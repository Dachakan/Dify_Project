# GAS WebApp Generator

## 概要
Google Apps Script（GAS）でスプレッドシートデータをJSON APIとして公開するウェブアプリコードを自動生成するスキル。

## 使用タイミング
- スプレッドシートのデータをDifyから取得したいとき
- 「GASでAPI化して」と依頼されたとき
- 外部からスプレッドシートデータにアクセスする必要があるとき

## 入力
- スプレッドシートの構造（シート名、カラム名）
- 必要なフィルタリング条件（オプション）
- 認証要件（オプション）

## 出力
- GASコード（.js ファイル）
- デプロイ手順の説明

## GASウェブアプリの基本構造

### 最小構成（全データ取得）
```javascript
/**
 * スプレッドシートデータをJSON形式で返すウェブアプリ
 *
 * デプロイ手順:
 * 1. Google スプレッドシートを開く
 * 2. 拡張機能 > Apps Script
 * 3. このコードを貼り付け
 * 4. デプロイ > 新しいデプロイ
 * 5. 種類: ウェブアプリ
 * 6. アクセス: 全員（または特定ユーザー）
 * 7. デプロイしてURLを取得
 */

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('シート名');
    const data = sheet.getDataRange().getValues();

    // ヘッダー行
    const headers = data[0];

    // データ行をオブジェクト配列に変換
    const result = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        count: result.length,
        data: result
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### フィルタリング対応版
```javascript
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('シート名');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // クエリパラメータ取得
    const params = e.parameter;

    // データ変換
    let result = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    // フィルタリング（パラメータがあれば）
    if (params.filter_column && params.filter_value) {
      result = result.filter(row =>
        String(row[params.filter_column]) === params.filter_value
      );
    }

    // 日付範囲フィルタ（オプション）
    if (params.date_column && params.start_date) {
      const startDate = new Date(params.start_date);
      result = result.filter(row => {
        const rowDate = new Date(row[params.date_column]);
        return rowDate >= startDate;
      });
    }

    // 件数制限（オプション）
    if (params.limit) {
      result = result.slice(0, parseInt(params.limit));
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        count: result.length,
        data: result
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 複数シート対応版
```javascript
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = e.parameter.sheet || 'Sheet1';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`シート "${sheetName}" が見つかりません`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const result = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        sheet: sheetName,
        count: result.length,
        data: result
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 集計機能付き版
```javascript
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売上');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    // 集計処理
    const summary = {
      total_count: rows.length,
      total_sales: rows.reduce((sum, r) => sum + (Number(r['売上金額']) || 0), 0),
      average_sales: 0,
      by_category: {}
    };

    summary.average_sales = summary.total_sales / summary.total_count;

    // カテゴリ別集計
    rows.forEach(row => {
      const cat = row['カテゴリ'] || '未分類';
      if (!summary.by_category[cat]) {
        summary.by_category[cat] = { count: 0, total: 0 };
      }
      summary.by_category[cat].count++;
      summary.by_category[cat].total += Number(row['売上金額']) || 0;
    });

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        summary: summary,
        data: rows
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 生成ルール

1. **ファイル命名**: `gas_{データ種別}_api.js`（例: `gas_sales_api.js`）
2. **エラーハンドリング**: 必ずtry-catchで囲む
3. **レスポンス形式**: `{ success, count/error, data }` の統一形式
4. **CORS対応**: ContentService.MimeType.JSON を使用
5. **コメント**: デプロイ手順を必ず記載

## 出力先
```
Dify_project/gas_templates/{api_name}.js
```

## Difyとの連携

### 環境変数設定
Dify DSLで環境変数を定義:
```yaml
environment_variables:
- name: gas_webapp_url
  value: ""
  value_type: secret
```

### HTTP Requestノードでの呼び出し例（Dify実形式）
```yaml
- data:
    authorization:
      config: null
      type: no-auth
    body:
      data: ''
      type: none
    desc: 'スプレッドシートからデータ取得'
    headers: ''
    method: get
    params: 'mode:all'
    selected: false
    timeout:
      connect: 60
      read: 60
      write: 60
    title: "データ取得"
    type: http-request
    url: '{{#env.gas_webapp_url#}}'
    variables: []
  height: 178
  id: '1000000002'
  position:
    x: 380
    y: 282
  positionAbsolute:
    x: 380
    y: 282
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 244
```

### 変数参照形式
- 環境変数: `{{#env.gas_webapp_url#}}`
- レスポンスbody: `{{#1000000002.body#}}`

## デプロイ後の確認

1. ブラウザでデプロイURLにアクセス
2. JSONが返ってくることを確認
3. DifyのHTTP Requestノードでテスト
4. 環境変数 `gas_webapp_url` にデプロイURLを設定
