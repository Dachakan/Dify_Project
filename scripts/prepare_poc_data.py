#!/usr/bin/env python3
"""
PoC用テストデータ変換スクリプト

入力:
  - Excel分析/output/月度別支払い内訳/final_output.json (333行、10-12月の支払明細)
  - output/master_items_initial.csv (87データ行、費目/工種/取引先マスタ)

出力:
  - output/poc_test_data.tsv   -- 支払明細82件（18列構成）
  - output/poc_vendors.tsv     -- 取引先マスタ（_M取引先シート用）
  - output/poc_budget.tsv      -- 実行予算テーブル（_実行予算テーブル用）

検証値:
  - 10月: 10,933,337円 / 11月: 8,458,604円 / 12月: 4,332,077円
"""
import json
import csv
import sys
from pathlib import Path
from collections import defaultdict, OrderedDict

# === パス設定 ===
BASE_DIR = Path(__file__).resolve().parent.parent
JSON_PATH = BASE_DIR.parent / "Excel分析" / "output" / "月度別支払い内訳" / "final_output.json"
CSV_PATH = BASE_DIR / "output" / "master_items_initial.csv"
OUTPUT_DIR = BASE_DIR / "output"

# 出力先
TSV_TEST_DATA = OUTPUT_DIR / "poc_test_data.tsv"
TSV_VENDORS = OUTPUT_DIR / "poc_vendors.tsv"
TSV_BUDGET = OUTPUT_DIR / "poc_budget.tsv"

# 検証値（税抜合計）
EXPECTED_TOTALS = {
    "10月度": 10_933_337,
    "11月度": 8_458_604,
    "12月度": 4_332_077,
}

# 月度ラベル→YYYY-MM変換（令和7年=2025年）
MONTH_MAP = {
    "10月度": "2025-10",
    "11月度": "2025-11",
    "12月度": "2025-12",
}

# === 経費コード→カテゴリ ===
def get_category(code_num):
    """JSON経費コード番号からカテゴリ名を判定"""
    if 10 <= code_num <= 19:
        return "直接工事費"
    elif 30 <= code_num <= 39:
        return "共通仮設費"
    elif 50 <= code_num <= 69:
        return "現場管理費"
    return "現場管理費"  # フォールバック


# === JSON経費コード→システム費目ID マッピング ===
# JSON(Excel現場コード体系)とCSV(国交省/図2-2体系)は番号が異なるため名前ベースでマッピング
EXPENSE_CODE_MAP = {
    # 直接工事費（10番台）→ expense_element (番号一致)
    11: ("E11", "材料費", ""),
    12: ("E12", "機械経費", ""),
    13: ("E13", "機械経費（損料）", ""),
    14: ("E14", "外注費", ""),
    15: ("E15", "労務費", ""),
    # 共通仮設費（30番台）→ expense_item (名前ベースマッピング)
    31: ("F32", "調査・準備費", ""),          # 準備費→調査・準備費
    32: ("F31", "運搬費", ""),                # 運搬費→運搬費
    33: ("F39", "営繕費", ""),                # 営繕費→営繕費
    34: ("F35", "安全対策費", ""),            # 安全費→安全対策費
    35: ("F36", "水道光熱費", ""),            # 動力用水光熱費→水道光熱費
    36: ("F38", "役務費", ""),                # 役務費→役務費
    37: ("F38", "役務費", "REVIEW: 技術管理費→役務費として暫定分類"),
    38: ("F34", "公害防止対策費", "REVIEW: 地元対策費→公害防止対策費として暫定分類"),
    39: ("F39", "営繕費", "REVIEW: 共通仮設雑費→営繕費として暫定分類"),
    # 現場管理費（50番台）→ expense_item (名前ベースマッピング)
    51: ("F51", "労務管理費", ""),
    52: ("F53", "租税公課", ""),
    53: ("F55", "保険料", ""),
    54: ("F56", "従業員給料手当", ""),
    55: ("F52", "法定福利費", ""),
    56: ("F59", "福利厚生費", ""),
    57: ("F60", "事務用品費", ""),
    58: ("F61", "旅費・交通費・通信費", ""),  # 通信交通費
    59: ("F67", "雑費", "REVIEW: 現場管理費/水道光熱費→雑費として暫定分類"),
    60: ("F67", "雑費", ""),                  # 雑費→雑費
}

# 経費項目未付与（小口購入分）の内訳→費目推定マップ
PETTY_CASH_MAP = {
    "トーチバーナー": ("F39", "営繕費", "共通仮設費"),
    "釘": ("E11", "材料費", "直接工事費"),
    "椅子": ("F39", "営繕費", "共通仮設費"),
    "水道材料": ("E11", "材料費", "直接工事費"),
    "掃除機": ("F67", "雑費", "現場管理費"),
    "お茶": ("F67", "雑費", "現場管理費"),
    "床材料": ("F39", "営繕費", "共通仮設費"),
    "電材": ("E11", "材料費", "直接工事費"),
    "マグネットクリップ": ("F60", "事務用品費", "現場管理費"),
}

# 表記揺れ正規化マップ
VENDOR_NORMALIZE = {
    "(有)濵畑水道": "(有)濱畑水道",
}


def parse_expense_code(expense_str):
    """経費項目文字列('14.外注費'形式)を解析してコード番号を返す"""
    if not expense_str:
        return None
    try:
        code_str = expense_str.split(".")[0].strip()
        return int(code_str)
    except (ValueError, IndexError):
        return None


def normalize_vendor(name):
    """業者名の表記揺れを正規化"""
    if not name:
        return ""
    name = str(name).strip()
    return VENDOR_NORMALIZE.get(name, name)


def infer_petty_expense(description):
    """内訳文字列から費目を推定（小口購入分用）"""
    if not description:
        return "F67", "雑費", "現場管理費", "REVIEW: 経費項目未付与"
    for keyword, (eid, ename, cat) in PETTY_CASH_MAP.items():
        if keyword in description:
            return eid, ename, cat, f"REVIEW: 内訳'{description}'から{ename}と推定"
    return "F67", "雑費", "現場管理費", f"REVIEW: 経費項目未付与（内訳: {description}）"


def build_budget_box_id(category, expense_id, work_type="", koushus=""):
    """予算箱IDを生成"""
    cat_code = {"直接工事費": "C01", "共通仮設費": "C02", "現場管理費": "C03"}.get(category, "C03")
    if category == "直接工事費":
        return f"{cat_code}-{work_type or 'W04'}-{koushus or 'K9901'}-{expense_id}"
    return f"{cat_code}-{expense_id}"


# === メイン処理 ===

def load_json():
    """final_output.jsonを読み込み"""
    if not JSON_PATH.exists():
        print(f"エラー: JSONファイルが見つかりません: {JSON_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_csv_master():
    """master_items_initial.csvを読み込み"""
    if not CSV_PATH.exists():
        print(f"エラー: CSVファイルが見つかりません: {CSV_PATH}", file=sys.stderr)
        sys.exit(1)
    master = {"expense_element": {}, "expense_item": {}, "koushus": {}, "work_type": {}, "vendor": {}}
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            t = row["type"]
            if t in master:
                master[t][row["id"]] = row
    return master


def generate_test_data(json_data):
    """支払明細82件のTSVデータを生成"""
    rows = []
    monthly_totals = defaultdict(int)
    review_comments = []
    seq = 0

    for month_key in ["10月度", "11月度", "12月度"]:
        month_data = json_data["data"].get(month_key)
        if not month_data:
            print(f"警告: {month_key}のデータが見つかりません", file=sys.stderr)
            continue

        year_month = MONTH_MAP[month_key]
        items = month_data.get("支払明細", [])

        for item in items:
            seq += 1
            vendor = normalize_vendor(item.get("支払先", ""))
            expense_str = item.get("経費項目")
            amount = item.get("支払金額_税抜")
            offset_amount = item.get("相殺", 0) or 0
            offset_target = item.get("相殺先", "") or ""
            description = item.get("内訳", "") or ""
            note = item.get("備考", "") or ""

            # 金額がnullの場合は0として処理（相殺のみの行）
            if amount is None:
                amount = 0
                if not note:
                    note = "金額なし（相殺のみ）"

            # 月別合計に加算
            monthly_totals[month_key] += amount

            # 経費コード解析
            code_num = parse_expense_code(expense_str)

            if code_num is not None and code_num in EXPENSE_CODE_MAP:
                expense_id, expense_name, comment = EXPENSE_CODE_MAP[code_num]
                category = get_category(code_num)
                if comment:
                    review_comments.append(f"行{seq}: {comment}")
                    if note:
                        note = f"{note} / {comment}"
                    else:
                        note = comment
            elif expense_str is None:
                # 経費項目未付与（小口購入分）
                expense_id, expense_name, category, comment = infer_petty_expense(description)
                review_comments.append(f"行{seq}: {comment}")
                if note:
                    note = f"{note} / {comment}"
                else:
                    note = comment
            else:
                # 未知の経費コード
                expense_id = "F67"
                expense_name = "雑費"
                category = "現場管理費"
                comment = f"REVIEW: 未知の経費コード '{expense_str}'"
                review_comments.append(f"行{seq}: {comment}")
                note = comment

            # 工事種別・工種（直接工事費のみ）
            if category == "直接工事費":
                work_type = "W04"    # 護岸・海岸工事（海潟漁港プロジェクト）
                koushus = "K9901"    # その他（JSONから特定不可）
            else:
                work_type = ""
                koushus = ""

            # 予算箱ID
            budget_box_id = build_budget_box_id(category, expense_id, work_type, koushus)

            # 課税区分・消費税・税込合計（自動計算列）
            tax_type = "課税" if amount > 0 else ""
            tax_amount = round(amount * 0.10) if amount > 0 else 0
            total_with_tax = amount + tax_amount

            # 備考に内訳を追加
            if description and not note:
                note = description
            elif description and description not in note:
                note = f"{description} / {note}"

            row = [
                seq,                # A: No.
                category,           # B: カテゴリ
                work_type,          # C: 工事種別
                koushus,            # D: 工種
                expense_id,         # E: 費目
                vendor,             # F: 支払先
                year_month,         # G: 支払年月
                1,                  # H: 数量
                "式",               # I: 単位
                amount,             # J: 単価
                amount,             # K: 金額
                offset_amount,      # L: 相殺額
                offset_target,      # M: 相殺先
                tax_type,           # N: 課税区分
                tax_amount,         # O: 消費税
                total_with_tax,     # P: 税込合計
                budget_box_id,      # Q: 予算箱ID
                note,               # R: 備考
            ]
            rows.append(row)

    return rows, monthly_totals, review_comments


def generate_vendors(json_data):
    """取引先マスタを生成"""
    # 全月から業者名を収集
    vendors = OrderedDict()
    for month_key in ["10月度", "11月度", "12月度"]:
        month_data = json_data["data"].get(month_key, {})
        for item in month_data.get("支払明細", []):
            name = normalize_vendor(item.get("支払先", ""))
            if name and name not in vendors:
                vendors[name] = None

    # 業者分類の推定
    subcontractors = {"川越建設(株)", "鹿児島仮設(株)", "菱和コンクリート(株)",
                      "(有)濱畑水道", "(株)コマロック", "環境保全建設(株)"}
    suppliers = {"桜島生コンクリート(株)", "(株)加根又本店", "(株)グリーンクロス",
                 "永瀬電業"}
    services = {"(株)現場サポート", "(株)シーティーエス", "(株)デザインアーク",
                "(有)大建測量設計", "JGS", "(株)勝利商会"}
    # 上記以外はretail

    rows = []
    for i, name in enumerate(vendors.keys(), start=1):
        vid = f"V{i:03d}"
        if name in subcontractors:
            vtype = "subcontractor"
        elif name in suppliers:
            vtype = "supplier"
        elif name in services:
            vtype = "service"
        else:
            vtype = "retail"
        rows.append([vid, name, vtype, "TRUE"])

    return rows


def generate_budget(json_data):
    """実行予算テーブルを生成（実績ベースで推定）"""
    # 費目別の3ヶ月実績を集計
    expense_totals = defaultdict(lambda: {"amount": 0, "category": "", "expense_id": "", "expense_name": ""})

    for month_key in ["10月度", "11月度", "12月度"]:
        month_data = json_data["data"].get(month_key, {})
        for item in month_data.get("支払明細", []):
            expense_str = item.get("経費項目")
            amount = item.get("支払金額_税抜") or 0
            code_num = parse_expense_code(expense_str)

            if code_num is not None and code_num in EXPENSE_CODE_MAP:
                expense_id, expense_name, _ = EXPENSE_CODE_MAP[code_num]
                category = get_category(code_num)
            elif expense_str is None:
                description = item.get("内訳", "") or ""
                expense_id, expense_name, category, _ = infer_petty_expense(description)
            else:
                expense_id = "F67"
                expense_name = "雑費"
                category = "現場管理費"

            key = expense_id
            expense_totals[key]["amount"] += amount
            expense_totals[key]["category"] = category
            expense_totals[key]["expense_id"] = expense_id
            expense_totals[key]["expense_name"] = expense_name

    # 実績の約2倍を予算額とする（3ヶ月実績 × 2 = 6ヶ月分の見込み）
    # 工期: 2025-10 ~ 2026-03（6ヶ月想定）
    rows = []
    for key in sorted(expense_totals.keys()):
        data = expense_totals[key]
        if data["amount"] == 0:
            continue
        category = data["category"]
        expense_id = data["expense_id"]

        if category == "直接工事費":
            work_type = "W04"
            koushus = "K9901"
        else:
            work_type = ""
            koushus = ""

        budget_box_id = build_budget_box_id(category, expense_id, work_type, koushus)
        # 予算額 = 3ヶ月実績 × 2（6ヶ月工期想定）、千円単位で切り上げ
        budget_amount = ((data["amount"] * 2) // 1000 + 1) * 1000

        rows.append([
            budget_box_id,      # budget_box_id
            category,           # category
            work_type,          # work_type
            koushus,            # koushus
            expense_id,         # expense_id
            data["expense_name"],  # expense_name
            budget_amount,      # budget_amount
            "2025-10",          # start_month
            "2026-03",          # end_month
        ])

    return rows


def validate_totals(monthly_totals):
    """月別合計の検証"""
    all_passed = True
    print("\n--- 月別合計 検証 ---")
    for month, expected in EXPECTED_TOTALS.items():
        actual = monthly_totals.get(month, 0)
        status = "passed" if actual == expected else "FAILED"
        if status == "FAILED":
            all_passed = False
        print(f"  {month}: 期待値={expected:>12,}  実績={actual:>12,}  [{status}]")
    return all_passed


def write_tsv(filepath, headers, rows):
    """TSVファイル書き出し"""
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)
    print(f"  出力: {filepath} ({len(rows)}行)")


def main():
    print("=== PoC用テストデータ変換 ===\n")

    # 1. 入力ファイル読み込み
    print("1. 入力ファイル読み込み")
    json_data = load_json()
    master = load_csv_master()
    print(f"  JSON: {JSON_PATH.name} (読み込み完了)")
    print(f"  CSV:  {CSV_PATH.name} (費目{len(master['expense_element'])}件, "
          f"工種{len(master['koushus'])}件, 取引先{len(master['vendor'])}件)")

    # 2. 支払明細データ生成
    print("\n2. 支払明細データ生成")
    test_rows, monthly_totals, review_comments = generate_test_data(json_data)
    print(f"  生成件数: {len(test_rows)}件")

    # 3. 月別合計検証
    if not validate_totals(monthly_totals):
        print("\n  検証失敗: 月別合計が不一致。出力を続行しますが確認してください。", file=sys.stderr)

    # 4. 取引先マスタ生成
    print("\n3. 取引先マスタ生成")
    vendor_rows = generate_vendors(json_data)
    print(f"  生成件数: {len(vendor_rows)}社")

    # 5. 実行予算テーブル生成
    print("\n4. 実行予算テーブル生成")
    budget_rows = generate_budget(json_data)
    print(f"  生成件数: {len(budget_rows)}行")
    total_budget = sum(r[6] for r in budget_rows)
    print(f"  予算合計: {total_budget:,}円")

    # 6. TSV出力
    print("\n5. TSV出力")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    test_headers = [
        "No.", "カテゴリ", "工事種別", "工種", "費目", "支払先",
        "支払年月", "数量", "単位", "単価", "金額",
        "相殺額", "相殺先",
        "課税区分", "消費税", "税込合計", "予算箱ID", "備考"
    ]
    write_tsv(TSV_TEST_DATA, test_headers, test_rows)

    vendor_headers = ["vendor_id", "vendor_name", "vendor_type", "active"]
    write_tsv(TSV_VENDORS, vendor_headers, vendor_rows)

    budget_headers = [
        "budget_box_id", "category", "work_type", "koushus",
        "expense_id", "expense_name", "budget_amount",
        "start_month", "end_month"
    ]
    write_tsv(TSV_BUDGET, budget_headers, budget_rows)

    # 7. 手動確認項目の出力
    if review_comments:
        print(f"\n6. 手動確認項目 ({len(review_comments)}件)")
        for comment in review_comments:
            print(f"  - {comment}")

    print("\n=== 完了 ===")


if __name__ == "__main__":
    main()
