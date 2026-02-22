/**
 * 予算健康度 計算処理（budget_health.gs）
 *
 * 概要:
 *   evm.gsの後継。正式EVMから「予実管理ベース」に転換。
 *   中小建設業（4千万円規模）に適した簡易指標で予算健康度を計算する。
 *
 * 核心指標:
 *   - 予算額（BAC）: 実行予算の合計
 *   - 計画支出（PV）: 実施工程表の開始月/終了月から自動均等配分
 *   - 実績支出（AC）: 支払明細の累計
 *   - 消化率: AC / BAC x 100
 *   - 出来高率: 所長が月1回入力（未入力時は工程進捗率で代替）
 *   - 過不足見込み: BAC - (AC / 出来高率 x 100)
 *
 * 信号判定:
 *   青(正常): 消化率 <= 出来高率 + 5pt
 *   黄(注意): 消化率 > 出来高率 + 5pt かつ <= +15pt
 *   赤(超過): 消化率 > 出来高率 + 15pt
 *
 * 依存:
 *   - api.gs（getSpreadsheet_(), getProjectData_(), getCurrentYearMonth_()）
 *   - aggregation.gs（getSpentByBudgetBox()）
 *   - template.gs（getOrCreateSheet_(), generateMonthList_()）
 */

// シート名定数
var BH_SHEET_BUDGET         = '_実行予算テーブル';
var BH_SHEET_BUDGET_MONTHLY = '_実行予算_月別';
var BH_SHEET_PAYMENT        = '支払明細入力';
var BH_SHEET_HEALTH         = '_C_予算健康度';
var BH_SHEET_MONTHLY_ADJ    = '_月次調整';

// 信号閾値
var BH_SIGNAL_NORMAL  = 5;   // 消化率 - 出来高率 <= 5pt → 青
var BH_SIGNAL_WARNING = 15;  // 消化率 - 出来高率 <= 15pt → 黄
// 15pt超 → 赤

/**
 * 月次予算健康度計算（メイン）
 * @param {string} yearMonth - 集計対象年月（例: '2025-12'）。省略時は当月
 * @returns {Object} 予算健康度オブジェクト
 */
function monthlyBudgetHealthCalculation(yearMonth) {
  if (!yearMonth) {
    yearMonth = getCurrentYearMonth_();
  }

  var ss = getSpreadsheet_();

  // 1. 予算額（BAC）を算出
  var bac = calculateBudgetTotal_(ss);

  // 2. PV累計を算出（実施工程表ベースの自動配分）
  var pv = calculatePlannedValue_(ss, yearMonth);

  // 3. AC累計を算出（支払明細の対象月までの累計）
  var ac = calculateActualCost_(ss, yearMonth);

  // 4. 消化率を算出
  var consumptionRate = bac > 0 ? (ac / bac * 100) : 0;
  consumptionRate = Math.round(consumptionRate * 10) / 10;

  // 5. 出来高率を取得（月次調整シート or 工程進捗率で代替）
  var progressRate = getProgressRate_(ss, yearMonth);

  // 6. 過不足見込みを算出
  var projectedTotal = 0;
  var shortage = 0;
  if (progressRate > 0) {
    projectedTotal = Math.round(ac / (progressRate / 100));
    shortage = bac - projectedTotal;
  } else {
    projectedTotal = ac;
    shortage = bac - ac;
  }

  // 7. 信号判定
  var gap = consumptionRate - progressRate;
  var signal = getSignal_(gap);

  // 8. _C_予算健康度シートに書き込み
  writeBudgetHealth_(ss, yearMonth, bac, pv, ac, consumptionRate, progressRate, shortage, signal);

  // 9. アラート判定
  if (signal === '超過') {
    sendBudgetAlert_(yearMonth, consumptionRate, progressRate, gap, bac, ac, shortage);
  }

  Logger.log('予算健康度計算完了: ' + yearMonth +
    ' BAC=' + bac + ' PV=' + pv + ' AC=' + ac +
    ' 消化率=' + consumptionRate + '% 出来高率=' + progressRate + '%' +
    ' 信号=' + signal);

  return {
    yearMonth: yearMonth,
    bac: bac,
    pv: pv,
    ac: ac,
    consumption_rate: consumptionRate,
    progress_rate: progressRate,
    projected_total: projectedTotal,
    shortage: shortage,
    signal: signal,
    gap: Math.round(gap * 10) / 10
  };
}

/**
 * 予算額（BAC）を算出する
 * _実行予算テーブルのbudget_amountの合計
 * @param {Spreadsheet} ss
 * @returns {number}
 */
function calculateBudgetTotal_(ss) {
  var sheet = ss.getSheetByName(BH_SHEET_BUDGET);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colIdx = headers.indexOf('budget_amount');
  if (colIdx < 0) return 0;

  var total = 0;
  for (var i = 1; i < data.length; i++) {
    var v = parseFloat(data[i][colIdx]);
    if (!isNaN(v)) total += v;
  }
  return total;
}

/**
 * PV（計画支出）累計を算出する
 * 実施工程表の開始月/終了月から均等配分で自動計算
 *
 * 例: 護岸工 予算980万円、工期 2025-10 ~ 2026-01 (4ヶ月)
 *   → 月次PV = 980万 / 4 = 245万/月
 *   → 10月PV累計: 245万、11月: 490万、12月: 735万、1月: 980万
 *
 * @param {Spreadsheet} ss
 * @param {string} yearMonth - 対象年月
 * @returns {number}
 */
function calculatePlannedValue_(ss, yearMonth) {
  var sheet = ss.getSheetByName(BH_SHEET_BUDGET);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var amtIdx   = headers.indexOf('budget_amount');
  var startIdx = headers.indexOf('start_month');
  var endIdx   = headers.indexOf('end_month');

  // 開始月/終了月列がない場合はPV計算不可
  if (amtIdx < 0 || startIdx < 0 || endIdx < 0) {
    // フォールバック: 月別配分テーブルがあればそちらから計算
    return calculatePVFromMonthly_(ss, yearMonth);
  }

  var totalPV = 0;

  for (var i = 1; i < data.length; i++) {
    var budget = parseFloat(data[i][amtIdx]) || 0;
    if (budget <= 0) continue;

    var startMonth = String(data[i][startIdx]).substring(0, 7);
    var endMonth   = String(data[i][endIdx]).substring(0, 7);

    if (!startMonth || startMonth.length < 7 || !endMonth || endMonth.length < 7) continue;

    // 工期月数を算出
    var months = countMonths_(startMonth, endMonth);
    if (months <= 0) continue;

    // 月次配分額
    var monthlyAmount = budget / months;

    // 対象月までの累積月数
    var elapsedMonths = countMonths_(startMonth, yearMonth);
    if (elapsedMonths <= 0) continue;
    if (elapsedMonths > months) elapsedMonths = months;

    totalPV += monthlyAmount * elapsedMonths;
  }

  return Math.round(totalPV);
}

/**
 * 月別配分テーブルからPVを計算するフォールバック
 * @param {Spreadsheet} ss
 * @param {string} yearMonth
 * @returns {number}
 */
function calculatePVFromMonthly_(ss, yearMonth) {
  var sheet = ss.getSheetByName(BH_SHEET_BUDGET_MONTHLY);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var ymIdx  = headers.indexOf('year_month');
  var amtIdx = headers.indexOf('planned_amount');

  if (ymIdx < 0 || amtIdx < 0) return 0;

  var total = 0;
  for (var i = 1; i < data.length; i++) {
    var ym = String(data[i][ymIdx]).substring(0, 7);
    if (ym <= yearMonth) {
      var v = parseFloat(data[i][amtIdx]);
      if (!isNaN(v)) total += v;
    }
  }
  return total;
}

/**
 * AC（実績支出）累計を算出する
 * @param {Spreadsheet} ss
 * @param {string} yearMonth - 対象年月
 * @returns {number}
 */
function calculateActualCost_(ss, yearMonth) {
  var sheet = ss.getSheetByName(BH_SHEET_PAYMENT);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var ymIdx  = headers.indexOf('支払年月');
  var amtIdx = headers.indexOf('支払金額');

  if (ymIdx < 0 || amtIdx < 0) return 0;

  var total = 0;
  for (var i = 1; i < data.length; i++) {
    var ym = String(data[i][ymIdx]).substring(0, 7);
    if (ym <= yearMonth) {
      var v = parseFloat(data[i][amtIdx]);
      if (!isNaN(v)) total += v;
    }
  }
  return total;
}

/**
 * 出来高率を取得する
 * 1. _月次調整シートに入力済みならその値を使用
 * 2. 未入力の場合、工程進捗率（均等配分ベース）で代替
 *
 * @param {Spreadsheet} ss
 * @param {string} yearMonth
 * @returns {number} 出来高率（0-100）
 */
function getProgressRate_(ss, yearMonth) {
  // 1. 月次調整シートから取得を試行
  var adjSheet = ss.getSheetByName(BH_SHEET_MONTHLY_ADJ);
  if (adjSheet && adjSheet.getLastRow() >= 2) {
    var adjData = adjSheet.getDataRange().getValues();
    var adjHeaders = adjData[0];
    var adjYmIdx   = adjHeaders.indexOf('year_month');
    var adjRateIdx = adjHeaders.indexOf('progress_rate');

    if (adjYmIdx >= 0 && adjRateIdx >= 0) {
      for (var i = 1; i < adjData.length; i++) {
        var ym = String(adjData[i][adjYmIdx]).substring(0, 7);
        if (ym === yearMonth) {
          var rate = parseFloat(adjData[i][adjRateIdx]);
          if (!isNaN(rate) && rate > 0) return rate;
        }
      }
    }
  }

  // 2. 工程進捗率で代替（工期の経過月数 / 全工期月数 x 100）
  return calculateScheduleProgress_(ss, yearMonth);
}

/**
 * 工程進捗率を計算する（均等配分ベース）
 * @param {Spreadsheet} ss
 * @param {string} yearMonth
 * @returns {number} 進捗率（0-100）
 */
function calculateScheduleProgress_(ss, yearMonth) {
  var project = getProjectData_();
  var startDate = String(project.start_date).substring(0, 7);
  var endDate   = String(project.end_date).substring(0, 7);

  if (!startDate || startDate.length < 7 || !endDate || endDate.length < 7) return 0;

  var totalMonths = countMonths_(startDate, endDate);
  if (totalMonths <= 0) return 0;

  var elapsed = countMonths_(startDate, yearMonth);
  if (elapsed <= 0) return 0;
  if (elapsed > totalMonths) elapsed = totalMonths;

  var rate = (elapsed / totalMonths) * 100;
  return Math.round(rate * 10) / 10;
}

/**
 * 2つのYYYY-MM間の月数を計算する（両端含む）
 * @param {string} fromYm - 開始年月
 * @param {string} toYm - 終了年月
 * @returns {number} 月数
 */
function countMonths_(fromYm, toYm) {
  var fromParts = fromYm.split('-');
  var toParts   = toYm.split('-');

  var fromY = parseInt(fromParts[0], 10);
  var fromM = parseInt(fromParts[1], 10);
  var toY   = parseInt(toParts[0], 10);
  var toM   = parseInt(toParts[1], 10);

  return (toY - fromY) * 12 + (toM - fromM) + 1;
}

/**
 * 信号判定
 * @param {number} gap - 消化率 - 出来高率
 * @returns {string} '正常' / '注意' / '超過'
 */
function getSignal_(gap) {
  if (gap <= BH_SIGNAL_NORMAL) return '正常';
  if (gap <= BH_SIGNAL_WARNING) return '注意';
  return '超過';
}

/**
 * _C_予算健康度シートにデータを書き込む
 */
function writeBudgetHealth_(ss, yearMonth, bac, pv, ac, consumptionRate, progressRate, shortage, signal) {
  var sheet = ss.getSheetByName(BH_SHEET_HEALTH);
  if (!sheet) {
    sheet = getOrCreateSheet_(ss, BH_SHEET_HEALTH);
    var headers = [
      'year_month',        // A: 年月
      'bac',               // B: 予算額
      'pv',                // C: 計画支出累計
      'ac',                // D: 実績支出累計
      'consumption_rate',  // E: 消化率(%)
      'progress_rate',     // F: 出来高率(%)
      'gap',               // G: 差分(消化率-出来高率)
      'shortage',          // H: 過不足見込み
      'signal',            // I: 信号
      'updated_at'         // J: 更新日時
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#2E75B6')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  var now = new Date().toISOString();
  var gap = Math.round((consumptionRate - progressRate) * 10) / 10;
  var rowData = [yearMonth, bac, pv, ac, consumptionRate, progressRate, gap, shortage, signal, now];

  // 既存行を検索
  var data = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).substring(0, 7) === yearMonth) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    var insertRow = sheet.getLastRow() + 1;
    sheet.getRange(insertRow, 1, 1, rowData.length).setValues([rowData]);
    targetRow = insertRow;
  }

  // 書式設定
  sheet.getRange(targetRow, 2, 1, 3).setNumberFormat('#,##0');   // BAC/PV/AC
  sheet.getRange(targetRow, 5, 1, 2).setNumberFormat('0.0');     // 消化率/出来高率
  sheet.getRange(targetRow, 7, 1, 1).setNumberFormat('0.0');     // 差分
  sheet.getRange(targetRow, 8, 1, 1).setNumberFormat('#,##0');   // 過不足

  // UX-04: 信号に応じた背景色+テキストラベル併記（色覚多様性対応）
  var signalCell = sheet.getRange(targetRow, 9);
  if (signal === '正常') {
    signalCell.setBackground('#C8E6C9') // 緑
      .setFontColor('#1B5E20')
      .setValue('正常');
  } else if (signal === '注意') {
    signalCell.setBackground('#FFF9C4') // 黄
      .setFontColor('#E65100')
      .setValue('注意');
  } else {
    signalCell.setBackground('#FFCDD2') // 赤
      .setFontColor('#B71C1C')
      .setFontWeight('bold')
      .setValue('超過');
  }
}

/**
 * 予算超過アラートメールを送信する
 */
function sendBudgetAlert_(yearMonth, consumptionRate, progressRate, gap, bac, ac, shortage) {
  var project = getProjectData_();

  var subject = '【予算超過警告】' + project.project_name + ' ' + yearMonth;
  var body = '工事名: ' + project.project_name + '\n' +
             '所長: ' + project.manager_name + '\n' +
             '対象月: ' + yearMonth + '\n' +
             '---\n' +
             '予算消化率: ' + consumptionRate + '%\n' +
             '出来高率: ' + progressRate + '%\n' +
             '差分: +' + gap.toFixed(1) + 'pt（消化が進捗を上回っている）\n' +
             '---\n' +
             '予算額: ' + bac.toLocaleString() + '円\n' +
             '実績支出: ' + ac.toLocaleString() + '円\n' +
             '過不足見込み: ' + shortage.toLocaleString() + '円\n';

  try {
    var alertEmail = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL');
    if (alertEmail) {
      MailApp.sendEmail(alertEmail, subject, body);
      Logger.log('予算超過アラート送信: ' + alertEmail);
    } else {
      Logger.log('ALERT_EMAIL未設定: ' + body);
    }
  } catch (err) {
    Logger.log('メール送信エラー: ' + err.message);
  }
}

/**
 * 予算健康度指標を取得する（api.gsのmode=healthから呼び出し）
 * @param {string} yearMonth - 対象年月
 * @returns {Object} 予算健康度オブジェクト
 */
function getBudgetHealthMetrics(yearMonth) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(BH_SHEET_HEALTH);

  // 予算健康度シートが存在しない、またはデータがない場合はリアルタイム計算
  if (!sheet || sheet.getLastRow() < 2) {
    return monthlyBudgetHealthCalculation(yearMonth);
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var ymIdx = headers.indexOf('year_month');

  // 対象年月の行を検索
  for (var i = 1; i < data.length; i++) {
    var ym = String(data[i][ymIdx]).substring(0, 7);
    if (ym === yearMonth) {
      var getVal = function(name) {
        var idx = headers.indexOf(name);
        return idx >= 0 ? (parseFloat(data[i][idx]) || 0) : 0;
      };
      var getStr = function(name) {
        var idx = headers.indexOf(name);
        return idx >= 0 ? String(data[i][idx]) : '';
      };

      return {
        yearMonth: yearMonth,
        bac: getVal('bac'),
        pv: getVal('pv'),
        ac: getVal('ac'),
        consumption_rate: getVal('consumption_rate'),
        progress_rate: getVal('progress_rate'),
        gap: getVal('gap'),
        shortage: getVal('shortage'),
        signal: getStr('signal'),
        projected_total: getVal('ac') > 0 && getVal('progress_rate') > 0
          ? Math.round(getVal('ac') / (getVal('progress_rate') / 100))
          : getVal('ac')
      };
    }
  }

  // 対象月のデータがない場合、リアルタイム計算を実行
  return monthlyBudgetHealthCalculation(yearMonth);
}

/**
 * PV自動配分を実行し、月別配分テーブルに書き込む
 * 実行予算テーブルの開始月/終了月から各月のPVを計算し、月別テーブルに反映
 */
function updatePVDistribution() {
  var ss = getSpreadsheet_();
  var budgetSheet = ss.getSheetByName(BH_SHEET_BUDGET);
  var monthlySheet = ss.getSheetByName(BH_SHEET_BUDGET_MONTHLY);

  if (!budgetSheet || budgetSheet.getLastRow() < 2) {
    Logger.log('PV配分更新: 予算テーブルが空');
    return;
  }
  if (!monthlySheet || monthlySheet.getLastRow() < 2) {
    Logger.log('PV配分更新: 月別テーブルが空');
    return;
  }

  var bData = budgetSheet.getDataRange().getValues();
  var bHeaders = bData[0];
  var bBoxIdx   = bHeaders.indexOf('budget_box_id');
  var bAmtIdx   = bHeaders.indexOf('budget_amount');
  var bStartIdx = bHeaders.indexOf('start_month');
  var bEndIdx   = bHeaders.indexOf('end_month');

  if (bBoxIdx < 0 || bAmtIdx < 0 || bStartIdx < 0 || bEndIdx < 0) {
    Logger.log('PV配分更新: 必要な列が不足');
    return;
  }

  // 予算箱ごとの月別配分を計算
  var pvMap = {}; // { boxId-yearMonth: amount }

  for (var i = 1; i < bData.length; i++) {
    var boxId  = String(bData[i][bBoxIdx]);
    var budget = parseFloat(bData[i][bAmtIdx]) || 0;
    var startM = String(bData[i][bStartIdx]).substring(0, 7);
    var endM   = String(bData[i][bEndIdx]).substring(0, 7);

    if (!boxId || budget <= 0 || !startM || startM.length < 7 || !endM || endM.length < 7) continue;

    var totalM = countMonths_(startM, endM);
    if (totalM <= 0) continue;

    var monthlyAmt = Math.round(budget / totalM);
    var months = generateMonthList_(startM, endM);

    for (var m = 0; m < months.length; m++) {
      var key = boxId + '|' + months[m];
      pvMap[key] = monthlyAmt;
    }
  }

  // 月別配分テーブルに書き込み
  var mData = monthlySheet.getDataRange().getValues();
  var mHeaders = mData[0];
  var mBoxIdx = mHeaders.indexOf('budget_box_id');
  var mYmIdx  = mHeaders.indexOf('year_month');
  var mAmtIdx = mHeaders.indexOf('planned_amount');

  if (mBoxIdx < 0 || mYmIdx < 0 || mAmtIdx < 0) {
    Logger.log('PV配分更新: 月別テーブルのヘッダーが不足');
    return;
  }

  var updateCount = 0;
  for (var r = 1; r < mData.length; r++) {
    var key = String(mData[r][mBoxIdx]) + '|' + String(mData[r][mYmIdx]).substring(0, 7);
    if (pvMap[key] !== undefined) {
      monthlySheet.getRange(r + 1, mAmtIdx + 1).setValue(pvMap[key]);
      updateCount++;
    }
  }

  Logger.log('PV配分更新完了: ' + updateCount + '行更新');
  SpreadsheetApp.getActive().toast('PV配分を更新しました: ' + updateCount + '行', '完了', 5);
}

/**
 * 全月の予算健康度を一括計算する
 */
function runFullBudgetHealthCalculation() {
  var project = getProjectData_();
  var startDate = String(project.start_date).substring(0, 7);
  var endDate = String(project.end_date).substring(0, 7);

  if (!startDate || !endDate) {
    Logger.log('工期情報が不足しているため全月計算スキップ');
    return;
  }

  var months = generateMonthList_(startDate, endDate);

  for (var i = 0; i < months.length; i++) {
    monthlyBudgetHealthCalculation(months[i]);
  }

  Logger.log('全月予算健康度計算完了: ' + months.length + 'ヶ月分');
}

/**
 * 月次予算健康度の自動トリガーを設定する
 * 毎月1日 8:00に実行
 */
function setMonthlyBudgetHealthTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'monthlyBudgetHealthCalculation') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('monthlyBudgetHealthCalculation')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();

  Logger.log('月次予算健康度トリガー設定: 毎月1日 8:00');
}

/**
 * テスト用: 予算健康度計算実行
 */
function testBudgetHealth() {
  var result = monthlyBudgetHealthCalculation('2025-12');
  Logger.log('予算健康度: ' + JSON.stringify(result));
}
