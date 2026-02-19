/**
 * 全体設定・シート保護・カスタムメニュー（config.gs）
 *
 * 概要:
 *   工事予算管理スプレッドシートの共通設定を集約する。
 *   シート保護、カスタムメニュー、前行コピー、入力期限アラートを担当。
 *
 * 依存:
 *   - api.gs（getSpreadsheet_()）
 *   - template.gs（シート名定数）
 */

// === 定数 ===

// シート保護レベル
var PROTECT_LEVEL = {
  SCRIPT_ONLY: 'script_only',   // スクリプト実行者のみ編集可（計算層）
  VIEW_ONLY:   'view_only',     // 全員閲覧のみ（出力層）
  INPUT:       'input'          // 入力層（範囲保護）
};

// 計算層シート（スクリプトのみ編集可）
var CALC_SHEETS = [
  '_C_予算健康度',
  '_C_月次集計',
  '_C_費目別集計'
];

// 出力層シート（閲覧のみ）
var OUTPUT_SHEETS = [
  '支払明細'
];

// 支払明細入力シートの列区分
var INPUT_COLS = {
  // 所長入力列（A-K、緑背景）
  OWNER_START: 1,   // A列
  OWNER_END:   11,  // K列
  // 事務員追記列（L-M、青背景）
  CLERK_START: 12,  // L列
  CLERK_END:   13,  // M列
  // 自動計算列（N-R、灰背景）
  AUTO_START:  14,  // N列
  AUTO_END:    18   // R列
};

// 消費税率
var TAX_RATE = 0.10;

// テキストフィールド最大文字数（SEC-04）
var MAX_TEXT_LENGTH = 50;

/**
 * スプレッドシート起動時にカスタムメニューを追加する
 * トリガー設定: GASエディタ > トリガー > onOpen > スプレッドシートから > 起動時
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('工事管理')
    .addItem('前行コピー', 'copyPreviousRow')
    .addItem('月次集計を実行', 'runMonthlyAggregation')
    .addItem('予算健康度を更新', 'monthlyBudgetHealthCalculation')
    .addSeparator()
    .addItem('ドロップダウン再設定', 'refreshDropdowns')
    .addItem('シート保護を設定', 'applySheetProtection')
    .addSeparator()
    .addItem('入力期限チェック', 'checkInputDeadline')
    .addToUi();
}

/**
 * シート保護を一括設定する（SEC-03）
 * 計算層: スクリプト実行者のみ編集可
 * 出力層: 全員閲覧のみ
 */
function applySheetProtection() {
  var ss = getSpreadsheet_();
  var me = Session.getEffectiveUser();

  // 計算層シートの保護
  for (var i = 0; i < CALC_SHEETS.length; i++) {
    var sheet = ss.getSheetByName(CALC_SHEETS[i]);
    if (!sheet) continue;

    // 既存の保護を削除
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    for (var p = 0; p < protections.length; p++) {
      if (protections[p].canDomainEdit()) {
        protections[p].remove();
      }
    }

    // 新規保護を設定
    var protection = sheet.protect()
      .setDescription('計算層: スクリプトのみ編集可（' + CALC_SHEETS[i] + '）');
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors());
    protection.addEditor(me);

    Logger.log('シート保護設定: ' + CALC_SHEETS[i] + ' (計算層)');
  }

  // 出力層シートの保護
  for (var j = 0; j < OUTPUT_SHEETS.length; j++) {
    var outSheet = ss.getSheetByName(OUTPUT_SHEETS[j]);
    if (!outSheet) continue;

    var outProtections = outSheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    for (var q = 0; q < outProtections.length; q++) {
      outProtections[q].remove();
    }

    var outProtection = outSheet.protect()
      .setDescription('出力層: 閲覧のみ（' + OUTPUT_SHEETS[j] + '）');
    outProtection.addEditor(me);
    outProtection.removeEditors(outProtection.getEditors());
    outProtection.addEditor(me);

    Logger.log('シート保護設定: ' + OUTPUT_SHEETS[j] + ' (出力層)');
  }

  // 支払明細入力シートの範囲保護（自動計算列のみ保護）
  var inputSheet = ss.getSheetByName('支払明細入力');
  if (inputSheet) {
    // 既存の範囲保護を削除
    var rangeProtections = inputSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    for (var r = 0; r < rangeProtections.length; r++) {
      rangeProtections[r].remove();
    }

    // 自動計算列（N-R列）を保護
    var autoRange = inputSheet.getRange(
      2, INPUT_COLS.AUTO_START,
      inputSheet.getMaxRows() - 1, INPUT_COLS.AUTO_END - INPUT_COLS.AUTO_START + 1
    );
    var autoProtection = autoRange.protect()
      .setDescription('自動計算列: 編集不可');
    autoProtection.addEditor(me);
    autoProtection.removeEditors(autoProtection.getEditors());
    autoProtection.addEditor(me);

    Logger.log('シート保護設定: 支払明細入力 (自動計算列保護)');
  }

  SpreadsheetApp.getActive().toast('シート保護を設定しました', '完了', 5);
}

/**
 * 前行コピー機能（SITE-01）
 * 支払明細入力シートのアクティブセル行の上1行から所長入力列をコピーする
 * 同一業者の連続入力時に便利
 */
function copyPreviousRow() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName('支払明細入力');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('支払明細入力シートが見つかりません');
    return;
  }

  var activeCell = sheet.getActiveCell();
  var currentRow = activeCell.getRow();

  if (currentRow < 3) {
    SpreadsheetApp.getUi().alert('コピー元の前行がありません（3行目以降で実行してください）');
    return;
  }

  var prevRow = currentRow - 1;

  // 所長入力列（A-K）の範囲をコピー
  // ただしA列（No.）は除外して B-K をコピー
  var sourceRange = sheet.getRange(prevRow, 2, 1, INPUT_COLS.OWNER_END - 1);
  var targetRange = sheet.getRange(currentRow, 2, 1, INPUT_COLS.OWNER_END - 1);

  var values = sourceRange.getValues();
  targetRange.setValues(values);

  // データバリデーションもコピー
  var validations = sourceRange.getDataValidations();
  targetRange.setDataValidations(validations);

  // 金額列（H列=8, I列=9, J列=10, K列=11）はクリア（金額は毎回異なる）
  sheet.getRange(currentRow, 8, 1, 4).clearContent();

  SpreadsheetApp.getActive().toast(
    '行' + prevRow + 'の内容をコピーしました（金額はクリア済み）',
    '前行コピー',
    3
  );
}

/**
 * 入力期限チェック（SITE-01）
 * 15日までに前月分の支払明細が未入力の場合にメール通知する
 */
function checkInputDeadline() {
  var today = new Date();
  var day = today.getDate();

  // 15日以降のみチェック
  if (day < 15) {
    Logger.log('入力期限チェック: 15日未満のためスキップ');
    return;
  }

  // 前月のYYYY-MM
  var prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  var prevYm = prevMonth.getFullYear() + '-' + String(prevMonth.getMonth() + 1).padStart(2, '0');

  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName('支払明細入力');
  if (!sheet || sheet.getLastRow() < 2) {
    sendDeadlineAlert_(prevYm, 0);
    return;
  }

  // 前月の入力行数をカウント
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var ymIdx = headers.indexOf('支払年月');
  if (ymIdx < 0) ymIdx = 6; // G列フォールバック

  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var ym = String(data[i][ymIdx]).substring(0, 7);
    if (ym === prevYm) count++;
  }

  if (count === 0) {
    sendDeadlineAlert_(prevYm, count);
  } else {
    Logger.log('入力期限チェック: ' + prevYm + ' は ' + count + '件入力済み');
  }
}

/**
 * 入力期限アラートメールを送信する
 * @param {string} yearMonth - 対象年月
 * @param {number} count - 入力件数
 */
function sendDeadlineAlert_(yearMonth, count) {
  var project = getProjectData_();

  var subject = '【入力期限】' + project.project_name + ' ' + yearMonth + '分の支払明細が未入力';
  var body = '工事名: ' + project.project_name + '\n' +
             '所長: ' + project.manager_name + '\n' +
             '---\n' +
             yearMonth + '分の支払明細が未入力です（現在' + count + '件）。\n' +
             '月末までに入力をお願いします。\n';

  try {
    var alertEmail = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL');
    if (alertEmail) {
      MailApp.sendEmail(alertEmail, subject, body);
      Logger.log('入力期限アラート送信: ' + alertEmail);
    } else {
      Logger.log('ALERT_EMAIL未設定: ' + body);
    }
  } catch (err) {
    Logger.log('メール送信エラー: ' + err.message);
  }
}

/**
 * テキストフィールドのサニタイズ（SEC-04）
 * 50文字を超えるテキストを切り詰め、危険な文字を除去する
 * @param {string} text - 入力テキスト
 * @returns {string} サニタイズ済みテキスト
 */
function sanitizeText(text) {
  if (!text) return '';
  var str = String(text);

  // HTMLタグ除去
  str = str.replace(/<[^>]*>/g, '');
  // スクリプトインジェクション対策
  str = str.replace(/['"<>&]/g, '');
  // 制御文字除去
  str = str.replace(/[\x00-\x1F\x7F]/g, '');
  // 50文字制限
  if (str.length > MAX_TEXT_LENGTH) {
    str = str.substring(0, MAX_TEXT_LENGTH);
  }

  return str.trim();
}

/**
 * 入力期限チェックの日次トリガーを設定する
 * 毎日8:00に実行
 */
function setDeadlineCheckTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkInputDeadline') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('checkInputDeadline')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log('入力期限チェックトリガー設定: 毎日8:00');
}

/**
 * PoC環境セットアップ（ワンクリック初期化）
 *
 * 実行内容:
 *   1. SCRIPT_PROPERTIES設定（API_KEY: ランダム生成、ALERT_EMAIL: 引数指定）
 *   2. トリガー一括設定（onEditHandler/月次集計/予算健康度）
 *   3. テンプレート生成呼び出し（initProjectTemplate('P004')）
 *   4. 実行結果のログ出力
 *
 * PoC手順書のStep 1-3, Step 2, Step 4をワンクリック化
 *
 * @param {string} alertEmail - アラート送信先メールアドレス（省略時はセッションユーザー）
 */
function setupForPoC(alertEmail) {
  var log = [];
  log.push('=== PoC セットアップ開始 ===');
  log.push('実行日時: ' + new Date().toISOString());

  // --- 1. SCRIPT_PROPERTIES設定 ---
  var props = PropertiesService.getScriptProperties();

  // API_KEY: ランダム生成（32文字の英数字）
  var apiKey = generateApiKey_();
  props.setProperty('API_KEY', apiKey);
  log.push('API_KEY設定: ' + apiKey.substring(0, 8) + '...(32文字)');

  // ALERT_EMAIL: 引数指定 or セッションユーザー
  if (!alertEmail) {
    alertEmail = Session.getEffectiveUser().getEmail();
  }
  props.setProperty('ALERT_EMAIL', alertEmail);
  log.push('ALERT_EMAIL設定: ' + alertEmail);

  // PROJECT_ID: PoC用
  props.setProperty('PROJECT_ID', 'P004');
  log.push('PROJECT_ID設定: P004');

  // --- 2. トリガー一括設定 ---
  // 既存トリガーを全削除
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    ScriptApp.deleteTrigger(existingTriggers[i]);
  }
  log.push('既存トリガー削除: ' + existingTriggers.length + '件');

  // onEditHandler → 編集時トリガー
  ScriptApp.newTrigger('onEditHandler')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  log.push('トリガー設定: onEditHandler（編集時）');

  // runMonthlyAggregation → 毎月1日 7:00
  ScriptApp.newTrigger('runMonthlyAggregation')
    .timeBased()
    .onMonthDay(1)
    .atHour(7)
    .create();
  log.push('トリガー設定: runMonthlyAggregation（毎月1日 7:00）');

  // monthlyBudgetHealthCalculation → 毎月1日 8:00
  ScriptApp.newTrigger('monthlyBudgetHealthCalculation')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();
  log.push('トリガー設定: monthlyBudgetHealthCalculation（毎月1日 8:00）');

  // checkInputDeadline → 毎日 8:00
  ScriptApp.newTrigger('checkInputDeadline')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  log.push('トリガー設定: checkInputDeadline（毎日 8:00）');

  // --- 3. テンプレート生成 ---
  try {
    initProjectTemplate('P004');
    log.push('テンプレート生成: P004 完了');
  } catch (err) {
    log.push('テンプレート生成エラー: ' + err.message);
  }

  // --- 3.5. _Mマスタシート確認（QA-05） ---
  var masterSheet = SpreadsheetApp.getActive().getSheetByName('_Mマスタ');
  if (masterSheet && masterSheet.getLastRow() >= 2) {
    var masterRowCount = masterSheet.getLastRow() - 1;
    log.push('_Mマスタシート確認: ' + masterRowCount + '行（費目+工種+費用要素）');
  } else {
    log.push('警告: _Mマスタシートが生成されていない。getMasterData_() はエラーを返します');
  }

  // --- 4. 結果出力 ---
  log.push('=== PoC セットアップ完了 ===');

  var logText = log.join('\n');
  Logger.log(logText);
  SpreadsheetApp.getActive().toast(
    'PoC セットアップ完了\nAPI_KEY: ' + apiKey.substring(0, 8) + '...',
    '完了',
    10
  );

  return {
    api_key: apiKey,
    alert_email: alertEmail,
    project_id: 'P004',
    triggers: 4,
    log: log
  };
}

/**
 * API_KEY用ランダム文字列を生成する（32文字）
 * @returns {string}
 */
function generateApiKey_() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var result = '';
  for (var i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
