/**
 * 工事成績評定通知書 内訳分析表 API
 *
 * スプレッドシートから工事評価データを取得し、JSON形式で返すWeb App
 *
 * デプロイ手順:
 * 1. Google Apps Script エディタで新規プロジェクト作成
 * 2. このコードを貼り付け
 * 3. SPREADSHEET_ID を実際のIDに変更
 * 4. デプロイ > 新しいデプロイ > ウェブアプリ
 * 5. アクセス権限: 「全員」に設定
 * 6. デプロイURLをDifyの環境変数に設定
 */

// スプレッドシート設定
// 方法1: スプレッドシートから「拡張機能 > Apps Script」で開いた場合は null のままでOK
// 方法2: 独立したスクリプトの場合は実際のIDを設定
const SPREADSHEET_ID = null; // null = 紐づいたスプレッドシートを使用
const SHEET_NAME = null; // null = 最初のシートを使用（または実際のシート名を指定）

/**
 * GETリクエストハンドラ
 * @param {Object} e - リクエストパラメータ
 * @returns {TextOutput} JSON形式のレスポンス
 */
function doGet(e) {
  try {
    const params = e.parameter;
    const mode = params.mode || 'all'; // all, summary, detail

    const data = getConstructionEvaluationData(mode);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        mode: mode,
        data: data
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 工事成績評定データを取得
 * @param {string} mode - 取得モード（all, summary, detail）
 * @returns {Object} 評価データ
 */
function getConstructionEvaluationData(mode) {
  // スプレッドシートを取得（紐づきスクリプト or ID指定）
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  // シートを取得（名前指定 or 最初のシート）
  const sheet = SHEET_NAME
    ? ss.getSheetByName(SHEET_NAME)
    : ss.getSheets()[0];
  const range = sheet.getDataRange();
  const values = range.getValues();

  // 評価項目の定義（0-indexed 行番号）
  // 行9=index8, 行10=index9, ...
  const evaluationItems = [
    { rowIdx: 8, category: '1. 施工体制', item: 'I.施工体制一般', maxScore: 3.3 },
    { rowIdx: 9, category: '1. 施工体制', item: 'II.配置技術者', maxScore: 4.1 },
    { rowIdx: 10, category: '2. 施工状況', item: 'I.施工管理', maxScore: 13 },
    { rowIdx: 11, category: '2. 施工状況', item: 'II.工程管理', maxScore: 8.1 },
    { rowIdx: 12, category: '2. 施工状況', item: 'III.安全対策', maxScore: 8.8 },
    { rowIdx: 13, category: '2. 施工状況', item: 'IV.対外関係', maxScore: 3.7 },
    { rowIdx: 14, category: '3. 出来形・品質・出来ばえ', item: 'I.出来形', maxScore: 14.9 },
    { rowIdx: 15, category: '3. 出来形・品質・出来ばえ', item: 'II.品質', maxScore: 17.4 },
    { rowIdx: 16, category: '3. 出来形・品質・出来ばえ', item: 'III.出来ばえ', maxScore: 8.5 },
    { rowIdx: 17, category: '4. 工事特性（加点）', item: '施工条件等への対応', maxScore: 7.3 },
    { rowIdx: 18, category: '5. 創意工夫（加点）', item: '創意工夫', maxScore: 5.7 },
    { rowIdx: 19, category: '6. 社会性等（加点）', item: '地域への貢献等', maxScore: 5.2 },
    { rowIdx: 20, category: '7. 法令遵守等（減点）', item: '工事事故等による減点', maxScore: 0 }
  ];

  // 工事情報の取得（列E以降、2列ずつ）
  const projects = [];
  const dateRowIdx = 4;    // 日付行（行5 → 0-indexed で4）
  const nameRowIdx = 5;    // 工事名行（行6 → 0-indexed で5）
  const totalRowIdx = 21;  // 合計点行（行22 → 0-indexed で21）

  // 列Eから開始（index 4）、2列ずつ処理
  for (let col = 4; col < values[0].length; col += 2) {
    const date = values[dateRowIdx] ? values[dateRowIdx][col] : '';
    const projectName = values[nameRowIdx] ? values[nameRowIdx][col] : '';
    // 合計点は評価点列（同じ列）から取得
    const totalScore = values[totalRowIdx] ? values[totalRowIdx][col] : 0;

    // 空の列はスキップ
    if (!projectName || projectName === '' || totalScore === 0) continue;

    const project = {
      date: formatDate(date),
      name: String(projectName).trim(),
      totalScore: parseFloat(totalScore) || 0,
      evaluations: []
    };

    // 各評価項目のスコアを取得
    evaluationItems.forEach(item => {
      const score = values[item.rowIdx] ? parseFloat(values[item.rowIdx][col]) || 0 : 0;
      // 達成率は小数（0.93...）で格納されているので100倍してパーセントに
      const rateRaw = values[item.rowIdx] ? values[item.rowIdx][col + 1] : 0;
      const rate = typeof rateRaw === 'number' ? (rateRaw * 100).toFixed(1) : parseFloat(String(rateRaw).replace('%', '')) || 0;

      project.evaluations.push({
        category: item.category,
        item: item.item,
        maxScore: item.maxScore,
        score: score,
        rate: parseFloat(rate)
      });
    });

    projects.push(project);
  }

  // モードに応じてデータを加工
  if (mode === 'summary') {
    return {
      projectCount: projects.length,
      projects: projects.map(p => ({
        date: p.date,
        name: p.name,
        totalScore: p.totalScore
      })),
      averageScore: projects.length > 0
        ? (projects.reduce((sum, p) => sum + p.totalScore, 0) / projects.length).toFixed(1)
        : 0,
      statistics: calculateStatistics(projects)
    };
  }

  if (mode === 'detail') {
    return {
      projectCount: projects.length,
      projects: projects,
      categoryAnalysis: analyzeCategoryPerformance(projects, evaluationItems)
    };
  }

  // mode === 'all'
  return {
    projectCount: projects.length,
    projects: projects,
    summary: {
      averageScore: projects.length > 0
        ? (projects.reduce((sum, p) => sum + p.totalScore, 0) / projects.length).toFixed(1)
        : 0,
      maxScore: projects.length > 0 ? Math.max(...projects.map(p => p.totalScore)) : 0,
      minScore: projects.length > 0 ? Math.min(...projects.map(p => p.totalScore)) : 0
    },
    categoryAnalysis: analyzeCategoryPerformance(projects, evaluationItems)
  };
}

/**
 * 日付フォーマット
 * @param {*} date - 日付値
 * @returns {string} フォーマット済み日付
 */
function formatDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return String(date);
}

/**
 * 統計情報を計算
 * @param {Array} projects - 工事リスト
 * @returns {Object} 統計情報
 */
function calculateStatistics(projects) {
  if (projects.length === 0) return {};

  const scores = projects.map(p => p.totalScore);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  return {
    count: projects.length,
    average: avg.toFixed(1),
    max: Math.max(...scores),
    min: Math.min(...scores),
    range: (Math.max(...scores) - Math.min(...scores)).toFixed(1)
  };
}

/**
 * カテゴリ別パフォーマンス分析
 * @param {Array} projects - 工事リスト
 * @param {Array} evaluationItems - 評価項目定義
 * @returns {Array} カテゴリ別分析結果
 */
function analyzeCategoryPerformance(projects, evaluationItems) {
  if (projects.length === 0) return [];

  const categories = {};

  projects.forEach(project => {
    project.evaluations.forEach(eval => {
      if (!categories[eval.category]) {
        categories[eval.category] = {
          category: eval.category,
          items: {},
          totalMaxScore: 0,
          totalActualScore: 0,
          count: 0
        };
      }

      if (!categories[eval.category].items[eval.item]) {
        categories[eval.category].items[eval.item] = {
          scores: [],
          rates: [],
          maxScore: eval.maxScore
        };
      }

      categories[eval.category].items[eval.item].scores.push(eval.score);
      categories[eval.category].items[eval.item].rates.push(eval.rate);
      categories[eval.category].totalActualScore += eval.score;
      categories[eval.category].totalMaxScore += eval.maxScore;
      categories[eval.category].count++;
    });
  });

  // カテゴリ別の平均達成率を計算
  return Object.values(categories).map(cat => {
    const itemAnalysis = Object.entries(cat.items).map(([itemName, data]) => ({
      item: itemName,
      maxScore: data.maxScore,
      averageScore: (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2),
      averageRate: (data.rates.reduce((a, b) => a + b, 0) / data.rates.length).toFixed(1) + '%'
    }));

    return {
      category: cat.category,
      averageAchievementRate: ((cat.totalActualScore / cat.totalMaxScore) * 100).toFixed(1) + '%',
      items: itemAnalysis
    };
  });
}

/**
 * テスト用関数（GASエディタで実行してデータ確認）
 */
function testGetData() {
  const result = getConstructionEvaluationData('all');
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * デバッグ用: スプレッドシートの構造を確認
 */
function debugSheetStructure() {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = SHEET_NAME
    ? ss.getSheetByName(SHEET_NAME)
    : ss.getSheets()[0];

  const values = sheet.getDataRange().getValues();

  Logger.log('=== シート情報 ===');
  Logger.log('シート名: ' + sheet.getName());
  Logger.log('行数: ' + values.length);
  Logger.log('列数: ' + (values[0] ? values[0].length : 0));

  Logger.log('\n=== 最初の10行の内容（A-F列） ===');
  for (let i = 0; i < Math.min(10, values.length); i++) {
    const row = values[i];
    Logger.log('行' + (i+1) + ': [A]' + row[0] + ' [B]' + row[1] + ' [C]' + row[2] + ' [D]' + row[3] + ' [E]' + row[4] + ' [F]' + row[5]);
  }

  Logger.log('\n=== 行20-25の内容（合計行を探す） ===');
  for (let i = 19; i < Math.min(25, values.length); i++) {
    const row = values[i];
    Logger.log('行' + (i+1) + ': [A]' + row[0] + ' [B]' + row[1] + ' [C]' + row[2] + ' [D]' + row[3]);
  }
}
