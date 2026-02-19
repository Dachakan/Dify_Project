/**
 * Nano Banana Pro Image Generator - Google Apps Script WebApp
 * Dify SSRF プロキシを回避して Gemini API で画像生成し、Google Drive に保存
 *
 * v3.3: ページごとYAMLファイル出力対応 - 画像と同時にYAMLをDriveに保存
 * v3.2: TEXT+IMAGE modalities対応
 * v3.0: 複数キャラクター参照画像対応 - ページごとに登場キャラの参照画像を渡す
 *
 * 背景:
 * - Dify Cloud の HTTP Request は SSRF プロキシ (squid) 経由
 * - generativelanguage.googleapis.com への直接リクエストがブロックされる
 * - GAS 経由で Dify の制約を完全回避
 *
 * デプロイ手順:
 * 1. Google Apps Script (script.google.com) で新規プロジェクト作成
 * 2. このコードを貼り付け
 * 3. OUTPUT_FOLDER_ID を保存先フォルダIDに変更
 * 4. スクリプトプロパティに GEMINI_API_KEY を設定
 *    - 左サイドバー > プロジェクトの設定 > スクリプトプロパティ
 *    - プロパティ名: GEMINI_API_KEY
 *    - 値: Google AI Studio の API キー
 * 5. デプロイ > 新しいデプロイ > ウェブアプリ
 *    - 説明: Nano Banana Pro Image Proxy v3.3
 *    - 実行者: 自分
 *    - アクセス: 全員
 * 6. ウェブアプリURLをDify環境変数 GAS_GEMINI_PROXY_URL に設定
 */

// 設定
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
const OUTPUT_FOLDER_ID = '159VvODhVSJr7h3EtUR1lTC5rZDq8d3lZ'; // マンガ出力先フォルダID

/**
 * POST リクエスト処理
 *
 * リクエストボディ:
 * {
 *   "prompt": "漫画のページを生成: ...",
 *   "sessionId": "20260104_1530",      // オプション
 *   "pageNumber": 1,                   // オプション
 *   "referenceImageIds": ["fileId1", "fileId2"],  // v3.0: キャラクター参照画像（配列）
 *   "yamlContent": "page: 1\nlayout_type: 5_panel\n..."  // v3.3: YAMLコンテンツ（オプション）
 * }
 *
 * レスポンス:
 * {
 *   "success": true,
 *   "message": "Success",
 *   "fileId": "xxx",
 *   "url": "https://drive.google.com/file/d/xxx/view",
 *   "downloadUrl": "https://drive.google.com/uc?export=download&id=xxx",
 *   "folder": "20260104_1530",
 *   "page_number": 1,
 *   "yaml": {                           // v3.3: YAML保存結果
 *     "success": true,
 *     "fileId": "yyy",
 *     "url": "...",
 *     "downloadUrl": "..."
 *   }
 * }
 */
function doPost(e) {
  // デバッグ情報を収集
  const debug = {
    referenceImageIds: [],
    characterNames: [],
    loaded: [],
    failed: [],
    pageNumber: 0
  };

  try {
    // API キー確認
    if (!GEMINI_API_KEY) {
      return createResponse(false, 'GEMINI_API_KEY not configured in script properties', { debug });
    }

    const data = JSON.parse(e.postData.contents);
    const prompt = data.prompt;

    if (!prompt) {
      return createResponse(false, 'prompt is required', { debug });
    }

    const sessionId = data.sessionId || formatDateTime(new Date());
    const pageNumber = data.pageNumber || 1;
    const referenceImageIds = data.referenceImageIds || [];  // v3.0: キャラクター参照画像（配列）
    const characterNames = data.character_names || [];  // Difyから送られるキャラクター名
    const yamlContent = data.yamlContent || null;  // v3.3: YAMLコンテンツ（オプション）

    // デバッグ情報を記録
    debug.referenceImageIds = referenceImageIds;
    debug.characterNames = characterNames;
    debug.pageNumber = pageNumber;

    // 1. Gemini API 呼び出し（複数参照画像対応）+ デバッグ情報収集
    const geminiResult = callGeminiAPIWithDebug(prompt, referenceImageIds, characterNames, debug);

    // エラーチェック
    if (geminiResult.response.error) {
      return createResponse(false, `Gemini API error: ${geminiResult.response.error.message}`, {
        errorCode: geminiResult.response.error.code,
        errorStatus: geminiResult.response.error.status,
        debug
      });
    }

    // 2. レスポンスから画像抽出
    const imageData = extractImageFromResponse(geminiResult.response);
    if (!imageData) {
      return createResponse(false, 'No image in Gemini response', {
        response: JSON.stringify(geminiResult.response).substring(0, 500),
        debug
      });
    }

    // 3. Google Drive に保存
    const filename = `page_${String(pageNumber).padStart(2, '0')}.png`;
    const driveResult = saveImageToDrive(imageData.base64, filename, sessionId);

    // v3.3: YAML保存（yamlContentが渡された場合）
    let yamlResult = null;
    if (yamlContent) {
      const yamlFilename = `page_${String(pageNumber).padStart(2, '0')}.yaml`;
      yamlResult = saveYAMLToDrive(yamlContent, yamlFilename, sessionId);
      Logger.log(`YAML saved: ${yamlFilename} -> ${yamlResult.success ? 'OK' : 'FAILED'}`);
    }

    return createResponse(true, yamlResult ? 'Image and YAML saved successfully' : 'Image generated and saved successfully', {
      ...driveResult,
      page_number: pageNumber,
      mimeType: imageData.mimeType,
      yaml: yamlResult,  // v3.3: YAML保存結果を追加
      debug
    });

  } catch (error) {
    return createResponse(false, `Server error: ${error.message}`, {
      stack: error.stack,
      debug
    });
  }
}

/**
 * GET リクエスト処理（ヘルスチェック）
 */
function doGet(e) {
  const hasApiKey = !!GEMINI_API_KEY;
  return createResponse(true, 'Nano Banana Pro Image Proxy v3.3 (3-pro) with TEXT+IMAGE modalities + YAML output', {
    version: '3.3.0',
    model: 'gemini-3-pro-image-preview',
    imageConfig: {
      aspectRatio: "2:3",
      imageSize: "1K"
    },
    features: ['multipleReferenceImages', 'portraitAspectRatio', 'yamlOutput'],
    outputFolder: OUTPUT_FOLDER_ID,
    apiKeyConfigured: hasApiKey
  });
}

/**
 * Gemini API 呼び出し（デバッグ情報付き）
 * @param {string} prompt - 生成プロンプト
 * @param {Array<string>} referenceImageIds - v3.0: キャラクター参照画像のDriveファイルID配列
 * @param {Array<string>} characterNames - v3.1: キャラクター名配列（キャプション生成用）
 * @param {Object} debug - デバッグ情報オブジェクト（loaded/failedを更新）
 * @returns {Object} { response: Gemini API response }
 */
function callGeminiAPIWithDebug(prompt, referenceImageIds, characterNames, debug) {
  // 3-pro: 参照画像を先に、テキストを後に
  const parts = [];

  // v3.1: 参照画像がある場合: キャプション → 画像 の順で追加（近接させて効果を高める）
  if (referenceImageIds && referenceImageIds.length > 0) {
    for (let i = 0; i < referenceImageIds.length; i++) {
      const fileId = referenceImageIds[i];
      const charName = (characterNames && characterNames[i]) ? characterNames[i] : `Character ${i+1}`;

      if (fileId) {
        try {
          // キャプションを先に追加（画像と近接させる）
          parts.push({
            text: `[Reference Image ${i+1} shows ${charName}. COPY THIS EXACT APPEARANCE for ${charName}. Do not reinterpret or redesign.]`
          });

          // 画像を直後に追加
          const referenceImage = getImageAsInlineData(fileId);
          if (referenceImage) {
            parts.push(referenceImage);
            debug.loaded.push(fileId);
            Logger.log(`Reference image ${i+1} (${charName}) added: ${fileId}`);
          }
        } catch (error) {
          debug.failed.push({ id: fileId, error: error.message });
          Logger.log(`Warning: Failed to load reference image ${fileId}: ${error.message}`);
          // 参照画像の読み込みに失敗しても処理は継続
        }
      }
    }
    Logger.log(`Total reference images added: ${debug.loaded.length}`);
  }

  // テキストプロンプトを最後に追加
  parts.push({ text: prompt });

  // v3.2: responseModalities に TEXT を追加（参照画像処理に必要な可能性）
  const payload = {
    contents: [{
      parts: parts
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.2,
      imageConfig: {
        aspectRatio: "2:3",
        imageSize: "1K"
      }
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const url = `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`;
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    Logger.log(`Gemini API error: ${responseCode} - ${response.getContentText()}`);
  }

  return { response: JSON.parse(response.getContentText()) };
}

/**
 * Gemini API 呼び出し（後方互換用）
 * @param {string} prompt - 生成プロンプト
 * @param {Array<string>} referenceImageIds - v3.0: キャラクター参照画像のDriveファイルID配列
 */
function callGeminiAPI(prompt, referenceImageIds, characterNames) {
  const dummyDebug = { loaded: [], failed: [] };
  return callGeminiAPIWithDebug(prompt, referenceImageIds, characterNames || [], dummyDebug).response;
}

/**
 * v2.0: DriveファイルをGemini API用のinlineData形式に変換
 * @param {string} fileId - DriveファイルID
 * @returns {Object} inlineData形式のオブジェクト
 */
function getImageAsInlineData(fileId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  const base64 = Utilities.base64Encode(blob.getBytes());
  const mimeType = file.getMimeType();

  return {
    inline_data: {
      mime_type: mimeType,
      data: base64
    }
  };
}

/**
 * Gemini レスポンスから画像データを抽出
 */
function extractImageFromResponse(result) {
  const candidates = result.candidates || [];
  if (candidates.length === 0) {
    Logger.log('No candidates in response');
    return null;
  }

  const parts = candidates[0].content?.parts || [];
  for (const part of parts) {
    const inlineData = part.inlineData || part.inline_data;
    if (inlineData?.data) {
      return {
        base64: inlineData.data,
        mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png'
      };
    }
  }

  Logger.log('No inlineData found in response parts');
  return null;
}

/**
 * v3.3: YAMLを Google Drive に保存
 * @param {string} yamlContent - YAML文字列
 * @param {string} filename - ファイル名 (例: page_01.yaml)
 * @param {string} sessionId - セッションID
 * @returns {Object} 保存結果
 */
function saveYAMLToDrive(yamlContent, filename, sessionId) {
  try {
    const parentFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    const sessionFolder = getOrCreateFolder(parentFolder, sessionId);

    const blob = Utilities.newBlob(yamlContent, 'text/yaml', filename);
    const file = sessionFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      fileId: file.getId(),
      url: file.getUrl(),
      downloadUrl: `https://drive.google.com/uc?export=download&id=${file.getId()}`,
      filename: filename,
      folder: sessionId
    };
  } catch (error) {
    Logger.log(`YAML save failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      filename: filename
    };
  }
}

/**
 * 画像を Google Drive に保存
 */
function saveImageToDrive(imageBase64, filename, sessionId) {
  // 出力先フォルダを取得
  const parentFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);

  // セッション用サブフォルダを取得または作成
  const sessionFolder = getOrCreateFolder(parentFolder, sessionId);

  // Base64デコードしてファイル作成
  const blob = Utilities.newBlob(
    Utilities.base64Decode(imageBase64),
    'image/png',
    filename
  );

  const file = sessionFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    url: file.getUrl(),
    downloadUrl: `https://drive.google.com/uc?export=download&id=${file.getId()}`,
    filename: filename,
    folder: sessionId
  };
}

/**
 * サブフォルダを取得または作成
 */
function getOrCreateFolder(parent, folderName) {
  const folders = parent.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(folderName);
}

/**
 * 日時フォーマット: YYYYMMDD_HHmm
 */
function formatDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}`;
}

/**
 * レスポンス作成
 */
function createResponse(success, message, data = {}) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString(),
    ...data
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * テスト用関数: Gemini API で画像生成テスト
 */
function testGeminiImageGeneration() {
  const testPrompt = 'A simple red circle on white background';

  const mockRequest = {
    postData: {
      contents: JSON.stringify({
        prompt: testPrompt,
        sessionId: 'test_' + formatDateTime(new Date()),
        pageNumber: 1
      })
    }
  };

  const result = doPost(mockRequest);
  Logger.log(result.getContent());
}

/**
 * テスト用関数: API キー設定確認
 */
function testApiKeyConfiguration() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (key) {
    Logger.log('API Key configured: ' + key.substring(0, 10) + '...');
  } else {
    Logger.log('API Key NOT configured. Set GEMINI_API_KEY in script properties.');
  }
}
