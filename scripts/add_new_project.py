#!/usr/bin/env python3
"""
新規工事プロジェクト登録スクリプト

project_registry.json に新規工事を登録し、
環境構築に必要な操作チェックリストを出力する。

使用方法:
    python scripts/add_new_project.py \
        --project_id P005 \
        --project_name "境川河川改修2期" \
        --spreadsheet_url "https://docs.google.com/spreadsheets/d/xxxxx/edit" \
        --budget_total 185000000 \
        --start_date 2026-04-01 \
        --end_date 2027-03-31
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# パス設定
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
REGISTRY_PATH = PROJECT_DIR / "project_registry.json"
OUTPUT_DIR = PROJECT_DIR / "output"


def extract_spreadsheet_id(url: str) -> str:
    """Spreadsheet URLからIDを抽出する"""
    match = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
    if not match:
        print(f"エラー: Spreadsheet URLからIDを抽出できません: {url}", file=sys.stderr)
        print("  形式例: https://docs.google.com/spreadsheets/d/{ID}/edit", file=sys.stderr)
        sys.exit(1)
    return match.group(1)


def validate_project_id(project_id: str) -> None:
    """プロジェクトIDの形式を検証する"""
    if not re.match(r"^P\d{3,}$", project_id):
        print(f"エラー: project_idの形式が不正です: {project_id}", file=sys.stderr)
        print("  形式例: P001, P005, P100", file=sys.stderr)
        sys.exit(1)


def validate_date(date_str: str, label: str) -> str:
    """日付文字列の形式を検証する"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return date_str
    except ValueError:
        print(f"エラー: {label}の日付形式が不正です: {date_str}", file=sys.stderr)
        print("  形式例: 2026-04-01", file=sys.stderr)
        sys.exit(1)


def load_registry() -> dict:
    """project_registry.jsonを読み込む（存在しない場合は空で初期化）"""
    if REGISTRY_PATH.exists():
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"projects": [], "updated_at": ""}


def save_registry(registry: dict) -> None:
    """project_registry.jsonに保存する"""
    registry["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)
    # LF改行で再書き込み
    content = REGISTRY_PATH.read_text(encoding="utf-8")
    REGISTRY_PATH.write_text(content, encoding="utf-8", newline="")


def generate_checklist(project: dict) -> str:
    """操作チェックリストを生成する"""
    pid = project["project_id"]
    pname = project["project_name"]
    ssid = project["spreadsheet_id"]
    budget = project["budget_total"]
    start = project["start_date"]
    end = project["end_date"]

    budget_str = f"{budget:,}"

    lines = []
    lines.append(f"# 工事登録チェックリスト: {pid} {pname}")
    lines.append(f"")
    lines.append(f"作成日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"")
    lines.append(f"## 登録情報")
    lines.append(f"")
    lines.append(f"| 項目 | 値 |")
    lines.append(f"|------|-----|")
    lines.append(f"| プロジェクトID | {pid} |")
    lines.append(f"| 工事名 | {pname} |")
    lines.append(f"| Spreadsheet ID | {ssid} |")
    lines.append(f"| 実行予算額 | {budget_str}円 |")
    lines.append(f"| 工期開始 | {start} |")
    lines.append(f"| 工期終了 | {end} |")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"## Step 1: hub.gsの_M工事台帳にspreadsheet_idを登録")
    lines.append(f"")
    lines.append(f"- [ ] 1. 本社管理台帳スプレッドシートを開く")
    lines.append(f"- [ ] 2. _M工事台帳シートに移動")
    lines.append(f"- [ ] 3. 新しい行に以下の情報を入力:")
    lines.append(f"")
    lines.append(f"| 列 | 入力値 |")
    lines.append(f"|-----|--------|")
    lines.append(f"| project_id | {pid} |")
    lines.append(f"| project_name | {pname} |")
    lines.append(f"| spreadsheet_id | {ssid} |")
    lines.append(f"| budget_total | {budget_str} |")
    lines.append(f"| start_date | {start} |")
    lines.append(f"| end_date | {end} |")
    lines.append(f"| active | TRUE |")
    lines.append(f"")
    lines.append(f"- [ ] 4. 入力後、_M工事台帳シートに{pid}の行が追加されていることを確認")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"## Step 2: 現場SSのGASセットアップ")
    lines.append(f"")
    lines.append(f"- [ ] 5. 対象スプレッドシートを開く:")
    lines.append(f"  - URL: https://docs.google.com/spreadsheets/d/{ssid}/edit")
    lines.append(f"- [ ] 6. メニュー「拡張機能」->「Apps Script」でエディタを開く")
    lines.append(f"- [ ] 7. gas_templates/budget_management/ 配下の6ファイルをコピー:")
    lines.append(f"  - config.gs, template.gs, validation_extended.gs")
    lines.append(f"  - aggregation.gs, budget_health.gs, api.gs")
    lines.append(f"- [ ] 8. setup_project_data.gs をコピーして追加（初期データ投入用）")
    lines.append(f"- [ ] 9. Apps Scriptエディタで setupProjectData() を実行")
    lines.append(f"  - 初回実行時: Googleアカウントの認証許可が求められる -> 「許可」をクリック")
    lines.append(f"  - 成功時: 9シートが自動生成される")
    lines.append(f"- [ ] 10. setup_project_data.gs を削除（初期化完了後は不要）")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"## Step 3: 動作確認")
    lines.append(f"")
    lines.append(f"### 3-1. APIデプロイ")
    lines.append(f"")
    lines.append(f"- [ ] 11. Apps Script -> 「デプロイ」->「新しいデプロイ」")
    lines.append(f"  - 種類: ウェブアプリ")
    lines.append(f"  - 実行するユーザー: 自分")
    lines.append(f"  - アクセスできるユーザー: 全員（組織内）")
    lines.append(f"- [ ] 12. デプロイURLをメモ")
    lines.append(f"")
    lines.append(f"### 3-2. APIヘルスチェック（PowerShell）")
    lines.append(f"")
    lines.append(f"```powershell")
    lines.append(f"# mode=health で予算健康度を確認")
    lines.append(f'Invoke-WebRequest -Uri "{{DEPLOY_URL}}?mode=health&key={{API_KEY}}" | Select-Object -ExpandProperty Content')
    lines.append(f"```")
    lines.append(f"")
    lines.append(f"期待値: budget_total > 0 を含むJSONレスポンス")
    lines.append(f"")
    lines.append(f"```powershell")
    lines.append(f"# mode=summary で工事概要を確認")
    lines.append(f'Invoke-WebRequest -Uri "{{DEPLOY_URL}}?mode=summary&key={{API_KEY}}" | Select-Object -ExpandProperty Content')
    lines.append(f"```")
    lines.append(f"")
    lines.append(f"期待値: project_id={pid}、budget_total={budget_str} を含むJSON")
    lines.append(f"")
    lines.append(f"### 3-3. hub.gs横断確認（PowerShell）")
    lines.append(f"")
    lines.append(f"```powershell")
    lines.append(f"# 本社台帳から全工事一覧を取得")
    lines.append(f'Invoke-WebRequest -Uri "{{HUB_URL}}?mode=cross_health" | Select-Object -ExpandProperty Content')
    lines.append(f"```")
    lines.append(f"")
    lines.append(f"期待値: {pid}が一覧に含まれ、budget_total > 0 であること")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"## Step 4: Dify DSLインポート（任意）")
    lines.append(f"")
    lines.append(f"Dify Cloudと連携する場合、以下を実施:")
    lines.append(f"")
    lines.append(f"- [ ] 13. Dify Cloud（cloud.dify.ai）にログイン")
    lines.append(f"- [ ] 14. 「スタジオ」->「DSLファイルからインポート」")
    lines.append(f"- [ ] 15. dsl/generated/budget_inquiry_chatbot.yml をアップロード")
    lines.append(f"- [ ] 16. 環境変数を設定（設定 -> 環境変数）:")
    lines.append(f"  - GAS_HUB_URL: hub.gsのWebアプリURL")
    lines.append(f"  - GAS_ENDPOINT_URL: api.gsのWebアプリURL")
    lines.append(f'- [ ] 17. 動作確認: 「{pid}の今月の状況を教えてください」と入力')
    lines.append(f"  - 期待値: 消化率/出来高率/信号を含む日本語レポート")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"以上で {pid} {pname} の登録が完了です。")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="新規工事プロジェクトをproject_registry.jsonに登録する"
    )
    parser.add_argument(
        "--project_id",
        required=True,
        help="プロジェクトID（例: P005）"
    )
    parser.add_argument(
        "--project_name",
        required=True,
        help="工事名（例: 境川河川改修2期）"
    )
    parser.add_argument(
        "--spreadsheet_url",
        required=True,
        help="Google Spreadsheet URL"
    )
    parser.add_argument(
        "--budget_total",
        required=True,
        type=int,
        help="実行予算額（例: 185000000）"
    )
    parser.add_argument(
        "--start_date",
        required=True,
        help="工期開始日（例: 2026-04-01）"
    )
    parser.add_argument(
        "--end_date",
        required=True,
        help="工期終了日（例: 2027-03-31）"
    )

    args = parser.parse_args()

    # 入力検証
    validate_project_id(args.project_id)
    validate_date(args.start_date, "start_date")
    validate_date(args.end_date, "end_date")
    spreadsheet_id = extract_spreadsheet_id(args.spreadsheet_url)

    print(f"=== 新規工事プロジェクト登録 ===\n")
    print(f"プロジェクトID: {args.project_id}")
    print(f"工事名: {args.project_name}")
    print(f"Spreadsheet ID: {spreadsheet_id}")
    print(f"実行予算額: {args.budget_total:,}円")
    print(f"工期: {args.start_date} ~ {args.end_date}")
    print("-" * 50)

    # レジストリ読み込み
    registry = load_registry()

    # 重複チェック
    existing_ids = [p["project_id"] for p in registry["projects"]]
    if args.project_id in existing_ids:
        print(f"\nエラー: project_id '{args.project_id}' は既に登録済みです。", file=sys.stderr)
        print("既存プロジェクト一覧:", file=sys.stderr)
        for p in registry["projects"]:
            print(f"  {p['project_id']}: {p['project_name']}", file=sys.stderr)
        sys.exit(1)

    # 新規プロジェクト情報
    project = {
        "project_id": args.project_id,
        "project_name": args.project_name,
        "spreadsheet_id": spreadsheet_id,
        "spreadsheet_url": args.spreadsheet_url,
        "budget_total": args.budget_total,
        "start_date": args.start_date,
        "end_date": args.end_date,
        "registered_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    # レジストリに追加して保存
    registry["projects"].append(project)
    save_registry(registry)
    print(f"\nproject_registry.json に登録完了")
    print(f"  ファイル: {REGISTRY_PATH}")
    print(f"  登録数: {len(registry['projects'])}件")

    # チェックリスト生成
    checklist = generate_checklist(project)

    # 標準出力に表示
    print("\n" + "=" * 60)
    print(checklist)
    print("=" * 60)

    # ファイルに保存
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now().strftime("%Y%m%d")
    checklist_path = OUTPUT_DIR / f"checklist_{args.project_id}_{date_str}.txt"
    checklist_path.write_text(checklist, encoding="utf-8")
    print(f"\nチェックリスト保存先: {checklist_path}")

    print("\n=== 完了 ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
