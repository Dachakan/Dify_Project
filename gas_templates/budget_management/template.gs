/**
 * 工事初期テンプレート生成（template.gs）
 *
 * 概要:
 *   新規工事のスプレッドシート構造を自動生成する。
 *   _M工事シートの情報を基に、実行予算テーブル・月別配分テーブル・
 *   支払明細シート・予算健康度シート・月次調整シートの骨格を一括作成する。
 *
 * v2変更点:
 *   - EVM→予実管理への転換（_C_EVM集計→_C_予算健康度）
 *   - available_elementsフィルタ（工種ごとの費用要素絞り込み）
 *   - 開始月/終了月列追加（PV自動配分用）
 *   - 2段階入力（所長/事務員列分離）
 *   - 数量/単位/単価列追加（直接工事費のみ）
 *   - 取引先DDマスタ連動
 *   - 簡易モード予算設定（8項目→26項目自動按分）
 *   - 月次出来高率入力シート新設
 *   - 取引先マスタシート新設
 *
 * 使用方法:
 *   1. _M工事シートに工事情報を入力（project_id, start_date, end_date等）
 *   2. GASエディタで initProjectTemplate('P004') を実行
 *   3. 自動生成されたシートに予算額を手入力
 *
 * 依存:
 *   - api.gs（getSpreadsheet_(), getProjectData_(), getMasterData_()）
 *   - validation_extended.gs（refreshDropdowns()）
 *   - config.gs（INPUT_COLS, sanitizeText()）
 */

// シート名定数
var TPL_SHEET_BUDGET         = '_実行予算テーブル';
var TPL_SHEET_BUDGET_MONTHLY = '_実行予算_月別';
var TPL_SHEET_PAYMENT_INPUT  = '支払明細入力';
var TPL_SHEET_PAYMENT        = '支払明細';
var TPL_SHEET_HEALTH         = '_C_予算健康度';
var TPL_SHEET_MONTHLY_AGG    = '_C_月次集計';
var TPL_SHEET_MONTHLY_ADJ    = '_月次調整';
var TPL_SHEET_VENDOR         = '_M取引先';
var TPL_SHEET_PROJECT        = '_M工事';
var TPL_SHEET_MASTER         = '_Mマスタ';

/**
 * 工事初期テンプレートを生成する
 * @param {string} projectId - 工事ID（例: 'P004'）
 */
function initProjectTemplate(projectId) {
  var ss = getSpreadsheet_();

  // 1. 工事情報を取得
  var project = getProjectInfo_(ss, projectId);
  if (!project) {
    throw new Error('工事ID "' + projectId + '" が _M工事シートに見つからない');
  }

  Logger.log('テンプレート生成開始: ' + project.project_name);

  // 2. 工期の月リストを算出
  var months = generateMonthList_(project.start_date, project.end_date);
  Logger.log('工期: ' + months[0] + ' - ' + months[months.length - 1] + ' (' + months.length + 'ヶ月)');

  // 3. マスタデータ取得（QA-05: seedデータを使用）
  var master = getDefaultMaster_();

  // 4. 各シートを生成（QA-05: _Mマスタシートを先に生成）
  createMasterSheet_(ss, master);
  createVendorSheet_(ss);
  createBudgetSheet_(ss, master);
  createBudgetMonthlySheet_(ss, months);
  createPaymentInputSheet_(ss, master);
  createPaymentSheet_(ss);
  createBudgetHealthSheet_(ss, months);
  createMonthlyAggSheet_(ss, months);
  createMonthlyAdjSheet_(ss, months);

  // 5. ドロップダウンの初期設定
  setupInitialDropdowns_(ss, master);

  Logger.log('テンプレート生成完了: ' + project.project_name);
  SpreadsheetApp.getActive().toast(
    project.project_name + ' のテンプレートを生成しました',
    '完了',
    5
  );
}

/**
 * _M工事シートから工事情報を取得する
 * @param {Spreadsheet} ss
 * @param {string} projectId
 * @returns {Object|null}
 */
function getProjectInfo_(ss, projectId) {
  var sheet = ss.getSheetByName(TPL_SHEET_PROJECT);
  if (!sheet || sheet.getLastRow() < 2) return null;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var pidIdx = headers.indexOf('project_id');
  if (pidIdx < 0) return null;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][pidIdx]) === projectId) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      obj.contract_amount = parseFloat(obj.contract_amount) || 0;
      obj.target_profit_rate = parseFloat(obj.target_profit_rate) || 0;
      return obj;
    }
  }
  return null;
}

/**
 * 開始月～終了月のYYYY-MMリストを生成する
 * @param {string} startDate - 'YYYY-MM' 形式
 * @param {string} endDate - 'YYYY-MM' 形式
 * @returns {Array<string>}
 */
function generateMonthList_(startDate, endDate) {
  var start = String(startDate).substring(0, 7);
  var end = String(endDate).substring(0, 7);

  var parts = start.split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);

  var months = [];
  var current = start;
  var maxIterations = 60; // 最大5年間の安全弁

  while (current <= end && maxIterations > 0) {
    months.push(current);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    current = y + '-' + String(m).padStart(2, '0');
    maxIterations--;
  }

  if (months.length === 0) {
    throw new Error('工期が不正: ' + startDate + ' - ' + endDate);
  }

  return months;
}

/* ============================================================
 * _Mマスタシート（QA-05: 費目・工種・費用要素の一元管理）
 * ============================================================ */

/**
 * _Mマスタシートを生成する（QA-05）
 * 費目26項目・工種35項目・費用要素5項目をシートに書き込む。
 * api.gsのgetMasterData_()はこのシートから動的に読み込む。
 *
 * @param {Spreadsheet} ss
 * @param {Object} master - getDefaultMaster_() の戻り値
 */
function createMasterSheet_(ss, master) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_MASTER);
  sheet.clear();

  // ヘッダー
  var headers = [
    'type',               // A: 種別（expense / work_type / cost_element）
    'id',                 // B: ID（F31, K0101, E11等）
    'name',               // C: 名称
    'parent_id',          // D: 親ID（費目→カテゴリ、工種→工事種別、費用要素→空）
    'parent_name',        // E: 親名称
    'available_elements', // F: 利用可能な費用要素（工種のみ、スペース区切り）
    'active'              // G: 有効フラグ
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var rows = [];

  // 費用要素（E11-E15）
  var costElements = [
    { id: 'E11', name: '材料費' },
    { id: 'E12', name: '機械経費' },
    { id: 'E13', name: '機械経費（損料）' },
    { id: 'E14', name: '外注費' },
    { id: 'E15', name: '労務費' }
  ];
  for (var c = 0; c < costElements.length; c++) {
    rows.push([
      'cost_element',
      costElements[c].id,
      costElements[c].name,
      '',
      '',
      '',
      'TRUE'
    ]);
  }

  // 費目（F31-F67）
  for (var e = 0; e < master.expense_items.length; e++) {
    var item = master.expense_items[e];
    rows.push([
      'expense',
      item.id,
      item.name,
      item.category,
      item.category_name,
      '',
      'TRUE'
    ]);
  }

  // 工種（K0101-K9901）
  for (var w = 0; w < master.work_types.length; w++) {
    var wt = master.work_types[w];
    rows.push([
      'work_type',
      wt.id,
      wt.name,
      wt.work_type,
      wt.work_type_name,
      wt.available_elements || '',
      'TRUE'
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#7030A0')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // フィルター設定
  if (rows.length > 0) {
    var range = sheet.getRange(1, 1, rows.length + 1, headers.length);
    range.createFilter();
  }

  Logger.log('_Mマスタシート生成完了: ' + rows.length + '行（費用要素5 + 費目' + master.expense_items.length + ' + 工種' + master.work_types.length + '）');
}

/* ============================================================
 * _M取引先シート（新設）
 * ============================================================ */

/**
 * _M取引先マスタシートを生成する
 */
function createVendorSheet_(ss) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_VENDOR);
  sheet.clear();

  var headers = [
    'vendor_id',    // A: 取引先ID（V001, V002, ...）
    'vendor_name',  // B: 取引先名
    'vendor_type',  // C: 種別（subcontractor/supplier/rental/other）
    'contact',      // D: 担当者名
    'active'        // E: 有効フラグ
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#7030A0')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // 種別DDを設定
  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['subcontractor', 'supplier', 'rental', 'other'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 3, 100, 1).setDataValidation(typeRule);

  // 有効フラグDDを設定
  var activeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 5, 100, 1).setDataValidation(activeRule);

  Logger.log('_M取引先シート生成完了');
}

/* ============================================================
 * _実行予算テーブル（修正: available_elements + 開始月/終了月）
 * ============================================================ */

/**
 * _実行予算テーブルを生成する
 * available_elementsに基づき、工種ごとに該当する費用要素のみ生成
 * 開始月/終了月列を追加（PV自動配分用）
 */
function createBudgetSheet_(ss, master) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_BUDGET);
  sheet.clear();

  // ヘッダー（開始月/終了月を追加）
  var headers = [
    'budget_box_id',   // A: 予算箱ID
    'category_id',     // B: カテゴリID (C01/C02/C03)
    'category_name',   // C: カテゴリ名
    'work_type_id',    // D: 工事種別ID (W01-W99)
    'work_type_name',  // E: 工事種別名
    'koushus_id',      // F: 工種ID (K0101-K9901)
    'koushus_name',    // G: 工種名
    'expense_id',      // H: 費目ID (F31-F67 or E11-E15)
    'expense_name',    // I: 費目名
    'budget_amount',   // J: 実行予算額（手入力）
    'official_amount', // K: 官積算額（手入力）
    'start_month',     // L: 施工開始月（YYYY-MM、手入力）
    'end_month',       // M: 施工終了月（YYYY-MM、手入力）
    'note'             // N: 備考
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 費用要素のマスタ
  var directExpenseMap = {
    'E11': '材料費',
    'E12': '機械経費',
    'E13': '機械経費（損料）',
    'E14': '外注費',
    'E15': '労務費'
  };

  // 共通仮設費・現場管理費の骨格行（C02 + F31-F39、C03 + F51-F67）
  var rows = [];
  var expenseItems = master.expense_items;

  for (var i = 0; i < expenseItems.length; i++) {
    var item = expenseItems[i];
    var categoryId = item.category === 'C02' ? 'C02' : 'C03';
    var budgetBoxId = categoryId + '-' + item.id;

    rows.push([
      budgetBoxId,
      categoryId,
      item.category_name,
      '',  // 工事種別なし（間接費）
      '',
      '',  // 工種なし（間接費）
      '',
      item.id,
      item.name,
      '',  // 予算額（手入力）
      '',  // 官積算額（手入力）
      '',  // 開始月（手入力）
      '',  // 終了月（手入力）
      ''
    ]);
  }

  // 直接工事費の骨格行（C01 + 工種別）
  // available_elementsに基づき、該当する費用要素のみ生成
  var workTypes = master.work_types;

  for (var w = 0; w < workTypes.length; w++) {
    var wt = workTypes[w];

    // available_elementsを取得（スペース区切り or カンマ区切り）
    var availableElements = null;
    if (wt.available_elements) {
      availableElements = String(wt.available_elements).trim().split(/[\s,]+/);
    }

    // available_elementsが未定義の場合は全5要素を展開
    var elementsToUse = availableElements || ['E11', 'E12', 'E13', 'E14', 'E15'];

    for (var d = 0; d < elementsToUse.length; d++) {
      var elemId = elementsToUse[d];
      var elemName = directExpenseMap[elemId] || elemId;
      var boxId = 'C01-' + wt.work_type + '-' + wt.id + '-' + elemId;

      rows.push([
        boxId,
        'C01',
        '直接工事費',
        wt.work_type,
        wt.work_type_name,
        wt.id,
        wt.name,
        elemId,
        elemName,
        '',  // 予算額（手入力）
        '',  // 官積算額（手入力）
        '',  // 開始月（手入力）
        '',  // 終了月（手入力）
        ''
      ]);
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4472C4')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // 予算額・官積算額列の書式（通貨）
  if (rows.length > 0) {
    sheet.getRange(2, 10, rows.length, 2).setNumberFormat('#,##0');
    // 開始月・終了月列はテキスト形式
    sheet.getRange(2, 12, rows.length, 2).setNumberFormat('@');
  }

  Logger.log('_実行予算テーブル生成: ' + rows.length + '行（available_elementsフィルタ適用）');
}

/* ============================================================
 * _実行予算_月別シート（EVM列を簡素化）
 * ============================================================ */

/**
 * _実行予算_月別シートを生成する
 * 予算箱ID * 月の行列構造（予実管理用に簡素化）
 */
function createBudgetMonthlySheet_(ss, months) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_BUDGET_MONTHLY);
  sheet.clear();

  // ヘッダー（予実管理向けに簡素化）
  var headers = [
    'budget_box_id',          // A: 予算箱ID
    'year_month',             // B: 年月
    'planned_amount',         // C: 計画配分額（PV自動配分 or 手入力）
    'planned_progress_rate',  // D: 計画進捗率（自動算出可）
    'pv_cumulative',          // E: PV累計（集計で自動算出）
    'ac_cumulative'           // F: AC累計（集計で自動算出）
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 予算テーブルから予算箱IDを取得
  var budgetSheet = ss.getSheetByName(TPL_SHEET_BUDGET);
  if (!budgetSheet || budgetSheet.getLastRow() < 2) {
    Logger.log('_実行予算_月別: 予算テーブルが空のためスキップ');
    return;
  }

  var budgetData = budgetSheet.getDataRange().getValues();
  var budgetBoxIds = [];
  for (var i = 1; i < budgetData.length; i++) {
    if (budgetData[i][0]) budgetBoxIds.push(budgetData[i][0]);
  }

  // 予算箱ID * 月 の行を生成
  var rows = [];
  for (var b = 0; b < budgetBoxIds.length; b++) {
    for (var m = 0; m < months.length; m++) {
      rows.push([
        budgetBoxIds[b],
        months[m],
        '',   // 計画配分額（PV自動配分で書き込み or 手入力）
        '',   // 計画進捗率
        '',   // PV累計（集計で自動算出）
        ''    // AC累計（集計で自動算出）
      ]);
    }
  }

  if (rows.length > 0) {
    var batchSize = 50000;
    for (var start = 0; start < rows.length; start += batchSize) {
      var batch = rows.slice(start, Math.min(start + batchSize, rows.length));
      sheet.getRange(start + 2, 1, batch.length, headers.length).setValues(batch);
    }
  }

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4472C4')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  Logger.log('_実行予算_月別生成: ' + rows.length + '行 (' + budgetBoxIds.length + '箱 x ' + months.length + 'ヶ月)');
}

/* ============================================================
 * 支払明細入力シート（2段階入力対応、数量列追加、取引先DD）
 * ============================================================ */

/**
 * 支払明細入力シートを生成する
 * 2段階入力: 所長入力列(A-K,緑) / 事務員追記列(L-M,青) / 自動計算列(N-R,灰)
 * 数量/単位/単価: 直接工事費(C01)の場合のみ有効
 */
function createPaymentInputSheet_(ss, master) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_PAYMENT_INPUT);
  sheet.clear();

  var headers = [
    // 所長入力列（A-K、緑背景）
    'No.',                  // A: 連番（自動）
    'カテゴリ',             // B: C01/C02/C03（DD）
    '工事種別',             // C: W01-W99（DD、C01のみ）
    '工種',                 // D: K0101-K9901（DD）
    '費目/要素',            // E: 費目or費用要素（DD）
    '支払先',               // F: 取引先（DD、_M取引先連動）
    '支払年月',             // G: YYYY-MM（手入力）
    '数量',                 // H: 数量（C01のみ有効）
    '単位',                 // I: 単位（C01のみ有効）
    '単価',                 // J: 単価（C01のみ有効）
    '支払金額',             // K: C01: 数量*単価自動計算 or 手入力、C02/C03: 手入力
    // 事務員追記列（L-M、青背景）
    '相殺額',               // L: 相殺額（事務員入力）
    '相殺先',               // M: 相殺先取引先名（事務員入力）
    // 自動計算列（N-R、灰背景）
    '課税区分',             // N: 課税/非課税/対象外（DD）
    '消費税',               // O: 自動計算
    '税込合計',             // P: 自動計算
    '予算箱ID',             // Q: 自動解決
    '備考'                  // R: 手入力
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var maxRows = 500;

  // ヘッダー書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setFontColor('#FFFFFF');

  // 所長入力列（A-K）: 緑背景
  sheet.getRange(1, 1, 1, 11).setBackground('#548235');

  // 事務員追記列（L-M）: 青背景
  sheet.getRange(1, 12, 1, 2).setBackground('#2E75B6');

  // 自動計算列（N-R）: 灰背景
  sheet.getRange(1, 14, 1, 5).setBackground('#808080');

  sheet.setFrozenRows(1);

  // データ行の背景色
  // 所長入力列（A-K）: 薄緑
  sheet.getRange(2, 1, maxRows, 11).setBackground('#E8F5E9');
  // 事務員追記列（L-M）: 薄青
  sheet.getRange(2, 12, maxRows, 2).setBackground('#E3F2FD');
  // 自動計算列（N-R）: 薄灰
  sheet.getRange(2, 14, maxRows, 5).setBackground('#F2F2F2');

  // 通貨書式列
  sheet.getRange(2, 10, maxRows, 1).setNumberFormat('#,##0');  // J列: 単価
  sheet.getRange(2, 11, maxRows, 1).setNumberFormat('#,##0');  // K列: 支払金額
  sheet.getRange(2, 12, maxRows, 1).setNumberFormat('#,##0');  // L列: 相殺額
  sheet.getRange(2, 15, maxRows, 1).setNumberFormat('#,##0');  // O列: 消費税
  sheet.getRange(2, 16, maxRows, 1).setNumberFormat('#,##0');  // P列: 税込合計

  // 数量列の書式
  sheet.getRange(2, 8, maxRows, 1).setNumberFormat('#,##0.0'); // H列: 数量

  // 年月書式列
  sheet.getRange(2, 7, maxRows, 1).setNumberFormat('@');       // G列: テキスト形式

  // 数量・単位・単価列はデフォルトでグレーアウト（C01選択時に有効化）
  sheet.getRange(2, 8, maxRows, 3).setBackground('#E0E0E0');

  // 課税区分DDを設定
  var taxRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['課税', '非課税', '対象外'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 14, maxRows, 1).setDataValidation(taxRule);

  // カテゴリDDを設定
  var categoryRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['直接工事費', '共通仮設費', '現場管理費'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 2, maxRows, 1).setDataValidation(categoryRule);

  Logger.log('支払明細入力シート生成完了（2段階入力対応）');
}

/* ============================================================
 * 支払明細シート（集計用、転記先）
 * ============================================================ */

/**
 * 支払明細シートを生成する（集計用、支払明細入力からの転記先）
 */
function createPaymentSheet_(ss) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_PAYMENT);
  sheet.clear();

  var headers = [
    'payment_id',      // A: 支払ID（自動採番）
    'budget_box_id',   // B: 予算箱ID
    'category_id',     // C: カテゴリID
    'work_type_id',    // D: 工事種別ID
    'koushus_id',      // E: 工種ID
    'expense_id',      // F: 費目ID
    'vendor',          // G: 支払先
    'year_month',      // H: 支払年月（YYYY-MM）
    'quantity',        // I: 数量
    'unit',            // J: 単位
    'unit_price',      // K: 単価
    'amount',          // L: 税抜額
    'offset',          // M: 相殺額
    'offset_vendor',   // N: 相殺先
    'tax_type',        // O: 課税区分
    'tax',             // P: 消費税
    'total',           // Q: 税込合計
    'note'             // R: 備考
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#BF8F00')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // 通貨書式
  sheet.getRange(2, 11, 1000, 1).setNumberFormat('#,##0');  // K列: 単価
  sheet.getRange(2, 12, 1000, 1).setNumberFormat('#,##0');  // L列: 税抜額
  sheet.getRange(2, 13, 1000, 1).setNumberFormat('#,##0');  // M列: 相殺額
  sheet.getRange(2, 16, 1000, 1).setNumberFormat('#,##0');  // P列: 消費税
  sheet.getRange(2, 17, 1000, 1).setNumberFormat('#,##0');  // Q列: 税込合計

  Logger.log('支払明細シート生成完了');
}

/* ============================================================
 * _C_予算健康度シート（_C_EVM集計の後継）
 * ============================================================ */

/**
 * _C_予算健康度シートを生成する
 */
function createBudgetHealthSheet_(ss, months) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_HEALTH);
  sheet.clear();

  var headers = [
    'year_month',        // A: 年月
    'bac',               // B: 予算額
    'pv',                // C: 計画支出累計
    'ac',                // D: 実績支出累計
    'consumption_rate',  // E: 消化率(%)
    'progress_rate',     // F: 出来高率(%)
    'gap',               // G: 差分(消化率-出来高率)
    'shortage',          // H: 過不足見込み
    'signal',            // I: 信号（正常/注意/超過）
    'updated_at'         // J: 更新日時
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 工期月数分の空行を準備
  var rows = [];
  for (var i = 0; i < months.length; i++) {
    rows.push([months[i], '', '', '', '', '', '', '', '', '']);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#2E75B6')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 2, rows.length, 3).setNumberFormat('#,##0');   // BAC/PV/AC
    sheet.getRange(2, 5, rows.length, 2).setNumberFormat('0.0');     // 消化率/出来高率
    sheet.getRange(2, 7, rows.length, 1).setNumberFormat('0.0');     // 差分
    sheet.getRange(2, 8, rows.length, 1).setNumberFormat('#,##0');   // 過不足
  }

  Logger.log('_C_予算健康度シート生成: ' + months.length + '行');
}

/* ============================================================
 * _C_月次集計シート
 * ============================================================ */

/**
 * _C_月次集計シートを生成する
 */
function createMonthlyAggSheet_(ss, months) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_MONTHLY_AGG);
  sheet.clear();

  var headers = [
    'year_month',          // A: 年月
    'category_id',         // B: カテゴリID
    'category_name',       // C: カテゴリ名
    'budget_amount',       // D: 予算額
    'spent_amount',        // E: 支出額（当月）
    'spent_cumulative',    // F: 支出累計
    'remaining',           // G: 残額
    'consumption_rate',    // H: 消化率(%)
    'pending_offset',      // I: 未確定相殺推定額
    'updated_at'           // J: 更新日時
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#C55A11')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  Logger.log('_C_月次集計シート生成完了');
}

/* ============================================================
 * _月次調整シート（出来高率の月次入力用）
 * ============================================================ */

/**
 * _月次調整シートを生成する
 * 所長が月1回「工事全体の出来高率(%)」を入力するシート
 */
function createMonthlyAdjSheet_(ss, months) {
  var sheet = getOrCreateSheet_(ss, TPL_SHEET_MONTHLY_ADJ);
  sheet.clear();

  var headers = [
    'year_month',      // A: 年月
    'progress_rate',   // B: 出来高率(%)（所長入力）
    'note',            // C: 備考
    'input_date'       // D: 入力日
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 工期月数分の空行を準備
  var rows = [];
  for (var i = 0; i < months.length; i++) {
    rows.push([months[i], '', '', '']);
  }

  if (rows.length > 0) {
    // A列をテキスト形式に設定（'2025-10'が日付型に自動変換されるのを防ぐ）
    sheet.getRange(2, 1, rows.length, 1).setNumberFormat('@');
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#548235')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // 出来高率列の書式
  if (rows.length > 0) {
    sheet.getRange(2, 2, rows.length, 1).setNumberFormat('0.0');
  }

  // 入力ガイド
  sheet.getRange(1, 6).setValue('入力ガイド: B列に工事全体の出来高率(%)を月末に入力してください');
  sheet.getRange(1, 6).setFontColor('#666666').setFontStyle('italic');

  Logger.log('_月次調整シート生成: ' + months.length + '行');
}

/* ============================================================
 * ドロップダウン初期設定（取引先DD追加）
 * ============================================================ */

/**
 * 支払明細入力シートのドロップダウンを初期設定する
 */
function setupInitialDropdowns_(ss, master) {
  var sheet = ss.getSheetByName(TPL_SHEET_PAYMENT_INPUT);
  if (!sheet) return;

  var maxRows = 500;

  // 費目DDの全選択肢を準備（全費目 + 直接費用要素）
  var allExpenseNames = [];
  for (var i = 0; i < master.expense_items.length; i++) {
    allExpenseNames.push(master.expense_items[i].name);
  }
  var directExpenses = ['材料費', '機械経費', '機械経費（損料）', '外注費', '労務費'];
  allExpenseNames = allExpenseNames.concat(directExpenses);

  // E列（費目/要素）DD を設定（初期状態は全項目表示）
  var expenseRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(allExpenseNames, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 5, maxRows, 1).setDataValidation(expenseRule);

  // 工事種別DDの名称リスト
  var workTypeNames = getUniqueWorkTypeNames_(master.work_types);

  var workTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(workTypeNames, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 3, maxRows, 1).setDataValidation(workTypeRule);

  // 工種DDの全リスト
  var koushusNames = [];
  for (var k = 0; k < master.work_types.length; k++) {
    koushusNames.push(master.work_types[k].name);
  }

  var koushusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(koushusNames, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 4, maxRows, 1).setDataValidation(koushusRule);

  // F列（支払先）DD を取引先マスタから設定
  setupVendorDropdown_(ss, sheet, maxRows);

  Logger.log('ドロップダウン初期設定完了');
}

/**
 * 取引先DDを設定する
 * _M取引先シートのactive=TRUEの取引先名をDDに設定
 */
function setupVendorDropdown_(ss, targetSheet, maxRows) {
  var vendorSheet = ss.getSheetByName(TPL_SHEET_VENDOR);
  if (!vendorSheet || vendorSheet.getLastRow() < 2) {
    Logger.log('取引先マスタが空のためDD設定スキップ');
    return;
  }

  var data = vendorSheet.getDataRange().getValues();
  var headers = data[0];
  var nameIdx   = headers.indexOf('vendor_name');
  var activeIdx = headers.indexOf('active');

  if (nameIdx < 0) return;

  var vendorNames = [];
  for (var i = 1; i < data.length; i++) {
    var isActive = activeIdx >= 0 ? String(data[i][activeIdx]).toUpperCase() : 'TRUE';
    if (isActive === 'TRUE' && data[i][nameIdx]) {
      vendorNames.push(String(data[i][nameIdx]));
    }
  }

  if (vendorNames.length > 0) {
    var vendorRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(vendorNames, true)
      .setAllowInvalid(true)  // 新規取引先の手入力も許可
      .build();
    targetSheet.getRange(2, 6, maxRows, 1).setDataValidation(vendorRule);
    Logger.log('取引先DD設定: ' + vendorNames.length + '件');
  }
}

/* ============================================================
 * ヘルパー関数
 * ============================================================ */

/**
 * シートを取得または新規作成する
 * @param {Spreadsheet} ss
 * @param {string} sheetName
 * @returns {Sheet}
 */
function getOrCreateSheet_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('シート新規作成: ' + sheetName);
  }
  return sheet;
}

/**
 * 予算箱IDを生成する
 * @param {string} categoryId - C01/C02/C03
 * @param {string} workTypeId - W01-W99（C02/C03の場合は空）
 * @param {string} koushusId - K0101-...（パッケージ時は空）
 * @param {string} expenseId - E11-E15 or F31-F67
 * @return {string} 予算箱ID（例: 'C01-W02-K0201-E14'）
 */
function generateBudgetBoxId(categoryId, workTypeId, koushusId, expenseId) {
  var parts = [categoryId];
  if (workTypeId) parts.push(workTypeId);
  if (koushusId) parts.push(koushusId);
  parts.push(expenseId);
  return parts.join('-');
}

/**
 * 工事種別名のユニークリストを取得
 */
function getUniqueWorkTypeNames_(workTypes) {
  var names = [];
  var seen = {};
  for (var i = 0; i < workTypes.length; i++) {
    var name = workTypes[i].work_type_name;
    if (!seen[name]) {
      names.push(name);
      seen[name] = true;
    }
  }
  return names;
}

/**
 * 月別配分テーブルの列を動的生成（工期月数分）
 * @param {string} projectId - 工事ID
 * @param {string} startYearMonth - '2025-09'
 * @param {string} endYearMonth - '2026-03'
 */
function generateMonthlyColumns(projectId, startYearMonth, endYearMonth) {
  var months = generateMonthList_(startYearMonth, endYearMonth);
  var ss = getSpreadsheet_();
  createBudgetMonthlySheet_(ss, months);
  Logger.log('月別配分テーブル再生成: ' + months.length + 'ヶ月');
}

/* ============================================================
 * 支払明細転記（列構成変更に対応）
 * ============================================================ */

/**
 * 支払明細入力 → 支払明細への転記処理
 * 新列構成に対応（数量/単位/単価、相殺先列追加）
 */
function transferPaymentData() {
  var ss = getSpreadsheet_();
  var inputSheet = ss.getSheetByName(TPL_SHEET_PAYMENT_INPUT);
  var outputSheet = ss.getSheetByName(TPL_SHEET_PAYMENT);

  if (!inputSheet || !outputSheet) {
    throw new Error('支払明細入力シートまたは支払明細シートが存在しない');
  }

  var inputData = inputSheet.getDataRange().getValues();
  if (inputData.length < 2) {
    Logger.log('転記対象データなし');
    return;
  }

  // 出力シートの次の行番号を取得
  var nextRow = outputSheet.getLastRow() + 1;
  var paymentId = nextRow - 1;

  var categoryMap = { '直接工事費': 'C01', '共通仮設費': 'C02', '現場管理費': 'C03' };

  var newRows = [];
  for (var i = 1; i < inputData.length; i++) {
    var row = inputData[i];
    if (!row[1]) continue; // B列（カテゴリ）空はスキップ

    var categoryId = categoryMap[row[1]] || '';
    paymentId++;

    // テキストフィールドのサニタイズ（SEC-04）
    var vendor = typeof sanitizeText === 'function' ? sanitizeText(row[5]) : String(row[5] || '');
    var offsetVendor = typeof sanitizeText === 'function' ? sanitizeText(row[12]) : String(row[12] || '');
    var note = typeof sanitizeText === 'function' ? sanitizeText(row[17]) : String(row[17] || '');

    newRows.push([
      'PAY-' + String(paymentId).padStart(5, '0'),  // payment_id (A)
      row[16] || '',     // budget_box_id (Q列→B)
      categoryId,        // category_id (C)
      '',                // work_type_id (D)
      '',                // koushus_id (E)
      '',                // expense_id (F)
      vendor,            // vendor (G)
      row[6] || '',      // year_month (H)
      row[7] || '',      // quantity (I)
      row[8] || '',      // unit (J)
      row[9] || 0,       // unit_price (K)
      row[10] || 0,      // amount (L)
      row[11] || 0,      // offset (M)
      offsetVendor,      // offset_vendor (N)
      row[13] || '',     // tax_type (O)
      row[14] || 0,      // tax (P)
      row[15] || 0,      // total (Q)
      note               // note (R)
    ]);
  }

  if (newRows.length > 0) {
    outputSheet.getRange(nextRow, 1, newRows.length, 18).setValues(newRows);
    Logger.log('転記完了: ' + newRows.length + '件');
  }
}

/* ============================================================
 * 簡易モード予算設定（8項目→26項目自動按分）
 * ============================================================ */

/**
 * 簡易モード予算設定
 * 所長が8項目の大枠予算を入力すると、共通仮設費・現場管理費を比率で自動按分
 *
 * @param {Object} simpleBudget - 8項目の予算額
 * {
 *   direct_material:    材料費合計,
 *   direct_labor:       労務費合計,
 *   direct_equipment:   機械経費合計,
 *   direct_outsource:   外注費合計,
 *   direct_other:       その他直接経費合計,
 *   common_temporary:   共通仮設費合計,
 *   site_management:    現場管理費合計,
 *   general_admin:      一般管理費合計
 * }
 */
function applySimpleBudget(simpleBudget) {
  var ss = getSpreadsheet_();
  var budgetSheet = ss.getSheetByName(TPL_SHEET_BUDGET);
  if (!budgetSheet || budgetSheet.getLastRow() < 2) {
    throw new Error('_実行予算テーブルが存在しない。先にテンプレートを生成してください');
  }

  var data = budgetSheet.getDataRange().getValues();
  var headers = data[0];
  var catIdx = headers.indexOf('category_id');
  var expIdx = headers.indexOf('expense_id');
  var amtIdx = headers.indexOf('budget_amount');

  if (catIdx < 0 || expIdx < 0 || amtIdx < 0) {
    throw new Error('予算テーブルのヘッダーが不正');
  }

  // 共通仮設費（C02）の按分比率（図2-2準拠のデフォルト比率）
  var c02Ratios = {
    'F31': 0.08,  // 運搬費
    'F32': 0.05,  // 調査・準備費
    'F33': 0.15,  // 仮設建物費
    'F34': 0.05,  // 公害防止対策費
    'F35': 0.25,  // 安全対策費
    'F36': 0.10,  // 水道光熱費
    'F37': 0.12,  // 産業廃棄物処理費
    'F38': 0.10,  // 役務費
    'F39': 0.10   // 営繕費
  };

  // 現場管理費（C03）の按分比率（一般的な中小建設業の比率）
  var c03Ratios = {
    'F51': 0.03,  // 労務管理費
    'F52': 0.15,  // 法定福利費
    'F53': 0.03,  // 租税公課
    'F54': 0.05,  // 地代家賃
    'F55': 0.08,  // 保険料
    'F56': 0.25,  // 従業員給料手当
    'F57': 0.08,  // 従業員賞与
    'F58': 0.02,  // 従業員退職金
    'F59': 0.03,  // 福利厚生費
    'F60': 0.02,  // 事務用品費
    'F61': 0.06,  // 旅費・交通費・通信費
    'F62': 0.02,  // 補償費
    'F63': 0.03,  // 設計費
    'F64': 0.02,  // 交際費
    'F65': 0.02,  // 保証料
    'F66': 0.03,  // 会議費・諸会費
    'F67': 0.08   // 雑費
  };

  var commonTotal = simpleBudget.common_temporary || 0;
  var siteTotal   = simpleBudget.site_management || 0;

  // 各行に予算額を書き込み
  for (var i = 1; i < data.length; i++) {
    var cat = String(data[i][catIdx]);
    var exp = String(data[i][expIdx]);
    var amount = 0;

    if (cat === 'C02' && c02Ratios[exp]) {
      amount = Math.round(commonTotal * c02Ratios[exp]);
    } else if (cat === 'C03' && c03Ratios[exp]) {
      amount = Math.round(siteTotal * c03Ratios[exp]);
    }
    // C01（直接工事費）は工種ごとに入力が必要なため、簡易モードでは按分しない

    if (amount > 0) {
      budgetSheet.getRange(i + 1, amtIdx + 1).setValue(amount);
    }
  }

  Logger.log('簡易モード予算設定完了: C02=' + commonTotal + ', C03=' + siteTotal);
  SpreadsheetApp.getActive().toast(
    '簡易モード: 共通仮設費・現場管理費を自動按分しました',
    '完了',
    5
  );
}

/**
 * ドロップダウンを更新する（支払明細入力シートのDD再設定）
 */
function refreshDropdowns() {
  var ss = getSpreadsheet_();
  // QA-05: _Mマスタが存在すれば動的読み込み、なければseedデータ
  var master;
  try {
    master = getMasterData_();
  } catch (e) {
    master = getDefaultMaster_();
  }
  setupInitialDropdowns_(ss, master);
}

/**
 * テスト用: テンプレート生成のドライラン
 */
function testInitTemplate() {
  initProjectTemplate('P004');
}
