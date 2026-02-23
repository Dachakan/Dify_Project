# 森組 工事予算管理システム

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [システム構成](#2-システム構成)
3. [ファイル構成](#3-ファイル構成)
4. [環境セットアップ（初回）](#4-環境セットアップ初回)
5. [新工事追加手順](#5-新工事追加手順)
6. [デモ手順](#6-デモ手順)
7. [運用・メンテナンス](#7-運用メンテナンス)

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| クライアント | (株)森組（土木工事業） |
| 目的 | 工事予算の予実管理・月次集計・本社横断ダッシュボード |
| 技術構成 | Google Apps Script (GAS) + Dify Cloud + Dify DSL (YAML v0.1.2) |
| 本番稼働日 | 2026-02-22 |
| 管理工事数 | 4工事（P001〜P004） |

### 主な機能

- 現場スプレッドシートで支払明細を入力（18列、緑/青/灰のゾーン分け）
- 費目別・工種別で月次集計・スナップショット保存
- 消化率・出来高率・予算信号（青/黄/赤）を自動算出
- 本社台帳（hub.gs）で複数現場を横断管理
- Dify Cloud チャットボットで自然言語による予実照会
- Dify Cloud ワークフローで月次レポートを自動生成

---

## 2. システム構成

### データフロー

```
現場スプレッドシート（支払明細入力）
    |
    v
aggregation.gs（月次集計）
    |
    v
budget_health.gs（消化率 / 出来高率 / 予算信号算出）
    |
    v
api.gs（GAS Web App API）
    |
    v
Dify Cloud（チャットボット / レポートワークフロー）
    |
    v
hub.gs（本社台帳 - 複数現場横断集計）
```

### デプロイ済み Dify アプリ

| アプリ名 | App ID | DSLファイル | 用途 |
|---------|--------|------------|------|
| 予実照会チャットボット | dcaca55b-0586-43b3-acaa-10189b624974 | dsl/generated/budget_inquiry_chatbot.yml | advanced-chat形式。工事ID指定で消化率/出来高率/信号を照会 |
| 月次予算管理レポート | c4445a51-fe3f-4fa4-b252-dd72bb20e0da | dsl/generated/monthly_report_workflow.yml | workflow形式。year_month指定で5セクション構成Markdownレポート生成 |

### GAS Web App URL

| 用途 | URL |
|------|-----|
| 現場API（api.gs） | `https://script.google.com/macros/s/AKfycbyMhtCFlRxe6T_qtAzKbllaq99uHdvgHfqwyKmJs_6vgs5wlNWXxRkSZESMw6SW2fRYcg/exec` |
| 本社台帳（hub.gs） | `https://script.google.com/macros/s/AKfycbygy0ZX_cTbzxMgB8D-reGtIsGkQelzf_3M1iKgZM-rkPLPss2g_d4VpG0W9frGE-xs/exec` |

---

## 3. ファイル構成

```
Dify_project/
├── README.md                          # 本ファイル
├── CLAUDE.md                          # Claude Code 向け実装ガイド
├── .gitignore
├── .claude/skills/
│   ├── dify-dsl-generator/            # DSL自動生成スキル（530行）
│   ├── gas-webapp-generator/          # GAS生成スキル
│   └── refresh-dify-token/            # Difyトークン更新スキル
├── dsl/
│   ├── templates/                     # 40テンプレート（リファレンス保持）
│   ├── exported/                      # エクスポートDSL（手動運用、次回取得で森組DSLが入る）
│   └── generated/
│       ├── budget_inquiry_chatbot.yml  # 予実照会チャットボット（本番デプロイ済み）
│       └── monthly_report_workflow.yml # 月次レポートワークフロー（本番デプロイ済み）
├── gas_templates/
│   └── budget_management/             # GAS本体 11ファイル
│       ├── config.gs                  # シート保護/メニュー/定数（434行）
│       ├── budget_health.gs           # 消化率/出来高率/信号算出（617行）
│       ├── template.gs                # テンプレート生成（1125行）
│       ├── validation_extended.gs     # カスケードDD/数量制御（466行）
│       ├── aggregation.gs             # 月次集計/スナップショット（539行）
│       ├── api.gs                     # Web App API（717行）
│       ├── hub.gs                     # 本社管理台帳（573行）
│       ├── setup_project_data.gs      # 現場SS初期データ投入
│       ├── setup_demo_sites.gs        # デモ用SS作成（P002/P003）
│       ├── setup_hub_registry.gs      # _M工事台帳セットアップ（163行）
│       └── appsscript.json            # GASプロジェクト設定
├── output/                            # PoC成果物（15ファイル + スクショ7枚）
│   ├── poc_test_data.tsv              # 支払明細テストデータ82件
│   ├── poc_vendors.tsv                # 取引先マスタ
│   ├── poc_budget.tsv                 # 実行予算13行
│   ├── demo_scenario.md              # デモシナリオ
│   └── ...
└── scripts/
    ├── add_new_project.py             # 新工事登録スクリプト（再現性の核心）
    ├── export_dify_workflows.py       # Dify DSLエクスポート
    ├── prepare_poc_data.py            # PoCテストデータ生成
    └── README.md                      # スクリプト利用ガイド
```

---

## 4. 環境セットアップ（初回）

### 前提条件

- Google アカウント（スプレッドシート・Apps Script）
- Dify Cloud アカウント
- Python 3.11+（スクリプト実行用）

### Step 1: 本社台帳スプレッドシート作成

1. Google スプレッドシートを新規作成（名前例: 森組_工事管理台帳）
2. 拡張機能 > Apps Script を開く
3. `gas_templates/budget_management/hub.gs` の内容を貼付
4. `gas_templates/budget_management/setup_hub_registry.gs` の内容を貼付（別ファイルとして追加）
5. `appsscript.json` の内容も貼付（マニフェスト設定）
6. `initHubData()` 関数を実行（シート雛形を自動作成）
7. `setupHubRegistry()` 関数を実行（_M工事台帳シートに工事データを投入）
8. Web App としてデプロイ（実行者: 自分、アクセス: 全員）

### Step 2: Dify Cloud で DSL インポート

1. Dify Cloud にログイン
2. 「アプリを作成」>「DSLファイルをインポート」
3. `dsl/generated/budget_inquiry_chatbot.yml` をインポート
4. 同様に `dsl/generated/monthly_report_workflow.yml` をインポート

### Step 3: Dify 環境変数に GAS_HUB_URL を設定

両アプリの設定画面で環境変数を追加:

| キー | 値 |
|------|----|
| GAS_HUB_URL | Step 1 でデプロイした hub.gs の Web App URL |

---

## 5. 新工事追加手順

### スクリプト実行

```bash
python scripts/add_new_project.py \
    --project_id P005 \
    --project_name "境川河川改修2期" \
    --spreadsheet_url "https://docs.google.com/spreadsheets/d/XXXX/edit" \
    --budget_total 185000000 \
    --start_date 2026-04-01 \
    --end_date 2027-03-31
```

| 引数 | 説明 | 例 |
|------|------|----|
| --project_id | 工事ID（P + 3桁以上の数字） | P005 |
| --project_name | 工事名 | 境川河川改修2期 |
| --spreadsheet_url | 現場SSのURL | https://docs.google.com/... |
| --budget_total | 実行予算総額（円） | 185000000 |
| --start_date | 工期開始日（YYYY-MM-DD） | 2026-04-01 |
| --end_date | 工期完了日（YYYY-MM-DD） | 2027-03-31 |

### 実行後のチェックリスト

スクリプトが出力するチェックリストに従って以下を実施:

1. **現場SS に GAS 6ファイルを貼付・デプロイ**
   - `config.gs` / `budget_health.gs` / `template.gs` / `validation_extended.gs` / `aggregation.gs` / `api.gs`
   - Web App としてデプロイ（実行者: 自分、アクセス: 全員）

2. **hub.gs の `_C_スプレッドシート一覧` に SSID を登録**
   - 本社台帳SSの `_C_スプレッドシート一覧` シートを開く
   - 新工事の SSID（スプレッドシートURL から取得）を追記

3. **疎通確認**
   ```
   hub.gs の mode=cross_health にアクセスして新工事が認識されることを確認
   ```

---

## 6. デモ手順

詳細は `output/demo_scenario.md` を参照。

### 概要

| ステップ | 内容 |
|---------|------|
| 1 | `setup_demo_sites.gs` でデモ用SS（P002/P003）を自動作成 |
| 2 | `setup_hub_registry.gs` で _M工事台帳シートを作成（4工事データ投入） |
| 3 | hub.gs の mode=cross_health で API 疎通確認 |
| 4 | Dify チャットボットで工事IDを指定して予実照会 |
| 5 | Dify ワークフローで year_month 指定して月次レポート生成 |

---

## 7. 運用・メンテナンス

### Dify トークン更新（30日ごと）

```bash
# Claude Code のスキルで更新
@refresh-dify-token
```

### DSL エクスポート（バックアップ）

```bash
export DIFY_REFRESH_TOKEN="your_token_here"
python scripts/export_dify_workflows.py
# dsl/exported/ に保存される
```

### トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| Dify で「未接続」と表示 | hub.gs の `_C_スプレッドシート一覧` に SSID 未登録 | 該当工事の SSID を登録 |
| API 呼び出しが失敗する | GAS トークン期限切れ / Web App 未デプロイ | `@refresh-dify-token` 実行 / GAS 再デプロイ |
| 集計値が 0 になる | `aggregation.gs` の月次集計未実行 | 対象月の月次集計を手動実行 |
| 工事が認識されない | _M工事台帳 に工事行が未登録 | `setup_hub_registry.gs` を実行、または _M工事台帳 に手動で行追加 |

### GAS ファイル更新時の注意

- `api.gs` と `hub.gs` は両方 `doGet()` を持つため、**同一 GAS プロジェクトに配置不可**
- 現場SS 用: `config` / `template` / `validation_extended` / `aggregation` / `budget_health` / `api` の 6 ファイル
- 本社台帳SS 用: `hub.gs` のみ（別スプレッドシートにバインド）
