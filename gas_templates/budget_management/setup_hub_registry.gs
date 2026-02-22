/**
 * setup_hub_registry.gs
 * hub.gs がバインドされた「森組_工事管理台帳」スプレッドシートに
 * _M工事台帳シート（工事レジストリの正本）を作成する
 *
 * 使用手順:
 *   1. hub.gs がバインドされた GAS プロジェクト（tab 485003258）にこのファイルを追加
 *   2. 「setupHubRegistry」関数を選択して「実行」
 *   3. バインド先 SS に _M工事台帳シートが作成される（13列ヘッダー + 4工事データ）
 *   4. hub.gs の readRegistry_() が正本パスで動作するようになる
 *
 * 列定義（hub.gs JSDoc 準拠、13列 A-M）:
 *   A: project_id        - 工事ID（P001等）
 *   B: project_name      - 工事名
 *   C: manager_name      - 所長名
 *   D: contract_amount   - 契約額（円）
 *   E: start_date        - 工期開始（YYYY-MM形式）
 *   F: end_date          - 工期終了（YYYY-MM形式）
 *   G: project_type      - 工事種別（河川/砂防/漁港等）
 *   H: client            - 発注者
 *   I: memo              - 備考
 *   J: spreadsheet_id    - 現場スプレッドシートID（各現場SSとの接続キー）
 *   K: target_profit_rate - 目標利益率（%）
 *   L: gas_webapp_url    - 現場GAS Web App URL
 *   M: status            - ステータス（active/completed/suspended）
 */

/**
 * メイン実行関数: _M工事台帳シートを作成し、4工事のデータを投入する
 * hub.gs と同じ getActiveSpreadsheet() でバインド先SSを取得する
 */
function setupHubRegistry() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('対象SS: ' + ss.getName() + ' (id=' + ss.getId() + ')');

  // 既存シートがあれば削除して再作成
  var existing = ss.getSheetByName('_M工事台帳');
  if (existing) {
    ss.deleteSheet(existing);
    Logger.log('既存の _M工事台帳 シートを削除');
  }

  var sheet = ss.insertSheet('_M工事台帳');
  Logger.log('_M工事台帳 シートを作成');

  // ヘッダー行（13列 A-M）
  var headers = [
    'project_id', 'project_name', 'manager_name',
    'contract_amount', 'start_date', 'end_date',
    'project_type', 'client', 'memo',
    'spreadsheet_id', 'target_profit_rate',
    'gas_webapp_url', 'status'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダー行の書式設定
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8EAF6');
  sheet.setFrozenRows(1);

  // 工事データ（4行）
  // SS ID は setup_demo_sites.gs で作成済みのデモSS
  // P004 は既存SS
  var data = [
    [
      'P001', '境川河川改修', '中村竜一',
      185000000, '2025-04', '2026-03',
      '河川', '鹿児島県', '材料調達力が高い。外注と材料のバランス型',
      '1hkeW97Dc8GPhESLhD656nocwX7NLoTtkC5Q5Iedk13c', 20.0,
      '', 'active'
    ],
    [
      'P002', '持木川中流部', '池田豊',
      160380000, '2025-04', '2026-03',
      '河川', '鹿児島県', '消化率86%、出来高率80%。進捗に対し支出が先行気味',
      '1D7f4RkGPbJtwagIjh-pElW3ZxUtyxGeniACh0Yr6eiY', 20.0,
      '', 'active'
    ],
    [
      'P003', '野尻川除石', '中原輝竜',
      76600000, '2025-04', '2026-03',
      '砂防', '鹿児島県', '消化率110%で予算超過。追加費用の原因究明が急務',
      '1K0DoekM18a3pYHQZIVoQau62zanPUSHqEyWyN1h2vTw', 15.0,
      '', 'active'
    ],
    [
      'P004', '海潟漁港海岸保全R7-1工区', '上村和弘',
      39840000, '2025-09', '2026-03',
      '漁港', '鹿児島県', '現場管理費比率が高い。小規模工事のため割高',
      '1EO9ZSIEk4EyiJk8ttkbsm4FBP2RHBeY_9psVa1e_teI', 15.0,
      '', 'active'
    ]
  ];
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);

  // J列（spreadsheet_id）のセル幅を広げる
  sheet.setColumnWidth(10, 380);

  // 列幅を整形（J列以外）
  sheet.autoResizeColumns(1, 9);
  sheet.autoResizeColumns(11, 3);

  // 契約額列（D列）に数値書式を設定
  sheet.getRange(2, 4, data.length, 1).setNumberFormat('#,##0');

  Logger.log('=== _M工事台帳 セットアップ完了 ===');
  Logger.log('ヘッダー: ' + headers.length + '列');
  Logger.log('データ: ' + data.length + '工事');
  Logger.log('');
  Logger.log('投入データ:');
  for (var i = 0; i < data.length; i++) {
    Logger.log('  ' + data[i][0] + ' ' + data[i][1] + ' → SS ID: ' + (data[i][9] || '(空)'));
  }
  Logger.log('');
  Logger.log('hub.gs の readRegistry_() が _M工事台帳 から正本データを読み取るようになります。');
  Logger.log('getFallbackRegistry_() へのフォールバックは発生しなくなります。');
}

/**
 * 特定工事のスプレッドシートIDを更新するユーティリティ関数
 * setup_demo_sites.gs 再実行時のSS ID差し替え等に使用
 *
 * 使用例（GASエディタのスクリプトログから）:
 *   updateSiteId('P001', '1hkeW97...');
 *
 * @param {string} projectId - 更新対象の工事ID（例: 'P001'）
 * @param {string} ssId - 新しいスプレッドシートID
 */
function updateSiteId(projectId, ssId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_M工事台帳');

  if (!sheet) {
    Logger.log('エラー: _M工事台帳 シートが存在しない。先に setupHubRegistry() を実行してください。');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var pidIdx = headers.indexOf('project_id');
  var ssIdIdx = headers.indexOf('spreadsheet_id');

  if (pidIdx < 0 || ssIdIdx < 0) {
    Logger.log('エラー: ヘッダーに project_id または spreadsheet_id 列が見つからない');
    return;
  }

  var updated = false;
  for (var i = 1; i < data.length; i++) {
    if (data[i][pidIdx] === projectId) {
      // J列（ssIdIdx + 1 で1始まりに変換）を更新
      sheet.getRange(i + 1, ssIdIdx + 1).setValue(ssId);
      Logger.log(projectId + ' の spreadsheet_id を更新: ' + ssId);
      updated = true;
      break;
    }
  }

  if (!updated) {
    Logger.log('エラー: 工事ID "' + projectId + '" が _M工事台帳 に見つからない');
  }
}
