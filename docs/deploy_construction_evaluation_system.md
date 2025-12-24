# 工事成績評定分析システム デプロイ手順書

## 概要

工事成績評定通知書のデータをDifyで自動分析するシステムのセットアップ手順。

```
[スプレッドシート] → [GAS Web App] → [Dify Workflow] → [分析レポート]
```

---

## Step 1: GAS Web Appのデプロイ

### 1.1 スクリプト作成

1. Google スプレッドシートを開く
2. **拡張機能** > **Apps Script** をクリック
3. 新規プロジェクトが開く
4. `gas_templates/gas_construction_evaluation_api.js` の内容を貼り付け

### 1.2 スプレッドシートID確認

スプレッドシートのURLから ID を確認:
```
https://docs.google.com/spreadsheets/d/【この部分がID】/edit
```

例: `1-RaPjijxCzkPloRfuYP05-HHtvnsdwOZ`

### 1.3 コード修正

GASコード内の以下を修正:
```javascript
const SPREADSHEET_ID = '1-RaPjijxCzkPloRfuYP05-HHtvnsdwOZ'; // 実際のIDに変更
const SHEET_NAME = '工事成績評定通知書'; // シート名を確認して変更
```

### 1.4 テスト実行

1. GASエディタで `testGetData` 関数を選択
2. **実行** ボタンをクリック
3. **表示** > **ログ** でデータが取得できているか確認

### 1.5 Web Appデプロイ

1. **デプロイ** > **新しいデプロイ**
2. **種類を選択** > **ウェブアプリ**
3. 設定:
   - 説明: 「工事成績評定API v1.0」
   - 次のユーザーとして実行: 「自分」
   - アクセスできるユーザー: 「全員」
4. **デプロイ** をクリック
5. **ウェブアプリのURL** をコピー（後で使用）

```
https://script.google.com/macros/s/XXXXXXXXXXXXXX/exec
```

### 1.6 動作確認

ブラウザで以下にアクセス:
```
{デプロイURL}?mode=summary
```

JSONが返ってくれば成功。

---

## Step 2: Dify ワークフローのインポート

### 2.1 Difyにログイン

https://cloud.dify.ai にアクセスしてログイン

### 2.2 DSLファイルのインポート

1. **スタジオ** > **アプリを作成**
2. **DSLファイルをインポート** を選択
3. `dsl/construction_evaluation_analysis_workflow.yml` をアップロード
4. インポート完了を確認

### 2.3 環境変数の設定

1. インポートしたアプリを開く
2. 右上の **設定** アイコン（歯車）をクリック
3. **環境変数** タブを選択
4. `gas_webapp_url` に Step 1.5 でコピーしたURLを設定
5. **保存**

---

## Step 3: ワークフローのテスト

### 3.1 テスト実行

1. ワークフロー画面で **実行** ボタンをクリック
2. 入力パラメータを設定:
   - **analysis_type**: `summary`（初回は概要から）
   - **focus_category**: 空欄でOK
3. **実行** をクリック

### 3.2 結果確認

- 正常: 工事評定の分析レポートが生成される
- エラー: エラーレポートが生成される（原因と対処法を確認）

---

## Step 4: 公開（オプション）

### 4.1 API公開

1. **公開** ボタンをクリック
2. **API** タブで APIキーを生成
3. 外部システムから呼び出し可能に

### 4.2 API呼び出し例

```bash
curl -X POST 'https://api.dify.ai/v1/workflows/run' \
  -H 'Authorization: Bearer {api_key}' \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": {
      "analysis_type": "detail",
      "focus_category": "施工状況"
    },
    "user": "user-123"
  }'
```

---

## トラブルシューティング

### GAS関連

| 問題 | 原因 | 対処 |
|------|------|------|
| 403エラー | 権限不足 | 「全員」にアクセス許可を設定 |
| データが空 | シート名不一致 | SHEET_NAMEを確認 |
| JSONエラー | データ形式不正 | スプレッドシートの構造確認 |

### Dify関連

| 問題 | 原因 | 対処 |
|------|------|------|
| HTTP Requestエラー | URL未設定 | 環境変数を確認 |
| タイムアウト | データ量過多 | GAS側でフィルタリング |
| 分析エラー | データ形式不正 | code-validatorのログ確認 |

---

## 分析タイプの説明

| タイプ | 説明 | ユースケース |
|--------|------|-------------|
| `summary` | 概要レポート | 経営層への報告 |
| `detail` | 詳細分析 | 改善計画策定 |
| `improvement` | 改善提案特化 | 次回工事の対策 |

## 重点カテゴリの選択肢

- `施工体制`: 体制・技術者配置の分析
- `施工状況`: 施工管理・安全対策の分析
- `出来形品質`: 品質・出来ばえの分析
- `工事特性`: 加点項目の獲得分析
- `創意工夫`: 創意工夫の評価分析
- `社会性等`: 地域貢献の評価分析

---

## ファイル一覧

| ファイル | 説明 |
|----------|------|
| `gas_templates/gas_construction_evaluation_api.js` | GAS Web Appコード |
| `dsl/construction_evaluation_analysis_workflow.yml` | Dify DSLファイル |
| `docs/deploy_construction_evaluation_system.md` | 本手順書 |
