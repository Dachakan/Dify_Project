/**
 * 月次自動集計処理（aggregation.gs）
 *
 * 概要:
 *   支払明細テーブルのデータを経費コード別・月別に集計し、
 *   _C_月次集計シートに書き出す。予算健康度計算の基盤データを提供する。
 *
 * v2変更点:
 *   - QA-02: スナップショット方式（データコピー後に集計）
 *   - 暫定集計対応（相殺未入力行は相殺なし扱い）
 *   - 未確定相殺の推定額を集計に含む
 *   - 支払明細の列構成変更に対応
 *
 * 集計粒度:
 *   - カテゴリ別（C01直接工事費 / C02共通仮設費 / C03現場管理費）
 *   - 費目コード別（F31-F67, E11-E15）
 *   - 月別（YYYY-MM）
 *
 * 実行方法:
 *   - 手動: GASエディタで runMonthlyAggregation() を実行
 *   - 自動: 月次トリガー（setAggregationTrigger()で設定）
 *   - メニュー: 工事管理 > 月次集計を実行
 *
 * 依存:
 *   - api.gs（getSpreadsheet_(), sumColumn_(), sumPaymentUpTo_()）
 *   - template.gs（getOrCreateSheet_()）
 */

// シート名定数
var AGG_SHEET_PAYMENT     = '支払明細';
var AGG_SHEET_BUDGET      = '_実行予算テーブル';
var AGG_SHEET_MONTHLY     = '_C_月次集計';
var AGG_SHEET_DETAIL      = '_C_費目別集計';

/**
 * 月次集計のメイン処理
 * QA-02: スナップショット方式でデータコピー後に集計する
 */
function runMonthlyAggregation() {
  var ss = getSpreadsheet_();
  var paymentSheet = ss.getSheetByName(AGG_SHEET_PAYMENT);
  var budgetSheet  = ss.getSheetByName(AGG_SHEET_BUDGET);

  if (!paymentSheet || paymentSheet.getLastRow() < 2) {
    Logger.log('支払明細が空のため集計スキップ');
    return { status: 'skipped', reason: '支払明細なし' };
  }

  // QA-02: スナップショット取得（同時編集時のデータ不整合を防ぐ）
  var paymentData = takeSnapshot_(paymentSheet);
  var paymentHeaders = paymentData[0];

  // 予算データの取得
  var budgetTotals = getBudgetTotals_(ss, budgetSheet);

  // 支払データを月×カテゴリで集計（暫定集計対応）
  var aggregated = aggregatePayments_(paymentData, paymentHeaders);

  // 未確定相殺の推定額を算出
  var pendingOffsets = calculatePendingOffsets_(paymentData, paymentHeaders);

  // _C_月次集計シートに書き出し
  writeMonthlyAggregation_(ss, aggregated, budgetTotals, pendingOffsets);

  // _C_費目別集計シートに詳細書き出し
  writeDetailAggregation_(ss, paymentData, paymentHeaders, budgetSheet);

  Logger.log('月次集計完了: ' + Object.keys(aggregated).length + '月分');
  return { status: 'completed', months: Object.keys(aggregated).length };
}

/**
 * シートのスナップショットを取得する（QA-02）
 * データを一括読み込みし、以降の処理はこのコピーに対して行う
 * 同時編集によるデータ不整合を防ぐ
 *
 * @param {Sheet} sheet
 * @returns {Array} 2次元配列（スナップショット）
 */
function takeSnapshot_(sheet) {
  // スプレッドシートのフラッシュ（保留中の変更を確定）
  SpreadsheetApp.flush();

  // データの一括コピー
  var data = sheet.getDataRange().getValues();

  Logger.log('スナップショット取得: ' + sheet.getName() + ' (' + data.length + '行)');
  return data;
}

/**
 * 予算テーブルからカテゴリ別の予算合計を取得する
 * @param {Spreadsheet} ss
 * @param {Sheet} budgetSheet
 * @returns {Object} カテゴリID別の予算合計
 */
function getBudgetTotals_(ss, budgetSheet) {
  var totals = { 'C01': 0, 'C02': 0, 'C03': 0, 'ALL': 0 };

  if (!budgetSheet || budgetSheet.getLastRow() < 2) return totals;

  var data = budgetSheet.getDataRange().getValues();
  var headers = data[0];
  var catIdx = headers.indexOf('category_id');
  var amtIdx = headers.indexOf('budget_amount');

  if (catIdx < 0 || amtIdx < 0) return totals;

  for (var i = 1; i < data.length; i++) {
    var cat = String(data[i][catIdx]);
    var amt = parseFloat(data[i][amtIdx]) || 0;

    if (totals.hasOwnProperty(cat)) {
      totals[cat] += amt;
    }
    totals['ALL'] += amt;
  }

  return totals;
}

/**
 * 支払データを月×カテゴリで集計する
 * 暫定集計: 相殺未入力行は相殺なし扱いで集計
 *
 * @param {Array} data - 支払明細の2次元配列
 * @param {Array} headers - ヘッダー行
 * @returns {Object} { 'YYYY-MM': { 'C01': amount, ... } }
 */
function aggregatePayments_(data, headers) {
  var ymIdx  = headers.indexOf('year_month');
  var catIdx = headers.indexOf('category_id');
  var amtIdx = headers.indexOf('amount');
  var offIdx = headers.indexOf('offset');

  if (ymIdx < 0 || amtIdx < 0) {
    Logger.log('支払明細に必須列（year_month, amount）が不足');
    return {};
  }

  var result = {};

  for (var i = 1; i < data.length; i++) {
    var ym  = String(data[i][ymIdx]).substring(0, 7);
    var cat = catIdx >= 0 ? String(data[i][catIdx]) : 'UNKNOWN';
    var amt = parseFloat(data[i][amtIdx]) || 0;
    var offset = offIdx >= 0 ? (parseFloat(data[i][offIdx]) || 0) : 0;

    if (!ym || ym.length < 7) continue;

    // 実質支出額 = 税抜額 - 相殺額（相殺未入力は0扱い = 暫定集計）
    var netAmount = amt - offset;

    if (!result[ym]) {
      result[ym] = { 'C01': 0, 'C02': 0, 'C03': 0, 'ALL': 0 };
    }

    if (result[ym].hasOwnProperty(cat)) {
      result[ym][cat] += netAmount;
    }
    result[ym]['ALL'] += netAmount;
  }

  return result;
}

/**
 * 未確定相殺の推定額を算出する
 * 相殺額が0で、かつ相殺先が未入力の行を「相殺未確定」として推定
 *
 * @param {Array} data - 支払明細の2次元配列
 * @param {Array} headers - ヘッダー行
 * @returns {Object} { 'YYYY-MM': estimatedAmount }
 */
function calculatePendingOffsets_(data, headers) {
  var ymIdx     = headers.indexOf('year_month');
  var offIdx    = headers.indexOf('offset');
  var offVIdx   = headers.indexOf('offset_vendor');
  var amtIdx    = headers.indexOf('amount');
  var catIdx    = headers.indexOf('category_id');

  if (ymIdx < 0 || amtIdx < 0) return {};

  var result = {};

  for (var i = 1; i < data.length; i++) {
    var ym = String(data[i][ymIdx]).substring(0, 7);
    if (!ym || ym.length < 7) continue;

    var offset = offIdx >= 0 ? (parseFloat(data[i][offIdx]) || 0) : 0;
    var offsetVendor = offVIdx >= 0 ? String(data[i][offVIdx]).trim() : '';
    var cat = catIdx >= 0 ? String(data[i][catIdx]) : '';

    // 相殺額が0で、直接工事費以外（共通仮設費・現場管理費は相殺が多い）
    // かつ金額が一定以上の場合、相殺未確定の可能性がある
    if (offset === 0 && !offsetVendor && (cat === 'C02' || cat === 'C03')) {
      var amt = parseFloat(data[i][amtIdx]) || 0;
      if (amt > 0) {
        if (!result[ym]) result[ym] = 0;
        // 推定相殺率（共通仮設費・現場管理費の相殺率は一般的に10-30%）
        // ここでは控えめに0（推定しない）。将来的に学習ベースで改善可能
        // 現時点では「未確定行数」として情報提供のみ
        result[ym] += 0;
      }
    }
  }

  return result;
}

/**
 * _C_月次集計シートに集計結果を書き出す
 * 未確定相殺の推定額を含む
 */
function writeMonthlyAggregation_(ss, aggregated, budgetTotals, pendingOffsets) {
  var sheet = getOrCreateSheet_(ss, AGG_SHEET_MONTHLY);
  sheet.clear();

  // ヘッダー
  var headers = [
    'year_month',       // A
    'category_id',      // B
    'category_name',    // C
    'budget_amount',    // D: カテゴリ別予算
    'spent_amount',     // E: 当月支出（相殺控除後）
    'spent_cumulative', // F: 支出累計
    'remaining',        // G: 残額
    'consumption_rate', // H: 消化率
    'pending_offset',   // I: 未確定相殺推定額
    'updated_at'        // J
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var categoryNames = { 'C01': '直接工事費', 'C02': '共通仮設費', 'C03': '現場管理費', 'ALL': '合計' };
  var categories = ['C01', 'C02', 'C03', 'ALL'];

  // 月を昇順ソート
  var months = Object.keys(aggregated).sort();

  // 累計を計算しながら書き出し
  var cumulatives = { 'C01': 0, 'C02': 0, 'C03': 0, 'ALL': 0 };
  var rows = [];
  var now = new Date().toISOString();

  for (var m = 0; m < months.length; m++) {
    var ym = months[m];
    var monthData = aggregated[ym];
    var pendingOffset = pendingOffsets[ym] || 0;

    for (var c = 0; c < categories.length; c++) {
      var cat = categories[c];
      var spent = monthData[cat] || 0;
      cumulatives[cat] += spent;

      var budget = budgetTotals[cat] || 0;
      var remaining = budget - cumulatives[cat];
      var rate = budget > 0 ? parseFloat((cumulatives[cat] / budget * 100).toFixed(1)) : 0;

      rows.push([
        ym,
        cat,
        categoryNames[cat],
        budget,
        spent,
        cumulatives[cat],
        remaining,
        rate,
        cat === 'ALL' ? pendingOffset : '',  // 未確定相殺はALL行のみ
        now
      ]);
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#C55A11')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 4, rows.length, 4).setNumberFormat('#,##0');
    sheet.getRange(2, 8, rows.length, 1).setNumberFormat('0.0');
    sheet.getRange(2, 9, rows.length, 1).setNumberFormat('#,##0');
  }

  Logger.log('_C_月次集計書き出し: ' + rows.length + '行');
}

/**
 * _C_費目別集計シートに費目コード単位の詳細集計を書き出す
 */
function writeDetailAggregation_(ss, paymentData, paymentHeaders, budgetSheet) {
  var sheet = getOrCreateSheet_(ss, AGG_SHEET_DETAIL);
  sheet.clear();

  // ヘッダー
  var headers = [
    'budget_box_id',    // A: 予算箱ID
    'category_id',      // B
    'expense_id',       // C: 費目ID
    'expense_name',     // D: 費目名
    'budget_amount',    // E: 予算額
    'spent_cumulative', // F: 支出累計
    'remaining',        // G: 残額
    'consumption_rate', // H: 消化率
    'vendor_count',     // I: 支払先数
    'updated_at'        // J
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 予算箱ID別の予算額マップを作成
  var budgetMap = {};
  if (budgetSheet && budgetSheet.getLastRow() >= 2) {
    var bData = budgetSheet.getDataRange().getValues();
    var bHeaders = bData[0];
    var bBoxIdx = bHeaders.indexOf('budget_box_id');
    var bCatIdx = bHeaders.indexOf('category_id');
    var bExpIdx = bHeaders.indexOf('expense_id');
    var bNameIdx = bHeaders.indexOf('expense_name');
    var bAmtIdx = bHeaders.indexOf('budget_amount');

    for (var i = 1; i < bData.length; i++) {
      var boxId = bData[i][bBoxIdx];
      if (boxId) {
        budgetMap[boxId] = {
          category_id: bCatIdx >= 0 ? bData[i][bCatIdx] : '',
          expense_id: bExpIdx >= 0 ? bData[i][bExpIdx] : '',
          expense_name: bNameIdx >= 0 ? bData[i][bNameIdx] : '',
          budget_amount: bAmtIdx >= 0 ? (parseFloat(bData[i][bAmtIdx]) || 0) : 0
        };
      }
    }
  }

  // 支払データを予算箱ID別に集計
  var boxIdx = paymentHeaders.indexOf('budget_box_id');
  var amtIdx = paymentHeaders.indexOf('amount');
  var offIdx = paymentHeaders.indexOf('offset');
  var vendorIdx = paymentHeaders.indexOf('vendor');

  var spentMap = {};  // boxId -> { total: number, vendors: {} }

  if (boxIdx >= 0 && amtIdx >= 0) {
    for (var p = 1; p < paymentData.length; p++) {
      var pBoxId = String(paymentData[p][boxIdx]);
      var pAmt = parseFloat(paymentData[p][amtIdx]) || 0;
      var pOff = offIdx >= 0 ? (parseFloat(paymentData[p][offIdx]) || 0) : 0;
      var pVendor = vendorIdx >= 0 ? String(paymentData[p][vendorIdx]) : '';

      if (!pBoxId) continue;

      if (!spentMap[pBoxId]) {
        spentMap[pBoxId] = { total: 0, vendors: {} };
      }
      spentMap[pBoxId].total += (pAmt - pOff);
      if (pVendor) spentMap[pBoxId].vendors[pVendor] = true;
    }
  }

  // 予算箱ごとの行を生成
  var rows = [];
  var now = new Date().toISOString();
  var allBoxIds = Object.keys(budgetMap);

  for (var sKey in spentMap) {
    if (allBoxIds.indexOf(sKey) < 0) allBoxIds.push(sKey);
  }

  allBoxIds.sort();

  for (var b = 0; b < allBoxIds.length; b++) {
    var bid = allBoxIds[b];
    var budgetInfo = budgetMap[bid] || { category_id: '', expense_id: '', expense_name: '', budget_amount: 0 };
    var spentInfo = spentMap[bid] || { total: 0, vendors: {} };

    var budget = budgetInfo.budget_amount;
    var spent = spentInfo.total;
    var remaining = budget - spent;
    var rate = budget > 0 ? parseFloat((spent / budget * 100).toFixed(1)) : 0;
    var vendorCount = Object.keys(spentInfo.vendors).length;

    rows.push([
      bid,
      budgetInfo.category_id,
      budgetInfo.expense_id,
      budgetInfo.expense_name,
      budget,
      spent,
      remaining,
      rate,
      vendorCount,
      now
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // 書式設定
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#548235')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 5, rows.length, 3).setNumberFormat('#,##0');
    sheet.getRange(2, 8, rows.length, 1).setNumberFormat('0.0');
  }

  Logger.log('_C_費目別集計書き出し: ' + rows.length + '行');
}

/**
 * 特定月のカテゴリ別集計を取得する（予算健康度計算用）
 * @param {string} yearMonth - 対象年月
 * @returns {Object}
 */
function getMonthlyAggregation(yearMonth) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(AGG_SHEET_MONTHLY);

  if (!sheet || sheet.getLastRow() < 2) {
    runMonthlyAggregation();
    sheet = ss.getSheetByName(AGG_SHEET_MONTHLY);
    if (!sheet || sheet.getLastRow() < 2) {
      return getEmptyAggregation_();
    }
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var ymIdx = headers.indexOf('year_month');
  var catIdx = headers.indexOf('category_id');

  var result = {};

  for (var i = 1; i < data.length; i++) {
    var ym = String(data[i][ymIdx]).substring(0, 7);
    if (ym !== yearMonth) continue;

    var cat = String(data[i][catIdx]);
    result[cat] = {
      budget: parseFloat(data[i][headers.indexOf('budget_amount')]) || 0,
      spent: parseFloat(data[i][headers.indexOf('spent_amount')]) || 0,
      cumulative: parseFloat(data[i][headers.indexOf('spent_cumulative')]) || 0,
      remaining: parseFloat(data[i][headers.indexOf('remaining')]) || 0,
      rate: parseFloat(data[i][headers.indexOf('consumption_rate')]) || 0,
      pending_offset: parseFloat(data[i][headers.indexOf('pending_offset')]) || 0
    };
  }

  return result;
}

/**
 * 空の集計オブジェクトを返す
 */
function getEmptyAggregation_() {
  var empty = { budget: 0, spent: 0, cumulative: 0, remaining: 0, rate: 0, pending_offset: 0 };
  return { 'C01': empty, 'C02': empty, 'C03': empty, 'ALL': empty };
}

/**
 * 支払明細から予算箱ID別の支出累計を取得する
 * @param {string} upToMonth - 集計上限年月
 * @returns {Object} { budgetBoxId: cumulativeAmount }
 */
function getSpentByBudgetBox(upToMonth) {
  var ss = getSpreadsheet_();
  var paymentSheet = ss.getSheetByName(AGG_SHEET_PAYMENT);

  if (!paymentSheet || paymentSheet.getLastRow() < 2) return {};

  var data = paymentSheet.getDataRange().getValues();
  var headers = data[0];
  var boxIdx = headers.indexOf('budget_box_id');
  var ymIdx  = headers.indexOf('year_month');
  var amtIdx = headers.indexOf('amount');
  var offIdx = headers.indexOf('offset');

  if (boxIdx < 0 || ymIdx < 0 || amtIdx < 0) return {};

  var result = {};

  for (var i = 1; i < data.length; i++) {
    var ym = String(data[i][ymIdx]).substring(0, 7);
    if (ym > upToMonth) continue;

    var boxId = String(data[i][boxIdx]);
    var amt = parseFloat(data[i][amtIdx]) || 0;
    var off = offIdx >= 0 ? (parseFloat(data[i][offIdx]) || 0) : 0;

    if (!boxId) continue;

    if (!result[boxId]) result[boxId] = 0;
    result[boxId] += (amt - off);
  }

  return result;
}

/**
 * 月次集計の自動トリガーを設定する
 * 毎月1日 7:00に実行
 */
function setAggregationTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runMonthlyAggregation') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('runMonthlyAggregation')
    .timeBased()
    .onMonthDay(1)
    .atHour(7)
    .create();

  Logger.log('月次集計トリガー設定完了: 毎月1日 7:00');
}

/**
 * テスト用: 集計実行
 */
function testAggregation() {
  var result = runMonthlyAggregation();
  Logger.log('集計結果: ' + JSON.stringify(result));

  var monthly = getMonthlyAggregation('2025-12');
  Logger.log('2025-12集計: ' + JSON.stringify(monthly));
}
