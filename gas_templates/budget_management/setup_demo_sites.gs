/**
 * setup_demo_sites.gs
 * P001〜P003 のデモ用スプレッドシートを指定フォルダに作成する
 *
 * 使用手順:
 *   1. GASエディタにこのファイルを貼り付ける（hub.gs とは別のスタンドアロンGASプロジェクトでも可）
 *   2. 「setupDemoSites」関数を実行する
 *   3. 実行ログ（Ctrl+Enter）に出力されたSS IDを確認する
 *   4. setup_hub_registry.gs の updateSiteId() で _M工事台帳 の SS ID を更新する
 *
 * 列定義（_C_予算健康度 シート）:
 *   A: year_month      - 年月（YYYY-MM形式）
 *   B: bac             - 予算合計（BAC）
 *   C: pv              - 計画出来高（PV）
 *   D: ac              - 実績累計（AC）
 *   E: consumption_rate - 消化率（%）
 *   F: progress_rate   - 出来高率（%）
 *   G: gap             - 差分（消化率 - 出来高率）
 *   H: shortage        - 過不足見込み（BAC - AC、正=余裕、負=超過）
 *   I: signal          - 信号（正常/注意/超過）
 *   J: last_updated    - 最終更新日時
 */

// デモSS作成先フォルダID
// https://drive.google.com/drive/u/0/folders/1DqzwP4yDTtezgZmjyooYNuEEDVBbf4F5
var DEMO_FOLDER_ID = '1DqzwP4yDTtezgZmjyooYNuEEDVBbf4F5';

/**
 * 作成したSSを指定フォルダに移動するユーティリティ
 * @param {string} ssId - 移動対象のスプレッドシートID
 */
function moveToDemoFolder_(ssId) {
  var file = DriveApp.getFileById(ssId);
  var folder = DriveApp.getFolderById(DEMO_FOLDER_ID);
  file.moveTo(folder);
}

/**
 * メイン実行関数
 * GASエディタの「実行」ボタンでこの関数を選択して実行する
 */
function setupDemoSites() {
  Logger.log('=== デモSS作成開始 ===');
  Logger.log('作成先フォルダ: ' + DEMO_FOLDER_ID);

  var p001Id = createDemoSite_P001_();
  Logger.log('P001 境川河川改修 SS ID: ' + p001Id);

  var p002Id = createDemoSite_P002_();
  Logger.log('P002 持木川中流部 SS ID: ' + p002Id);

  var p003Id = createDemoSite_P003_();
  Logger.log('P003 野尻川除石 SS ID: ' + p003Id);

  Logger.log('---');
  Logger.log('_M工事台帳 への転記用:');
  Logger.log("updateSiteId('P001', '" + p001Id + "');");
  Logger.log("updateSiteId('P002', '" + p002Id + "');");
  Logger.log("updateSiteId('P003', '" + p003Id + "');");
  Logger.log('=== デモSS作成完了 ===');
}

/**
 * P001 境川河川改修 デモSS作成（正常ステータス）
 * 消化率70%、出来高率70%、gap=0pt → 正常
 * @returns {string} 作成したスプレッドシートのID
 */
function createDemoSite_P001_() {
  var ss = SpreadsheetApp.create('森組_境川河川改修_デモ');
  var sheet = ss.getSheets()[0];
  sheet.setName('_C_予算健康度');

  // ヘッダー行
  var headers = [
    'year_month', 'bac', 'pv', 'ac',
    'consumption_rate', 'progress_rate', 'gap',
    'shortage', 'signal', 'last_updated'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // BAC: 185,000,000円
  var bac = 185000000;
  var now = new Date();

  // 3ヶ月分データ（進行中: 2025-10〜2025-12、全て「正常」）
  var data = [
    // 2025-10: 正常（消化率30%、出来高率30%、gap=0pt）
    ['2025-10', bac, 55500000, 55500000, 30.0, 30.0, 0.0, 129500000, '正常', now],
    // 2025-11: 正常（消化率50%、出来高率50%、gap=0pt）
    ['2025-11', bac, 92500000, 92500000, 50.0, 50.0, 0.0, 92500000, '正常', now],
    // 2025-12: 正常（消化率70%、出来高率70%、gap=0pt）
    ['2025-12', bac, 129500000, 129500000, 70.0, 70.0, 0.0, 55500000, '正常', now]
  ];
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);

  // 信号列（I列）に背景色を付与（全て正常: 緑）
  sheet.getRange(2, 9).setBackground('#C8E6C9'); // 2025-10 正常: 緑
  sheet.getRange(3, 9).setBackground('#C8E6C9'); // 2025-11 正常: 緑
  sheet.getRange(4, 9).setBackground('#C8E6C9'); // 2025-12 正常: 緑

  // 列幅を整形
  sheet.autoResizeColumns(1, headers.length);

  moveToDemoFolder_(ss.getId());
  Logger.log('P001 SS 作成完了: ' + ss.getName() + ' (id=' + ss.getId() + ')');
  return ss.getId();
}

/**
 * P002 持木川中流部 デモSS作成（注意ステータス）
 * 消化率86%、出来高率80%、gap=6pt → 注意
 * @returns {string} 作成したスプレッドシートのID
 */
function createDemoSite_P002_() {
  var ss = SpreadsheetApp.create('森組_持木川中流部_デモ');
  var sheet = ss.getSheets()[0];
  sheet.setName('_C_予算健康度');

  // ヘッダー行
  var headers = [
    'year_month', 'bac', 'pv', 'ac',
    'consumption_rate', 'progress_rate', 'gap',
    'shortage', 'signal', 'last_updated'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // BAC: 160,380,000円（mockup_sites.html 記載値）
  var bac = 160380000;
  var now = new Date();

  // 3ヶ月分データ（進行中: 2025-10〜2025-12）
  var data = [
    // 2025-10: 正常（消化率30%、出来高率30%、gap=0pt）
    ['2025-10', bac, 48114000, 48114000, 30.0, 30.0, 0.0, 112266000, '正常', now],
    // 2025-11: 正常（消化率60%、出来高率55%、gap=5pt → 正常ギリギリ）
    ['2025-11', bac, 88209000, 96228000, 60.0, 55.0, 5.0, 64152000, '正常', now],
    // 2025-12: 注意（消化率86%、出来高率80%、gap=6pt → 注意）
    ['2025-12', bac, 128304000, 137927000, 86.0, 80.0, 6.0, 22453000, '注意', now]
  ];
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);

  // 信号列（I列）に背景色を付与
  sheet.getRange(2, 9).setBackground('#C8E6C9'); // 2025-10 正常: 緑
  sheet.getRange(3, 9).setBackground('#C8E6C9'); // 2025-11 正常: 緑
  sheet.getRange(4, 9).setBackground('#FFF9C4'); // 2025-12 注意: 黄

  // 列幅を整形
  sheet.autoResizeColumns(1, headers.length);

  moveToDemoFolder_(ss.getId());
  Logger.log('P002 SS 作成完了: ' + ss.getName() + ' (id=' + ss.getId() + ')');
  return ss.getId();
}

/**
 * P003 野尻川除石 デモSS作成（超過ステータス）
 * 消化率110%、出来高率88%、gap=22pt → 超過
 * @returns {string} 作成したスプレッドシートのID
 */
function createDemoSite_P003_() {
  var ss = SpreadsheetApp.create('森組_野尻川除石_デモ');
  var sheet = ss.getSheets()[0];
  sheet.setName('_C_予算健康度');

  // ヘッダー行
  var headers = [
    'year_month', 'bac', 'pv', 'ac',
    'consumption_rate', 'progress_rate', 'gap',
    'shortage', 'signal', 'last_updated'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // BAC: 76,600,000円（mockup_sites.html 記載値）
  var bac = 76600000;
  var now = new Date();

  // 3ヶ月分データ（進行中: 2025-10〜2025-12）
  var data = [
    // 2025-10: 正常（消化率30%、出来高率30%、gap=0pt）
    ['2025-10', bac, 22980000, 22980000, 30.0, 30.0, 0.0, 53620000, '正常', now],
    // 2025-11: 注意（消化率70%、出来高率60%、gap=10pt → 注意）
    ['2025-11', bac, 45960000, 53620000, 70.0, 60.0, 10.0, 22980000, '注意', now],
    // 2025-12: 超過（消化率110%、出来高率88%、gap=22pt → 超過）
    ['2025-12', bac, 67408000, 84260000, 110.0, 88.0, 22.0, -7660000, '超過', now]
  ];
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);

  // 信号列（I列）に背景色を付与
  sheet.getRange(2, 9).setBackground('#C8E6C9'); // 2025-10 正常: 緑
  sheet.getRange(3, 9).setBackground('#FFF9C4'); // 2025-11 注意: 黄
  sheet.getRange(4, 9).setBackground('#FFCDD2'); // 2025-12 超過: 赤

  // 列幅を整形
  sheet.autoResizeColumns(1, headers.length);

  moveToDemoFolder_(ss.getId());
  Logger.log('P003 SS 作成完了: ' + ss.getName() + ' (id=' + ss.getId() + ')');
  return ss.getId();
}
