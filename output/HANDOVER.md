# 森組 工事予算管理システム x Dify Cloud連携 -- 引継ぎドキュメント

---

| 項目 | 内容 |
|------|------|
| 文書バージョン | 1.0 |
| 作成日 | 2026-02-23 |
| 作成者 | Claude Code (Opus 4.6) |
| 対象プロジェクト | Dify_project（森組 工事予算管理システム） |
| リポジトリ | claude-thinking-clone-main/Dify_project/ |
| 開発期間 | 2025-12-24 ~ 2026-02-23（約2ヶ月） |
| ステータス | Phase K 完了、本番稼働中 |

---

## 読者前提

本ドキュメントは以下の読者を想定している。

| 読者 | 前提知識 | 本ドキュメントの活用法 |
|------|---------|---------------------|
| 後任エンジニア | GAS / HTML / JavaScript / YAML の基礎知識 | 第1-7章でシステム全体像を把握し、第11章で運用手順を習得 |
| プロジェクトマネージャー | IT システム管理の基礎知識 | 第1章のサマリーと第15章の残課題を確認 |
| クライアント（森組） | スプレッドシート操作の基礎 | 第11章のデプロイ・運用ガイドを参照 |

## 読み方ガイド

- **急いでいる人**: 第1章「エグゼクティブサマリー」を読めば全体像がわかる
- **開発を引き継ぐ人**: 第2-7章を通読し、第10章「APIリファレンス」を手元に置く
- **運用を引き継ぐ人**: 第11章「デプロイ・運用ガイド」から始める
- **設計判断を理解したい人**: 第3章「設計判断とその根拠」と第8章「認証デバッグ物語」

---

# 第1章 エグゼクティブサマリー

## 1.1 プロジェクト概要

| 項目 | 内容 |
|------|------|
| クライアント | (株)森組（土木工事業、鹿児島県） |
| システム名 | 工事予算管理システム |
| 目的 | 工事現場の予実管理をスプレッドシート+GASで自動化し、Dify Cloudの AIチャットボットで自然言語照会を実現 |
| 技術スタック | Google Sheets + GAS + Dify Cloud + Python |
| 開発手法 | バイブコーディング（自然言語からDSL自動生成） |
| 開発期間 | 2025-12-24 ~ 2026-02-23（約2ヶ月、32コミット） |

## 1.2 成果物一覧

### GAS（Google Apps Script）-- 14ファイル、6,976行

| ファイル | 行数 | 役割 |
|---------|------|------|
| config.gs | 434 | シート保護、メニュー、定数、入力期限アラート |
| budget_health.gs | 621 | 予実管理計算（消化率/出来高率/信号判定） |
| template.gs | 1,127 | プロジェクト初期化、マスタデータ、シート作成 |
| validation_extended.gs | 466 | カスケードドロップダウン、入力バリデーション |
| aggregation.gs | 543 | 月次集計、費目別集計、スナップショット |
| api.gs | 943 | 現場SS用 Web App API（6モード） |
| hub.gs | 644 | 本社管理台帳（複数現場横断、5モード） |
| setup_hub_registry.gs | 163 | _M工事台帳シート作成 |
| setup_demo_sites.gs | 199 | デモ現場SS自動作成 |
| setup_project_data.gs | 304 | PoCデータ投入 |
| dashboard.html | 1,484 | 本社横断ダッシュボード HTML本体 |
| dashboard_css.html | 131 | ダッシュボード CSS |
| dashboard_js.html | 916 | ダッシュボード JavaScript |
| appsscript.json | 1 | GASプロジェクト設定 |

### Dify Cloud -- 3アプリ（本番稼働中）

| アプリ名 | 形式 | App ID | DSLファイル |
|---------|------|--------|------------|
| 予実照会チャットボット | advanced-chat | dcaca55b-... | budget_inquiry_chatbot.dsl (288行) |
| 月次予算管理レポート | workflow | c4445a51-... | monthly_report_workflow.dsl (347行) |
| 本社向け経営分析チャットボット | advanced-chat | 1ec5e80b-... | executive_report_chatbot.dsl (402行) |

### Python スクリプト -- 3本、1,028行

| スクリプト | 行数 | 用途 |
|-----------|------|------|
| add_new_project.py | 304 | 新規工事プロジェクト登録 |
| export_dify_workflows.py | 251 | Dify Cloud DSLエクスポート |
| prepare_poc_data.py | 473 | PoCテストデータ生成 |

### ドキュメント -- output/ 配下21ファイル

| 分類 | ファイル数 | 代表ファイル |
|------|----------|------------|
| 提案フェーズ | 3 | proposal_package.md, system_design_proposal.md |
| 実装フェーズ | 3 | poc_deployment_guide.md, poc_execution_playbook.md |
| 検証フェーズ | 5 | design_review_v2.md, demo_scenario.md |
| データ | 3 | poc_test_data.tsv, poc_budget.tsv, poc_vendors.tsv |
| UI | 4 | mockup_sheets.html, mockup_sites.html, manual_*.html |
| 画像 | 2 | dify_chatbot_overview.png, gas_editor_check.png |
| スクリーンショット | 7 | output/screenshots/ss1-ss7.png |

### DSLテンプレート -- 38ファイル

```
dsl/templates/
  agent/      -- 16テンプレート
  chatbot/    -- 5テンプレート
  chatflow/   -- 5テンプレート（推定）
  completion/ -- 6テンプレート（推定）
  workflow/   -- 6テンプレート（推定）
```

## 1.3 本番環境情報

### URL・エンドポイント

| 用途 | URL |
|------|-----|
| GAS HUB Web App | `https://script.google.com/macros/s/AKfycbygy0ZX_cTbzxMgB8D-reGtIsGkQelzf_3M1iKgZM-rkPLPss2g_d4VpG0W9frGE-xs/exec` |
| GAS API Web App | `https://script.google.com/macros/s/AKfycbyMhtCFlRxe6T_qtAzKbllaq99uHdvgHfqwyKmJs_6vgs5wlNWXxRkSZESMw6SW2fRYcg/exec` |
| ダッシュボード | HUB URLにパラメータなしでアクセス |
| 所長向けDifyチャット | `https://udify.app/chatbot/8JW4EA9aJiBnEW1R` |
| 本社向けDifyチャット | `https://udify.app/chatbot/eT6LUMaOglFVq4ug` |

### スプレッドシート

| 用途 | SS名 | SS ID |
|------|------|-------|
| 本社管理台帳 | 森組_工事管理台帳 | 1F_CvQj5... |
| 工事レジストリ | _M工事台帳シート（上記SS内） | -- |

### Dify Cloud環境変数

| 変数名 | 設定先 | 値 |
|--------|--------|-----|
| GAS_HUB_URL | 3アプリ共通 | HUB Web App URL |

## 1.4 開発フェーズ総括

| Phase | 期間 | 主要成果 |
|-------|------|---------|
| Phase 0 | 2025-12-24 ~ 2026-02-19 | Dify認証デバッグ、DSLテンプレート収集、基盤設計 |
| Phase A | 2026-02-19 | GAS 6ファイル実装（config/template/validation/aggregation/budget_health/api） |
| Phase B-C | 2026-02-19 ~ 02-20 | 設計レビュー17件対応、マスタ一元化、匿名化機能 |
| Phase D-F | 2026-02-22 | PoC環境構築、Dify DSL 2本生成、デモ資料完成 |
| Phase G | 2026-02-22 | ダッシュボード本物化（API連携）、デモSS作成 |
| Phase H | 2026-02-23 | _M工事台帳正式セットアップ、API疎通完了 |
| Phase I | 2026-02-23 | サイドバー・サマリーAPI動的化 |
| Phase J | 2026-02-23 | HtmlService化（dashboard 3ファイル分離） |
| Phase K | 2026-02-23 | 本社向けチャットボット追加、GAS再デプロイ完了 |

---

# 第2章 アーキテクチャ全体像

## 2.1 5層構造

```
+------------------------------------------------------------------+
|  Layer 5: AI対話層（Dify Cloud）                                  |
|  +------------------+ +------------------+ +------------------+  |
|  | 予実照会         | | 月次レポート     | | 経営分析         |  |
|  | チャットボット   | | ワークフロー     | | チャットボット   |  |
|  | (advanced-chat)  | | (workflow)       | | (advanced-chat)  |  |
|  +--------+---------+ +--------+---------+ +--------+---------+  |
|           |                    |                    |            |
+-----------+--------------------+--------------------+------------+
            |                    |                    |
            v                    v                    v
+------------------------------------------------------------------+
|  Layer 4: API Gateway層（GAS Web App）                           |
|  +---------------------------+ +-------------------------------+ |
|  | hub.gs (本社用)            | | api.gs (現場用)               | |
|  | mode: projects_all         | | mode: health                  | |
|  |       cross_summary        | |       master                  | |
|  |       cross_health         | |       summary                 | |
|  |       project_detail       | |       project                 | |
|  |       dashboard            | |       aggregate               | |
|  +-------------+-------------+ |       dashboard               | |
|                |                +---------------+---------------+ |
+----------------+--------------------------------+----------------+
                 |                                |
                 v                                v
+------------------------------------------------------------------+
|  Layer 3: ダッシュボード層（HtmlService）                        |
|  +------------------------------------------------------------+  |
|  | dashboard.html (1,484行) -- 7ページ構成                     |  |
|  |   page0: 全現場サマリー（経営者ビュー）                     |  |
|  |   page1: 工事予実管理KPI（所長ビュー）                      |  |
|  |   page2: 経営分析 予算vs実績（所長ビュー）                  |  |
|  |   page3: 現場管理 費目・業者・推移（所長ビュー）            |  |
|  |   page3.5: 予算ヘルスチェック（所長ビュー）                 |  |
|  |   page4: AIチャット 2パネル（共通）                         |  |
|  |   page5-7: 全社経営概況・パフォーマンス・改善（経営者）     |  |
|  | dashboard_css.html (131行) -- Tailwind + カスタムCSS         |  |
|  | dashboard_js.html (916行) -- google.script.run + Chart.js   |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                 |
                 v
+------------------------------------------------------------------+
|  Layer 2: ビジネスロジック層（GAS）                              |
|  +----------------+ +-------------------+ +-------------------+  |
|  | config.gs      | | budget_health.gs  | | aggregation.gs    |  |
|  | 設定・保護     | | 予実計算          | | 月次集計          |  |
|  +----------------+ +-------------------+ +-------------------+  |
|  +----------------+ +-------------------+                        |
|  | template.gs    | | validation_       |                        |
|  | 初期化・マスタ | | extended.gs       |                        |
|  +----------------+ | 入力検証          |                        |
|                     +-------------------+                        |
+------------------------------------------------------------------+
                 |
                 v
+------------------------------------------------------------------+
|  Layer 1: データ層（Google Sheets）                              |
|  +-----------------------------+ +-----------------------------+ |
|  | 現場SS（工事ごとに1つ）     | | 本社管理台帳SS              | |
|  | _Mマスタ                    | | _M工事台帳（13列）          | |
|  | _M取引先                    | | _C_スプレッドシート一覧     | |
|  | _実行予算テーブル           | |                             | |
|  | _実行予算_月別              | |                             | |
|  | 支払明細入力                | |                             | |
|  | 支払明細                    | |                             | |
|  | _C_予算健康度               | |                             | |
|  | _C_月次集計                 | |                             | |
|  | _C_費目別集計               | |                             | |
|  | _月次調整                   | |                             | |
|  +-----------------------------+ +-----------------------------+ |
+------------------------------------------------------------------+
```

## 2.2 データフロー

```
所長（現場）                      事務員                    本社（経営層）
    |                              |                           |
    v                              v                           v
[支払明細入力シート]         [相殺額・相殺先追記]      [ダッシュボード閲覧]
  A-K列（緑）                  L-M列（青）               hub.gs → dashboard.html
    |                              |                           |
    +------------ N-R列（灰）自動計算 -----------+             |
    |  課税区分 / 消費税 / 税込合計 / 予算箱ID    |             |
    +---------------------------------------------+             |
                        |                                       |
                        v                                       |
              [aggregation.gs]                                  |
              月次集計 → _C_月次集計                             |
              費目別集計 → _C_費目別集計                         |
                        |                                       |
                        v                                       |
              [budget_health.gs]                                |
              消化率 = AC / BAC * 100                            |
              出来高率 = 手動入力 or 自動算出                    |
              GAP = 消化率 - 出来高率                            |
              信号 = GAP<=5:正常 / 5<GAP<=15:注意 / GAP>15:超過 |
              結果 → _C_予算健康度                               |
                        |                                       |
                        v                                       v
              [api.gs Web App]                        [hub.gs Web App]
              現場単位のJSON API                      全現場横断JSON API
                        |                                       |
                        +----------------+----------------------+
                                         |
                                         v
                              [Dify Cloud 3アプリ]
                              HTTP Request → GAS API
                              LLM → 自然言語回答
                                         |
                                         v
                              [ダッシュボード page4]
                              iframe 2パネル
                              所長向け / 本社向け
```

## 2.3 スプレッドシート構成

### 現場SS（工事ごとに1つ）

| シート名 | 用途 | 入力者 |
|---------|------|--------|
| _Mマスタ | 費目/工種/費用要素のマスタデータ | 自動生成 |
| _M取引先 | 取引先（業者）マスタ | 事務員 |
| _実行予算テーブル | 工種x費目の予算配分 | 所長 |
| _実行予算_月別 | PV（計画値）の月別配分 | 所長 |
| 支払明細入力 | 支払データ入力（18列） | 所長+事務員 |
| 支払明細 | 支払データ確定版 | 自動転記 |
| _C_予算健康度 | BAC/PV/AC/消化率/出来高率/信号 | 自動計算 |
| _C_月次集計 | 月別xカテゴリの集計 | 自動計算 |
| _C_費目別集計 | 予算箱単位の消化状況 | 自動計算 |
| _月次調整 | 出来高率の手動入力 | 所長 |

### 本社管理台帳SS

| シート名 | 用途 | 列数 |
|---------|------|------|
| _M工事台帳 | 全工事の登録情報（正本） | 13列 |
| _C_スプレッドシート一覧 | 各現場SSのID管理 | -- |

### _M工事台帳 列定義（13列）

| 列 | フィールド名 | 型 | 説明 |
|----|------------|-----|------|
| A | project_id | string | 工事ID（P001, P002, ...） |
| B | project_name | string | 工事名 |
| C | manager_name | string | 現場所長名 |
| D | contract_amount | number | 請負金額 |
| E | start_date | date | 工期開始日 |
| F | end_date | date | 工期終了日 |
| G | project_type | string | 工事種別 |
| H | client | string | 発注者 |
| I | memo | string | 備考 |
| J | spreadsheet_id | string | 現場SSのID |
| K | target_profit_rate | number | 目標粗利率 |
| L | gas_webapp_url | string | 現場GAS Web App URL |
| M | status | string | active / completed |

## 2.4 デプロイ構成

```
[GASプロジェクト 1: 現場SS用]
  ファイル: config.gs, template.gs, validation_extended.gs,
           aggregation.gs, budget_health.gs, api.gs,
           setup_project_data.gs
  デプロイ: Web App（api.gs の doGet が受け口）
  バインド先: 各現場SS

[GASプロジェクト 2: 本社管理台帳SS用]
  ファイル: hub.gs, setup_hub_registry.gs, setup_demo_sites.gs,
           dashboard.html, dashboard_css.html, dashboard_js.html,
           appsscript.json
  デプロイ: Web App（hub.gs の doGet が受け口）
  バインド先: 森組_工事管理台帳SS
  注意: 複数デプロイが存在（「無題」デプロイがHUB URL用）

[Dify Cloud]
  3アプリ: 環境変数 GAS_HUB_URL に HUB Web App URL を設定
  認証: なし（GAS側もAPIキー不要で公開）
```

**重要**: api.gs と hub.gs は両方 `doGet()` を持つため、同一GASプロジェクトに配置不可。必ず別のスプレッドシートにバインドすること。

---

# 第3章 設計判断とその根拠

## 3.1 EVM（正式）から予実管理ベースへの転換

### 判断

正式なEVM（アーンドバリューマネジメント）の導入を見送り、消化率/出来高率ベースの簡易予実管理に転換した。

### 根拠

| 観点 | EVM（正式） | 予実管理ベース（採用） |
|------|-----------|---------------------|
| 対象規模 | 数億円以上の大型プロジェクト | 4千万円規模の土木工事に適合 |
| 必要データ | CPI/SPI/EAC等の算出に精密なWBS | 消化率と出来高率の2指標で十分 |
| 運用負荷 | 高（WBS更新・EV算出が常時必要） | 低（月次の支払入力と進捗率入力のみ） |
| 現場理解度 | 専門用語が多く現場に浸透しにくい | 「使った額/予算」「進み具合」で直感的 |

### 実装への影響

- `budget_health.gs` の指標は BAC/PV/AC の3値だが、算出ロジックは簡易版
- EVM用語（SPI, CPI, EAC）はコード内に残存しない
- 信号判定: GAP = 消化率 - 出来高率 で判定（5pt/15ptの閾値）

## 3.2 建築と土木の費目コード混同の回避

### 判断

費目コードは「土木工事の積算体系」に厳密に準拠し、建築の費目コードを混入させない。

### 根拠

| 費目区分 | 土木（採用） | 建築（不採用） |
|---------|------------|--------------|
| 直接工事費 | C01: 材料費(E11), 機械経費(E12,E13), 外注費(E14), 労務費(E15) | 直接仮設/躯体/仕上等 |
| 共通仮設費 | C02: F31-F39 の9項目 | 仮設計画が異なる |
| 現場管理費 | C03: F51-F67 の17項目 | 管理費の内訳が異なる |

### 実装への影響

- `template.gs` の `getDefaultExpenseItems_()` で26費目をシード
- `validation_extended.gs` の `filterExpenseByCategory_()` でカテゴリ別にフィルタ
- 費目コード体系: E11-E15（費用要素）、F31-F39（共通仮設）、F51-F67（現場管理）

## 3.3 doGet() 分離（api.gs と hub.gs）

### 判断

現場用API（api.gs）と本社横断API（hub.gs）を別GASプロジェクトに分離した。

### 根拠

GASの仕様として、1プロジェクトに `doGet()` は1つしか定義できない。同一プロジェクトに2つの `doGet()` を置くと後勝ちとなり、予期しない動作になる。

### 設計パターン

```
現場SS（工事ごと）                本社管理台帳SS
  api.gs の doGet(e)                hub.gs の doGet(e)
    mode=health                       mode=projects_all
    mode=master                       mode=cross_summary
    mode=summary                      mode=cross_health
    mode=project                      mode=project_detail
    mode=aggregate                    mode=dashboard
    mode=dashboard
```

hub.gs は内部で各現場SSを `SpreadsheetApp.openById()` で開き、データを集約する。

## 3.4 DSLバージョン 0.1.2 の固定

### 判断

Dify DSLのバージョンを `0.1.2` に固定し、`0.5.0` を禁止した。

### 根拠

Dify Cloud（SaaS版）が受け付けるDSLバージョンは `0.1.2` のみ。`0.5.0` はOSS版（セルフホスト）向けであり、Cloud版にインポートするとエラーになる。この制約はQiita記事（yuto-ida-stb）で詳述されている。

### 実装への影響

- 全DSLファイルの先頭: `version: '0.1.2'`
- ノードID: 数字文字列形式（`'1000000001'`）、文字列ID禁止
- 変数参照: `{{#id.variable#}}` 形式（Jinja2形式禁止）
- Edge必須フィールド: `isInIteration`, `isInLoop`, `zIndex`

## 3.5 マスタデータの一元化（_Mマスタシート）

### 判断

費目・工種・費用要素のマスタデータを `_Mマスタ` シートに一元化し、api.gs はシートから動的に読み込む。

### 根拠

| 方式 | メリット | デメリット |
|------|---------|----------|
| コード内ハードコード | 変更時にデプロイ必要 | コード肥大化、複数箇所の同期必要 |
| シート一元化（採用） | ユーザーが直接編集可能 | 初回セットアップが必要 |

### 実装への影響

- `api.gs` の `getMasterData_()`: `_Mマスタ` シートから読み込み、シートがない場合は `getDefaultMaster_()` でシードデータ返却
- `template.gs` の `createMasterSheet_()`: シート作成時にシードデータを投入
- 設計レビュー QA-05 対応

## 3.6 匿名化機能（SEC-02）

### 判断

Dify Cloud経由でデータを照会する際、業者名・所長名を匿名化するオプションを実装。

### 根拠

Dify CloudはSaaSであり、APIリクエスト/レスポンスがDifyのサーバーを経由する。個人情報・取引先情報の漏洩リスクを低減するため、`anonymize=true` パラメータで匿名化を選択可能にした。

### 実装への影響

- `api.gs` の `anonymizeResponse_(data)`: 業者名をV001等のIDに、所長名を「所長A」等に置換
- `buildVendorAnonymizeMap_()`: `_M取引先` シートからマッピング生成
- 設計レビュー SEC-02 対応

## 3.7 HtmlService採用（Phase J）

### 判断

ダッシュボードの実装方式として、Google Sites + iframe ではなく GAS の HtmlService を採用。

### 根拠

| 方式 | メリット | デメリット |
|------|---------|----------|
| Google Sites + iframe | 見た目のカスタマイズ容易 | CORS制約、認証の2重管理 |
| HtmlService（採用） | GAS関数を直接呼び出し可能 | HTMLファイルサイズ制限あり |

### 実装への影響

- `hub.gs` の `doGet()`: `mode=dashboard` 時に `buildHubDashboardHtml_()` で HTML を返却
- `include_(filename)`: ファイル分割（CSS/JS）を実現する HtmlService のパターン
- `getDashboardData(yearMonth)`: `google.script.run` で呼び出されるサーバーサイド関数
- テンプレートスクリプトレット: `<?!= include_('dashboard_css') ?>` でCSS埋め込み

## 3.8 ナレッジベース空でのデプロイ（Phase K）

### 判断

Dify Cloud の3アプリは、Knowledge Retrieval ノードなし（ナレッジベース空）でデプロイした。

### 根拠

| 観点 | 説明 |
|------|------|
| 初期段階の判断 | GAS APIだけで予実データの照会・レポート生成が可能 |
| 将来の拡張 | ノード追加のみで対応可能な設計にしている |
| 蓄積計画 | 所長用: 現場ノウハウ文書、本社用: 経営判断資料 |

### 実装への影響

- 3つのDSLすべてで `knowledge: []` （空配列）
- Knowledge Retrieval ノードは未配置だが、Code→HTTP並列→LLM のパイプラインに挿入可能

---

# 第4章 GASファイル詳細仕様

## 4.1 config.gs（434行、11関数）

### 概要

シート保護、カスタムメニュー、定数定義、入力期限アラートを管理する設定モジュール。

### 定数

```javascript
TAX_RATE = 0.10          // 消費税率 10%
MAX_TEXT_LENGTH = 50      // テキスト入力の最大文字数
PROTECT_LEVEL             // Script only / View only / Input modes
CALC_SHEETS               // 保護対象: _C_予算健康度, _C_月次集計, _C_費目別集計
INPUT_COLS                // Owner(A-K), Clerk(L-M), Auto(N-R)
```

### 関数一覧

| 関数名 | 引数 | 戻り値 | 説明 |
|--------|------|--------|------|
| `onOpen()` | -- | void | スプレッドシート起動時にカスタムメニューを作成 |
| `applySheetProtection()` | -- | void | CALC_SHEETS を Script only で保護、支払明細入力の列を色分け保護 |
| `copyPreviousRow()` | -- | void | アクティブ行の上の行をコピー（所長の入力省力化） |
| `checkInputDeadline()` | -- | void | 当月の支払明細未入力を検知しアラート |
| `sendDeadlineAlert_(yearMonth, count)` | string, number | void | メール通知送信 |
| `sanitizeText(text)` | string | string | 50文字制限、HTML/制御文字除去、前後空白トリム |
| `setDeadlineCheckTrigger()` | -- | void | 毎日8:00のトリガー設定 |
| `setupForPoC(alertEmail)` | string | void | PoC環境一括初期化（APIキー生成、トリガー設定等） |
| `generateApiKey_()` | -- | string | 32文字のランダムAPIキー生成 |
| `getProjectData_()` | -- | object | _M工事シートからプロジェクトメタデータ取得 |

### 依存関係

- `template.gs` → `initProjectTemplate()` を `setupForPoC()` から呼び出し
- `api.gs` → `generateApiKey()` でAPIキーをプロパティに格納

---

## 4.2 budget_health.gs（621行、16関数）

### 概要

予実管理の中核モジュール。消化率・出来高率・GAP・信号を算出し、`_C_予算健康度` シートに書き込む。

### 核心指標

```
BAC（Budget at Completion）= 実行予算合計
PV（Planned Value）= 月別計画値の累計
AC（Actual Cost）= 支払実績の累計
消化率 = AC / BAC * 100
出来高率 = 手動入力（_月次調整）or 自動算出（工期進捗）
GAP = 消化率 - 出来高率
信号 = GAP<=5: 正常(green) / 5<GAP<=15: 注意(yellow) / GAP>15: 超過(red)
```

### 関数一覧

| 関数名 | 引数 | 戻り値 | 説明 |
|--------|------|--------|------|
| `monthlyBudgetHealthCalculation(yearMonth)` | string | void | メイン計算関数（1ヶ月分） |
| `calculateBudgetTotal_(ss)` | Spreadsheet | number | BAC合計を算出 |
| `calculatePlannedValue_(ss, yearMonth)` | SS, string | number | PV累計を算出 |
| `calculatePVFromMonthly_(ss, yearMonth)` | SS, string | number | _実行予算_月別からPV算出（フォールバック） |
| `calculateActualCost_(ss, yearMonth)` | SS, string | number | AC累計を算出 |
| `getProgressRate_(ss, yearMonth)` | SS, string | number | 出来高率取得（手動優先） |
| `calculateScheduleProgress_(ss, yearMonth)` | SS, string | number | 工期ベースの進捗自動算出 |
| `countMonths_(fromYm, toYm)` | string, string | number | 月数カウント（YYYY-MM形式） |
| `getSignal_(gap)` | number | string | 信号判定（正常/注意/超過） |
| `writeBudgetHealth_(ss, yearMonth, ...)` | SS, string, ... | void | _C_予算健康度シートに書き込み |
| `sendBudgetAlert_(yearMonth, ...)` | string, ... | void | 超過時のメールアラート |
| `getBudgetHealthMetrics(yearMonth)` | string | object | API用のメトリクス取得 |
| `updatePVDistribution()` | -- | void | PV月別配分の更新 |
| `runFullBudgetHealthCalculation()` | -- | void | 全月分一括計算 |
| `setMonthlyBudgetHealthTrigger()` | -- | void | 毎月1日 8:00のトリガー |
| `testBudgetHealth()` | -- | void | テスト関数 |

### 信号判定ロジック

```
          GAP <= 5pt          5pt < GAP <= 15pt        GAP > 15pt
  +------------------+  +---------------------+  +------------------+
  |  正常 (green)    |  |  注意 (yellow)      |  |  超過 (red)      |
  |  対応不要        |  |  要経過観察         |  |  要是正措置      |
  +------------------+  +---------------------+  +------------------+
```

---

## 4.3 template.gs（1,127行、22関数）

### 概要

プロジェクト初期化の中核。新規工事SSのシート群を一括作成し、マスタデータ・ドロップダウン・予算テーブルの骨格を生成する。

### マスタデータ（シード）

**費目（26項目）**

| カテゴリ | コード範囲 | 項目数 | 代表例 |
|---------|----------|--------|--------|
| C01 直接工事費 | E11-E15 | 5 | 材料費, 機械経費, 機械経費(損料), 外注費, 労務費 |
| C02 共通仮設費 | F31-F39 | 9 | 運搬費, 準備費, 事業損失防止施設費, 安全費, 役務費 等 |
| C03 現場管理費 | F51-F67 | 17 | 労務管理費, 安全訓練等費用, 租税公課, 保険料, 法定福利費 等 |

**工種（35項目）**

コード K0101 ~ K9901。各工種に `available_elements`（使用可能な費用要素）が定義されている。
例: K0101（掘削工）→ E11, E12, E14, E15 が使用可能

**費用要素（5項目）**

| コード | 名称 |
|--------|------|
| E11 | 材料費 |
| E12 | 機械経費 |
| E13 | 機械経費（損料） |
| E14 | 外注費 |
| E15 | 労務費 |

### 主要関数

| 関数名 | 説明 |
|--------|------|
| `initProjectTemplate(projectId)` | マスター初期化（全シート作成のオーケストレーター） |
| `createMasterSheet_(ss, master)` | _Mマスタシート作成（費目/工種/費用要素を投入） |
| `createVendorSheet_(ss)` | _M取引先シート作成（ヘッダーのみ） |
| `createBudgetSheet_(ss, master)` | _実行予算テーブル作成（available_elements対応） |
| `createBudgetMonthlySheet_(ss, months)` | _実行予算_月別作成（PV配分用） |
| `createPaymentInputSheet_(ss, master)` | 支払明細入力作成（18列、2段階入力） |
| `createPaymentSheet_(ss)` | 支払明細作成 |
| `createBudgetHealthSheet_(ss, months)` | _C_予算健康度作成 |
| `createMonthlyAggSheet_(ss, months)` | _C_月次集計作成 |
| `createMonthlyAdjSheet_(ss, months)` | _月次調整作成 |
| `setupInitialDropdowns_(ss, master)` | 全ドロップダウン初期設定 |
| `generateBudgetBoxId(cat, wt, k, exp)` | 予算箱ID生成（例: C01-W04-K0101-E11） |
| `applySimpleBudget(simpleBudget)` | 8項目簡易予算 → 26項目自動配分 |
| `transferPaymentData()` | 支払明細入力 → 支払明細への転記 |
| `refreshDropdowns()` | 全ドロップダウン更新 |

### 生成シート一覧

```
initProjectTemplate(projectId)
  |
  +-- createMasterSheet_()         → _Mマスタ
  +-- createVendorSheet_()         → _M取引先
  +-- createBudgetSheet_()         → _実行予算テーブル
  +-- createBudgetMonthlySheet_()  → _実行予算_月別
  +-- createPaymentInputSheet_()   → 支払明細入力
  +-- createPaymentSheet_()        → 支払明細
  +-- createBudgetHealthSheet_()   → _C_予算健康度
  +-- createMonthlyAggSheet_()     → _C_月次集計
  +-- createMonthlyAdjSheet_()     → _月次調整
  +-- setupInitialDropdowns_()     → 全ドロップダウン設定
```

---

## 4.4 validation_extended.gs（466行、13関数）

### 概要

onEdit トリガーで動作するカスケードドロップダウン制御と入力バリデーション。

### カスケードDD動作

```
B列（カテゴリ）変更
  |
  +-- C01: 直接工事費 → C列（工事種別）DD有効、D列（工種）DD有効、H列（数量）入力可
  +-- C02: 共通仮設費 → C,D列クリア・無効化、E列にF31-F39のDD設定、H列グレーアウト
  +-- C03: 現場管理費 → C,D列クリア・無効化、E列にF51-F67のDD設定、H列グレーアウト

C列（工事種別）変更
  → D列（工種）をフィルタ

D列（工種）変更
  → E列（費目）を available_elements でフィルタ
```

### 自動計算

| トリガー | 計算内容 | 出力列 |
|---------|---------|--------|
| H列（数量）or J列（単価）変更 | H * J = 金額 | K列 |
| B-E列変更 | 予算箱ID解決 | Q列 |
| K列（金額）or L列（相殺額）変更 | 消費税・税込合計計算 | O列, P列 |
| G列（年月）変更 | YYYY-MM形式チェック | -- |

### 関数一覧

| 関数名 | 説明 |
|--------|------|
| `onEditHandler(e)` | メインディスパッチャー（18列監視） |
| `onCategoryChange(sheet, row, value)` | B列変更ハンドラ |
| `onWorkTypeChange(sheet, row, value)` | C列変更ハンドラ |
| `onKoushusChange(sheet, row, value)` | D列変更ハンドラ |
| `calcAmountFromQuantity(sheet, row)` | H*J→K計算 |
| `resolveBudgetBoxId(sheet, row)` | Q列の予算箱ID解決 |
| `calcTax(sheet, row)` | 消費税・税込合計計算 |
| `validateYearMonth(sheet, row)` | G列のYYYY-MM検証 |
| `getCategoryId(name)` | カテゴリ名→ID変換 |
| `getWorkTypeIdFromName_(name)` | 工事種別名→ID変換 |
| `getKoushusIdFromName_(name)` | 工種名→ID変換 |
| `getExpenseIdFromName_(name)` | 費目名→ID変換 |
| `filterExpenseByCategory_(items, catId)` | カテゴリ別費目フィルタ |

---

## 4.5 aggregation.gs（543行、12関数）

### 概要

月次集計・費目別集計のスナップショット方式モジュール。

### スナップショット方式

```
takeSnapshot_(sheet)
  → シートデータを一括読み込み（配列化）
  → 以降の計算は配列操作のみ（シートアクセスなし）
  → 同時編集の影響を受けない（QA-02対応）
```

### 集計ディメンション

| ディメンション | 例 |
|-------------|-----|
| 月 | 2025-10, 2025-11, 2025-12 |
| カテゴリ | C01, C02, C03, ALL |
| 予算箱ID | C01-W04-K0101-E11 |

### 関数一覧

| 関数名 | 説明 |
|--------|------|
| `runMonthlyAggregation()` | 月次集計メイン |
| `takeSnapshot_(sheet)` | シートデータのスナップショット取得 |
| `getBudgetTotals_(ss, budgetSheet)` | カテゴリ別予算合計 |
| `aggregatePayments_(data, headers)` | 支払データの月xカテゴリ集計 |
| `calculatePendingOffsets_(data, headers)` | 未確定相殺額の推計 |
| `writeMonthlyAggregation_(ss, ...)` | _C_月次集計シートへの書き込み |
| `writeDetailAggregation_(ss, ...)` | _C_費目別集計シートへの書き込み |
| `getMonthlyAggregation(yearMonth)` | API用集計データ取得 |
| `getEmptyAggregation_()` | 空集計オブジェクト |
| `getSpentByBudgetBox(upToMonth)` | 予算箱別累計支出 |
| `setAggregationTrigger()` | 毎月1日 7:00のトリガー |
| `testAggregation()` | テスト関数 |

---

## 4.6 api.gs（943行、26関数）

### 概要

現場SS用のWeb App APIエンドポイント。Dify CloudおよびダッシュボードからHTTPリクエストを受け付ける。

### APIモード

| mode | 用途 | 主要関数 |
|------|------|---------|
| health | 予算健康度メトリクス | `getHealthData_(yearMonth)` |
| master | マスタデータ（費目/工種/費用要素） | `getMasterData_()` |
| summary | 予算/支出サマリー | `getSummaryData_(yearMonth)` |
| project | プロジェクトメタデータ | `getProjectData_()` |
| aggregate | 月次集計データ | `getAggregateData_(yearMonth)` |
| dashboard | サイトダッシュボードHTML | `buildSiteDashboardHtml_(yearMonth)` |
| evm | healthへリダイレクト（レガシー） | -- |

### レスポンス形式（統一）

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-23T10:00:00.000Z"
}
```

エラー時:
```json
{
  "success": false,
  "error": "エラーメッセージ",
  "timestamp": "2026-02-23T10:00:00.000Z"
}
```

### 匿名化（SEC-02）

```
GET ?mode=summary&anonymize=true

業者名 → V001, V002, ...
所長名 → 所長A, 所長B, ...
```

### 主要関数

| 関数名 | 説明 |
|--------|------|
| `doGet(e)` | メインルーター |
| `validateApiKey_(e)` | APIキー検証 |
| `getHealthData_(yearMonth)` | 予算健康度 |
| `getAggregateData_(yearMonth)` | 月次集計 |
| `getProjectData_()` | プロジェクト情報 |
| `getMasterData_()` | マスタデータ（_Mマスタから動的読み込み） |
| `readMasterFromSheet_(sheet)` | シートからマスタ読み込み |
| `getDefaultMaster_()` | シードデータ（フォールバック） |
| `getDefaultExpenseItems_()` | 26費目のシードデータ |
| `getDefaultWorkTypes_()` | 35工種のシードデータ（available_elements付き） |
| `getVendorsMaster_()` | 取引先マスタ |
| `getSummaryData_(yearMonth)` | サマリーデータ |
| `anonymizeResponse_(data)` | レスポンス匿名化 |
| `buildVendorAnonymizeMap_()` | 匿名化マッピング生成 |
| `buildSiteDashboardHtml_(yearMonth)` | サイトダッシュボードHTML生成 |
| `escapeHtml_(str)` | HTMLエスケープ |
| `generateApiKey()` | APIキー生成・保存 |
| `testDoGet()` | 全モードテスト |

---

## 4.7 hub.gs（644行、17関数）

### 概要

本社管理台帳用のWeb App。全現場横断でデータを集約し、Dify CloudとダッシュボードにJSONまたはHTMLを返却する。

### APIモード

| mode | 用途 | 主要関数 |
|------|------|---------|
| projects_all | 全工事メタデータ | `getProjectsAll_()` |
| cross_summary | 全工事予算サマリー | `getCrossSummary_(yearMonth)` |
| cross_health | 全工事健康度メトリクス | `getCrossHealth_(yearMonth)` |
| project_detail | 個別工事詳細 | `getProjectDetail_(projectId, yearMonth)` |
| dashboard | ダッシュボードHTML（デフォルト） | `buildHubDashboardHtml_(yearMonth)` |

### 内部データ取得

```
hub.gs
  |
  +-- readRegistry_() → _M工事台帳シートから全工事情報取得
  |
  +-- 各工事のspreadsheet_id を取得
  |
  +-- SpreadsheetApp.openById(ssId) で現場SSを開く
  |
  +-- fetchSiteSummary_(ssId, yearMonth)  → 予算/支出データ
  +-- fetchSiteHealth_(ssId, yearMonth)   → 健康度メトリクス
```

### HtmlService統合

```javascript
function doGet(e) {
  var mode = (e && e.parameter && e.parameter.mode) || 'dashboard';
  if (mode === 'dashboard') {
    return buildHubDashboardHtml_(yearMonth);
    // → HtmlService.createTemplateFromFile('dashboard')
    //     .evaluate()
    //     .setTitle('森組 工事管理ダッシュボード')
  }
  // 他のmodeはJSON返却
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDashboardData(yearMonth) {
  // google.script.run から呼ばれるサーバーサイド関数
  // 全工事の健康度データを返却
}
```

### 関数一覧

| 関数名 | 説明 |
|--------|------|
| `doGet(e)` | メインルーター（デフォルト: dashboard） |
| `getProjectsAll_()` | 全工事メタデータ |
| `getCrossSummary_(yearMonth)` | 全工事横断サマリー |
| `getCrossHealth_(yearMonth)` | 全工事横断健康度 |
| `getProjectDetail_(projectId, yearMonth)` | 個別工事詳細 |
| `readRegistry_()` | _M工事台帳読み込み（正本） |
| `getFallbackRegistry_()` | フォールバック4工事データ |
| `fetchSiteSummary_(ssId, yearMonth)` | 現場SS予算サマリー取得 |
| `fetchSiteHealth_(ssId, yearMonth)` | 現場SS健康度取得 |
| `include_(filename)` | HtmlServiceファイルインクルード |
| `getDashboardData(yearMonth)` | google.script.run用ラッパー |
| `buildHubDashboardHtml_(yearMonth)` | ダッシュボードHTML構築 |
| `getCurrentYearMonth_()` | YYYY-MM取得 |
| `sumColumn_(data, colName)` | 列合計 |
| `sumPaymentUpTo_(data, upToMonth)` | 累計支払合計 |
| `testDoGet()` | テスト |
| `testGetDashboardData()` | ダッシュボードデータテスト |

---

## 4.8 セットアップスクリプト群

### setup_hub_registry.gs（163行、2関数）

| 関数名 | 説明 |
|--------|------|
| `setupHubRegistry()` | _M工事台帳シート作成（13列ヘッダー + 4工事デモデータ） |
| `updateSiteId(projectId, ssId)` | 特定工事のspreadsheet_id更新 |

### setup_demo_sites.gs（199行、5関数）

| 関数名 | 説明 |
|--------|------|
| `setupDemoSites()` | デモSS作成オーケストレーター |
| `createDemoSite_P001_()` | P001 境川河川改修（正常、消化率70%） |
| `createDemoSite_P002_()` | P002 持木川中流部（注意、消化率86%） |
| `createDemoSite_P003_()` | P003 野尻川除石（超過、消化率110%） |
| `moveToDemoFolder_(ssId)` | デモフォルダへ移動 |

### setup_project_data.gs（304行）

PoCテストデータ（82件の支払明細）をスプレッドシートに投入するスクリプト。

---

## 4.9 関数依存関係マップ

```
config.gs
  onOpen() → メニュー作成
  setupForPoC() → template.initProjectTemplate()
                → generateApiKey_()
                → setDeadlineCheckTrigger()

template.gs
  initProjectTemplate() → createMasterSheet_()
                        → createVendorSheet_()
                        → createBudgetSheet_()
                        → createBudgetMonthlySheet_()
                        → createPaymentInputSheet_()
                        → createPaymentSheet_()
                        → createBudgetHealthSheet_()
                        → createMonthlyAggSheet_()
                        → createMonthlyAdjSheet_()
                        → setupInitialDropdowns_()

validation_extended.gs
  onEditHandler() → onCategoryChange() → filterExpenseByCategory_()
                 → onWorkTypeChange()
                 → onKoushusChange()
                 → calcAmountFromQuantity()
                 → resolveBudgetBoxId() → template.generateBudgetBoxId()
                 → calcTax()
                 → validateYearMonth()

aggregation.gs
  runMonthlyAggregation() → takeSnapshot_()
                          → getBudgetTotals_()
                          → aggregatePayments_()
                          → calculatePendingOffsets_()
                          → writeMonthlyAggregation_()
                          → writeDetailAggregation_()

budget_health.gs
  monthlyBudgetHealthCalculation() → calculateBudgetTotal_()
                                   → calculatePlannedValue_()
                                   → calculateActualCost_()
                                   → getProgressRate_()
                                   → getSignal_()
                                   → writeBudgetHealth_()
                                   → sendBudgetAlert_()

api.gs
  doGet() → getHealthData_() → budget_health.getBudgetHealthMetrics()
          → getMasterData_() → readMasterFromSheet_() / getDefaultMaster_()
          → getSummaryData_()
          → getProjectData_()
          → getAggregateData_() → aggregation.getMonthlyAggregation()
          → anonymizeResponse_()

hub.gs
  doGet() → readRegistry_()
          → getCrossHealth_() → fetchSiteHealth_()
          → getCrossSummary_() → fetchSiteSummary_()
          → buildHubDashboardHtml_() → include_()
                                     → getDashboardData()
```

---

# 第5章 ダッシュボード仕様

## 5.1 概要

GAS の HtmlService で構築された本社横断ダッシュボード。3ファイル構成、計2,531行。

| ファイル | 行数 | 役割 |
|---------|------|------|
| dashboard.html | 1,484 | HTML本体（7ページ構成、テンプレートスクリプトレット） |
| dashboard_css.html | 131 | CSS定義（Tailwind CDN + カスタム） |
| dashboard_js.html | 916 | JavaScript（google.script.run + Chart.js） |

### アクセス方法

```
HUB URL にパラメータなしでアクセス
→ hub.gs doGet() が mode=dashboard として処理
→ HtmlService.createTemplateFromFile('dashboard').evaluate() を返却
```

## 5.2 ページ構成

### ビューモード

| ビュー | 対象ユーザー | 表示ページ |
|--------|------------|-----------|
| executive | 経営者（本社） | page0, page4, page5, page6, page7 |
| manager | 現場所長 | page1, page2, page3, page3.5, page4 |

### ページ一覧

| ページID | タイトル | 主要コンテンツ |
|---------|---------|---------------|
| page0 | 全現場サマリー | KPIカード4枚（進行中/完了/合計請負/平均益率）、信号バー、工事カード6枚、アラート表 |
| page1 | 工事予実管理KPI | 工事セレクタ、信号表示（60x60px）、KPIカード、アラート表、アクション3ボタン |
| page2 | 経営分析 | 月別支出推移（Line）、予算vs実績（Grouped Horizontal Bar）、予実対比テーブル |
| page3 | 現場管理 | 費目別構成（Doughnut）、月次推移（Stacked Bar）、業者TOP10（Horizontal Bar）、法定4分類ビュー |
| page3.5 | 予算ヘルスチェック | 粗利率KPI Banner、費目別ヘルスチェック表（9列x11行）、常用費用サマリ |
| page4 | AIチャット | サジェストボタン9個、所長向けiframe（左）、本社向けiframe（右） |
| page5 | 全社経営概況 | 売上・粗利比較（Bar）、工事別粗利率（Horizontal Bar） |
| page6 | 工事別パフォーマンス | 粗利率ランキング（Horizontal Bar）、原価構造比較（100% Stacked Bar）、所長別まとめ表 |
| page7 | コスト改善の見える化 | 単価格差（Bar + カスタムアノテーション）、年間改善効果（Horizontal Stacked Bar） |

## 5.3 外部依存

| ライブラリ | CDN URL | 用途 |
|-----------|---------|------|
| Tailwind CSS | `https://cdn.tailwindcss.com` | ユーティリティCSS |
| Chart.js | `https://cdn.jsdelivr.net/npm/chart.js` | グラフ描画 |
| Google Apps Script | `google.script.run` | サーバー通信 |

## 5.4 テンプレートスクリプトレット

```html
<?!= include_('dashboard_css') ?>    <!-- CSS埋め込み -->
<?= defaultMonth ?>                   <!-- GAS側で設定した年月パラメータ -->
<?!= include_('dashboard_js') ?>     <!-- JavaScript埋め込み -->
```

`include_()` は hub.gs の関数で、`HtmlService.createHtmlOutputFromFile(filename).getContent()` を返す。

## 5.5 Chart.js グラフ一覧

| グラフ | ページ | タイプ | データソース |
|--------|--------|--------|-------------|
| 月別支出推移 | page2 | Line | _C_月次集計 |
| 予算vs実績 | page2 | Grouped Horizontal Bar | _C_月次集計 + _実行予算テーブル |
| 費目別構成 | page3 | Doughnut | _C_費目別集計 |
| 月次推移 | page3 | Stacked Bar | _C_月次集計 |
| 業者TOP10 | page3 | Horizontal Bar | 支払明細 |
| 法定4分類 | page3 | Doughnut | 法定変換ルール適用 |
| 売上・粗利比較 | page5 | Bar | hub.gs cross_summary |
| 工事別粗利率 | page5 | Horizontal Bar | hub.gs cross_summary |
| 粗利率ランキング | page6 | Horizontal Bar | hub.gs cross_health |
| 原価構造比較 | page6 | 100% Stacked Bar | hub.gs cross_health |
| 単価格差 | page7 | Bar（カスタムafterDraw） | 内部データ |
| 改善効果 | page7 | Horizontal Stacked Bar | 内部データ |

### メモリ管理

```javascript
function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}
// ページ遷移時に旧チャートを破棄してからnew Chart()
```

## 5.6 JavaScript関数一覧

### 初期化

| 関数名 | 説明 |
|--------|------|
| `initDashboard()` | DOMContentLoaded時のメイン初期化 |
| `_esc(str)` | XSS対策HTMLエスケープ |

### 動的レンダリング

| 関数名 | 説明 |
|--------|------|
| `renderSidebar(projects)` | サイドバー工事リスト動的生成 |
| `renderSummaryCards(projects)` | page0 KPIカード更新 |
| `renderProjectCards(projects)` | page0 工事カード6枚生成 |
| `renderAlertsTable(projects)` | page0 アラート表生成 |
| `updateSiteKpi(p)` | page1 KPI更新 |

### ナビゲーション

| 関数名 | 説明 |
|--------|------|
| `loadSiteData(projectId)` | 工事データ取得（キャッシュ優先） |
| `switchProject(projectId)` | 工事切替 |
| `switchView(view)` | ビュー切替（executive/manager） |
| `showPage(pageId, navElement)` | ページ遷移 |
| `toggleSidebar()` | モバイルサイドバートグル |

### Chart.js初期化

| 関数名 | 説明 |
|--------|------|
| `initCharts(pageId)` | ページ別チャート初期化ディスパッチャー |
| `destroyChart(id)` | チャートインスタンス破棄 |
| `initPage2Charts()` | page2 グラフ2本 |
| `initPage3Charts()` | page3 グラフ4本 |
| `initPage5Charts()` | page5 グラフ2本 |
| `initPage6Charts()` | page6 グラフ2本 |
| `initPage7Charts()` | page7 グラフ2本 |

### UI制御

| 関数名 | 説明 |
|--------|------|
| `copySuggest(el, text)` | サジェストボタン→クリップボードコピー（800msアニメーション） |
| `filterAlerts(filter)` | アラートフィルタ（over/all） |
| `toggleHighContrast()` | 高コントラストモード切替 |

## 5.7 Dify Embed統合（page4）

| パネル | embed URL | 対象 |
|--------|----------|------|
| 左（所長向け） | `https://udify.app/chatbot/8JW4EA9aJiBnEW1R` | 予実照会チャットボット |
| 右（本社向け） | `https://udify.app/chatbot/eT6LUMaOglFVq4ug` | 経営分析チャットボット |

```html
<iframe src="https://udify.app/chatbot/8JW4EA9aJiBnEW1R"
  style="width:100%; height:600px; border:none;"
  allow="microphone">
</iframe>
```

## 5.8 レスポンシブ設計

| ブレークポイント | レイアウト |
|----------------|----------|
| 1024px以上 | 3列グリッド（page0工事カード） |
| 640-1023px | 2列グリッド |
| 640px以下 | 1列 + モバイルサイドバー（fixed, transform） |

### 色彩体系

| 用途 | 色コード | 説明 |
|------|---------|------|
| 信号赤（超過） | #E53935 | 予算超過アラート |
| 信号黄（注意） | #FDD835 | 注意アラート |
| 信号緑（正常） | #2E7D32 | 正常状態 |
| 主色（Info） | #1565C0 | サイドバー、選択状態 |
| サイドバー背景 | #0D47A1 | ナビゲーション |

### 高コントラストモード

```css
.high-contrast .signal-* { border: 2px solid #000; }
.high-contrast .kpi-card  { border: 2px solid #333; }
```

---

# 第6章 Dify DSL仕様

## 6.1 予実照会チャットボット（budget_inquiry_chatbot.dsl）

### 基本情報

| 項目 | 値 |
|------|-----|
| ファイル | dsl/generated/budget_inquiry_chatbot.dsl |
| 行数 | 288 |
| app.mode | advanced-chat |
| DSL version | 0.1.2 |
| App ID | dcaca55b-0586-43b3-acaa-10189b624974 |
| embed URL | https://udify.app/chatbot/8JW4EA9aJiBnEW1R |

### ノード構成図

```
[Start] → [Code: パラメータ抽出] → [HTTP: GAS予実照会] → [LLM: 予実解説] → [Answer]
  1000000001   1000000002            1000000003            1000000004        1000000005
```

### ノード詳細

**1000000002 Code: パラメータ抽出**（Python3）

```python
import re
from datetime import datetime

def main(user_input: str) -> dict:
    project_match = re.search(r'P\d+', user_input)
    project_id = project_match.group(0) if project_match else 'all'
    year_month_match = re.search(r'\d{4}-\d{2}', user_input)
    if year_month_match:
        year_month = year_month_match.group(0)
    else:
        year_month = datetime.now().strftime('%Y-%m')
    return {
        'project_id': project_id,
        'year_month': year_month,
        'original_query': user_input
    }
```

出力変数: `project_id`, `year_month`, `original_query`

**1000000003 HTTP Request: GAS予実照会**

| 項目 | 値 |
|------|-----|
| URL | `{{#env.GAS_HUB_URL#}}` |
| メソッド | GET |
| パラメータ | mode=cross_health, project_id=`{{#1000000002.project_id#}}`, year_month=`{{#1000000002.year_month#}}` |
| タイムアウト | connect 60s, read 60s, write 60s |

**1000000004 LLM: 予実解説**

| 項目 | 値 |
|------|-----|
| モデル | gpt-4o-mini (OpenAI) |
| Temperature | 0.3 |
| edition_type | basic |
| structured_output_enabled | false |

システムプロンプト:
```
あなたは工事予算管理の専門家です。
GASシステムから取得した予実管理データを、現場担当者にわかりやすく日本語で解説してください。

以下の点を必ず説明してください：
1. 消化率（支払実績/実行予算）の現状と評価
2. 出来高率（工事進捗に対する支払いバランス）の現状と評価
3. 信号ステータス（green/yellow/red）の意味と必要な対応
4. 超過リスクや注意事項があれば具体的に指摘

データがない場合や取得エラーの場合は、その旨を明確に伝えてください。
回答は箇条書きを活用し、簡潔にまとめてください。
```

### Opening Statement & サジェスト

```
工事予算の予実状況を照会します。工事IDと年月を教えてください。
例: P004の今月の状況を教えてください
```

サジェスト:
- 「P004の今月の状況を教えてください」
- 「全工事の2026-01の予実状況は？」
- 「P001の予算消化状況を確認したい」

---

## 6.2 月次予算管理レポート（monthly_report_workflow.dsl）

### 基本情報

| 項目 | 値 |
|------|-----|
| ファイル | dsl/generated/monthly_report_workflow.dsl |
| 行数 | 347 |
| app.mode | workflow |
| DSL version | 0.1.2 |
| App ID | c4445a51-fe3f-4fa4-b252-dd72bb20e0da |

### ノード構成図

```
                     +-- [HTTP: 横断サマリー取得] --+
                     |     1000000002               |
[Start] ----------->+                               +-->[Template: データ結合] --> [LLM: レポート生成] --> [End]
  1000000001         |                               |     1000000004               1000000005            1000000006
                     +-- [HTTP: 予実健康度取得]  --+
                           1000000003
```

**並列HTTP取得**: Start ノードから2つのHTTPリクエストが並列に発行される。

### Start ノード入力変数

| 変数名 | 型 | 必須 | ラベル |
|--------|-----|------|--------|
| year_month | text-input | required | 対象年月 |

### HTTP Request ノード

| ノード | mode | パラメータ |
|--------|------|----------|
| 1000000002 | cross_summary | year_month |
| 1000000003 | cross_health | year_month |

### Template Transform: データ結合

```
# 月次予算管理データ（対象年月: {{year_month}}）

## 1. 全工事横断サマリー（cross_summary）
{{summary_data}}

## 2. 予実健康度データ（cross_health）
{{health_data}}
```

### LLM: レポート生成

5セクション構成のMarkdownレポートを生成:
1. 概要（対象年月、工事件数、消化状況サマリー）
2. 消化率ランキング（上位・下位を表形式）
3. 超過リスク工事（超過金額を明示）
4. 注意工事（yellow/red信号の工事リスト）
5. 推奨アクション（優先度順に3件以上）

### End ノード出力

| 変数名 | ソース |
|--------|--------|
| report | LLM node (1000000005).text |

---

## 6.3 本社向け経営分析チャットボット（executive_report_chatbot.dsl）

### 基本情報

| 項目 | 値 |
|------|-----|
| ファイル | dsl/generated/executive_report_chatbot.dsl |
| 行数 | 402 |
| app.mode | advanced-chat |
| DSL version | 0.1.2 |
| App ID | 1ec5e80b-a7b4-42bf-a392-dd48a590b664 |
| embed URL | https://udify.app/chatbot/eT6LUMaOglFVq4ug |

### ノード構成図

```
                                   +-- [HTTP: 横断サマリー取得] --+
                                   |     1000000003               |
[Start] → [Code: パラメータ抽出] →+                               +→ [Template: データ結合] → [LLM: 経営分析] → [Answer]
  1000000001   1000000002          |                               |     1000000005              1000000006        1000000007
                                   +-- [HTTP: 予実健康度取得]  --+
                                         1000000004
```

### 月次レポートとの差異

| 観点 | 月次レポート (6.2) | 経営分析チャットボット (6.3) |
|------|-------------------|---------------------------|
| app.mode | workflow | advanced-chat |
| ノード数 | 6 | 7（Codeノード追加） |
| 入力 | year_month（テキスト指定） | 自由形式の質問 |
| 出力 | End ノード→テキスト | Answer ノード→チャット |
| 動作モード | レポート生成のみ | レポート or 質問回答（2モード） |

### Code ノード: パラメータ抽出

月次レポートのStart入力変数の代わりに、自由テキストから年月を抽出:

```python
import re
from datetime import datetime

def main(user_input: str) -> dict:
    year_month_match = re.search(r'\d{4}-\d{2}', user_input)
    if year_month_match:
        year_month = year_month_match.group(0)
    else:
        year_month = datetime.now().strftime('%Y-%m')
    return {
        'year_month': year_month,
        'original_query': user_input
    }
```

### LLM: 経営分析（2モード動作）

- **レポートモード**: 「レポート」「月次」「まとめ」等のキーワードで5セクションMarkdown生成
- **質問回答モード**: 具体的な質問に対しデータに基づいて簡潔に回答

システムプロンプトの追加指示:
- 数値は必ずGASデータから引用（推測しない）
- 建設業特有の文脈（長期下請関係、季節変動等）を考慮
- データがない場合はその旨を明記

### Opening Statement & サジェスト

```
全工事横断の経営分析・月次レポートを生成します。年月や質問をどうぞ。
例: 2026-01の月次レポートを作成してください
```

サジェスト:
- 「今月の全工事レポートを出して」
- 「予算超過している工事はある？」
- 「コスト削減の提案をください」

## 6.4 DSL共通仕様

### 環境変数

| 変数名 | 設定先 | 説明 |
|--------|--------|------|
| GAS_HUB_URL | 3アプリ共通 | GAS hub.gs の Web App URL |

### 共通設定

| 項目 | 値 |
|------|-----|
| DSL version | 0.1.2 |
| LLM model | gpt-4o-mini |
| Temperature | 0.3 |
| edition_type | basic |
| structured_output_enabled | false |
| HTTP タイムアウト | 60s (connect/read/write) |
| Knowledge Retrieval | 未使用（空配列） |
| File Upload | 無効 |
| Speech to Text | 無効 |

### ノードID規則

全ノードID は `1000000001` 形式の数字文字列。変数参照は `{{#1000000002.variable#}}` 形式。

---

# 第7章 Pythonスクリプト仕様

## 7.1 add_new_project.py（304行）

### 概要

新規工事プロジェクトを `project_registry.json` に登録し、環境構築チェックリストを自動生成するCLIツール。

### 使い方

```bash
python scripts/add_new_project.py \
  --project_id P005 \
  --project_name "新川護岸補修工事" \
  --spreadsheet_url "https://docs.google.com/spreadsheets/d/{ID}/edit" \
  --budget_total 185000000 \
  --start_date 2026-04-01 \
  --end_date 2027-03-31
```

### 引数

| 引数 | 型 | 必須 | 説明 |
|------|-----|------|------|
| --project_id | string | 必須 | 工事ID（P001形式） |
| --project_name | string | 必須 | 工事名 |
| --spreadsheet_url | string | 必須 | Google Sheets URL |
| --budget_total | int | 必須 | 実行予算額 |
| --start_date | string | 必須 | 工期開始日（YYYY-MM-DD） |
| --end_date | string | 必須 | 工期終了日（YYYY-MM-DD） |

### 処理フロー

```
1. 引数パース & 入力検証
2. project_registry.json 読み込み
3. 重複チェック（project_id）
4. プロジェクト情報を辞書化
5. レジストリに追加 & 保存
6. チェックリスト生成（Step 1-4の Markdown）
7. 標準出力に表示 & output/ にファイル保存
```

### 出力

| ファイル | 形式 | 内容 |
|---------|------|------|
| project_registry.json | JSON | `{"projects": [...], "updated_at": "..."}` |
| output/checklist_{ID}_{DATE}.txt | Markdown | 4ステップのセットアップ手順 |

### チェックリスト構成

- Step 1: hub.gsの_M工事台帳にspreadsheet_idを登録
- Step 2: 現場SSのGASセットアップ（6ファイル配置）
- Step 3: 動作確認（APIデプロイ & ヘルスチェック）
- Step 4: Dify DSLインポート（任意）

### 依存ライブラリ

標準ライブラリのみ（argparse, json, re, pathlib, datetime）

---

## 7.2 export_dify_workflows.py（251行）

### 概要

Dify Cloud APIを使用して全ワークフロー/アプリをDSL形式でエクスポートするスクリプト。

### 使い方

```bash
# 事前準備: /refresh-dify-token でトークン取得
export DIFY_REFRESH_TOKEN="rt-xxxxxxxx"

# 実行
python scripts/export_dify_workflows.py
```

### 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| DIFY_REFRESH_TOKEN | (必須) | Dify Cloud リフレッシュトークン（30日有効） |
| DIFY_BASE_URL | `https://cloud.dify.ai` | ベースURL |
| INCLUDE_SECRET | false | シークレット情報を含めるか |

### 処理フロー

```
1. DIFY_REFRESH_TOKEN チェック
2. refresh_access_token() でアクセストークン取得
3. get_apps() で全アプリ一覧取得（ページネーション: 100件/ページ）
4. 各アプリをループ:
   - mode が "workflow" or "advanced-chat" のみ対象
   - export_app_dsl() でDSLダウンロード
   - save_dsl() でローカル保存
5. create_manifest() で _manifest.json 生成
```

### 出力

| ファイル | 形式 | 内容 |
|---------|------|------|
| dsl/exported/{name}_{id[:8]}.yml | YAML | Dify DSL |
| dsl/exported/_manifest.json | JSON | エクスポート一覧 |

### エラーハンドリング

| エラー | 挙動 |
|--------|------|
| トークン未設定 | エラーメッセージ + return 1 |
| 401/403（期限切れ） | トークン更新メッセージ + return 1 |
| 5xx エラー | 個別アプリSKIP、他は継続 |

### 依存ライブラリ

`requests`, `yaml`（pip install 必要）

---

## 7.3 prepare_poc_data.py（473行）

### 概要

実際のExcel分析結果からPoCテストデータ（TSV 3ファイル）を生成するデータ変換スクリプト。

### 使い方

```bash
python scripts/prepare_poc_data.py
```

引数なし。入力ファイルパスはスクリプト内にハードコード。

### 入力ファイル

| ファイル | 説明 |
|---------|------|
| ../Excel分析/output/月度別支払い内訳/final_output.json | 3ヶ月の支払明細（10-12月、82件） |
| output/master_items_initial.csv | マスタデータ |

### 出力ファイル

| ファイル | 列数 | 行数 | 内容 |
|---------|------|------|------|
| output/poc_test_data.tsv | 18 | 82 | 支払明細（A:No ~ R:備考） |
| output/poc_vendors.tsv | 4 | ~20 | 取引先マスタ |
| output/poc_budget.tsv | 9 | 13 | 実行予算テーブル |

### マッピング辞書

| マップ | 変換例 |
|--------|--------|
| EXPENSE_CODE_MAP | 11 → (E11, 材料費) |
| PETTY_CASH_MAP | "釘" → (E11, 材料費, 直接工事費) |
| VENDOR_NORMALIZE | "(有)浜畑水道" → "(有)濱畑水道" |
| MONTH_MAP | "10月度" → "2025-10" |

### 検証ロジック

月別合計の期待値チェック:
- 10月: 10,933,337円
- 11月: 8,458,604円
- 12月: 4,332,077円

### 依存ライブラリ

標準ライブラリのみ

## 7.4 スクリプト比較表

| 項目 | add_new_project.py | export_dify_workflows.py | prepare_poc_data.py |
|------|-------------------|-------------------------|-------------------|
| 行数 | 304 | 251 | 473 |
| 外部依存 | なし | requests, yaml | なし |
| 環境変数 | なし | 3個（DIFY_*） | なし |
| 入力 | CLI引数 | Dify Cloud API | JSON + CSV |
| 出力 | JSON + TXT | YAML + JSON | TSV x 3 |
| エラー時 | sys.exit(1) | return 1 | sys.exit(1) or 警告 |

---

# 第8章 認証デバッグ物語

## 8.1 概要

Dify Cloud Console API の認証方式をめぐる8コミット分の試行錯誤の記録。2025-12-24 ~ 2025-12-27 の4日間で5つの認証方式を試した。

## 8.2 時系列

### Day 1: 2025-12-24 -- Email/Password認証

**コミット**: `32f2ca6` Initial commit: Dify Workflow Development Project

最初のアプローチ。Dify Cloud の Console API にメール/パスワードで認証を試みた。

**コミット**: `f5b1043` Fix: Add default value for DIFY_BASE_URL

DIFY_BASE_URL のデフォルト値を追加。

**コミット**: `b06b2ec` Fix: Change authentication to Email/Password login

問題: Dify CloudはGoogle SSO認証がメインで、Email/Password認証が使えないケースがあった。

### Day 2: 2025-12-25 -- refresh_token方式 & CSRF対応

**コミット**: `af54fc2` Feat: Switch to refresh_token authentication

refresh_token 方式に切り替え。ブラウザのCookieから refresh_token を抽出して使用。

**コミット**: `caa923b` Fix: Add CSRF token to API requests

問題: APIリクエストが403 Forbiddenを返す。原因はCSRFトークンの欠如。
対処: X-CSRF-Token ヘッダーを追加。

### Day 3-4: 2025-12-27 -- Cookie方式 & 最終解決

**コミット**: `01c9889` Revert: refresh_token方式に復元

Cookie送信方式を試したが失敗し、refresh_token方式に戻す。

**コミット**: `25c9427` Fix: Cookie送信方式をヘッダー直接指定に変更

requests.Session() のCookie管理ではなく、ヘッダーに直接Cookie文字列を設定。

**コミット**: `f4fbf8f` Debug: トークン情報を出力

デバッグ用のトークン情報出力を追加（後に削除）。

**コミット**: `ae21d78` Feat: Add CSRF token support for Dify Console API

最終解決: CSRFトークンをCookieとX-CSRF-Tokenヘッダーの両方に設定。

**コミット**: `f0712da` Fix: Send CSRF token in both Cookie and X-CSRF-Token header

CSRFトークンの送信を確実にするための修正。

## 8.3 認証方式の変遷

```
Email/Password認証（失敗）
  → Google SSO非対応で使えず
      |
      v
refresh_token方式（部分成功）
  → トークン取得は成功するがAPIで403
      |
      v
Cookie直接指定（失敗）
  → requests.Session()のCookie管理が不完全
      |
      v
CSRF + Cookie + Header（成功）
  → access_token + csrf_token を
    Cookie と X-CSRF-Token の両方に設定
```

## 8.4 最終的な認証フロー

```
1. ユーザーがブラウザでDify Cloudにログイン
2. /refresh-dify-token スキルで認証コード送信
3. メールに届いた6桁コードを入力
4. POST /console/api/email-code-login/validity
5. Set-Cookie ヘッダーから refresh_token を抽出
6. refresh_token → access_token + csrf_token に交換
7. APIリクエスト時:
   - Authorization: Bearer {access_token}
   - Cookie: csrf_token={csrf_token}
   - X-CSRF-Token: {csrf_token}
```

## 8.5 教訓

| 教訓 | 詳細 |
|------|------|
| Dify CloudのAPIは非公開 | Console APIはドキュメント化されておらず、認証方式の発見に試行錯誤が必要 |
| CSRFトークンは二重送信 | Cookie と ヘッダー の両方に同じCSRFトークンを設定する必要がある |
| refresh_tokenの有効期限 | 30日間有効。期限切れ前に `/refresh-dify-token` で更新 |
| Google SSOとの競合 | Email/Password認証はGoogle SSOユーザーには使えない場合がある |

---

# 第9章 フェーズ別開発記録

## 9.1 Phase 0: 基盤構築（2025-12-24 ~ 2026-02-19）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| 32f2ca6 | 12-24 | Initial commit: Dify Workflow Development Project |
| f5b1043 | 12-24 | Fix: Add default value for DIFY_BASE_URL |
| b06b2ec | 12-24 | Fix: Change authentication to Email/Password login |
| af54fc2 | 12-25 | Feat: Switch to refresh_token authentication |
| caa923b | 12-25 | Fix: Add CSRF token to API requests |
| 01c9889 | 12-27 | Revert: refresh_token方式に復元 |
| 25c9427 | 12-27 | Fix: Cookie送信方式をヘッダー直接指定に変更 |
| f4fbf8f | 12-27 | Debug: トークン情報を出力 |
| ae21d78 | 12-27 | Feat: Add CSRF token support for Dify Console API |
| f0712da | 12-27 | Fix: Send CSRF token in both Cookie and X-CSRF-Token header |
| 0e32fa1 | 12-27 | refactor: Remove work004 migration artifacts |
| 4be45d0 | 12-27 | docs: Add context enrichment design philosophy |
| 30eeafd | 12-27 | feat: Add initial DSL export for context enrichment |

### 主要成果

- Dify Console API認証の確立（8コミット分の試行錯誤、第8章参照）
- DSLテンプレート38本の収集
- export_dify_workflows.py の完成
- バイブコーディング基盤の確立

---

## 9.2 Phase A: GAS実装（2026-02-19）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| 86fa85d | 02-19 | refactor: Organize files by project and track deliverables |

### 主要成果

- GAS 6ファイル実装: config.gs, template.gs, validation_extended.gs, aggregation.gs, budget_health.gs, api.gs
- 提案資料: system_design_proposal.md (155KB), proposal_package.md (48KB)
- 設計レビュー: design_review_v2.md (37KB)
- PoC構築手順: poc_deployment_guide.md
- マスタデータ: master_items_initial.csv

---

## 9.3 Phase B-C: 設計レビュー対応（2026-02-19 ~ 02-20）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| 07920ef | 02-20 | docs: Unify project context as Morigumi budget management system |
| 31d936f | 02-20 | refactor: Remove GitHub Actions workflow, switch to manual DSL export |
| 48613ab | 02-20 | fix: Update skill line count and add .env to gitignore |
| fc00c69 | 02-20 | docs: Update GAS statistics and mark mockup fixes as completed |

### 設計レビュー対応（17件）

| ID | カテゴリ | 指摘 | 対応 |
|----|---------|------|------|
| SEC-01 | セキュリティ | APIキー管理 | PropertiesServiceに格納 |
| SEC-02 | セキュリティ | 個人情報漏洩リスク | anonymize=true パラメータ実装 |
| SEC-03 | セキュリティ | XSS対策 | sanitizeText()、escapeHtml_() |
| SEC-04 | セキュリティ | 入力バリデーション | MAX_TEXT_LENGTH=50、YYYY-MM検証 |
| QA-02 | 品質 | 同時編集対策 | スナップショット方式（takeSnapshot_） |
| QA-03 | 品質 | データ整合性 | 予算箱ID自動解決 |
| QA-04 | 品質 | エラーハンドリング | 統一レスポンス形式 |
| QA-05 | 品質 | マスタ一元化 | _Mマスタシートに一元化 |
| UX-02 | UX | 入力省力化 | copyPreviousRow() |
| UX-03 | UX | カスケードDD | onCategoryChange等の連鎖 |
| UX-04 | UX | 色分け保護 | Owner緑/Clerk青/Auto灰 |
| SITE-01 | 現場 | 費目コード | 土木工事体系に準拠（26費目） |
| SITE-02 | 現場 | 工種マスタ | 35工種 + available_elements |
| SITE-03 | 現場 | 入力期限 | checkInputDeadline() + メール通知 |
| SITE-04 | 現場 | 予算箱ID | generateBudgetBoxId() |
| SITE-05 | 現場 | 簡易予算 | applySimpleBudget() 8→26自動配分 |
| QA-01 | 品質 | (除外) | -- |

---

## 9.4 Phase D-F: PoC環境構築 & Dify DSL生成（2026-02-22）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| ddc6575 | 02-21 | docs: Add Phase 0 deliverables and PoC execution playbook |
| 790e90e | 02-22 | feat: Add Dify DSL workflows for budget inquiry and monthly report |
| 0f465a2 | 02-22 | fix: Unify sheet header names to Japanese in aggregation and budget_health |
| 65b27f9 | 02-22 | feat: Add dashboard mode to api.gs and hub.gs |
| ee45e6e | 02-22 | feat: Add PoC setup scripts and GAS project config |
| ad928e1 | 02-22 | fix: _月次調整シートのyear_month日付型変換バグを修正 |
| 1a4600f | 02-22 | feat: Phase D-F デモ資料完成 |

### 主要成果

- Dify DSL 2本生成: budget_inquiry_chatbot.dsl, monthly_report_workflow.dsl
- GAS追加: hub.gs（本社横断API）、ダッシュボードモード
- PoC実行プレイブック: poc_execution_playbook.md (39KB)
- シートヘッダー日本語統一
- _月次調整シートの日付型バグ修正

---

## 9.5 Phase G: ダッシュボード本物化（2026-02-22）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| 2408415 | 02-22 | feat: Phase G ダッシュボード本物化（mockup_sites.html API連携） |
| bd81092 | 02-22 | chore(cleanup): マンガ・工事成績評定の残骸ファイルを削除 |
| 77b7b87 | 02-22 | docs: README.md 新規作成 + CLAUDE.md を Phase G 完了状態に更新 |
| 752d420 | 02-22 | feat(demo): デモ環境完成 |

### 主要成果

- mockup_sites.html にGAS API連携を追加（6関数: initDashboard等）
- setup_demo_sites.gs: P002/P003 のデモSS自動作成
- XSS対策: createElement使用（innerHTML非使用）
- README.md 新規作成

---

## 9.6 Phase H: _M工事台帳正式稼働（2026-02-23）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| 9f3af8a | 02-22 | feat(hub): _M工事台帳 正式セットアップスクリプト追加 |
| f07666b | 02-23 | fix(demo): setup_demo_sites.gs デモSS作成先フォルダ指定 |

### 主要成果

- setup_hub_registry.gs: 13列ヘッダー + 4工事データ投入
- readRegistry_() が正本パスで動作確認
- mockup_sites.html の APIレスポンスパス修正（data.data.projects）

---

## 9.7 Phase I: API動的化（2026-02-23）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| ca99c90 | 02-23 | fix(dashboard): mockup_sites.html APIレスポンスパス修正 |
| 6223219 | 02-23 | feat(dashboard): Phase I - サイドバー・サマリーAPI動的化 |

### 主要成果

- サイドバー工事リストをAPI動的生成に改修
- サマリーカード（KPI 4枚）をAPI動的生成に改修
- ハードコード完了工事データを除去
- ブラウザ検証: API疎通・サイドバー4工事・コンソールエラーなし

---

## 9.8 Phase J: HtmlService化（2026-02-23）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| acc7baa | 02-23 | feat(dashboard): Phase J - HtmlService化 + デフォルトモード変更 |

### 主要成果

- mockup_sites.html → dashboard.html (1,484行) に変換
- CSS分離: dashboard_css.html (131行)
- JS分離: dashboard_js.html (916行)
- fetch() → google.script.run 変換
- hub.gs: include_() / getDashboardData() 追加
- doGet() デフォルトモードを dashboard に変更

---

## 9.9 Phase K: 本社向けチャットボット & 最終デプロイ（2026-02-23）

### コミット一覧

| ハッシュ | 日付 | メッセージ |
|---------|------|----------|
| 7eb5573 | 02-23 | feat(dify): Phase K + generated/ DSL拡張子を .dsl に統一 |
| 5e31794 | 02-23 | deploy(dashboard): Phase K GAS Web App再デプロイ + 本社向けDify embed URL確定 |

### 主要成果

- executive_report_chatbot.dsl: 本社向け経営分析チャットボット（7ノード）
- dashboard.html page4: iframe 2パネル化（所長向け + 本社向け）
- DSL拡張子を .yml → .dsl に統一
- GAS Web App 再デプロイ（複数デプロイ対応）
- Dify embed URL確定: 所長向け(8JW4EA9a) + 本社向け(eT6LUMaO)

---

# 第10章 APIリファレンス

## 10.1 api.gs（現場SS用 Web App）

### 基本情報

| 項目 | 値 |
|------|-----|
| デプロイ先 | 各現場SSにバインドされたGASプロジェクト |
| ベースURL | 現場SSごとに異なる |
| 認証 | APIキー（PropertiesServiceに格納） |
| レスポンス形式 | JSON |

### 共通レスポンス形式

```json
// 成功時
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-23T10:00:00.000Z"
}

// エラー時
{
  "success": false,
  "error": "エラーメッセージ",
  "timestamp": "2026-02-23T10:00:00.000Z"
}
```

### mode=health -- 予算健康度

```
GET ?mode=health&year_month=2026-02
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "year_month": "2026-02",
    "bac": 39840000,
    "pv": 19920000,
    "ac": 18500000,
    "consumption_rate": 46.4,
    "progress_rate": 50.0,
    "gap": -3.6,
    "signal": "正常",
    "shortage": 0,
    "last_updated": "2026-02-23T10:00:00"
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| bac | number | 実行予算合計（Budget at Completion） |
| pv | number | 計画値累計（Planned Value） |
| ac | number | 実績値累計（Actual Cost） |
| consumption_rate | number | 消化率（AC/BAC*100） |
| progress_rate | number | 出来高率 |
| gap | number | GAP（消化率-出来高率） |
| signal | string | 信号（正常/注意/超過） |
| shortage | number | 不足額（AC>BACの場合） |

### mode=master -- マスタデータ

```
GET ?mode=master
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "expense_items": [
      {"id": "E11", "name": "材料費", "category": "C01"},
      {"id": "F31", "name": "運搬費", "category": "C02"},
      ...
    ],
    "work_types": [
      {"id": "K0101", "name": "掘削工", "available_elements": ["E11","E12","E14","E15"]},
      ...
    ],
    "cost_elements": [
      {"id": "E11", "name": "材料費"},
      ...
    ]
  }
}
```

### mode=summary -- 予算/支出サマリー

```
GET ?mode=summary&year_month=2026-02
GET ?mode=summary&year_month=2026-02&anonymize=true
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "project_id": "P004",
    "project_name": "海潟漁港R7-1",
    "year_month": "2026-02",
    "budget_total": 39840000,
    "spent_total": 18500000,
    "consumption_rate": 46.4,
    "categories": {
      "C01": {"budget": 23724018, "spent": 11000000},
      "C02": {"budget": 7524000, "spent": 3500000},
      "C03": {"budget": 8591982, "spent": 4000000}
    }
  }
}
```

### mode=project -- プロジェクトメタデータ

```
GET ?mode=project
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "project_id": "P004",
    "project_name": "海潟漁港海岸保全施設整備連携工事(R7-1工区)",
    "manager": "上村",
    "contract_amount": 43000000,
    "start_date": "2025-09-01",
    "end_date": "2026-06-30",
    "project_type": "海岸",
    "client": "鹿児島県"
  }
}
```

### mode=aggregate -- 月次集計

```
GET ?mode=aggregate&year_month=2026-02
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "year_month": "2026-02",
    "monthly": {
      "2025-10": {"C01": 5000000, "C02": 2000000, "C03": 1500000, "ALL": 8500000},
      "2025-11": {"C01": 3500000, "C02": 1000000, "C03": 1200000, "ALL": 5700000},
      "2025-12": {"C01": 2500000, "C02": 500000, "C03": 1300000, "ALL": 4300000}
    },
    "cumulative": {"C01": 11000000, "C02": 3500000, "C03": 4000000, "ALL": 18500000}
  }
}
```

### mode=dashboard -- サイトダッシュボードHTML

```
GET ?mode=dashboard&year_month=2026-02
```

HTMLレスポンスを返却（ContentService ではなく HtmlOutput）。

---

## 10.2 hub.gs（本社管理台帳用 Web App）

### 基本情報

| 項目 | 値 |
|------|-----|
| デプロイ先 | 森組_工事管理台帳SSにバインド |
| ベースURL | `https://script.google.com/macros/s/AKfycbygy0ZX_cTbzxMgB8D-reGtIsGkQelzf_3M1iKgZM-rkPLPss2g_d4VpG0W9frGE-xs/exec` |
| 認証 | なし（公開） |
| レスポンス形式 | JSON（dashboard モード時はHTML） |
| デフォルトモード | dashboard |

### mode=projects_all -- 全工事メタデータ

```
GET ?mode=projects_all
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "project_id": "P001",
        "project_name": "境川河川改修工事",
        "manager_name": "田中",
        "contract_amount": 85000000,
        "start_date": "2025-04-01",
        "end_date": "2026-03-31",
        "status": "active",
        "spreadsheet_id": "1abc..."
      },
      ...
    ],
    "count": 4
  }
}
```

### mode=cross_summary -- 全工事横断サマリー

```
GET ?mode=cross_summary&year_month=2026-02
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "year_month": "2026-02",
    "projects": [
      {
        "project_id": "P001",
        "project_name": "境川河川改修工事",
        "budget_total": 85000000,
        "spent_total": 42000000,
        "consumption_rate": 49.4,
        "categories": { "C01": {...}, "C02": {...}, "C03": {...} }
      },
      ...
    ],
    "total": {
      "budget": 200000000,
      "spent": 95000000,
      "consumption_rate": 47.5
    }
  }
}
```

### mode=cross_health -- 全工事横断健康度

```
GET ?mode=cross_health&year_month=2026-02
```

Dify Cloudの3アプリが主に使用するモード。

レスポンス:
```json
{
  "success": true,
  "data": {
    "year_month": "2026-02",
    "projects": [
      {
        "project_id": "P001",
        "project_name": "境川河川改修工事",
        "manager": "田中",
        "bac": 85000000,
        "ac": 42000000,
        "consumption_rate": 49.4,
        "progress_rate": 55.0,
        "gap": -5.6,
        "signal": "正常",
        "status": "active"
      },
      ...
    ],
    "summary": {
      "total_projects": 4,
      "active": 3,
      "signals": {"正常": 2, "注意": 1, "超過": 1}
    }
  }
}
```

### mode=project_detail -- 個別工事詳細

```
GET ?mode=project_detail&project_id=P001&year_month=2026-02
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "project": { ... },
    "health": { ... },
    "summary": { ... }
  }
}
```

### mode=dashboard -- ダッシュボードHTML（デフォルト）

```
GET （パラメータなし）
GET ?mode=dashboard
GET ?mode=dashboard&year_month=2026-02
```

HtmlServiceで構築されたダッシュボードHTML（第5章参照）を返却。

---

# 第11章 デプロイ・運用ガイド

## 11.1 初回環境構築

### 前提条件

- Google Workspace アカウント
- Dify Cloud アカウント
- Python 3.8+ (スクリプト実行用)

### Step 1: 本社管理台帳SSの作成

1. Google Sheetsで新規スプレッドシート「森組_工事管理台帳」を作成
2. GASエディタを開き、以下のファイルを配置:
   - hub.gs
   - setup_hub_registry.gs
   - setup_demo_sites.gs
   - dashboard.html
   - dashboard_css.html
   - dashboard_js.html
   - appsscript.json
3. `setupHubRegistry()` を実行して _M工事台帳 シートを作成

### Step 2: 現場SSの作成（工事ごと）

1. Google Sheetsで新規スプレッドシートを作成
2. GASエディタに以下のファイルを配置:
   - config.gs
   - template.gs
   - validation_extended.gs
   - aggregation.gs
   - budget_health.gs
   - api.gs
   - setup_project_data.gs
3. `setupForPoC('alert@example.com')` を実行
4. `initProjectTemplate('P001')` を実行

### Step 3: SSIDの登録

1. 本社管理台帳SSの _M工事台帳 シートを開く
2. 対象工事の J列（spreadsheet_id）に現場SSのIDを記入
3. L列（gas_webapp_url）に現場SSのWeb App URLを記入

### Step 4: GAS Web Appのデプロイ

#### 現場SS用（api.gs）
1. GASエディタ → デプロイ → 新しいデプロイ
2. 種類: ウェブアプリ
3. 実行者: 自分
4. アクセス権: 全員
5. URLをコピー → _M工事台帳の L列に記入

#### 本社管理台帳SS用（hub.gs）
1. GASエディタ → デプロイ → 新しいデプロイ
2. 種類: ウェブアプリ
3. 実行者: 自分
4. アクセス権: 全員
5. URLをコピー → Dify環境変数 GAS_HUB_URL に設定

### Step 5: Dify Cloudのセットアップ

1. Dify Cloud にログイン
2. DSLファイル（dsl/generated/*.dsl）をインポート
3. 各アプリの環境変数 `GAS_HUB_URL` にStep 4のURLを設定
4. アプリを公開

## 11.2 新工事の追加手順

### 方法A: スクリプト使用

```bash
python scripts/add_new_project.py \
  --project_id P005 \
  --project_name "新工事名" \
  --spreadsheet_url "https://docs.google.com/spreadsheets/d/{ID}/edit" \
  --budget_total 50000000 \
  --start_date 2026-04-01 \
  --end_date 2027-03-31
```

出力されるチェックリストに従って設定を完了する。

### 方法B: 手動

1. 新規スプレッドシートを作成
2. GASファイル6本を配置
3. `setupForPoC()` → `initProjectTemplate()` 実行
4. Web Appをデプロイ
5. _M工事台帳にspreadsheet_id と gas_webapp_url を追加
6. 動作確認: `{HUB_URL}?mode=cross_health` で新工事が表示されることを確認

## 11.3 GAS再デプロイ手順

コード変更後のWeb App更新手順。

### チェックリスト

```
[ ] 1. GASエディタでコードを更新
     成功時: ファイル保存時にエラーなし

[ ] 2. デプロイ → デプロイを管理 → 鉛筆アイコン
     成功時: 編集画面が開く

[ ] 3. バージョン: 「新バージョン」を選択
     注意: 既存バージョンを選ぶと更新されない

[ ] 4. デプロイ → URLにアクセスして動作確認
     成功時: JSONまたはHTML が正常返却

[ ] 5. 複数デプロイがある場合、全て更新
     確認: 「デプロイを管理」で全デプロイのバージョンを確認
```

### 注意事項

- hub.gsの場合、「無題」デプロイ（HUB URL用）と「Phase K」デプロイの両方を更新する必要がある
- デプロイIDは変わらない（URLは維持される）
- バージョンを「新バージョン」にしないと反映されない

## 11.4 Difyトークン更新

```bash
# Claude Codeから
/refresh-dify-token

# 手動の場合
# 1. 認証コード送信
curl -X POST https://cloud.dify.ai/console/api/email-code-login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'

# 2. メールで届いた6桁コードを使ってトークン取得
curl -X POST https://cloud.dify.ai/console/api/email-code-login/validity \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","code":"123456"}'

# 3. Set-Cookieヘッダーからrefresh_tokenを抽出
export DIFY_REFRESH_TOKEN="rt-xxxxxxxx"
```

トークン有効期限: 30日間

## 11.5 トラブルシューティング

### API呼び出しで空データが返る

| 原因 | 対処 |
|------|------|
| _M工事台帳にSSIDが未登録 | J列にスプレッドシートIDを記入 |
| 現場SSのシートが未作成 | `initProjectTemplate()` を実行 |
| Web Appが未デプロイ | 「新しいデプロイ」を実行 |
| バージョンが古い | 「新バージョン」で再デプロイ |

### ダッシュボードが表示されない

| 原因 | 対処 |
|------|------|
| CDNブロック | 社内ネットワークでTailwind/Chart.jsのCDNがブロックされていないか確認 |
| GAS権限エラー | SpreadsheetApp.openById()の権限を確認（初回実行時に承認ダイアログ） |
| デフォルトモード変更 | hub.gs doGet()のデフォルトが「dashboard」であることを確認 |

### Difyチャットボットが応答しない

| 原因 | 対処 |
|------|------|
| GAS_HUB_URL未設定 | Difyアプリの環境変数を確認 |
| GAS Web Appタイムアウト | hub.gsの処理時間を確認（複数SS読み込みで遅延する場合がある） |
| HTTPリクエストタイムアウト | DSLのタイムアウト設定を確認（デフォルト60s） |

### 信号が全て「正常」になる

| 原因 | 対処 |
|------|------|
| _C_予算健康度シートが空 | `runFullBudgetHealthCalculation()` を実行 |
| 出来高率が0 | _月次調整シートに手動で出来高率を入力 |
| 支払明細が空 | テストデータを投入して確認 |

---

# 第12章 設計レビュー対応記録

## 12.1 セキュリティ（SEC）

### SEC-01: APIキー管理

| 項目 | 内容 |
|------|------|
| 指摘 | APIキーがコード内にハードコードされるリスク |
| 対応 | PropertiesService.getScriptProperties()に格納 |
| 実装 | config.gs `generateApiKey_()` → PropertiesServiceに保存 |
| 確認方法 | GASエディタ → プロジェクト設定 → スクリプトプロパティ |

### SEC-02: 個人情報漏洩リスク

| 項目 | 内容 |
|------|------|
| 指摘 | Dify Cloud経由で業者名・所長名が漏洩するリスク |
| 対応 | `anonymize=true` パラメータで匿名化 |
| 実装 | api.gs `anonymizeResponse_(data)`, `buildVendorAnonymizeMap_()` |
| 変換例 | 業者名→V001, 所長名→所長A |

### SEC-03: XSS対策

| 項目 | 内容 |
|------|------|
| 指摘 | ユーザー入力値のサニタイズ |
| 対応 | 2層防御: 入力時サニタイズ + 出力時エスケープ |
| 実装 | config.gs `sanitizeText()` (50文字制限、HTML除去), api.gs `escapeHtml_()`, dashboard_js.html `_esc()` |

### SEC-04: 入力バリデーション

| 項目 | 内容 |
|------|------|
| 指摘 | 不正データの入力防止 |
| 対応 | MAX_TEXT_LENGTH=50, YYYY-MM形式チェック |
| 実装 | validation_extended.gs `validateYearMonth()` |

## 12.2 品質保証（QA）

### QA-02: 同時編集対策

| 項目 | 内容 |
|------|------|
| 指摘 | 集計中にシートが編集されるとデータ不整合 |
| 対応 | スナップショット方式（一括読み込み後は配列操作のみ） |
| 実装 | aggregation.gs `takeSnapshot_()` |

### QA-03: データ整合性

| 項目 | 内容 |
|------|------|
| 指摘 | 予算配分と支払の紐付け |
| 対応 | 予算箱ID自動解決 |
| 実装 | validation_extended.gs `resolveBudgetBoxId()` → template.gs `generateBudgetBoxId()` |

### QA-04: エラーハンドリング

| 項目 | 内容 |
|------|------|
| 指摘 | APIエラー時のレスポンス不統一 |
| 対応 | 統一レスポンス形式 `{success, data/error, timestamp}` |
| 実装 | api.gs / hub.gs の全モードで統一 |

### QA-05: マスタ一元化

| 項目 | 内容 |
|------|------|
| 指摘 | マスタデータがコード内に散在 |
| 対応 | _Mマスタシートに一元化、api.gsはシートから動的読み込み |
| 実装 | api.gs `getMasterData_()` → `readMasterFromSheet_()` |

## 12.3 UX

### UX-02: 入力省力化

| 項目 | 内容 |
|------|------|
| 指摘 | 繰り返し入力が多い |
| 対応 | 前行コピー機能 |
| 実装 | config.gs `copyPreviousRow()` → カスタムメニューから実行 |

### UX-03: カスケードドロップダウン

| 項目 | 内容 |
|------|------|
| 指摘 | 費目選択が複雑 |
| 対応 | B列→C列→D列→E列の連鎖DD |
| 実装 | validation_extended.gs `onCategoryChange()` 他 |

### UX-04: 色分け保護

| 項目 | 内容 |
|------|------|
| 指摘 | 入力可能範囲がわかりにくい |
| 対応 | 3色分け: Owner(A-K)=緑, Clerk(L-M)=青, Auto(N-R)=灰 |
| 実装 | config.gs `applySheetProtection()` + template.gs |

## 12.4 現場対応（SITE）

### SITE-01~04: 費目/工種/予算箱

| ID | 指摘 | 対応 |
|----|------|------|
| SITE-01 | 費目コードが建築混在 | 土木工事体系に統一（26費目） |
| SITE-02 | 工種マスタが不十分 | 35工種 + available_elements |
| SITE-03 | 入力忘れ防止 | checkInputDeadline() + メール通知 |
| SITE-04 | 予算紐付けが曖昧 | generateBudgetBoxId() で自動ID |

### SITE-05: 簡易予算入力

| 項目 | 内容 |
|------|------|
| 指摘 | 26費目の予算配分が複雑 |
| 対応 | 8大項目を入力すれば26費目に自動配分 |
| 実装 | template.gs `applySimpleBudget()` |

---

# 第13章 出力ドキュメント一覧

## 13.1 提案フェーズ

| ファイル | サイズ | 内容 |
|---------|--------|------|
| proposal_package.md | 47,817B | 統合提案資料（工事概要、システム設計、導入計画） |
| system_design_proposal.md | 155,158B | 設計書（最大ファイル、全システム詳細仕様） |
| presentation_slides.md | 7,917B | プレゼン骨子（Markdown形式のスライド構成） |

## 13.2 実装フェーズ

| ファイル | サイズ | 内容 |
|---------|--------|------|
| poc_deployment_guide.md | 10,977B | PoC構築手順書（Phase A用） |
| poc_execution_playbook.md | 39,461B | PoC実行プレイブック（1日で完了する手順） |
| consulting_flow_action_plan.md | 13,569B | コンサルフロー & アクションプラン |

## 13.3 検証フェーズ

| ファイル | サイズ | 内容 |
|---------|--------|------|
| design_review_v2.md | 37,402B | 設計レビュー討議録（17項目） |
| diagnosis_e2e_and_evm.md | 26,856B | 一気通貫システム診断 + EVM検討 |
| demo_scenario.md | 34,258B | 提案デモ台本（692行、Phase G対応） |
| dashboard_setup_checklist.md | 9,446B | ダッシュボードセットアップ手順 |
| gas_redeploy_checklist.md | 4,035B | GAS再デプロイ手順 |

## 13.4 データファイル

| ファイル | サイズ | 内容 |
|---------|--------|------|
| poc_test_data.tsv | 10,335B | 支払明細テストデータ（82件、18列） |
| poc_budget.tsv | 1,293B | 実行予算テーブル（13行、9列） |
| poc_vendors.tsv | 1,140B | 取引先マスタ |
| master_items_initial.csv | 4,115B | 初期マスタデータ（費目/工種/取引先） |

## 13.5 UIモックアップ・マニュアル

| ファイル | サイズ | 内容 |
|---------|--------|------|
| mockup_sheets.html | 139,020B | スプレッドシートUIモックアップ |
| mockup_sites.html | 139,931B | ダッシュボードUIモックアップ（API連携版） |
| manual_director.html | 27,234B | 所長向け操作マニュアル |
| manual_office_staff.html | 17,422B | 事務員向け操作マニュアル |

## 13.6 画像・スクリーンショット

| ファイル | サイズ | 内容 |
|---------|--------|------|
| dify_chatbot_overview.png | 198,156B | Difyチャットボット概要図 |
| gas_editor_check.png | 198,156B | GASエディタ確認画面 |
| screenshots/ss1-ss7.png | -- | デモ用スクリーンショット（7枚） |

---

# 第14章 Claude Codeスキル

## 14.1 dify-dsl-generator（530行）

### 概要

自然言語の要件からDify Cloud互換のDSL（YAML）を自動生成するスキル。

### トリガー

```
@dify-dsl-generator
```

### 生成ワークフロー

```
1. 要件確認（目的、ノードタイプ、入出力形式）
2. テンプレート選択
   参照優先順位:
   [1] dsl/exported/（動作確認済み実例）
   [2] dsl/templates/_base_template_enhanced.yml
   [3] dsl/templates/ の40テンプレート
3. DSL生成（ノード定義 + エッジ + 環境変数）
4. 品質検証（11項目チェックリスト）
```

### 絶対ルール

| ルール | OK | NG |
|--------|-----|-----|
| DSLバージョン | `version: '0.1.2'` | `version: '0.5.0'` |
| ノードID | `'1000000001'` | `'start-1'` |
| 変数参照 | `{{#id.var#}}` | `{{ id.var }}` |
| ファイル拡張子 | `.dsl` | `.yml`（生成時） |

### 品質チェックリスト（11項目）

1. version: 0.1.2
2. ノードID形式（数字文字列）
3. 変数参照形式
4. Edge必須フィールド（isInIteration, isInLoop, zIndex）
5. LLM edition_type: basic
6. LLM structured_output_enabled: false
7. 環境変数の定義
8. Start/End(またはAnswer)ノードの存在
9. ノード間の接続整合性
10. Position規則（x: 80→380→680→980→1280、y: 282）
11. プレースホルダーなし

### 出力先

```
dsl/generated/{workflow_name}.dsl
```

---

## 14.2 gas-webapp-generator（385行）

### 概要

スプレッドシートデータをJSON APIとして公開するGASコードを自動生成するスキル。

### トリガー

```
@gas-webapp-generator
```

### 提供パターン

| パターン | 説明 |
|---------|------|
| 最小構成 | データ全件取得 |
| フィルタリング対応 | パラメータ条件絞り込み、日付範囲、件数制限 |
| 複数シート対応 | `e.parameter.sheet` で動的選択 |
| 集計機能付き | 件数集計、カテゴリ別集計 |

### 絶対ルール

| ルール | 詳細 |
|--------|------|
| レスポンス形式 | `{ success: bool, count/error: xxx, data: [] }` |
| MIME Type | ContentService.MimeType.JSON |
| エラーハンドリング | try-catch必須、catch内でJSON返却 |
| シート名 | 変数化必須（ハードコード禁止） |
| パラメータ | `doGet(e)` / `doPost(e)` で e 必須 |

### 出力先

```
gas_templates/{category}/{api_name}.js
```

---

## 14.3 refresh-dify-token（54行）

### 概要

Dify Cloudのリフレッシュトークンを取得・更新するスキル。

### トリガー

```
/refresh-dify-token
```

### 処理フロー

```
1. メールアドレス確認（デフォルト: naieco2006@gmail.com）
2. POST /console/api/email-code-login → 認証コード送信
3. ユーザーがメール経由でコード入力（6桁、5分以内）
4. POST /console/api/email-code-login/validity → トークン取得
5. 環境変数 DIFY_REFRESH_TOKEN に設定
```

### トークン仕様

| 項目 | 値 |
|------|-----|
| 変数名 | DIFY_REFRESH_TOKEN |
| 有効期限 | 30日間 |
| 用途 | export_dify_workflows.py の実行 |

## 14.4 バイブコーディングワークフロー

```
[ユーザー] 自然言語で要件を記述
    |
    v
[@dify-dsl-generator] DSL自動生成
    |
    +-- テンプレート参照（40本）
    +-- ノード構成決定
    +-- YAML出力
    |
    v
[品質検証] 11項目チェック
    |
    v
[Dify Cloud] DSLインポート
    |
    v
[動作確認] → 問題あれば修正ループ
    |
    v
[GAS連携] @gas-webapp-generator でAPI作成（必要に応じて）
    |
    v
[本番稼働]
```

---

# 第15章 残課題と今後の展開

## 15.1 ナレッジベース戦略

### 現状

3つのDifyアプリはKnowledge Retrievalノードなし（ナレッジベース空）で稼働中。GAS APIのデータのみで回答を生成している。

### 今後の計画

| アプリ | 蓄積予定の文書 | 期待効果 |
|--------|-------------|---------|
| 予実照会チャットボット | 現場ノウハウ文書（施工手順、安全管理） | コスト削減の具体的提案が可能に |
| 経営分析チャットボット | 経営判断資料（過去の経営会議資料、業界レポート） | 経営判断の根拠を提示可能に |

### 実装方法

1. Dify CloudでKnowledge Baseを作成
2. 文書をアップロード
3. DSLにKnowledge Retrievalノードを追加（Code→HTTP並列の後に挿入）
4. LLMプロンプトにナレッジ参照を追加

## 15.2 横展開

### 他現場への展開

現在4工事（P001-P004）で稼働中。新工事の追加は以下のみ:

1. `_M工事台帳` に行を追加
2. 現場SSを作成しGASを配置
3. Web Appをデプロイ

`add_new_project.py` でチェックリストが自動生成される。

### 他部署への展開

- 経理部門: 支払明細の承認ワークフロー
- 安全管理: KYシート・安全日誌との連携
- 品質管理: 検査記録との連携

## 15.3 セキュリティ強化

### 現状のリスク

| リスク | 現状 | 対策案 |
|--------|------|--------|
| GAS Web App公開アクセス | APIキーなし公開 | OAuth2.0 / サービスアカウント認証の導入 |
| Dify Cloud経由のデータ漏洩 | anonymize=true オプション | デフォルトで匿名化 ON |
| スプレッドシートの権限管理 | 手動管理 | 自動権限設定スクリプト |

### 優先度

1. (高) GAS Web AppのAPIキー認証を本番で有効化
2. (中) anonymize のデフォルトON化
3. (低) OAuth2.0の導入検討

## 15.4 機能拡張候補

| 機能 | 優先度 | 概要 |
|------|--------|------|
| 承認ワークフロー | 高 | 支払明細の所長→本社承認フロー |
| PDF出力 | 中 | 月次レポートのPDF自動生成 |
| Slack通知 | 中 | 信号変更時のSlack/Teams通知 |
| モバイル最適化 | 低 | ダッシュボードのPWA化 |
| 予測分析 | 低 | 過去データに基づく予算超過予測 |

---

# 付録A シート名・列名一覧

## A.1 現場SS（工事ごと）

### _Mマスタ

| 列 | フィールド名 | 説明 |
|----|------------|------|
| A | type | expense_item / work_type / cost_element |
| B | id | E11, F31, K0101 等 |
| C | name | 名称 |
| D | category | C01 / C02 / C03（expense_item のみ） |
| E | available_elements | E11,E12,E14 等（work_type のみ） |

### _M取引先

| 列 | フィールド名 | 説明 |
|----|------------|------|
| A | vendor_id | V001, V002, ... |
| B | vendor_name | 業者名 |
| C | vendor_type | subcontractor / supplier / service / retail |
| D | active | TRUE / FALSE |

### _実行予算テーブル

| 列 | フィールド名 | 説明 |
|----|------------|------|
| A | budget_box_id | C01-W04-K0101-E11 等 |
| B | category | C01 / C02 / C03 |
| C | work_type_id | W04 等（C01のみ） |
| D | koushus_id | K0101 等（C01のみ） |
| E | expense_id | E11 / F31 / F51 等 |
| F | expense_name | 費目名 |
| G | budget_amount | 予算額 |
| H | unit | 単位 |
| I | unit_price | 単価 |
| J | quantity | 数量 |

### _実行予算_月別

| 列 | フィールド名 | 説明 |
|----|------------|------|
| A | budget_box_id | 予算箱ID |
| B | expense_name | 費目名 |
| C~ | YYYY-MM | 月ごとの計画値（PV） |

### 支払明細入力（18列）

| 列 | フィールド名 | 入力者 | 色 |
|----|------------|--------|-----|
| A | No. | 自動 | 灰 |
| B | カテゴリ | 所長 | 緑 |
| C | 工事種別 | 所長 | 緑 |
| D | 工種 | 所長 | 緑 |
| E | 費目 | 所長 | 緑 |
| F | 支払先 | 所長 | 緑 |
| G | 支払年月 | 所長 | 緑 |
| H | 数量 | 所長 | 緑 |
| I | 単位 | 所長 | 緑 |
| J | 単価 | 所長 | 緑 |
| K | 金額 | 所長 | 緑 |
| L | 相殺額 | 事務員 | 青 |
| M | 相殺先 | 事務員 | 青 |
| N | 課税区分 | 自動 | 灰 |
| O | 消費税 | 自動 | 灰 |
| P | 税込合計 | 自動 | 灰 |
| Q | 予算箱ID | 自動 | 灰 |
| R | 備考 | -- | 灰 |

### _C_予算健康度

| 列 | フィールド名 | 説明 |
|----|------------|------|
| A | year_month | 対象年月（YYYY-MM） |
| B | bac | 実行予算合計 |
| C | pv | 計画値累計 |
| D | ac | 実績値累計 |
| E | consumption_rate | 消化率（%） |
| F | progress_rate | 出来高率（%） |
| G | gap | GAP（消化率-出来高率） |
| H | shortage | 不足額 |
| I | signal | 信号（正常/注意/超過） |
| J | last_updated | 最終更新日時 |

### _C_月次集計

| 列 | フィールド名 | 説明 |
|----|------------|------|
| A | year_month | 対象年月 |
| B | C01 | 直接工事費合計 |
| C | C02 | 共通仮設費合計 |
| D | C03 | 現場管理費合計 |
| E | ALL | 全カテゴリ合計 |

### _C_費目別集計

| 列 | フィールド名 | 説明 |
|----|------------|------|
| A | budget_box_id | 予算箱ID |
| B | expense_name | 費目名 |
| C | budget_amount | 予算額 |
| D | spent_amount | 支出累計 |
| E | remaining | 残額 |
| F | consumption_rate | 消化率（%） |

### _月次調整

| 列 | フィールド名 | 説明 |
|----|------------|------|
| A | year_month | 対象年月 |
| B | progress_rate | 出来高率（手動入力） |
| C | memo | 備考 |

## A.2 本社管理台帳SS

### _M工事台帳（13列）

第2章 2.3節 参照。

---

# 付録B Gitコミット履歴

全35コミット（Dify_project関連）

| No. | ハッシュ | 日付 | メッセージ |
|-----|---------|------|----------|
| 1 | 32f2ca6 | 2025-12-24 | Initial commit: Dify Workflow Development Project |
| 2 | f5b1043 | 2025-12-24 | Fix: Add default value for DIFY_BASE_URL |
| 3 | b06b2ec | 2025-12-24 | Fix: Change authentication to Email/Password login |
| 4 | af54fc2 | 2025-12-25 | Feat: Switch to refresh_token authentication |
| 5 | caa923b | 2025-12-25 | Fix: Add CSRF token to API requests |
| 6 | 01c9889 | 2025-12-27 | Revert: refresh_token方式に復元 |
| 7 | 25c9427 | 2025-12-27 | Fix: Cookie送信方式をヘッダー直接指定に変更 |
| 8 | f4fbf8f | 2025-12-27 | Debug: トークン情報を出力 |
| 9 | ae21d78 | 2025-12-27 | Feat: Add CSRF token support for Dify Console API |
| 10 | f0712da | 2025-12-27 | Fix: Send CSRF token in both Cookie and X-CSRF-Token header |
| 11 | 0e32fa1 | 2025-12-27 | refactor: Remove work004 migration artifacts |
| 12 | 4be45d0 | 2025-12-27 | docs: Add context enrichment design philosophy |
| 13 | 30eeafd | 2025-12-27 | feat: Add initial DSL export for context enrichment |
| 14 | 86fa85d | 2026-02-19 | refactor: Organize files by project and track deliverables |
| 15 | 07920ef | 2026-02-20 | docs: Unify project context as Morigumi budget management system |
| 16 | 31d936f | 2026-02-20 | refactor: Remove GitHub Actions workflow, switch to manual DSL export |
| 17 | 48613ab | 2026-02-20 | fix: Update skill line count and add .env to gitignore |
| 18 | fc00c69 | 2026-02-20 | docs: Update GAS statistics and mark mockup fixes as completed |
| 19 | ddc6575 | 2026-02-21 | docs: Add Phase 0 deliverables and PoC execution playbook |
| 20 | 790e90e | 2026-02-22 | feat: Add Dify DSL workflows for budget inquiry and monthly report |
| 21 | 0f465a2 | 2026-02-22 | fix: Unify sheet header names to Japanese |
| 22 | 65b27f9 | 2026-02-22 | feat: Add dashboard mode to api.gs and hub.gs |
| 23 | ee45e6e | 2026-02-22 | feat: Add PoC setup scripts and GAS project config |
| 24 | ad928e1 | 2026-02-22 | fix: _月次調整シートのyear_month日付型変換バグを修正 |
| 25 | 1a4600f | 2026-02-22 | feat: Phase D-F デモ資料完成 |
| 26 | 2408415 | 2026-02-22 | feat: Phase G ダッシュボード本物化 |
| 27 | bd81092 | 2026-02-22 | chore(cleanup): マンガ・工事成績評定の残骸ファイルを削除 |
| 28 | 77b7b87 | 2026-02-22 | docs: README.md 新規作成 + CLAUDE.md 更新 |
| 29 | 752d420 | 2026-02-22 | feat(demo): デモ環境完成 |
| 30 | 9f3af8a | 2026-02-22 | feat(hub): _M工事台帳 正式セットアップスクリプト追加 |
| 31 | f07666b | 2026-02-23 | fix(demo): setup_demo_sites.gs デモSS作成先フォルダ指定 |
| 32 | ca99c90 | 2026-02-23 | fix(dashboard): mockup_sites.html APIレスポンスパス修正 |
| 33 | 6223219 | 2026-02-23 | feat(dashboard): Phase I - サイドバー・サマリーAPI動的化 |
| 34 | acc7baa | 2026-02-23 | feat(dashboard): Phase J - HtmlService化 |
| 35 | 7eb5573 | 2026-02-23 | feat(dify): Phase K + DSL拡張子を .dsl に統一 |
| 36 | 5e31794 | 2026-02-23 | deploy(dashboard): Phase K GAS Web App再デプロイ |

---

# 付録C ファイルサイズ一覧

## C.1 GASファイル

| ファイル | 行数 | 関数数 |
|---------|------|--------|
| config.gs | 434 | 11 |
| budget_health.gs | 621 | 16 |
| template.gs | 1,127 | 22 |
| validation_extended.gs | 466 | 13 |
| aggregation.gs | 543 | 12 |
| api.gs | 943 | 26 |
| hub.gs | 644 | 17 |
| setup_hub_registry.gs | 163 | 2 |
| setup_demo_sites.gs | 199 | 5 |
| setup_project_data.gs | 304 | -- |
| **小計（.gs 10本）** | **5,444** | **124** |
| dashboard.html | 1,484 | -- |
| dashboard_css.html | 131 | -- |
| dashboard_js.html | 916 | 25 |
| appsscript.json | 1 | -- |
| **小計（HTML/JSON 4本）** | **2,532** | **25** |
| **GAS合計（14本）** | **7,976** | **149** |

## C.2 Dify DSLファイル

| ファイル | 行数 | ノード数 |
|---------|------|---------|
| budget_inquiry_chatbot.dsl | 288 | 5 |
| monthly_report_workflow.dsl | 347 | 6 |
| executive_report_chatbot.dsl | 402 | 7 |
| **DSL合計（3本）** | **1,037** | **18** |

## C.3 Pythonスクリプト

| ファイル | 行数 |
|---------|------|
| add_new_project.py | 304 |
| export_dify_workflows.py | 251 |
| prepare_poc_data.py | 473 |
| **Python合計（3本）** | **1,028** |

## C.4 総合統計

| カテゴリ | ファイル数 | 総行数 |
|---------|----------|--------|
| GAS（.gs + .html + .json） | 14 | 7,976 |
| Dify DSL（.dsl） | 3 | 1,037 |
| Python（.py） | 3 | 1,028 |
| ドキュメント（output/ .md） | 11 | -- |
| UIモックアップ・マニュアル（.html） | 4 | -- |
| データ（.tsv, .csv） | 4 | -- |
| 画像（.png） | 9 | -- |
| Claude Codeスキル（.md） | 3 | ~970 |
| **全成果物合計** | **51** | **10,041+** |

---

# 文書終了

本ドキュメントは森組 工事予算管理システム x Dify Cloud連携プロジェクトの全成果物を網羅する引継ぎドキュメントである。

後任エンジニアは第11章「デプロイ・運用ガイド」を起点に運用を引き継ぎ、第15章の残課題を参考に今後の開発を計画されたい。

---

文書バージョン: 1.0
作成日: 2026-02-23
作成ツール: Claude Code (Opus 4.6)
