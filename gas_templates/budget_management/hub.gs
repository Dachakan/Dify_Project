/**
 * 本社管理台帳 GAS Web App エンドポイント（hub.gs）
 *
 * 概要:
 *   複数現場の工事データを横断取得し、経営者向けダッシュボード・Difyへ提供する。
 *   「森組_工事管理台帳」スプレッドシートにバインドして使用。
 *
 * エンドポイント（GETパラメータ）:
 *   ?mode=projects_all  → 全工事メタデータ一覧
 *   ?mode=cross_summary → 全工事の予実サマリ横断（month指定可）
 *   ?mode=cross_health  → 全工事の予算健康度横断（month指定可）
 *   ?mode=project_detail → 特定工事の詳細（project_id, month指定）
 *   ?mode=dashboard      → 本社横断ダッシュボードHTML画面（HtmlService）
 *
 * デプロイ手順:
 *   1. 「森組_工事管理台帳」スプレッドシートにバインドしたGASプロジェクトを作成
 *   2. _M工事台帳シートに工事データを入力（下記の列定義参照）
 *   3. デプロイ > 新しいデプロイ > ウェブアプリ
 *   4. アクセス: 「全員」、実行ユーザー: 「自分」
 *   5. デプロイURLをDifyの環境変数 GAS_HUB_URL に設定
 *
 * _M工事台帳シートの列定義:
 *   A: project_id       B: project_name     C: manager_name
 *   D: contract_amount  E: start_date       F: end_date
 *   G: project_type     H: client           I: memo
 *   J: spreadsheet_id   K: target_profit_rate
 *   L: gas_webapp_url   M: status
 */

// シート名定数
const HUB_SHEET_REGISTRY = '_M工事台帳';

// 各現場SSのシート名定数（api.gsと同一）
const SITE_SHEET_BUDGET  = '_実行予算テーブル';
const SITE_SHEET_PAYMENT = '支払明細';
const SITE_SHEET_HEALTH  = '_C_予算健康度';

/**
 * GETリクエストハンドラ
 * @param {Object} e - リクエストオブジェクト
 * @returns {TextOutput} JSON形式レスポンス
 */
function doGet(e) {
  try {
    var mode = (e && e.parameter && e.parameter.mode) ? e.parameter.mode : 'dashboard';
    var targetMonth = (e && e.parameter && e.parameter.month) ? e.parameter.month : getCurrentYearMonth_();
    var projectId = (e && e.parameter && e.parameter.project_id) ? e.parameter.project_id : null;

    // mode=dashboard → 本社横断ダッシュボードHTML画面
    if (mode === 'dashboard') {
      return buildHubDashboardHtml_(targetMonth);
    }

    var data;
    switch (mode) {
      case 'projects_all':
        data = getProjectsAll_();
        break;
      case 'cross_summary':
        data = getCrossSummary_(targetMonth);
        break;
      case 'cross_health':
        data = getCrossHealth_(targetMonth);
        break;
      case 'project_detail':
        if (!projectId) {
          throw new Error('project_detail モードには project_id パラメータが必要');
        }
        data = getProjectDetail_(projectId, targetMonth);
        break;
      default:
        throw new Error('未知のモード: ' + mode + ' (projects_all / cross_summary / cross_health / project_detail / dashboard のいずれかを指定)');
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        mode: mode,
        timestamp: new Date().toISOString(),
        data: data
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ============================================================
 * mode=projects_all: 全工事メタデータ一覧
 * ============================================================ */

/**
 * 工事台帳から全工事のメタデータを取得する
 * @returns {Object} 工事一覧オブジェクト
 */
function getProjectsAll_() {
  var projects = readRegistry_();
  return {
    count: projects.length,
    projects: projects
  };
}

/* ============================================================
 * mode=cross_summary: 全工事の予実サマリ横断
 * ============================================================ */

/**
 * 全工事の予実サマリを横断取得する
 * @param {string} yearMonth - 対象年月
 * @returns {Object} 横断サマリオブジェクト
 */
function getCrossSummary_(yearMonth) {
  var projects = readRegistry_();
  var summaries = [];
  var totalBudgetAll = 0;
  var totalSpentAll = 0;

  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    if (p.status !== 'active') continue;

    var summary = fetchSiteSummary_(p.spreadsheet_id, yearMonth);
    summary.project_id = p.project_id;
    summary.project_name = p.project_name;
    summary.manager_name = p.manager_name;
    summary.contract_amount = p.contract_amount;

    totalBudgetAll += summary.total_budget;
    totalSpentAll += summary.total_spent;

    summaries.push(summary);
  }

  // 全社合計
  var totalRemainingAll = totalBudgetAll - totalSpentAll;
  var overallRate = totalBudgetAll > 0 ? parseFloat((totalSpentAll / totalBudgetAll * 100).toFixed(1)) : 0;

  return {
    yearMonth: yearMonth,
    total: {
      budget: totalBudgetAll,
      spent: totalSpentAll,
      remaining: totalRemainingAll,
      consumption_rate: overallRate
    },
    projects: summaries
  };
}

/* ============================================================
 * mode=cross_health: 全工事の予算健康度横断
 * ============================================================ */

/**
 * 全工事の予算健康度を横断取得する
 * @param {string} yearMonth - 対象年月
 * @returns {Object} 横断予算健康度オブジェクト
 */
function getCrossHealth_(yearMonth) {
  var projects = readRegistry_();
  var healthList = [];

  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    if (p.status !== 'active') continue;

    var health = fetchSiteHealth_(p.spreadsheet_id, yearMonth);
    health.project_id = p.project_id;
    health.project_name = p.project_name;
    health.manager_name = p.manager_name;
    health.contract_amount = p.contract_amount;

    healthList.push(health);
  }

  return {
    yearMonth: yearMonth,
    projects: healthList
  };
}

/* ============================================================
 * mode=project_detail: 特定工事の詳細
 * ============================================================ */

/**
 * 特定工事の詳細情報を取得する（メタデータ + サマリ + 予算健康度）
 * @param {string} projectId - 工事ID
 * @param {string} yearMonth - 対象年月
 * @returns {Object} 工事詳細オブジェクト
 */
function getProjectDetail_(projectId, yearMonth) {
  var projects = readRegistry_();
  var target = null;

  for (var i = 0; i < projects.length; i++) {
    if (projects[i].project_id === projectId) {
      target = projects[i];
      break;
    }
  }

  if (!target) {
    throw new Error('工事ID "' + projectId + '" が見つからない');
  }

  var summary = fetchSiteSummary_(target.spreadsheet_id, yearMonth);
  var health = fetchSiteHealth_(target.spreadsheet_id, yearMonth);

  return {
    project: target,
    summary: summary,
    health: health
  };
}

/* ============================================================
 * 工事台帳読み取り
 * ============================================================ */

/**
 * _M工事台帳シートから全工事データを読み取る
 * @returns {Array} 工事オブジェクトの配列
 */
function readRegistry_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HUB_SHEET_REGISTRY);

  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('readRegistry_: _M工事台帳シート未設定。フォールバック値を使用');
    return getFallbackRegistry_();
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var projects = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // 空行スキップ（project_idが空なら無視）
    var pidIdx = headers.indexOf('project_id');
    if (pidIdx < 0 || !row[pidIdx]) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }

    // 数値型の型変換
    obj.contract_amount = parseFloat(obj.contract_amount) || 0;
    obj.target_profit_rate = parseFloat(obj.target_profit_rate) || 0;

    projects.push(obj);
  }

  return projects;
}

/**
 * 工事台帳のフォールバック値（シート未設定時）
 * mockup_sites.htmlの4工事データを返す
 * @returns {Array} フォールバック工事配列
 */
function getFallbackRegistry_() {
  return [
    {
      project_id:         'P001',
      project_name:       '境川河川改修',
      manager_name:       '中村竜一',
      contract_amount:    185000000,
      start_date:         '2025-04',
      end_date:           '2026-03',
      project_type:       '河川',
      client:             '鹿児島県',
      memo:               '材料調達力が高い。外注と材料のバランス型',
      spreadsheet_id:     '',
      target_profit_rate: 20.0,
      gas_webapp_url:     '',
      status:             'active'
    },
    {
      project_id:         'P002',
      project_name:       '持木川中流部',
      manager_name:       '池田豊',
      contract_amount:    160380000,
      start_date:         '2025-04',
      end_date:           '2026-03',
      project_type:       '河川',
      client:             '鹿児島県',
      memo:               '消化率86%、出来高率80%。進捗に対し支出が先行気味',
      spreadsheet_id:     '',
      target_profit_rate: 20.0,
      gas_webapp_url:     '',
      status:             'active'
    },
    {
      project_id:         'P003',
      project_name:       '野尻川除石',
      manager_name:       '中原輝竜',
      contract_amount:    76600000,
      start_date:         '2025-04',
      end_date:           '2026-03',
      project_type:       '砂防',
      client:             '鹿児島県',
      memo:               '消化率110%で予算超過。追加費用の原因究明が急務',
      spreadsheet_id:     '',
      target_profit_rate: 15.0,
      gas_webapp_url:     '',
      status:             'active'
    },
    {
      project_id:         'P004',
      project_name:       '海潟漁港海岸保全R7-1工区',
      manager_name:       '上村和弘',
      contract_amount:    39840000,
      start_date:         '2025-09',
      end_date:           '2026-03',
      project_type:       '漁港',
      client:             '鹿児島県',
      memo:               '現場管理費比率が高い。小規模工事のため割高',
      spreadsheet_id:     '',
      target_profit_rate: 15.0,
      gas_webapp_url:     '',
      status:             'active'
    }
  ];
}

/* ============================================================
 * 各現場スプレッドシートへの横断アクセス
 * SpreadsheetApp.openById() で直接参照（UrlFetchApp不要で高速）
 * ============================================================ */

/**
 * 特定現場の予実サマリを取得する
 * @param {string} ssId - 現場スプレッドシートID
 * @param {string} yearMonth - 対象年月
 * @returns {Object} 予実サマリオブジェクト
 */
function fetchSiteSummary_(ssId, yearMonth) {
  if (!ssId) {
    return {
      total_budget: 0,
      total_spent: 0,
      total_remaining: 0,
      consumption_rate: 0,
      status: '未接続',
      note: 'スプレッドシートID未設定'
    };
  }

  try {
    var ss = SpreadsheetApp.openById(ssId);
    var budgetSheet = ss.getSheetByName(SITE_SHEET_BUDGET);
    var paymentSheet = ss.getSheetByName(SITE_SHEET_PAYMENT);

    if (!budgetSheet || !paymentSheet) {
      return {
        total_budget: 0,
        total_spent: 0,
        total_remaining: 0,
        consumption_rate: 0,
        status: '未接続',
        note: '予算/支払シートが存在しない'
      };
    }

    var budgetData = budgetSheet.getDataRange().getValues();
    var paymentData = paymentSheet.getDataRange().getValues();

    var totalBudget = sumColumn_(budgetData, 'budget_amount');
    var totalSpent = sumPaymentUpTo_(paymentData, yearMonth);
    var totalRemaining = totalBudget - totalSpent;
    var rate = totalBudget > 0 ? parseFloat((totalSpent / totalBudget * 100).toFixed(1)) : 0;

    return {
      total_budget: totalBudget,
      total_spent: totalSpent,
      total_remaining: totalRemaining,
      consumption_rate: rate,
      status: rate > 100 ? '超過' : rate > 80 ? '注意' : '正常'
    };

  } catch (err) {
    Logger.log('fetchSiteSummary_ エラー (ssId=' + ssId + '): ' + err.message);
    return {
      total_budget: 0,
      total_spent: 0,
      total_remaining: 0,
      consumption_rate: 0,
      status: 'エラー',
      note: err.message
    };
  }
}

/**
 * 特定現場の予算健康度を取得する
 * _C_予算健康度シートから消化率/出来高率/信号等を読み取る
 * @param {string} ssId - 現場スプレッドシートID
 * @param {string} yearMonth - 対象年月
 * @returns {Object} 予算健康度オブジェクト
 */
function fetchSiteHealth_(ssId, yearMonth) {
  if (!ssId) {
    return {
      yearMonth: yearMonth,
      bac: 0, pv: 0, ac: 0,
      consumption_rate: 0, progress_rate: 0,
      gap: 0, shortage: 0, signal: '',
      status: '未接続',
      note: 'スプレッドシートID未設定'
    };
  }

  try {
    var ss = SpreadsheetApp.openById(ssId);
    var healthSheet = ss.getSheetByName(SITE_SHEET_HEALTH);

    if (!healthSheet || healthSheet.getLastRow() < 2) {
      return {
        yearMonth: yearMonth,
        bac: 0, pv: 0, ac: 0,
        consumption_rate: 0, progress_rate: 0,
        gap: 0, shortage: 0, signal: '',
        status: '未接続',
        note: '予算健康度シートが存在しないか空'
      };
    }

    var data = healthSheet.getDataRange().getValues();
    var headers = data[0];
    var ymIdx = headers.indexOf('year_month');

    // 対象年月の行を検索（見つからなければ最新行を使用）
    var targetRow = null;
    var latestRow = null;

    for (var i = 1; i < data.length; i++) {
      var rowYm = String(data[i][ymIdx]).substring(0, 7);
      if (rowYm === yearMonth) {
        targetRow = data[i];
        break;
      }
      latestRow = data[i];
    }

    var row = targetRow || latestRow;
    if (!row) {
      return {
        yearMonth: yearMonth,
        bac: 0, pv: 0, ac: 0,
        consumption_rate: 0, progress_rate: 0,
        gap: 0, shortage: 0, signal: '',
        status: '未接続',
        note: '予算健康度データなし'
      };
    }

    // ヘッダーからフィールドを取得
    var getVal = function(name) {
      var idx = headers.indexOf(name);
      return idx >= 0 ? (parseFloat(row[idx]) || 0) : 0;
    };
    var getStr = function(name) {
      var idx = headers.indexOf(name);
      return idx >= 0 ? String(row[idx]) : '';
    };

    return {
      yearMonth: yearMonth,
      bac: getVal('bac'),
      pv:  getVal('pv'),
      ac:  getVal('ac'),
      consumption_rate: getVal('consumption_rate'),
      progress_rate:    getVal('progress_rate'),
      gap:     getVal('gap'),
      shortage: getVal('shortage'),
      signal:  getStr('signal')
    };

  } catch (err) {
    Logger.log('fetchSiteHealth_ エラー (ssId=' + ssId + '): ' + err.message);
    return {
      yearMonth: yearMonth,
      bac: 0, pv: 0, ac: 0,
      consumption_rate: 0, progress_rate: 0,
      gap: 0, shortage: 0, signal: '',
      status: 'エラー',
      note: err.message
    };
  }
}

/* ============================================================
 * ユーティリティ関数
 * api.gs と同一ロジック（将来リファクタで共通化予定）
 * ============================================================ */

/**
 * 現在の年月を YYYY-MM 形式で返す
 */
function getCurrentYearMonth_() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

/**
 * 2次元配列から列名に一致する列の合計を返す（ヘッダー行あり想定）
 */
function sumColumn_(data, columnName) {
  if (!data || data.length < 2) return 0;
  var headers = data[0];
  var colIdx = headers.indexOf(columnName);
  if (colIdx < 0) return 0;
  var sum = 0;
  for (var i = 1; i < data.length; i++) {
    var v = parseFloat(data[i][colIdx]);
    if (!isNaN(v)) sum += v;
  }
  return sum;
}

/**
 * 支払明細から対象年月以前の累計を計算する
 * @param {Array} data - 支払明細の2次元配列（ヘッダー行あり）
 * @param {string} upToMonth - 集計上限年月（例: '2025-12'）
 * @returns {number} 累計額
 */
function sumPaymentUpTo_(data, upToMonth) {
  if (!data || data.length < 2) return 0;
  var headers = data[0];
  var dateIdx = headers.indexOf('year_month');
  var amountIdx = headers.indexOf('amount');
  if (dateIdx < 0 || amountIdx < 0) return 0;

  var sum = 0;
  for (var i = 1; i < data.length; i++) {
    var rowMonth = String(data[i][dateIdx]).substring(0, 7);
    if (rowMonth <= upToMonth) {
      var v = parseFloat(data[i][amountIdx]);
      if (!isNaN(v)) sum += v;
    }
  }
  return sum;
}

/* ============================================================
 * HtmlService ユーティリティ
 * ============================================================ */

/**
 * HTMLテンプレートから別ファイルをインクルードする
 * dashboard.html 内の <?!= include_('dashboard_css') ?> 等で使用
 * @param {string} filename - インクルードするファイル名（拡張子なし or あり）
 * @returns {string} ファイルの内容
 */
function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================
 * mode=dashboard: 本社横断ダッシュボードHTML画面
 * ============================================================ */

/**
 * google.script.run から呼び出されるダッシュボードデータ取得関数
 * クライアントサイドJSから直接 getCrossHealth_() は呼べないためラッパーとして提供
 * @param {string} yearMonth - 対象年月（YYYY-MM形式、省略時は当月）
 * @returns {Object} { success: true, data: { yearMonth, projects }, timestamp }
 */
function getDashboardData(yearMonth) {
  var data = getCrossHealth_(yearMonth || getCurrentYearMonth_());
  return {
    success: true,
    data: data,
    timestamp: new Date().toISOString()
  };
}

/**
 * 本社横断ダッシュボードのHTMLを生成する
 * dashboard.html テンプレートを evaluate() してフル機能版ダッシュボードを返す
 * @param {string} yearMonth - 対象年月（YYYY-MM形式）
 * @returns {HtmlOutput} ダッシュボードHTML
 */
function buildHubDashboardHtml_(yearMonth) {
  var template = HtmlService.createTemplateFromFile('dashboard');
  template.defaultMonth = yearMonth || getCurrentYearMonth_();
  return template.evaluate()
    .setTitle('森組 経営ダッシュボード')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/* ============================================================
 * テスト用関数
 * ============================================================ */

/**
 * doGet のローカルテスト用関数
 * GASエディタで直接実行して動作確認できる
 */
function testDoGet() {
  var testCases = [
    { mode: 'projects_all' },
    { mode: 'cross_summary', month: '2025-12' },
    { mode: 'cross_health', month: '2025-12' },
    { mode: 'project_detail', project_id: 'P001', month: '2025-12' },
    { mode: 'dashboard', month: '2025-12' }
  ];

  testCases.forEach(function(params) {
    var result = doGet({ parameter: params });
    Logger.log('=== mode=' + params.mode + ' ===');
    Logger.log(typeof result.getContent === 'function' ? result.getContent().substring(0, 200) + '...' : '(HtmlOutput)');
  });
}

/**
 * getDashboardData のテスト用関数
 * GASエディタで直接実行してダッシュボードデータ取得を確認できる
 */
function testGetDashboardData() {
  var result = getDashboardData('2025-12');
  Logger.log('success: ' + result.success);
  Logger.log('timestamp: ' + result.timestamp);
  Logger.log('projects count: ' + (result.data && result.data.projects ? result.data.projects.length : 0));
  if (result.data && result.data.projects) {
    result.data.projects.forEach(function(p) {
      Logger.log('  ' + p.project_id + ' ' + p.project_name + ' signal=' + p.signal + ' consumption_rate=' + p.consumption_rate);
    });
  }
}
