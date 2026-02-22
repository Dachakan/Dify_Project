# 複数現場ダッシュボード セットアップチェックリスト

森組 工事予算管理システム - Phase H デモ環境セットアップ手順

- 対象: P001（境川河川改修）/ P002（持木川中流部）/ P003（野尻川除石）
- 所要時間: 約15〜20分
- 前提: Google アカウントにログイン済み、GAS プロジェクト（hub.gs バインド）へのアクセス権あり

---

## 事前確認

- [ ] 「森組_工事管理台帳」スプレッドシートにアクセスできる
- [ ] hub.gs がバインドされた GAS プロジェクトを開ける
- [ ] `_M工事台帳` シートの J列（spreadsheet_id）が P001〜P004 全て空欄であることを確認
  - 成功時: J列のセルが空白

---

## Step 1: setup_demo_sites.gs の実行（P001/P002/P003 デモ SS 作成）

### 1-1. GAS エディタを開く

- [ ] 「森組_工事管理台帳」スプレッドシートを開く
  - 画面上部メニューの「拡張機能」→「Apps Script」をクリック
  - 成功時: GAS エディタが別タブで開く

### 1-2. setup_demo_sites.gs を追加する

- [ ] GAS エディタ左側のファイル一覧で「+」ボタンをクリック
- [ ] 「スクリプト」を選択し、ファイル名に `setup_demo_sites` と入力して Enter
  - 成功時: エディタに空のファイルが作成される

- [ ] 以下のコードを全てコピーして、エディタに貼り付ける

=== コピー用コード ===
以下を全てコピーしてください（`setup_demo_sites.gs` の内容全文）:

---開始---
（プロジェクトディレクトリ `gas_templates/budget_management/setup_demo_sites.gs` の内容を貼り付ける）
---終了---

コピー完了後、次のステップへ進んでください。

### 1-3. 関数を実行する

- [ ] GAS エディタ上部の関数選択ドロップダウンで `setupDemoSites` を選択
  - 位置: エディタ上部中央、「実行」ボタンの左隣にあるドロップダウン
- [ ] 「実行」ボタン（三角マーク）をクリック
  - 成功時: 「実行ログ」パネルが画面下部に表示される

- [ ] 初回実行時は権限承認が求められる場合がある
  - 「権限を確認」→「詳細」→「森組_工事管理台帳（安全でないページ）に移動」→「許可」

---

## Step 2: SS ID の確認・転記

### 2-1. 実行ログから SS ID を確認する

- [ ] GAS エディタ下部の「実行ログ」に以下のような出力が表示されることを確認する

```
=== デモSS作成開始 ===
P001 境川河川改修 SS ID: 1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
P002 持木川中流部 SS ID: 1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
P003 野尻川除石 SS ID: 1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
---
_M工事台帳 への転記内容:
P001 J列: 1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
P002 J列: 1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
P003 J列: 1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
P004 J列: （P004は既存SS IDを使用）
=== デモSS作成完了 ===
```

- 成功時: 各 SS ID（44文字の英数字）が3行分表示される

### 2-2. _M工事台帳 に SS ID を転記する

- [ ] 「森組_工事管理台帳」スプレッドシートに戻り、`_M工事台帳` シートを開く
- [ ] P001 行の J列（spreadsheet_id）に、ログの「P001 J列:」に表示された SS ID を貼り付ける
- [ ] P002 行の J列 に、「P002 J列:」の SS ID を貼り付ける
- [ ] P003 行の J列 に、「P003 J列:」の SS ID を貼り付ける
  - 成功時: J列 3行分に SS ID（44文字）が入力されている

---

## Step 3: hub.gs 疎通確認（cross_health API）

- [ ] ブラウザの新しいタブで以下の URL にアクセスする

```
{GAS_HUB_URL}?mode=cross_health&month=2025-12
```

`{GAS_HUB_URL}` は hub.gs のデプロイ URL に置き換える
（`https://script.google.com/macros/s/...../exec` 形式）

- 成功時: 以下のような JSON が返却される

```json
{
  "success": true,
  "mode": "cross_health",
  "data": {
    "yearMonth": "2025-12",
    "projects": [
      { "project_id": "P001", "project_name": "境川河川改修", "signal": "正常", "consumption_rate": 70.0 },
      { "project_id": "P002", "project_name": "持木川中流部", "signal": "注意", "consumption_rate": 86.0 },
      { "project_id": "P003", "project_name": "野尻川除石", "signal": "超過", "consumption_rate": 110.0 },
      { "project_id": "P004", "project_name": "海潟漁港海岸保全R7-1工区", ... }
    ]
  }
}
```

- 「未接続」が表示される工事がある場合: Step 2 の SS ID 転記をやり直す
- `status: "エラー"` が出る場合: トラブルシューティングを参照

---

## Step 4: mockup_sites.html 動作確認

- [ ] プロジェクトディレクトリの `output/mockup_sites.html` をブラウザで開く
  - ファイルをダブルクリック、または `file://` パスでブラウザに直接ドラッグ

- [ ] ブラウザの開発者ツール（F12）のコンソールを開く

- [ ] ページ右上の「データ取得」ボタンをクリック（またはページロード時に自動実行）
  - 成功時: ダッシュボードに3〜4工事のカードが表示される
  - 各カードに「信号」「消化率」「出来高率」が表示される

- [ ] 各工事カードの信号を確認する

| 工事名 | 期待する信号 | 消化率 |
|--------|------------|--------|
| 境川河川改修 | 正常（緑） | 70% |
| 持木川中流部 | 注意（黄） | 86% |
| 野尻川除石 | 超過（赤） | 110% |
| 海潟漁港海岸保全R7-1工区 | （接続済みならデータ表示） | - |

- 成功時: 超過1件・注意1件・正常2件（P004接続済みの場合）のサマリーカードが上部に表示される

---

## トラブルシューティング

### SS ID 転記後も「未接続」が表示される

原因: _M工事台帳 の J列に SS ID が正しく入力されていない可能性

対処:
1. `_M工事台帳` シートを開き、J列の値をコピーして確認
2. SS ID は44文字の英数字（例: `1BxR2ABC...`）
3. 先頭/末尾の空白が入っていないか確認（セルをクリックして数式バーで確認）

### `status: "エラー"` が返却される

原因: hub.gs が対象 SS にアクセスできない権限エラーの可能性

対処:
1. デモ SS を作成したアカウントと hub.gs を実行するアカウントが同一か確認
2. 別アカウントの場合: デモ SS を hub.gs 実行アカウントと共有する（編集者権限）

### mockup_sites.html でデータが表示されない

原因: GAS_HUB_URL の設定ミスまたは CORS の問題

対処:
1. mockup_sites.html 内の `GAS_HUB_URL` 変数が正しい URL になっているか確認
2. Step 3 の直接アクセスで JSON が返ることを先に確認する
3. ブラウザコンソール（F12）のエラーメッセージを確認する

### setup_demo_sites.gs の実行でエラーが出る

対処:
1. 「スプレッドシートを作成する権限がありません」→ Google ドライブの容量確認
2. 「実行時間超過」→ P001/P002/P003 を個別の関数（`createDemoSite_P001_()` 等）で1つずつ実行する

---

## 完了確認

全ステップ完了後、以下の状態になっていることを確認する:

- [ ] Google ドライブに「森組_境川河川改修_デモ」「森組_持木川中流部_デモ」「森組_野尻川除石_デモ」の3つのSSが作成されている
- [ ] 各デモ SS に `_C_予算健康度` シートが存在し、3行のデータが入っている
- [ ] `_M工事台帳` J列に P001/P002/P003 の SS ID が転記されている
- [ ] `cross_health?month=2025-12` API が3〜4工事のデータを返す
- [ ] `mockup_sites.html` で複数工事カードが信号付きで表示される

以上のチェックが全て完了したら、Phase H のデモ環境セットアップは完了です。
