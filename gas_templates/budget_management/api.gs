/**
 * Dify連携用 GAS Web App エンドポイント
 *
 * 概要:
 *   工事予算管理スプレッドシートのデータをDifyへJSON形式で提供する
 *
 * v2変更点:
 *   - mode=evm → mode=health（予実管理への転換）
 *   - mode=evmは後方互換のためmode=healthにリダイレクト
 *   - SEC-04: テキストフィールドのサニタイズ（50文字制限）
 *   - 消化率/出来高率の返却（summary, health）
 *   - available_elementsを工種マスタに追加
 *   - 取引先マスタの返却
 *
 * エンドポイント（GETパラメータ）:
 *   ?mode=health   → 予算健康度（消化率/出来高率/過不足見込み/信号判定）
 *   ?mode=master   → 費目26項目・工種35項目・取引先のマスタ
 *   ?mode=summary  → 工事単位の予実サマリ
 *   ?mode=project  → 工事メタデータ（工事名・所長名・契約額等）
 *   ?mode=aggregate → 月次集計データ
 *   ?mode=evm      → 後方互換（mode=healthにリダイレクト）
 *   ?mode=dashboard → HTMLダッシュボード画面（HtmlService）
 *
 * デプロイ手順:
 *   1. Google Apps Script エディタで新規プロジェクト作成
 *   2. このコードと他のgsファイルを同じプロジェクトに追加
 *   3. SPREADSHEET_ID を実際のIDに変更（コンテナバインドの場合は null のまま）
 *   4. デプロイ > 新しいデプロイ > ウェブアプリ
 *   5. アクセス: 「全員」、実行ユーザー: 「自分（スプレッドシートオーナー）」
 *   6. デプロイURLをDifyの環境変数 GAS_ENDPOINT_URL に設定
 */

// コンテナバインドの場合は null のまま
const SPREADSHEET_ID = null;

// シート名定数
const SHEET_HEALTH   = '_C_予算健康度';
const SHEET_BUDGET   = '_実行予算テーブル';
const SHEET_PAYMENT  = '支払明細';
const SHEET_MASTER   = '_Mマスタ';
const SHEET_PROJECT  = '_M工事';
const SHEET_VENDOR   = '_M取引先';

/**
 * GETリクエストハンドラ
 * @param {Object} e - リクエストオブジェクト
 * @returns {TextOutput} JSON形式レスポンス
 *
 * 認証:
 *   ?key=YOUR_API_KEY パラメータ必須（masterモードを除く）
 */
function doGet(e) {
  try {
    var mode = (e && e.parameter && e.parameter.mode) ? e.parameter.mode : 'summary';
    var targetMonth = (e && e.parameter && e.parameter.month) ? e.parameter.month : getCurrentYearMonth_();

    // mode=evm → mode=health にリダイレクト（後方互換）
    if (mode === 'evm') {
      mode = 'health';
    }

    // mode=dashboard → HTMLダッシュボード画面（認証不要）
    if (mode === 'dashboard') {
      var yearMonth = (e && e.parameter && e.parameter.year_month) ? e.parameter.year_month : getCurrentYearMonth_();
      return buildSiteDashboardHtml_(yearMonth);
    }

    // APIキー認証（masterモードはキーなしでアクセス可能）
    if (mode !== 'master') {
      var authResult = validateApiKey_(e);
      if (!authResult.valid) {
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: authResult.message,
            timestamp: new Date().toISOString()
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // SEC-02: 匿名化パラメータ
    var anonymize = (e && e.parameter && e.parameter.anonymize === 'true');

    var data;
    switch (mode) {
      case 'health':
        data = getHealthData_(targetMonth);
        break;
      case 'master':
        data = getMasterData_();
        break;
      case 'summary':
        data = getSummaryData_(targetMonth);
        break;
      case 'project':
        data = getProjectData_();
        break;
      case 'aggregate':
        data = getAggregateData_(targetMonth);
        break;
      default:
        throw new Error('未知のモード: ' + mode + ' (health / master / summary / project / aggregate / dashboard のいずれかを指定)');
    }

    // SEC-02: 匿名化処理（Dify Cloud送信時の機密データ保護）
    if (anonymize) {
      data = anonymizeResponse_(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        mode: mode,
        anonymized: anonymize,
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

/**
 * APIキーを検証する
 * @param {Object} e - リクエストオブジェクト
 * @returns {Object} { valid: boolean, message: string }
 */
function validateApiKey_(e) {
  var storedKey = PropertiesService.getScriptProperties().getProperty('API_KEY');

  // API_KEYが未設定の場合は認証をスキップ（初期設定支援）
  if (!storedKey) {
    Logger.log('警告: API_KEY未設定。スクリプトプロパティにAPI_KEYを設定してください');
    return { valid: true, message: '' };
  }

  var requestKey = (e && e.parameter && e.parameter.key) ? e.parameter.key : '';

  if (!requestKey) {
    return { valid: false, message: '認証エラー: keyパラメータが必要（?key=YOUR_API_KEY）' };
  }

  if (requestKey !== storedKey) {
    return { valid: false, message: '認証エラー: APIキーが無効' };
  }

  return { valid: true, message: '' };
}

/* ============================================================
 * mode=health: 予算健康度取得（evm.gsの後継）
 * ============================================================ */

/**
 * 予算健康度データを取得する
 * @param {string} yearMonth - 対象年月
 * @returns {Object} 予算健康度オブジェクト
 */
function getHealthData_(yearMonth) {
  // budget_health.gs の getBudgetHealthMetrics() を呼び出す
  var metrics = getBudgetHealthMetrics(yearMonth);

  var project = getProjectData_();
  var projectPrice = project.contract_amount;

  return {
    // 工事識別情報
    project_name:   project.project_name,
    manager_name:   project.manager_name,
    // 予実管理指標
    yearMonth:        yearMonth,
    bac:              metrics.bac,
    pv:               metrics.pv,
    ac:               metrics.ac,
    consumption_rate: metrics.consumption_rate,
    progress_rate:    metrics.progress_rate,
    gap:              metrics.gap,
    projected_total:  metrics.projected_total,
    shortage:         metrics.shortage,
    signal:           metrics.signal,
    // 所長ビュー向けフィールド（日本語表示用）
    budget_consumed_pct: metrics.consumption_rate,
    progress_pct:        metrics.progress_rate,
    shortage_yen:        metrics.shortage,
    profit_impact_pt:    projectPrice > 0 ? ((metrics.shortage / projectPrice) * 100).toFixed(1) : '0.0',
    status_label:        metrics.signal,
    action_hint:         metrics.signal === '超過' ? '今すぐ対策が必要' :
                         metrics.signal === '注意' ? '注意して監視' : '正常'
  };
}

/* ============================================================
 * mode=aggregate: 月次集計データ取得
 * ============================================================ */

/**
 * 月次集計データを取得する
 * @param {string} yearMonth - 対象年月
 * @returns {Object} 集計データ
 */
function getAggregateData_(yearMonth) {
  var monthly = getMonthlyAggregation(yearMonth);
  var project = getProjectData_();

  return {
    project_name: project.project_name,
    yearMonth: yearMonth,
    categories: monthly
  };
}

/* ============================================================
 * mode=project: 工事メタデータ取得
 * ============================================================ */

/**
 * 工事メタデータを取得する
 */
function getProjectData_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_PROJECT);

  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('getProjectData_: _M工事シート未設定。フォールバック値を使用');
    return getFallbackProjectData_();
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var row = data[1];

  var fields = [
    'project_id', 'project_name', 'manager_name', 'contract_amount',
    'start_date', 'end_date', 'project_type', 'client',
    'memo', 'spreadsheet_id', 'target_profit_rate'
  ];
  var result = {};

  for (var f = 0; f < fields.length; f++) {
    var field = fields[f];
    var colIdx = headers.indexOf(field);
    result[field] = colIdx >= 0 ? row[colIdx] : '';
  }

  result.contract_amount = parseFloat(result.contract_amount) || 0;
  result.target_profit_rate = parseFloat(result.target_profit_rate) || 0;

  if (!result.spreadsheet_id) {
    result.spreadsheet_id = ss.getId();
  }

  return result;
}

/**
 * 工事メタデータのフォールバック値
 */
function getFallbackProjectData_() {
  var ss = getSpreadsheet_();
  return {
    project_id:         'P004',
    project_name:       '海潟漁港海岸保全R7-1工区',
    manager_name:       '上村和弘',
    contract_amount:    39840000,
    start_date:         '2025-09',
    end_date:           '2026-03',
    project_type:       '漁港',
    client:             '鹿児島県',
    memo:               '小規模工事。現場管理費比率高い',
    spreadsheet_id:     ss.getId(),
    target_profit_rate: 15.0,
    note:               'フォールバックデータ（_M工事シート未設定）'
  };
}

/* ============================================================
 * mode=master: マスタ返却（取引先マスタ追加、available_elements追加）
 * ============================================================ */

/**
 * マスタデータを取得する（QA-05: _Mマスタシートからの動的読み込み）
 * _Mマスタシートが存在すればシートから読み込み、存在しなければエラー。
 * テンプレート生成時のseedデータには getDefaultMaster_() を使用すること。
 */
function getMasterData_() {
  var ss = getSpreadsheet_();
  var masterSheet = ss.getSheetByName(SHEET_MASTER);

  if (masterSheet && masterSheet.getLastRow() >= 2) {
    return readMasterFromSheet_(masterSheet);
  }

  // _Mマスタシートが存在しない場合はエラーレスポンス
  throw new Error('_Mマスタシートが見つかりません。initProjectTemplate() でテンプレートを生成してください');
}

/**
 * _Mマスタシートからマスタデータを読み込む（QA-05）
 * @param {Sheet} sheet - _Mマスタシート
 * @returns {Object} { expense_items, work_types, vendors }
 */
function readMasterFromSheet_(sheet) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var typeIdx = headers.indexOf('type');
  var idIdx = headers.indexOf('id');
  var nameIdx = headers.indexOf('name');
  var parentIdx = headers.indexOf('parent_id');
  var parentNameIdx = headers.indexOf('parent_name');
  var elemIdx = headers.indexOf('available_elements');
  var activeIdx = headers.indexOf('active');

  var expenseItems = [];
  var workTypes = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var type = String(row[typeIdx]);
    var active = activeIdx >= 0 ? String(row[activeIdx]).toUpperCase() : 'TRUE';
    if (active === 'FALSE') continue;

    if (type === 'expense') {
      expenseItems.push({
        id: String(row[idIdx]),
        name: String(row[nameIdx]),
        category: String(row[parentIdx]),
        category_name: parentNameIdx >= 0 ? String(row[parentNameIdx]) : ''
      });
    } else if (type === 'work_type') {
      workTypes.push({
        id: String(row[idIdx]),
        name: String(row[nameIdx]),
        work_type: String(row[parentIdx]),
        work_type_name: parentNameIdx >= 0 ? String(row[parentNameIdx]) : '',
        available_elements: elemIdx >= 0 ? String(row[elemIdx]) : ''
      });
    }
  }

  var vendors = getVendorsMaster_();

  return {
    expense_items: expenseItems,
    work_types: workTypes,
    vendors: vendors
  };
}

/**
 * デフォルトマスタデータを取得する（template.gs専用seedデータ）
 * テンプレート生成時に _Mマスタ シートに書き込むための初期データ。
 * API応答には使用しない。
 */
function getDefaultMaster_() {
  var expenseItems = getDefaultExpenseItems_();
  var workTypes    = getDefaultWorkTypes_();
  var vendors      = getVendorsMaster_();

  return {
    expense_items: expenseItems,
    work_types:    workTypes,
    vendors:       vendors
  };
}

/**
 * 費目マスタのデフォルト値（QA-05: seed関数、template.gs専用）
 * API応答には使用しない。_Mマスタシートからの動的読み込みを使用すること。
 */
function getDefaultExpenseItems_() {
  return [
    // 共通仮設費（C02）
    { id: 'F31', name: '運搬費',             category: 'C02', category_name: '共通仮設費' },
    { id: 'F32', name: '調査・準備費',       category: 'C02', category_name: '共通仮設費' },
    { id: 'F33', name: '仮設建物費',         category: 'C02', category_name: '共通仮設費' },
    { id: 'F34', name: '公害防止対策費',     category: 'C02', category_name: '共通仮設費' },
    { id: 'F35', name: '安全対策費',         category: 'C02', category_name: '共通仮設費' },
    { id: 'F36', name: '水道光熱費',         category: 'C02', category_name: '共通仮設費' },
    { id: 'F37', name: '産業廃棄物処理費',   category: 'C02', category_name: '共通仮設費' },
    { id: 'F38', name: '役務費',             category: 'C02', category_name: '共通仮設費' },
    { id: 'F39', name: '営繕費',             category: 'C02', category_name: '共通仮設費' },
    // 現場管理費（C03）
    { id: 'F51', name: '労務管理費',         category: 'C03', category_name: '現場管理費' },
    { id: 'F52', name: '法定福利費',         category: 'C03', category_name: '現場管理費' },
    { id: 'F53', name: '租税公課',           category: 'C03', category_name: '現場管理費' },
    { id: 'F54', name: '地代家賃',           category: 'C03', category_name: '現場管理費' },
    { id: 'F55', name: '保険料',             category: 'C03', category_name: '現場管理費' },
    { id: 'F56', name: '従業員給料手当',     category: 'C03', category_name: '現場管理費' },
    { id: 'F57', name: '従業員賞与',         category: 'C03', category_name: '現場管理費' },
    { id: 'F58', name: '従業員退職金',       category: 'C03', category_name: '現場管理費' },
    { id: 'F59', name: '福利厚生費',         category: 'C03', category_name: '現場管理費' },
    { id: 'F60', name: '事務用品費',         category: 'C03', category_name: '現場管理費' },
    { id: 'F61', name: '旅費・交通費・通信費', category: 'C03', category_name: '現場管理費' },
    { id: 'F62', name: '補償費',             category: 'C03', category_name: '現場管理費' },
    { id: 'F63', name: '設計費',             category: 'C03', category_name: '現場管理費' },
    { id: 'F64', name: '交際費',             category: 'C03', category_name: '現場管理費' },
    { id: 'F65', name: '保証料',             category: 'C03', category_name: '現場管理費' },
    { id: 'F66', name: '会議費・諸会費',     category: 'C03', category_name: '現場管理費' },
    { id: 'F67', name: '雑費',               category: 'C03', category_name: '現場管理費' }
  ];
}

/**
 * 工種マスタのデフォルト値（QA-05: seed関数、template.gs専用）
 * CSVマスタ準拠: E11=材料費, E12=機械経費, E13=機械経費（損料）, E14=外注費, E15=労務費
 * API応答には使用しない。_Mマスタシートからの動的読み込みを使用すること。
 */
function getDefaultWorkTypes_() {
  return [
    // 土工事（W01）
    { id: 'K0101', name: '掘削工',           work_type: 'W01', work_type_name: '土工事',           available_elements: 'E11 E12 E13 E14 E15' },
    { id: 'K0102', name: '盛土工',           work_type: 'W01', work_type_name: '土工事',           available_elements: 'E11 E12 E13 E14 E15' },
    { id: 'K0103', name: '除石工',           work_type: 'W01', work_type_name: '土工事',           available_elements: 'E12 E13 E14' },
    { id: 'K0104', name: '浚渫工',           work_type: 'W01', work_type_name: '土工事',           available_elements: 'E12 E13 E14' },
    { id: 'K0105', name: '場内運搬工',       work_type: 'W01', work_type_name: '土工事',           available_elements: 'E12 E13 E14' },
    // コンクリート工事（W02）
    { id: 'K0201', name: 'コンクリート工',   work_type: 'W02', work_type_name: 'コンクリート工事', available_elements: 'E11 E12 E13 E14 E15' },
    { id: 'K0202', name: '型枠工',           work_type: 'W02', work_type_name: 'コンクリート工事', available_elements: 'E11 E14 E15' },
    { id: 'K0203', name: '鉄筋工',           work_type: 'W02', work_type_name: 'コンクリート工事', available_elements: 'E11 E14 E15' },
    { id: 'K0204', name: '均しコンクリート工', work_type: 'W02', work_type_name: 'コンクリート工事', available_elements: 'E11 E14 E15' },
    { id: 'K0205', name: '基礎割栗石工',     work_type: 'W02', work_type_name: 'コンクリート工事', available_elements: 'E11 E12 E14' },
    // 仮設工事（W03）
    { id: 'K0301', name: '足場工',           work_type: 'W03', work_type_name: '仮設工事',         available_elements: 'E11 E12 E14' },
    { id: 'K0302', name: '仮囲工',           work_type: 'W03', work_type_name: '仮設工事',         available_elements: 'E11 E14' },
    { id: 'K0303', name: '工事用道路工',     work_type: 'W03', work_type_name: '仮設工事',         available_elements: 'E11 E12 E14' },
    // 護岸・海岸工事（W04）
    { id: 'K0401', name: '護岸工',           work_type: 'W04', work_type_name: '護岸・海岸工事',   available_elements: 'E11 E12 E14' },
    { id: 'K0402', name: '消波根固工',       work_type: 'W04', work_type_name: '護岸・海岸工事',   available_elements: 'E11 E14' },
    { id: 'K0403', name: '根固工',           work_type: 'W04', work_type_name: '護岸・海岸工事',   available_elements: 'E11 E14' },
    // 砂防・治山工事（W05）
    { id: 'K0501', name: '砂防ダム工（堰堤工）', work_type: 'W05', work_type_name: '砂防・治山工事', available_elements: 'E11 E12 E14' },
    { id: 'K0502', name: '流路工',           work_type: 'W05', work_type_name: '砂防・治山工事',   available_elements: 'E11 E12 E14' },
    { id: 'K0503', name: '床止工',           work_type: 'W05', work_type_name: '砂防・治山工事',   available_elements: 'E11 E12 E14' },
    { id: 'K0504', name: '山腹工',           work_type: 'W05', work_type_name: '砂防・治山工事',   available_elements: 'E11 E14 E15' },
    { id: 'K0505', name: '落石防止工',       work_type: 'W05', work_type_name: '砂防・治山工事',   available_elements: 'E11 E14' },
    // 舗装工事（W06）
    { id: 'K0601', name: 'アスファルト舗装工', work_type: 'W06', work_type_name: '舗装工事',       available_elements: 'E11 E12 E14' },
    { id: 'K0602', name: '路盤工',           work_type: 'W06', work_type_name: '舗装工事',         available_elements: 'E11 E12 E14' },
    // 法面工事（W07）
    { id: 'K0701', name: '法面保護工',       work_type: 'W07', work_type_name: '法面工事',         available_elements: 'E11 E12 E14 E15' },
    { id: 'K0702', name: '法面整形工',       work_type: 'W07', work_type_name: '法面工事',         available_elements: 'E12 E13 E14' },
    // 林道・農林道工事（W08）
    { id: 'K0801', name: '路体工',           work_type: 'W08', work_type_name: '林道・農林道工事', available_elements: 'E11 E12 E14' },
    { id: 'K0802', name: '路面工',           work_type: 'W08', work_type_name: '林道・農林道工事', available_elements: 'E11 E12 E14' },
    { id: 'K0803', name: '排水路工（林道）', work_type: 'W08', work_type_name: '林道・農林道工事', available_elements: 'E11 E14' },
    // 基礎工事（W09）
    { id: 'K0901', name: '地盤改良工',       work_type: 'W09', work_type_name: '基礎工事',         available_elements: 'E11 E12 E14' },
    { id: 'K0902', name: '杭工',             work_type: 'W09', work_type_name: '基礎工事',         available_elements: 'E11 E12 E14' },
    // 撤去工事（W10）
    { id: 'K1001', name: '構造物撤去工',     work_type: 'W10', work_type_name: '撤去工事',         available_elements: 'E12 E13 E14' },
    { id: 'K1002', name: '舗装撤去工',       work_type: 'W10', work_type_name: '撤去工事',         available_elements: 'E12 E14' },
    // 排水工事（W11）
    { id: 'K1101', name: '管渠工（排水工）', work_type: 'W11', work_type_name: '排水工事',         available_elements: 'E11 E12 E14' },
    { id: 'K1102', name: '側溝工',           work_type: 'W11', work_type_name: '排水工事',         available_elements: 'E11 E14' },
    // その他直接工事（W99）
    { id: 'K9901', name: '測量丁張工',       work_type: 'W99', work_type_name: 'その他直接工事',   available_elements: 'E14 E15' }
  ];
}

/**
 * 取引先マスタを取得する
 * _M取引先シートから有効な取引先を返す
 */
function getVendorsMaster_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_VENDOR);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var vendors = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    // active=TRUE のみ返す
    if (String(obj.active).toUpperCase() !== 'FALSE') {
      vendors.push(obj);
    }
  }

  return vendors;
}

/* ============================================================
 * mode=summary: 工事単位の予実サマリ（消化率/出来高率追加）
 * ============================================================ */

/**
 * 工事サマリデータを取得する
 * @param {string} yearMonth - 対象年月
 * @returns {Object} サマリデータオブジェクト
 */
function getSummaryData_(yearMonth) {
  var ss = getSpreadsheet_();

  try {
    var budgetSheet  = ss.getSheetByName(SHEET_BUDGET);
    var paymentSheet = ss.getSheetByName(SHEET_PAYMENT);

    if (!budgetSheet || !paymentSheet) {
      return getSampleSummary_(yearMonth);
    }

    var budgetData  = budgetSheet.getDataRange().getValues();
    var paymentData = paymentSheet.getDataRange().getValues();

    var totalBudget   = sumColumn_(budgetData, 'budget_amount');
    var totalSpent    = sumPaymentUpTo_(paymentData, yearMonth);
    var totalRemaining = totalBudget - totalSpent;
    var consumptionRate = totalBudget > 0 ? (totalSpent / totalBudget * 100).toFixed(1) : '0.0';

    // 予算健康度から出来高率と信号を取得
    var healthMetrics = null;
    try {
      healthMetrics = getBudgetHealthMetrics(yearMonth);
    } catch (err) {
      Logger.log('予算健康度取得エラー: ' + err.message);
    }

    var progressRate = healthMetrics ? healthMetrics.progress_rate : 0;
    var signal = healthMetrics ? healthMetrics.signal : '不明';
    var shortage = healthMetrics ? healthMetrics.shortage : 0;

    return {
      yearMonth:        yearMonth,
      total_budget:     totalBudget,
      total_spent:      totalSpent,
      total_remaining:  totalRemaining,
      consumption_rate: parseFloat(consumptionRate),
      progress_rate:    progressRate,
      signal:           signal,
      shortage:         shortage,
      status:           signal
    };

  } catch (err) {
    Logger.log('getSummaryData_ エラー: ' + err.message);
    return getSampleSummary_(yearMonth);
  }
}

/**
 * サンプルサマリデータ（シート未接続時のフォールバック）
 */
function getSampleSummary_(yearMonth) {
  return {
    yearMonth:        yearMonth,
    total_budget:     25000000,
    total_spent:      18500000,
    total_remaining:   6500000,
    consumption_rate: 74.0,
    progress_rate:    70.0,
    signal:           '正常',
    shortage:         0,
    status:           '正常',
    note:             'サンプルデータ（スプレッドシート未接続）'
  };
}

/* ============================================================
 * ユーティリティ関数
 * ============================================================ */

/**
 * レスポンスデータを匿名化する（SEC-02）
 * 業者名をマスタIDに置換、工事名・所長名を匿名化。
 * 金額データはそのまま（分析に必要）。
 *
 * @param {Object} data - APIレスポンスのdataオブジェクト
 * @returns {Object} 匿名化済みデータ
 */
function anonymizeResponse_(data) {
  var json = JSON.stringify(data);

  // 業者名→IDマッピングを構築
  var vendorMap = buildVendorAnonymizeMap_();
  for (var name in vendorMap) {
    // 業者名を全てIDに置換
    json = json.split(name).join(vendorMap[name]);
  }

  // 工事名・所長名の匿名化
  var projectAnon = {
    '海潟漁港海岸保全施設整備連携工事(R7-1工区)': 'P004',
    '海潟漁港海岸海岸保全施設整備連携工事(R7-1工区)': 'P004',
    '海潟漁港R7-1': 'P004',
    '上村和弘': '所長A',
    '池田豊': '所長B',
    '中村竜一': '所長C',
    '中原輝竜': '所長D'
  };
  for (var key in projectAnon) {
    json = json.split(key).join(projectAnon[key]);
  }

  return JSON.parse(json);
}

/**
 * 業者名→匿名IDのマッピングを構築する（SEC-02）
 * @returns {Object} { '川越建設': 'V001', ... }
 */
function buildVendorAnonymizeMap_() {
  var map = {};
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(SHEET_VENDOR);
    if (sheet && sheet.getLastRow() >= 2) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var idIdx = headers.indexOf('vendor_id');
      var nameIdx = headers.indexOf('vendor_name');
      if (idIdx >= 0 && nameIdx >= 0) {
        for (var i = 1; i < data.length; i++) {
          var vName = String(data[i][nameIdx]);
          var vId = String(data[i][idIdx]);
          if (vName && vId) {
            map[vName] = vId;
          }
        }
      }
    }
  } catch (err) {
    Logger.log('匿名化マップ構築エラー: ' + err.message);
  }
  return map;
}

/**
 * スプレッドシートを取得する
 */
function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

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
 * 2次元配列から列名に一致する列の合計を返す
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
 */
function sumPaymentUpTo_(data, upToMonth) {
  if (!data || data.length < 2) return 0;
  var headers = data[0];
  var dateIdx   = headers.indexOf('year_month');
  var amountIdx = headers.indexOf('amount');
  var offsetIdx = headers.indexOf('offset');
  if (dateIdx < 0 || amountIdx < 0) return 0;

  var sum = 0;
  for (var i = 1; i < data.length; i++) {
    var rowMonth = String(data[i][dateIdx]).substring(0, 7);
    if (rowMonth <= upToMonth) {
      var amt = parseFloat(data[i][amountIdx]);
      var off = offsetIdx >= 0 ? (parseFloat(data[i][offsetIdx]) || 0) : 0;
      if (!isNaN(amt)) sum += (amt - off);
    }
  }
  return sum;
}

/**
 * doGet のローカルテスト用関数
 */
function testDoGet() {
  var modes = ['health', 'master', 'summary', 'project', 'aggregate', 'dashboard'];
  modes.forEach(function(mode) {
    var result = doGet({ parameter: { mode: mode, month: '2025-12' } });
    Logger.log('=== mode=' + mode + ' ===');
    Logger.log(result.getContent());
  });
}

/**
 * APIキーを生成してスクリプトプロパティに保存する
 */
function generateApiKey() {
  var key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_KEY', key);
  Logger.log('APIキーを生成しました: ' + key);
  Logger.log('Dify環境変数に設定してください: GAS_API_KEY=' + key);
  return key;
}

/* ============================================================
 * mode=dashboard: 現場ダッシュボードHTML画面
 * ============================================================ */

/**
 * 現場予実管理ダッシュボードのHTMLを生成する
 * @param {string} yearMonth - 対象年月（YYYY-MM形式）
 * @returns {HtmlOutput} ダッシュボードHTML
 */
function buildSiteDashboardHtml_(yearMonth) {
  // データ取得
  var project = getProjectData_();
  var health = getHealthData_(yearMonth);

  // 費目別集計データ取得（aggregation.gs）
  var categories = {};
  try {
    categories = getMonthlyAggregation(yearMonth);
  } catch (err) {
    Logger.log('費目別集計取得エラー: ' + err.message);
  }

  // 金額フォーマット関数
  var fmtYen = function(v) {
    if (v === 0) return '0';
    var abs = Math.abs(v);
    if (abs >= 100000000) return (v / 100000000).toFixed(1) + '億';
    if (abs >= 10000) return Math.round(v / 10000).toLocaleString() + '万';
    return v.toLocaleString();
  };

  // 信号の表示用データ
  var signalColor, signalBg, signalBorder, signalLabel;
  if (health.signal === '超過') {
    signalColor = '#fff'; signalBg = '#E53935'; signalBorder = '#B71C1C'; signalLabel = '超過';
  } else if (health.signal === '注意') {
    signalColor = '#333'; signalBg = '#FDD835'; signalBorder = '#F9A825'; signalLabel = '注意';
  } else {
    signalColor = '#fff'; signalBg = '#2E7D32'; signalBorder = '#1B5E20'; signalLabel = '正常';
  }

  // 消化率バーの色
  var consumptionBarColor = health.consumption_rate > 100 ? '#E53935' :
                            health.consumption_rate > 80 ? '#FDD835' : '#1565C0';

  // 出来高率バーの色
  var progressBarColor = '#2E7D32';

  // アクション提案
  var actionText = health.action_hint || '';

  var html = '<!DOCTYPE html>' +
    '<html lang="ja">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>工事現場 予実管理ダッシュボード</title>' +
    '<style>' +
    '  * { margin: 0; padding: 0; box-sizing: border-box; }' +
    '  body { font-family: "Segoe UI", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif; background: #F5F7FA; color: #333; }' +
    '  .header { background: #0D47A1; color: #fff; padding: 20px 32px; }' +
    '  .header h1 { font-size: 18px; font-weight: 700; }' +
    '  .header p { font-size: 12px; color: #90CAF9; margin-top: 4px; }' +
    '  .container { max-width: 960px; margin: 0 auto; padding: 24px 16px; }' +
    '  .meta-bar { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; font-size: 13px; color: #555; }' +
    '  .meta-bar span { background: #fff; padding: 6px 14px; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }' +
    '  .signal-section { text-align: center; margin-bottom: 32px; }' +
    '  .signal-circle { width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; border: 4px solid; }' +
    '  .signal-hint { font-size: 13px; margin-top: 8px; color: #555; }' +
    '  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }' +
    '  .kpi-card { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }' +
    '  .kpi-card .label { font-size: 11px; color: #888; margin-bottom: 4px; }' +
    '  .kpi-card .value { font-size: 24px; font-weight: 700; }' +
    '  .kpi-card .sub { font-size: 11px; color: #888; margin-top: 4px; }' +
    '  .bar-section { background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 24px; }' +
    '  .bar-section h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #333; }' +
    '  .bar-row { display: flex; align-items: center; margin-bottom: 12px; }' +
    '  .bar-label { width: 80px; font-size: 12px; color: #555; flex-shrink: 0; }' +
    '  .bar-track { flex: 1; height: 24px; background: #E8EAF0; border-radius: 12px; overflow: hidden; position: relative; }' +
    '  .bar-fill { height: 100%; border-radius: 12px; transition: width 0.5s ease; }' +
    '  .bar-value { width: 60px; text-align: right; font-size: 13px; font-weight: 600; flex-shrink: 0; margin-left: 8px; }' +
    '  .table-section { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; margin-bottom: 24px; }' +
    '  .table-section h3 { font-size: 14px; font-weight: 600; padding: 16px 20px 12px; color: #333; }' +
    '  .table-section table { width: 100%; border-collapse: collapse; }' +
    '  .table-section th { background: #F5F7FA; padding: 8px 16px; font-size: 11px; color: #666; text-align: left; font-weight: 600; border-bottom: 2px solid #E0E0E0; }' +
    '  .table-section td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #F0F0F0; }' +
    '  .table-section tr:last-child td { border-bottom: none; font-weight: 700; background: #FAFAFA; }' +
    '  .table-section .num { text-align: right; font-variant-numeric: tabular-nums; }' +
    '  .footer { text-align: center; padding: 16px; font-size: 11px; color: #999; }' +
    '  @media (max-width: 600px) { .kpi-grid { grid-template-columns: 1fr; } .header { padding: 16px; } }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="header">' +
    '  <h1>工事現場 予実管理ダッシュボード</h1>' +
    '  <p>' + escapeHtml_(project.project_name) + '</p>' +
    '</div>' +
    '<div class="container">' +
    '  <div class="meta-bar">' +
    '    <span>対象月: ' + escapeHtml_(yearMonth) + '</span>' +
    '    <span>所長: ' + escapeHtml_(project.manager_name) + '</span>' +
    '    <span>契約額: ' + fmtYen(project.contract_amount) + '円</span>' +
    '  </div>' +
    '  <div class="signal-section">' +
    '    <div class="signal-circle" style="color:' + signalColor + ';background:' + signalBg + ';border-color:' + signalBorder + ';">' + signalLabel + '</div>' +
    '    <div class="signal-hint">' + escapeHtml_(actionText) + '</div>' +
    '  </div>' +
    '  <div class="kpi-grid">' +
    '    <div class="kpi-card">' +
    '      <div class="label">予算額（BAC）</div>' +
    '      <div class="value">' + fmtYen(health.bac) + '</div>' +
    '      <div class="sub">円</div>' +
    '    </div>' +
    '    <div class="kpi-card">' +
    '      <div class="label">実績支出（AC）</div>' +
    '      <div class="value">' + fmtYen(health.ac) + '</div>' +
    '      <div class="sub">円</div>' +
    '    </div>' +
    '    <div class="kpi-card">' +
    '      <div class="label">過不足見込み</div>' +
    '      <div class="value" style="color:' + (health.shortage < 0 ? '#E53935' : '#2E7D32') + ';">' + fmtYen(health.shortage) + '</div>' +
    '      <div class="sub">円（正=余裕 / 負=不足）</div>' +
    '    </div>' +
    '    <div class="kpi-card">' +
    '      <div class="label">利益影響</div>' +
    '      <div class="value">' + escapeHtml_(String(health.profit_impact_pt)) + '</div>' +
    '      <div class="sub">ポイント</div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="bar-section">' +
    '    <h3>消化率 vs 出来高率</h3>' +
    '    <div class="bar-row">' +
    '      <div class="bar-label">消化率</div>' +
    '      <div class="bar-track"><div class="bar-fill" style="width:' + Math.min(health.consumption_rate, 100) + '%;background:' + consumptionBarColor + ';"></div></div>' +
    '      <div class="bar-value">' + health.consumption_rate + '%</div>' +
    '    </div>' +
    '    <div class="bar-row">' +
    '      <div class="bar-label">出来高率</div>' +
    '      <div class="bar-track"><div class="bar-fill" style="width:' + Math.min(health.progress_rate, 100) + '%;background:' + progressBarColor + ';"></div></div>' +
    '      <div class="bar-value">' + health.progress_rate + '%</div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="table-section">' +
    '    <h3>費目別支出（' + escapeHtml_(yearMonth) + '）</h3>' +
    '    <table>' +
    '      <thead><tr>' +
    '        <th>カテゴリ</th>' +
    '        <th class="num">予算額</th>' +
    '        <th class="num">当月支出</th>' +
    '        <th class="num">累計支出</th>' +
    '        <th class="num">残高</th>' +
    '        <th class="num">消化率</th>' +
    '      </tr></thead>' +
    '      <tbody>' +
    buildCategoryRow_('C01', '直接工事費', categories, fmtYen) +
    buildCategoryRow_('C02', '共通仮設費', categories, fmtYen) +
    buildCategoryRow_('C03', '現場管理費', categories, fmtYen) +
    buildCategoryRow_('ALL', '合計', categories, fmtYen) +
    '      </tbody>' +
    '    </table>' +
    '  </div>' +
    '  <div class="kpi-grid">' +
    '    <div class="kpi-card">' +
    '      <div class="label">実行予算残高</div>' +
    '      <div class="value" style="color:' + ((health.bac - health.ac) < 0 ? '#E53935' : '#1565C0') + ';">' + fmtYen(health.bac - health.ac) + '</div>' +
    '      <div class="sub">円（予算額 - 実績支出）</div>' +
    '    </div>' +
    '    <div class="kpi-card">' +
    '      <div class="label">計画支出（PV）</div>' +
    '      <div class="value">' + fmtYen(health.pv || 0) + '</div>' +
    '      <div class="sub">円</div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="footer">更新: ' + new Date().toLocaleString('ja-JP') + '</div>' +
    '</body>' +
    '</html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('工事現場 予実管理ダッシュボード')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 費目カテゴリ行のHTMLを生成する
 * @param {string} catId - カテゴリID（C01/C02/C03/ALL）
 * @param {string} catName - カテゴリ表示名
 * @param {Object} categories - getMonthlyAggregation()の返値
 * @param {Function} fmtYen - 金額フォーマット関数
 * @returns {string} テーブル行HTML
 */
function buildCategoryRow_(catId, catName, categories, fmtYen) {
  var cat = categories[catId] || { budget: 0, spent: 0, cumulative: 0, remaining: 0, rate: 0 };
  var remainColor = cat.remaining < 0 ? '#E53935' : '#333';
  return '<tr>' +
    '<td>' + catName + '</td>' +
    '<td class="num">' + fmtYen(cat.budget) + '</td>' +
    '<td class="num">' + fmtYen(cat.spent) + '</td>' +
    '<td class="num">' + fmtYen(cat.cumulative) + '</td>' +
    '<td class="num" style="color:' + remainColor + ';">' + fmtYen(cat.remaining) + '</td>' +
    '<td class="num">' + cat.rate + '%</td>' +
    '</tr>';
}

/**
 * HTML特殊文字をエスケープする
 * @param {string} str - エスケープ対象文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHtml_(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
