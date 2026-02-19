/**
 * 入力バリデーション・ドロップダウン連動制御（validation_extended.gs）
 *
 * 概要:
 *   支払明細入力シートのonEdit連動処理。
 *   カテゴリ→工事種別→工種→費目の4段階カスケードDDを制御する。
 *   予算箱ID自動解決、消費税自動計算、数量列制御も担当。
 *
 * v2変更点:
 *   - 列構成変更（数量/単位/単価列追加、相殺先列追加）
 *   - 取引先DD連動（_M取引先マスタ参照）
 *   - C01選択時のみ数量/単位/単価列を有効化
 *   - 費用要素名の修正（CSVマスタ準拠: E11=材料費, E15=労務費）
 *
 * トリガー設定:
 *   GASエディタ > トリガー > onEditHandler > スプレッドシートから > 編集時
 *
 * 依存:
 *   - template.gs（generateBudgetBoxId(), refreshDropdowns()）
 *   - api.gs（getMasterData_(), getSpreadsheet_()）
 *   - config.gs（sanitizeText()）
 */

// 支払明細入力シートの列定数（v2: 18列構成）
// 所長入力列（A-K、緑背景）
var VAL_COL_NO        = 1;   // A列: No.
var VAL_COL_CATEGORY  = 2;   // B列: カテゴリ
var VAL_COL_WORKTYPE  = 3;   // C列: 工事種別
var VAL_COL_KOUSHUS   = 4;   // D列: 工種
var VAL_COL_EXPENSE   = 5;   // E列: 費目/要素
var VAL_COL_VENDOR    = 6;   // F列: 支払先（取引先DD）
var VAL_COL_YEARMONTH = 7;   // G列: 支払年月
var VAL_COL_QUANTITY  = 8;   // H列: 数量（C01のみ）
var VAL_COL_UNIT      = 9;   // I列: 単位（C01のみ）
var VAL_COL_UNITPRICE = 10;  // J列: 単価（C01のみ）
var VAL_COL_PAYMENT   = 11;  // K列: 支払金額
// 事務員追記列（L-M、青背景）
var VAL_COL_OFFSET    = 12;  // L列: 相殺額
var VAL_COL_OFFSET_VENDOR = 13; // M列: 相殺先
// 自動計算列（N-R、灰背景）
var VAL_COL_TAXTYPE   = 14;  // N列: 課税区分
var VAL_COL_TAX       = 15;  // O列: 消費税
var VAL_COL_TOTAL     = 16;  // P列: 税込合計
var VAL_COL_BUDGETBOX = 17;  // Q列: 予算箱ID
var VAL_COL_NOTE      = 18;  // R列: 備考

var VAL_SHEET_NAME = '支払明細入力';

/**
 * 編集イベントハンドラ（支払明細入力シート専用）
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function onEditHandler(e) {
  var sheet = e.range.getSheet();
  if (sheet.getName() !== VAL_SHEET_NAME) return;

  var col = e.range.getColumn();
  var row = e.range.getRow();
  if (row < 2) return; // ヘッダー行はスキップ

  switch (col) {
    case VAL_COL_CATEGORY:
      onCategoryChange(sheet, row, e.value);
      break;
    case VAL_COL_WORKTYPE:
      onWorkTypeChange(sheet, row, e.value);
      break;
    case VAL_COL_KOUSHUS:
      onKoushusChange(sheet, row, e.value);
      break;
    case VAL_COL_EXPENSE:
      resolveBudgetBoxId(sheet, row);
      break;
    case VAL_COL_QUANTITY:
    case VAL_COL_UNITPRICE:
      calcAmountFromQuantity(sheet, row);
      break;
    case VAL_COL_PAYMENT:
    case VAL_COL_OFFSET:
    case VAL_COL_TAXTYPE:
      calcTax(sheet, row);
      break;
    case VAL_COL_YEARMONTH:
      validateYearMonth(sheet, row);
      break;
  }
}

/* ============================================================
 * カスケードDD制御
 * ============================================================ */

/**
 * B列（カテゴリ）変更時の処理
 * C01（直接工事費）: C列(工事種別)とD列(工種)を有効化、H-J列(数量)を有効化
 * C02/C03（間接費）: C列/D列をグレーアウト、H-J列をグレーアウト、E列を費目DDに切替
 */
function onCategoryChange(sheet, row, categoryValue) {
  // C/D/E列をクリア
  sheet.getRange(row, VAL_COL_WORKTYPE).clearContent().clearDataValidations();
  sheet.getRange(row, VAL_COL_KOUSHUS).clearContent().clearDataValidations();
  sheet.getRange(row, VAL_COL_EXPENSE).clearContent().clearDataValidations();
  sheet.getRange(row, VAL_COL_BUDGETBOX).clearContent();

  // 数量列（H-J）をクリア
  sheet.getRange(row, VAL_COL_QUANTITY, 1, 3).clearContent();

  if (!categoryValue) return;

  var master = getMasterData_();

  if (categoryValue === '直接工事費') {
    // C列: 工事種別DDを有効化
    sheet.getRange(row, VAL_COL_WORKTYPE).setBackground('#E8F5E9');
    sheet.getRange(row, VAL_COL_KOUSHUS).setBackground('#E8F5E9');

    var workTypeNames = getUniqueWorkTypeNames_(master.work_types);
    var wtRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(workTypeNames, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(row, VAL_COL_WORKTYPE).setDataValidation(wtRule);

    // E列: 直接費用要素のDD（CSVマスタ準拠）
    var directExpenseNames = ['材料費', '機械経費', '機械経費（損料）', '外注費', '労務費'];
    var deRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(directExpenseNames, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(row, VAL_COL_EXPENSE).setDataValidation(deRule);

    // H-J列（数量/単位/単価）を有効化（白背景）
    sheet.getRange(row, VAL_COL_QUANTITY, 1, 3).setBackground('#E8F5E9');

    // 単位DDを設定
    var unitRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['m3', 'm2', 'm', 't', '台', '本', '枚', '個', '式', '人工'], true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(row, VAL_COL_UNIT).setDataValidation(unitRule);

  } else if (categoryValue === '共通仮設費') {
    // C列/D列をグレーアウト（間接費には工事種別・工種がない）
    sheet.getRange(row, VAL_COL_WORKTYPE).setBackground('#E0E0E0');
    sheet.getRange(row, VAL_COL_KOUSHUS).setBackground('#E0E0E0');

    // H-J列をグレーアウト（数量の概念なし）
    sheet.getRange(row, VAL_COL_QUANTITY, 1, 3).setBackground('#E0E0E0');

    // E列: 共通仮設費の費目DDに切替（F31-F39）
    var c02Items = filterExpenseByCategory_(master.expense_items, 'C02');
    var c02Rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(c02Items, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(row, VAL_COL_EXPENSE).setDataValidation(c02Rule);

  } else if (categoryValue === '現場管理費') {
    // C列/D列をグレーアウト
    sheet.getRange(row, VAL_COL_WORKTYPE).setBackground('#E0E0E0');
    sheet.getRange(row, VAL_COL_KOUSHUS).setBackground('#E0E0E0');

    // H-J列をグレーアウト（数量の概念なし）
    sheet.getRange(row, VAL_COL_QUANTITY, 1, 3).setBackground('#E0E0E0');

    // E列: 現場管理費の費目DDに切替（F51-F67）
    var c03Items = filterExpenseByCategory_(master.expense_items, 'C03');
    var c03Rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(c03Items, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(row, VAL_COL_EXPENSE).setDataValidation(c03Rule);
  }
}

/**
 * C列（工事種別）変更時の処理
 * D列（工種）のDDを当該工事種別の工種のみにフィルタ
 */
function onWorkTypeChange(sheet, row, workTypeValue) {
  // D/E列をクリア
  sheet.getRange(row, VAL_COL_KOUSHUS).clearContent().clearDataValidations();
  sheet.getRange(row, VAL_COL_EXPENSE).clearContent();
  sheet.getRange(row, VAL_COL_BUDGETBOX).clearContent();

  if (!workTypeValue) return;

  var master = getMasterData_();

  // 選択された工事種別名に属する工種のみ抽出
  var filteredKoushus = [];
  for (var i = 0; i < master.work_types.length; i++) {
    if (master.work_types[i].work_type_name === workTypeValue) {
      filteredKoushus.push(master.work_types[i].name);
    }
  }

  if (filteredKoushus.length > 0) {
    var kRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(filteredKoushus, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(row, VAL_COL_KOUSHUS).setDataValidation(kRule);
  }

  // E列: 直接費用要素のDDを再設定
  var directExpenseNames = ['材料費', '機械経費', '機械経費（損料）', '外注費', '労務費'];
  var deRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(directExpenseNames, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, VAL_COL_EXPENSE).setDataValidation(deRule);
}

/**
 * D列（工種）変更時の処理
 * E列を更新し、available_elementsに基づいて費用要素をフィルタ
 */
function onKoushusChange(sheet, row, koushusValue) {
  sheet.getRange(row, VAL_COL_EXPENSE).clearContent();
  sheet.getRange(row, VAL_COL_BUDGETBOX).clearContent();

  if (!koushusValue) return;

  var master = getMasterData_();

  // 選択された工種のavailable_elementsを取得
  var availableElements = null;
  for (var i = 0; i < master.work_types.length; i++) {
    if (master.work_types[i].name === koushusValue) {
      availableElements = master.work_types[i].available_elements;
      break;
    }
  }

  // 費用要素名のマッピング（CSVマスタ準拠）
  var elementNameMap = {
    'E11': '材料費',
    'E12': '機械経費',
    'E13': '機械経費（損料）',
    'E14': '外注費',
    'E15': '労務費'
  };

  var expenseNames;
  if (availableElements) {
    var elements = String(availableElements).trim().split(/[\s,]+/);
    expenseNames = [];
    for (var j = 0; j < elements.length; j++) {
      var name = elementNameMap[elements[j]];
      if (name) expenseNames.push(name);
    }
  } else {
    // available_elements未定義の場合は全5要素
    expenseNames = ['材料費', '機械経費', '機械経費（損料）', '外注費', '労務費'];
  }

  if (expenseNames.length > 0) {
    var deRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(expenseNames, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(row, VAL_COL_EXPENSE).setDataValidation(deRule);
  }
}

/* ============================================================
 * 数量 x 単価 → 金額 自動計算
 * ============================================================ */

/**
 * H列（数量）またはJ列（単価）変更時に金額を自動計算する
 * 直接工事費(C01)の場合のみ: 金額 = 数量 x 単価
 */
function calcAmountFromQuantity(sheet, row) {
  var category = sheet.getRange(row, VAL_COL_CATEGORY).getValue();
  if (category !== '直接工事費') return;

  var quantity  = Number(sheet.getRange(row, VAL_COL_QUANTITY).getValue()) || 0;
  var unitPrice = Number(sheet.getRange(row, VAL_COL_UNITPRICE).getValue()) || 0;

  if (quantity > 0 && unitPrice > 0) {
    var amount = Math.round(quantity * unitPrice);
    sheet.getRange(row, VAL_COL_PAYMENT).setValue(amount);
    // 金額更新時に税計算も実行
    calcTax(sheet, row);
  }
}

/* ============================================================
 * 予算箱ID自動解決
 * ============================================================ */

/**
 * Q列（予算箱ID）の自動解決
 * B-E列の入力値から予算箱IDを生成し、実行予算テーブルと照合する
 */
function resolveBudgetBoxId(sheet, row) {
  var categoryName = sheet.getRange(row, VAL_COL_CATEGORY).getValue();
  var workTypeName = sheet.getRange(row, VAL_COL_WORKTYPE).getValue();
  var koushusName  = sheet.getRange(row, VAL_COL_KOUSHUS).getValue();
  var expenseName  = sheet.getRange(row, VAL_COL_EXPENSE).getValue();

  if (!categoryName || !expenseName) {
    sheet.getRange(row, VAL_COL_BUDGETBOX).clearContent().setBackground('#F2F2F2');
    return;
  }

  var categoryId = getCategoryId(categoryName);
  var workTypeId = getWorkTypeIdFromName_(workTypeName);
  var koushusId  = getKoushusIdFromName_(koushusName);
  var expenseId  = getExpenseIdFromName_(expenseName);

  var budgetBoxId = generateBudgetBoxId(categoryId, workTypeId, koushusId, expenseId);
  var budgetBoxCell = sheet.getRange(row, VAL_COL_BUDGETBOX);

  // _実行予算テーブルに存在するか確認
  var ss = getSpreadsheet_();
  var budgetSheet = ss.getSheetByName('_実行予算テーブル');

  if (!budgetSheet || budgetSheet.getLastRow() < 2) {
    budgetBoxCell.setValue(budgetBoxId).setBackground('#FFF9C4'); // 黄色: 予算テーブル未設定
    return;
  }

  var budgetData = budgetSheet.getRange(2, 1, budgetSheet.getLastRow() - 1, 1).getValues();
  var budgetIds = budgetData.map(function(r) { return r[0]; });

  if (budgetIds.indexOf(budgetBoxId) >= 0) {
    budgetBoxCell.setValue(budgetBoxId).setBackground('#C8E6C9'); // 緑: 一致
  } else {
    budgetBoxCell.setValue(budgetBoxId).setBackground('#FFCDD2'); // 赤: 未設定
    SpreadsheetApp.getActive().toast(
      '予算箱IDが未設定: ' + budgetBoxId + '\n_実行予算テーブルに該当行を追加してください',
      '警告',
      10
    );
  }
}

/* ============================================================
 * 消費税自動計算
 * ============================================================ */

/**
 * K列（支払金額）、L列（相殺額）、N列（課税区分）変更時の消費税計算
 */
function calcTax(sheet, row) {
  var payment = Number(sheet.getRange(row, VAL_COL_PAYMENT).getValue()) || 0;
  var offset  = Number(sheet.getRange(row, VAL_COL_OFFSET).getValue()) || 0;
  var taxType = sheet.getRange(row, VAL_COL_TAXTYPE).getValue();

  var base = payment - offset;
  var tax = 0;

  if (taxType === '非課税' || taxType === '対象外') {
    tax = 0;
  } else {
    // 課税（config.gsのTAX_RATE定数を使用）
    var rate = (typeof TAX_RATE !== 'undefined') ? TAX_RATE : 0.10;
    tax = Math.round(base * rate);
  }

  sheet.getRange(row, VAL_COL_TAX).setValue(tax);
  sheet.getRange(row, VAL_COL_TOTAL).setValue(base + tax);
}

/**
 * G列（支払年月）のバリデーション
 * YYYY-MM形式を検証する
 */
function validateYearMonth(sheet, row) {
  var value = String(sheet.getRange(row, VAL_COL_YEARMONTH).getValue());
  var pattern = /^\d{4}-(0[1-9]|1[0-2])$/;

  if (value && !pattern.test(value)) {
    sheet.getRange(row, VAL_COL_YEARMONTH).setBackground('#FFCDD2');
    SpreadsheetApp.getActive().toast(
      '支払年月はYYYY-MM形式で入力してください（例: 2025-12）',
      '入力エラー',
      5
    );
  } else {
    sheet.getRange(row, VAL_COL_YEARMONTH).setBackground('#E8F5E9');
  }
}

/* ============================================================
 * ヘルパー関数（名称→ID変換）
 * ============================================================ */

/**
 * カテゴリ名からカテゴリIDを取得
 */
function getCategoryId(name) {
  var map = { '直接工事費': 'C01', '共通仮設費': 'C02', '現場管理費': 'C03' };
  return map[name] || '';
}

/**
 * 工事種別名からIDを取得（マスタ参照）
 */
function getWorkTypeIdFromName_(name) {
  if (!name) return '';
  var master = getMasterData_();
  for (var i = 0; i < master.work_types.length; i++) {
    if (master.work_types[i].work_type_name === name) {
      return master.work_types[i].work_type;
    }
  }
  return '';
}

/**
 * 工種名からIDを取得（マスタ参照）
 */
function getKoushusIdFromName_(name) {
  if (!name) return '';
  var master = getMasterData_();
  for (var i = 0; i < master.work_types.length; i++) {
    if (master.work_types[i].name === name) {
      return master.work_types[i].id;
    }
  }
  return '';
}

/**
 * 費目・費用要素名からIDを取得
 * CSVマスタ準拠: E11=材料費, E12=機械経費, E13=機械経費（損料）, E14=外注費, E15=労務費
 */
function getExpenseIdFromName_(name) {
  if (!name) return '';

  // 直接費用要素の変換（CSVマスタ準拠）
  var directMap = {
    '材料費': 'E11',
    '機械経費': 'E12',
    '機械経費（損料）': 'E13',
    '外注費': 'E14',
    '労務費': 'E15'
  };
  if (directMap[name]) return directMap[name];

  // 間接費の費目マスタから検索
  var master = getMasterData_();
  for (var i = 0; i < master.expense_items.length; i++) {
    if (master.expense_items[i].name === name) {
      return master.expense_items[i].id;
    }
  }
  return '';
}

/**
 * 費目をカテゴリIDでフィルタして名称リストを返す
 */
function filterExpenseByCategory_(expenseItems, categoryId) {
  var names = [];
  for (var i = 0; i < expenseItems.length; i++) {
    if (expenseItems[i].category === categoryId) {
      names.push(expenseItems[i].name);
    }
  }
  return names;
}
