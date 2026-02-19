/**
 * Manga Image Uploader - Google Apps Script WebApp
 * Difyワークフローから生成された画像をGoogle Driveに保存
 */

// 出力先フォルダID（マンガ出力先）
const OUTPUT_FOLDER_ID = '159VvODhVSJr7h3EtUR1lTC5rZDq8d3lZ';

/**
 * POST リクエスト処理
 *
 * リクエストボディ:
 * {
 *   "imageBase64": "iVBORw0KGgo...",
 *   "filename": "page_1.png",
 *   "sessionId": "20260102_1530"  // オプション: セッションID（日時）
 * }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (!data.imageBase64) {
      return createResponse(false, 'imageBase64 is required');
    }

    const imageBase64 = data.imageBase64;
    const filename = data.filename || `image_${Date.now()}.png`;

    // セッションID（日時フォルダ名）を決定
    const sessionId = data.sessionId || formatDateTime(new Date());

    // 出力先フォルダを取得
    const parentFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);

    // セッション用サブフォルダを取得または作成
    const sessionFolder = getOrCreateFolder(parentFolder, sessionId);

    // MIMEタイプ判定
    const mimeType = getMimeType(filename);

    // Base64デコードしてファイル作成
    const blob = Utilities.newBlob(
      Utilities.base64Decode(imageBase64),
      mimeType,
      filename
    );

    const file = sessionFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return createResponse(true, 'Success', {
      fileId: file.getId(),
      url: file.getUrl(),
      downloadUrl: `https://drive.google.com/uc?export=download&id=${file.getId()}`,
      filename: filename,
      folder: sessionId
    });

  } catch (error) {
    return createResponse(false, error.message);
  }
}

/**
 * GET リクエスト処理（ヘルスチェック）
 */
function doGet(e) {
  return createResponse(true, 'Manga Image Uploader is running', {
    version: '1.1.0',
    outputFolder: OUTPUT_FOLDER_ID
  });
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
 * MIMEタイプ判定
 */
function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/png';
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
 * テスト用関数: 小さなテスト画像をアップロード
 */
function testUpload() {
  // 1x1 透明PNG (Base64)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const mockRequest = {
    postData: {
      contents: JSON.stringify({
        imageBase64: testImageBase64,
        filename: 'test_upload.png',
        sessionId: formatDateTime(new Date())
      })
    }
  };

  const result = doPost(mockRequest);
  Logger.log(result.getContent());
}
