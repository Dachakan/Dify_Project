/**
 * Nano Banana Pro Image Generator - Google Apps Script WebApp v3.8
 * Dify SSRF プロキシを回避して Gemini API で画像生成し、Google Drive に保存
 *
 * v3.8 更新内容:
 * - ユーザーアップロード画像対応
 *   - Google Drive連携を廃止（キャラクター画像取得部分）
 *   - DifyからBase64エンコードされた画像を直接受け取り
 *   - character_imagesパラメータ: [{name: "takeru", base64: "..."}, ...]
 *   - キャラクター参照画像のアップロードをユーザーに委譲
 *
 * v3.7 更新内容:
 * - character_namesパラメータを有効化
 *   - Difyから指定されたキャラクターのみ画像を読み込む
 *   - 指定がない場合は全キャラクターにフォールバック
 *   - キャラクター一貫性問題の根本解決（不要キャラ画像を渡さない）
 *
 * v3.5 更新内容（v3.8で廃止）:
 * - 全キャラクター強制読み込み実装
 *   - Difyからのcharacter_namesパラメータを無視
 *   - 常に全4キャラクターの参照画像を読み込む
 *   - ページ2-3でキャラクター画像が渡らない問題を根本解決
 *
 * v3.4 更新内容:
 * - personGenerationパラメータ削除（Gemini API非対応）
 *
 * v3.2 更新内容:
 * - 全4キャラクター一貫性改善完了
 *   - カズさん: color_palette拡張（5色→7色: eyes, mole追加）、reference_image_text強化、Vibe具体化
 *   - 所長: color_palette拡張（6色→7色: eyes追加）、reference_image_text強化、Vibe具体化
 *
 * v3.1 更新内容:
 * - 竜さんキャラクター一貫性改善
 *   - color_palette拡張（5色→8色: eyes, eyebrows, scar追加）
 *   - reference_image_text強化（大文字強調、HEX色コード追加）
 *   - Vibe説明具体化（漫画キャラ参照追加）
 * - buildMangaPrompt改善
 *   - キャラクター一貫性マニフェスト追加（SECTION 1.5）
 *   - CRITICAL指示を3回繰り返し（SECTION 2,3,5）
 *   - 参照画像の役割明示（Purpose, Priority）
 *
 * v3.0 更新内容:
 * - ページフォーマット指示追加（縦長2:3、右から左、5パネル）
 * - キャラクターマスタ詳細化（reference_image_text, appearance_description, color_palette）
 * - buildMangaPrompt関数追加（完全なプロンプト構築）
 *
 * v2.0 更新内容:
 * - マルチモーダル入力対応（キャラクター参照画像）
 * - モデルを gemini-3-pro-image-preview に変更
 * - キャラクターマスタ定義追加
 * - Google Drive から参照画像を取得してBase64化
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
 *    - 説明: Nano Banana Pro Image Proxy v3.2
 *    - 実行者: 自分
 *    - アクセス: 全員
 * 6. ウェブアプリURLをDify環境変数 GAS_GEMINI_PROXY_URL に設定
 */

// =============================================================================
// 設定
// =============================================================================
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
const OUTPUT_FOLDER_ID = '159VvODhVSJr7h3EtUR1lTC5rZDq8d3lZ'; // マンガ出力先フォルダID

// =============================================================================
// v3.5: 全キャラクター強制読み込み用ファイルID
// Difyからのパラメータに依存せず、常に全4キャラクターの画像を読み込む
// =============================================================================
const ALL_CHARACTER_FILE_IDS = [
  { id: "1aBahLtJpy0DnoKJ6f0ObQnTDMM5y-L4y", name: "kazusan" },  // カズさん
  { id: "1umU2L6J0wJdoVd2fHmjMUP4cMJP4HgGV", name: "ryusan" },   // 竜さん
  { id: "1VdRytA2MTc5WiYyvPOiJ9iGFnwxQARXu", name: "shochou" },  // 所長
  { id: "1PBP3aeoc_zYEIP93AnbMyLZ84iGuxc3T", name: "takeru" }    // タケル
];

// =============================================================================
// ページフォーマット定義（v3.0追加）
// =============================================================================
const PAGE_FORMAT = {
  aspect_ratio: "2:3",
  orientation: "vertical/portrait",
  reading_order: "right_to_left",
  default_panels: 5,
  style: "Japanese Gekiga manga adapted to 4-head SD (Chibi) proportions",
  text_language: "Japanese"
};

// =============================================================================
// キャラクターマスタ定義（v3.0詳細化）
// 定義元: マンガ生成プロジェクト/templates/character_master.yaml
// =============================================================================
const CHARACTER_MASTER = {
  "takeru": {
    "drive_file_id": "1PBP3aeoc_zYEIP93AnbMyLZ84iGuxc3T",
    "display_name": "Takeru",
    "name_japanese": "タケル",
    "role": "questioner",
    "reference_image_text": `Character sheet for Takeru.
Maintain consistent appearance throughout all panels:
- Spiky black hair, slightly wild/wind-swept
- Blue helmet (#2563eb) with scratches
- Grey work uniform (#4b5563), top button undone
- White towel around neck
- HUGE sparkling determined eyes
- Bandage on cheek (badge of hard work)
- 4-head SD proportions, athletic build`,
    "appearance_description": `**Character**: Takeru (The Hot-Blooded Rookie)
- 22-year-old new construction worker. The hero who never gives up.
- **Face (SD)**: Strong young jawline, **wild black spiky hair**, **HUGE SPARKLING determined eyes**, thick expressive eyebrows, **bandage on cheek** (badge of hard work).
- **Body (SD)**: Lean but athletic SD build. **Always leaning forward, ready to charge.**
- **Outfit**:
  - **Blue Helmet (rookie, slightly scratched/dirty)** (#2563eb)
  - Grey work uniform (#4b5563, top button undone, slightly disheveled)
  - **White towel around neck**
  - Work gloves showing wear
- **Vibe**: NEKKETSU - from Salaryman Kintaro (reckless courage), Captain Tsubasa (sparkling eyes), Kunio-kun (hot-blooded toughness)`,
    "color_palette": {
      "helmet": "#2563eb",
      "uniform": "#4b5563",
      "skin": "#d4a574",
      "hair": "#111827",
      "bandage": "#fef3c7",
      "towel": "#ffffff"
    }
  },
  "kazusan": {
    "drive_file_id": "1aBahLtJpy0DnoKJ6f0ObQnTDMM5y-L4y",
    "display_name": "Kazusan",
    "name_japanese": "カズさん",
    "role": "mentor",
    "reference_image_text": `Character sheet for Kazu-san - The Charming Female Mentor.
CRITICAL: Maintain EXACTLY this appearance throughout ALL panels:
- **BLACK SHORT HAIR with SIDE-SWEPT BANGS** (neat, professional)
- **WHITE HELMET** (#ffffff, spotless senior worker)
- **NAVY BLUE WORK UNIFORM** (#1e3a5f, fitted, professional)
- **FLUORESCENT YELLOW SAFETY VEST** (#facc15, high visibility)
- **GENTLE DROOPY EYES with LONG LASHES** (#2d2d2d, warm, approachable)
- **SMALL MOLE ON LEFT CHEEK** (#8b5a3c, distinctive mark, always visible)
- **4-HEAD SD PROPORTIONS, SLIM ATHLETIC BUILD** (graceful, capable)`,
    "appearance_description": `**Character**: Kazu-san (The Charming Mentor)
- 32-year-old female senior construction worker. The reliable "Ane-go" (big sister).
- **Face (SD)**: Slightly long face, **black short hair with side-swept bangs**, **gentle droopy eyes with long lashes**, healthy tanned skin, **small mole on left cheek**.
- **Body (SD)**: Slim but athletic SD build. Approachable posture.
- **Outfit**:
  - **White Helmet (senior)** (#ffffff)
  - **Navy Blue work uniform (fitted)** (#1e3a5f)
  - **Fluorescent Yellow safety vest** (#facc15)
  - Full body harness
  - Leather gloves, Compact tool belt
- **Vibe**: **ANEKI MENTOR** - Like Balsa from Moribito, Major Kusanagi's calm side (GitS), or Riza Hawkeye (FMA). Capable female mentor with **gentle warmth** and **quiet strength**.`,
    "color_palette": {
      "helmet": "#ffffff",
      "uniform": "#1e3a5f",
      "vest": "#facc15",
      "skin": "#c9956c",
      "hair": "#1f2937",
      "eyes": "#2d2d2d",
      "mole": "#8b5a3c"
    }
  },
  "ryusan": {
    "drive_file_id": "1umU2L6J0wJdoVd2fHmjMUP4cMJP4HgGV",
    "display_name": "Ryusan",
    "name_japanese": "竜さん",
    "role": "veteran",
    "reference_image_text": `Character sheet for Ryu-san - The Legendary Veteran Foreman.
CRITICAL: Maintain EXACTLY this appearance throughout ALL panels:
- **GREY BUZZ CUT** (short military-style, steel-like texture)
- **LARGE SCRATCHED YELLOW HELMET** (#fbbf24, battle-worn with visible dents)
- **DARK GREY WORK UNIFORM** (#374151, sleeves ALWAYS rolled up)
- **WHITE TOWEL around SHORT THICK NECK** (signature item, never missing)
- **SHARP PIERCING EYES with DEEP CROW'S FEET WRINKLES** (#4a3728, wise, commanding)
- **THICK BUSHY GREY EYEBROWS** (#6b7280, expressive, furrowed when serious)
- **PROMINENT SCAR ON CHIN** (#c9a08a, distinctive mark, always visible)
- **4-HEAD SD PROPORTIONS, STOCKY BARREL-LIKE BUILD** (short, solid as rock)`,
    "appearance_description": `**Character**: Ryu-san (The Legend)
- 55-year-old construction foreman. Legendary veteran everyone respects.
- **Face (SD)**: Large square jaw head, **grey buzz cut**, deep wrinkles (crow's feet), **scar on chin**, fierce but expressive eyes, thick bushy grey eyebrows.
- **Body (SD)**: Short thick neck, barrel torso, short stout legs, large hands/feet. Like a sturdy barrel.
- **Outfit**:
  - **Large Scratched Yellow Helmet** (#fbbf24)
  - Dark Grey worn work uniform (#374151, sleeves rolled up)
  - **White towel around short neck**
  - Full body harness
  - Large tool belt
- **Vibe**: **OYAJI LEGEND** - Like Sakata Gintoki's boss mode (Gintama), Ryu from Shenmue, or a weathered foreman from Kaiji. Stubborn but **DEEPLY RESPECTED**. "Shokunin" spirit embodied.`,
    "color_palette": {
      "helmet": "#fbbf24",
      "uniform": "#374151",
      "towel": "#ffffff",
      "skin": "#9a5b3b",
      "hair": "#9ca3af",
      "eyes": "#4a3728",
      "eyebrows": "#6b7280",
      "scar": "#c9a08a"
    }
  },
  "shochou": {
    "drive_file_id": "1VdRytA2MTc5WiYyvPOiJ9iGFnwxQARXu",
    "display_name": "Shochou",
    "name_japanese": "所長",
    "role": "commander",
    "reference_image_text": `Character sheet for Shochou - The Commanding Site Manager.
CRITICAL: Maintain EXACTLY this appearance throughout ALL panels:
- **GREY-STREAKED BLACK HAIR, IMMACULATELY PARTED 7:3** (distinguished, authoritative)
- **SPOTLESS WHITE HELMET** (#ffffff, leadership symbol)
- **NAVY SUIT JACKET with COLLAR STANDING UP** (#1e3a5f, signature power pose)
- **BOLD ORANGE SAFETY VEST** (#ea580c, commander's mark)
- **SILVER-FRAMED RECTANGULAR GLASSES** (#d1d5db, intellectual authority)
- **SHARP PENETRATING EYES BEHIND GLASSES** (#3d2314, commanding presence)
- **4-HEAD SD PROPORTIONS, STOCKY IMPOSING BUILD** (ramrod straight posture)`,
    "appearance_description": `**Character**: Shocho (The Commander)
- 50-year-old construction site manager. The "big boss" everyone respects.
- **Face (SD)**: Square strong jawline, **grey-streaked black hair immaculately parted 7:3**, **sharp penetrating eyes behind silver-framed rectangular glasses** (#d1d5db), weathered tan skin with dignified wrinkles.
- **Body (SD)**: Stocky, broad-shouldered SD build. **Ramrod straight posture.**
- **Outfit**:
  - **Spotless White Helmet** (#ffffff)
  - **Navy suit jacket with COLLAR STANDING UP** (#1e3a5f) - signature look
  - **Bold Orange safety vest** (#ea580c) - commander's mark
  - Polished black safety boots
  - Professional clipboard, quality pen
- **Vibe**: **OYABUN COMMANDER** - Like Chairman Tonegawa (Kaiji), Gendo Ikari's authority (Evangelion), or Boss Tanaka from Salaryman Kintaro. **Intellectual authority**, battle-hardened site commander.`,
    "color_palette": {
      "helmet": "#ffffff",
      "jacket": "#1e3a5f",
      "vest": "#ea580c",
      "skin": "#a67c5b",
      "hair": "#374151",
      "glasses": "#d1d5db",
      "eyes": "#3d2314"
    }
  }
};

// 後方互換性エイリアス（旧キー対応）
CHARACTER_MASTER["kazu"] = CHARACTER_MASTER["kazusan"];
CHARACTER_MASTER["ryu"] = CHARACTER_MASTER["ryusan"];
CHARACTER_MASTER["director"] = CHARACTER_MASTER["shochou"];

// =============================================================================
// POST リクエスト処理
// =============================================================================
/**
 * POST リクエスト処理
 *
 * v3.9: リクエストボディ（Drive file IDs または Base64画像対応）:
 * {
 *   "prompt": "漫画のページを生成: ...",
 *   "referenceImageIds": ["fileId1", "fileId2"],  // v3.9: Drive file ID配列 (優先)
 *   "character_names": ["takeru", "kazusan"],     // v3.9: キャラクター名配列
 *   "character_images": [                         // v3.8互換: Base64画像配列
 *     {"name": "takeru", "base64": "iVBORw0..."},
 *     {"name": "shochou", "base64": "iVBORw0..."}
 *   ],
 *   "sessionId": "20260104_1530",                 // オプション
 *   "pageNumber": 1                               // オプション
 * }
 *
 * 優先順位: referenceImageIds > character_images > 画像なし
 */
function doPost(e) {
  try {
    // API キー確認
    if (!GEMINI_API_KEY) {
      return createResponse(false, 'GEMINI_API_KEY not configured in script properties');
    }

    const data = JSON.parse(e.postData.contents);
    const prompt = data.prompt;

    if (!prompt) {
      return createResponse(false, 'prompt is required');
    }

    const sessionId = data.sessionId || formatDateTime(new Date());
    const pageNumber = data.pageNumber || 1;

    // v3.9: referenceImageIds (Drive file IDs) または character_images (Base64) を受け付け
    const referenceImageIds = data.referenceImageIds || [];
    const uploadedImages = data.character_images || [];
    const characterNames = data.character_names || [];

    Logger.log(`v3.9: referenceImageIds=${referenceImageIds.length}, character_images=${uploadedImages.length}, character_names=${characterNames.length}`);

    // 1. v3.9: 画像ソースを優先度順に処理
    let referenceImages = [];
    let characterNamesForPrompt = [];

    if (referenceImageIds.length > 0) {
      // v3.9: Drive file IDsから画像をロード (Dify DSL方式)
      referenceImages = loadImagesFromDriveIds(referenceImageIds);
      characterNamesForPrompt = characterNames.length > 0 ? characterNames : referenceImageIds;
      Logger.log(`v3.9: Loaded ${referenceImages.length} images from Drive file IDs`);
    } else if (uploadedImages.length > 0) {
      // v3.8互換: Base64アップロード画像を使用
      referenceImages = processUploadedImages(uploadedImages);
      characterNamesForPrompt = uploadedImages.map(img => img.name);
      Logger.log(`v3.9: Processed ${referenceImages.length} uploaded Base64 images`);
    } else {
      // 画像なしで続行
      Logger.log(`v3.9: No character images provided - generating without reference`);
      characterNamesForPrompt = [];
    }

    // 2. 完全なマンガプロンプトを構築
    const fullPrompt = buildMangaPrompt(prompt, characterNamesForPrompt, pageNumber);

    // 3. Gemini API 呼び出し（マルチモーダル）
    const geminiResponse = callGeminiAPIMultimodal(fullPrompt, referenceImages);

    // エラーチェック
    if (geminiResponse.error) {
      return createResponse(false, `Gemini API error: ${geminiResponse.error.message}`, {
        errorCode: geminiResponse.error.code,
        errorStatus: geminiResponse.error.status
      });
    }

    // 4. レスポンスから画像抽出
    const imageData = extractImageFromResponse(geminiResponse);
    if (!imageData) {
      return createResponse(false, 'No image in Gemini response', {
        response: JSON.stringify(geminiResponse).substring(0, 500)
      });
    }

    // 5. Google Drive に保存
    const filename = `page_${String(pageNumber).padStart(2, '0')}.png`;
    const driveResult = saveImageToDrive(imageData.base64, filename, sessionId);

    // v3.9: デバッグ情報を追加
    const imageSource = referenceImageIds.length > 0 ? 'drive_file_ids' :
                        uploadedImages.length > 0 ? 'user_upload' : 'none';
    return createResponse(true, 'Image generated and saved successfully', {
      ...driveResult,
      page_number: pageNumber,
      mimeType: imageData.mimeType,
      characters_used: characterNamesForPrompt,
      debug: {
        version: '3.9.0',
        source: imageSource,
        images_loaded: referenceImages.length,
        image_details: referenceImages.map(img => ({
          character: img.characterId,
          mime_type: img.mimeType,
          base64_length: img.base64 ? img.base64.length : 0
        })),
        prompt_length: fullPrompt.length,
        api_parts_count: referenceImages.length + 1  // 画像数 + テキストプロンプト1つ
      }
    });

  } catch (error) {
    return createResponse(false, `Server error: ${error.message}`, {
      stack: error.stack
    });
  }
}

// =============================================================================
// GET リクエスト処理（ヘルスチェック）
// =============================================================================
function doGet(e) {
  const hasApiKey = !!GEMINI_API_KEY;
  return createResponse(true, 'Nano Banana Pro Image Proxy v3.8 is running', {
    version: '3.8.0',
    model: 'gemini-3-pro-image-preview',
    outputFolder: OUTPUT_FOLDER_ID,
    apiKeyConfigured: hasApiKey,
    availableCharacters: Object.keys(CHARACTER_MASTER).filter(k => !['kazu', 'ryu', 'director'].includes(k)),
    pageFormat: PAGE_FORMAT,
    imageConfig: {
      aspectRatio: "2:3",
      imageSize: "1K"
    },
    multimodalSupported: true,
    imageSource: 'user_upload'  // v3.8: ユーザーアップロード方式
  });
}

// =============================================================================
// マンガプロンプト構築（v3.0追加）
// =============================================================================
/**
 * 完全なマンガプロンプトを構築
 * @param {string} basePrompt - Difyからの元プロンプト（ストーリー等）
 * @param {string[]} characterNames - 使用するキャラクター名
 * @param {number} pageNumber - ページ番号
 * @returns {string} 完全なプロンプト
 */
function buildMangaPrompt(basePrompt, characterNames, pageNumber) {
  const sections = [];

  // ============================================================
  // SECTION 1: ページフォーマット指示（固定）
  // ============================================================
  sections.push(`
============================================================
[PAGE FORMAT - CRITICAL]
============================================================

Generate a **VERTICAL manga page** with the following specifications:

- **Aspect Ratio**: ${PAGE_FORMAT.aspect_ratio} (${PAGE_FORMAT.orientation}) - MUST be taller than wide
- **Reading Order**: ${PAGE_FORMAT.reading_order === 'right_to_left' ? 'RIGHT to LEFT, top to bottom (Japanese manga style)' : 'Left to right'}
- **Panel Count**: ${PAGE_FORMAT.default_panels} panels (unless specified otherwise)
- **Panel Borders**: Clean black borders, varying thickness for emphasis
- **Style**: ${PAGE_FORMAT.style}
- **Text**: ${PAGE_FORMAT.text_language} dialogue in speech bubbles
- **Effects**: Speed lines, emotion marks, sound effects (onomatopoeia) as needed

IMPORTANT: The image MUST be in PORTRAIT orientation (taller than wide).
`);

  // ============================================================
  // SECTION 1.5: キャラクター一貫性マニフェスト（v3.1追加）
  // ============================================================
  if (characterNames && characterNames.length > 0) {
    sections.push(`
============================================================
[CHARACTER CONSISTENCY MANIFEST - HIGHEST PRIORITY]
============================================================

For EACH character appearing in this page:
1. Reference image = ONLY source of truth
2. DO NOT interpret or creatively modify appearance
3. Replicate with 100% fidelity:
   - Eye shape, color, expression
   - Hair texture, color, style
   - Skin tone, wrinkles, scars, markings
   - Outfit colors (use HEX codes EXACTLY)
4. If character appears in multiple panels:
   - Appearance MUST NOT drift
   - SAME FACE in EVERY panel
   - SAME OUTFIT COLORS in EVERY panel

VIOLATION WARNING: Any deviation from reference images is UNACCEPTABLE.
============================================================
`);
  }

  // ============================================================
  // SECTION 2: キャラクター参照画像説明
  // ============================================================
  if (characterNames && characterNames.length > 0) {
    const charRefTexts = characterNames.map((name, idx) => {
      const charKey = name.toLowerCase().trim();
      const charInfo = CHARACTER_MASTER[charKey];
      if (!charInfo) return null;
      return `**Image ${idx + 1}**: ${charInfo.name_japanese} (${charInfo.display_name})
- Purpose: Use for FACIAL FEATURES, OUTFIT COLORS, and BODY PROPORTIONS
- Priority: This image is the SINGLE SOURCE OF TRUTH for this character

${charInfo.reference_image_text}`;
    }).filter(Boolean);

    if (charRefTexts.length > 0) {
      sections.push(`
============================================================
[REFERENCE IMAGES ATTACHED]
============================================================

${charRefTexts.join('\n\n')}

[CRITICAL - FIRST REMINDER]
- Characters in the manga MUST look IDENTICAL to the reference images
- Refer to the corresponding Image number whenever drawing each character
- TRACE the exact appearance from the reference images
- DO NOT interpret or modify - REPLICATE exactly
`);
    }
  }

  // ============================================================
  // SECTION 3: キャラクター外見説明（詳細）
  // ============================================================
  if (characterNames && characterNames.length > 0) {
    const charDescriptions = characterNames.map(name => {
      const charKey = name.toLowerCase().trim();
      const charInfo = CHARACTER_MASTER[charKey];
      if (!charInfo) return null;

      // カラーパレット文字列を構築
      let colorInfo = '';
      if (charInfo.color_palette) {
        const colors = Object.entries(charInfo.color_palette)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        colorInfo = `\n- **Color Palette**: ${colors}`;
      }

      return `${charInfo.appearance_description}${colorInfo}`;
    }).filter(Boolean);

    if (charDescriptions.length > 0) {
      sections.push(`
============================================================
[CHARACTER DESCRIPTIONS - USE THESE EXACTLY]
============================================================

${charDescriptions.join('\n\n---\n\n')}

[CRITICAL - SECOND REMINDER]
- Use EXACT HEX colors specified above
- Maintain 100% consistency across all panels
- DO NOT modify character appearances
`);
    }
  }

  // ============================================================
  // SECTION 4: 元のプロンプト（Difyからのストーリー等）
  // ============================================================
  sections.push(`
============================================================
[STORY/SCENE REQUEST]
============================================================

${basePrompt}
`);

  // ============================================================
  // SECTION 5: 最終リマインダー
  // ============================================================
  sections.push(`
============================================================
[FINAL REMINDERS]
============================================================

1. **VERTICAL PAGE**: The image MUST be in 2:3 portrait orientation (taller than wide)
2. **Reading Order**: RIGHT to LEFT (Japanese manga style)
3. **Character Consistency**: MUST match reference images exactly - same face, same clothes, same colors
4. **Panel Clarity**: Each panel should be distinct and readable
5. **Text Legibility**: Speech bubbles must be readable with Japanese text
6. **SD Proportions**: All characters are 4-head tall SD/Chibi style

[CRITICAL - FINAL REMINDER]
- Character appearance must NOT drift between panels
- Reference images are the ONLY source of truth
- Any deviation from reference images is UNACCEPTABLE

Page ${pageNumber}
============================================================
`);

  return sections.join('\n');
}

// =============================================================================
// v3.8: アップロード画像処理
// =============================================================================
/**
 * v3.8: Difyからアップロードされた画像を処理
 * Base64データを受け取り、Gemini APIに渡せる形式に変換
 *
 * @param {Array} uploadedImages - [{name: "takeru", base64: "..."}, ...]
 * @returns {Array} 処理済み画像配列
 */
function processUploadedImages(uploadedImages) {
  const images = [];

  for (const img of uploadedImages) {
    const name = img.name || 'unknown';
    let base64Data = img.base64 || '';

    // data:image/png;base64, プレフィックスを削除
    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }

    if (!base64Data) {
      Logger.log(`v3.8: Skipping ${name} - no base64 data`);
      continue;
    }

    // CHARACTER_MASTERから詳細情報を取得（存在する場合）
    const charInfo = CHARACTER_MASTER[name.toLowerCase()] || {};

    images.push({
      base64: base64Data,
      mimeType: 'image/png',  // アップロード画像は主にPNG
      characterId: name.toLowerCase(),
      displayName: charInfo.display_name || name
    });

    Logger.log(`v3.8: Processed ${name} (${base64Data.length} chars)`);
  }

  return images;
}

// =============================================================================
// キャラクター画像取得（v3.8で非推奨 - 後方互換用に保持）
// =============================================================================
/**
 * v3.9: Drive file IDsから画像をロード
 * Dify DSLのreferenceImageIdsパラメータに対応
 * @param {string[]} fileIds - Google DriveのファイルID配列
 * @returns {Object[]} 画像データ配列 {base64, mimeType, characterId}
 */
function loadImagesFromDriveIds(fileIds) {
  const images = [];

  for (const fileId of fileIds) {
    try {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      const mimeType = blob.getContentType() || 'image/png';
      const filename = file.getName();

      // ファイル名からキャラクター名を推測（オプション）
      const charName = filename.replace(/\.(png|jpg|jpeg|gif)$/i, '');

      images.push({
        base64: base64,
        mimeType: mimeType,
        characterId: charName,
        displayName: charName,
        fileId: fileId
      });

      Logger.log(`v3.9: Loaded from Drive: ${filename} (${mimeType}, ${base64.length} chars)`);
    } catch (e) {
      Logger.log(`v3.9: Failed to load file ID ${fileId}: ${e.message}`);
      // 失敗しても続行
    }
  }

  return images;
}

// =============================================================================
/**
 * v3.5: 全キャラクター画像を強制的に読み込む
 * Difyからのパラメータに依存せず、常に全4キャラクターの画像を取得
 * NOTE: v3.8ではprocessUploadedImages()を使用するため、この関数は後方互換用
 */
function loadAllCharacterImages() {
  const images = [];

  for (const char of ALL_CHARACTER_FILE_IDS) {
    try {
      const file = DriveApp.getFileById(char.id);
      const blob = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      const mimeType = blob.getContentType() || 'image/png';

      // CHARACTER_MASTERから詳細情報を取得
      const charInfo = CHARACTER_MASTER[char.name] || {};

      images.push({
        base64: base64,
        mimeType: mimeType,
        characterId: char.name,
        displayName: charInfo.display_name || char.name
      });

      Logger.log(`v3.5: Loaded ${char.name} (${mimeType}, ${base64.length} chars)`);
    } catch (e) {
      Logger.log(`v3.5: Failed to load ${char.name} (${char.id}): ${e.message}`);
      // 失敗しても続行（他のキャラクターは読み込む）
    }
  }

  return images;
}

/**
 * Google DriveからキャラクターIDで画像を取得しBase64化
 * 注: v3.5では loadAllCharacterImages() を使用するため、この関数は後方互換用
 */
function getCharacterImagesFromDrive(characterNames) {
  const images = [];

  for (const charId of characterNames) {
    const charKey = charId.toLowerCase().trim();
    const charInfo = CHARACTER_MASTER[charKey];

    if (!charInfo) {
      Logger.log(`Unknown character: ${charId}`);
      continue;
    }

    try {
      const file = DriveApp.getFileById(charInfo.drive_file_id);
      const blob = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      const mimeType = blob.getContentType() || 'image/png';

      images.push({
        base64: base64,
        mimeType: mimeType,
        characterId: charKey,
        displayName: charInfo.display_name
      });

      Logger.log(`Loaded character image: ${charKey} (${mimeType}, ${base64.length} chars)`);
    } catch (e) {
      Logger.log(`Failed to load character ${charId}: ${e.message}`);
    }
  }

  return images;
}

// =============================================================================
// Gemini API 呼び出し
// =============================================================================
/**
 * Gemini 3 Pro Image API マルチモーダル呼び出し
 */
function callGeminiAPIMultimodal(prompt, referenceImages = []) {
  // parts配列を構築
  const parts = [];

  // 1. 参照画像を先に追加（最大14枚だがキャラクターは4枚まで）
  for (const img of referenceImages) {
    parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.base64
      }
    });
  }

  // 2. テキストプロンプトを追加
  parts.push({ text: prompt });

  // ペイロード構築 (v3.4: personGeneration削除)
  const payload = {
    contents: [{
      parts: parts
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
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

  Logger.log(`Calling Gemini API with ${referenceImages.length} reference images`);
  Logger.log(`Prompt length: ${prompt.length} chars`);

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    Logger.log(`Gemini API error: ${responseCode} - ${response.getContentText()}`);
  }

  return JSON.parse(response.getContentText());
}

// =============================================================================
// レスポンス処理
// =============================================================================
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
    if (part.inlineData?.data) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png'
      };
    }
  }

  Logger.log('No inlineData found in response parts');
  return null;
}

// =============================================================================
// Google Drive 保存
// =============================================================================
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

// =============================================================================
// ユーティリティ
// =============================================================================
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

// =============================================================================
// テスト用関数
// =============================================================================
/**
 * テスト用関数: マルチモーダル画像生成テスト（v3.2対応）
 * 全4キャラクター一貫性改善版
 */
function testMultimodalGeneration() {
  const testPrompt = `Create a manga page about safety harness training.

Panel 1: Takeru asks Ryusan about how to wear the harness.
Panel 2: Ryusan demonstrates the first step.
Panel 3: Close-up on the D-ring position.
Panel 4: Ryusan points out Takeru's mistake.
Panel 5: Takeru successfully wears the harness.`;

  const mockRequest = {
    postData: {
      contents: JSON.stringify({
        prompt: testPrompt,
        character_names: ['takeru', 'ryusan'],
        sessionId: 'test_v3_' + formatDateTime(new Date()),
        pageNumber: 1
      })
    }
  };

  const result = doPost(mockRequest);
  Logger.log(result.getContent());
}

/**
 * テスト用関数: プロンプト構築テスト
 */
function testBuildMangaPrompt() {
  const testPrompt = `Scene: Safety meeting at construction site.
Takeru and Kazusan discussing harness usage.`;

  const fullPrompt = buildMangaPrompt(testPrompt, ['takeru', 'kazusan'], 1);
  Logger.log('=== Generated Prompt ===');
  Logger.log(fullPrompt);
  Logger.log(`Total length: ${fullPrompt.length} characters`);
}

/**
 * テスト用関数: キャラクター画像読み込みテスト
 */
function testCharacterImageLoading() {
  const images = getCharacterImagesFromDrive(['takeru', 'kazusan']);
  Logger.log(`Loaded ${images.length} images`);
  for (const img of images) {
    Logger.log(`${img.characterId} (${img.displayName}): ${img.mimeType}, ${img.base64.substring(0, 50)}...`);
  }
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

/**
 * テスト用関数: キャラクターマスタ確認
 */
function testCharacterMaster() {
  Logger.log('Available characters:');
  for (const [key, value] of Object.entries(CHARACTER_MASTER)) {
    if (['kazu', 'ryu', 'director'].includes(key)) continue; // エイリアスはスキップ
    Logger.log(`  ${key}: ${value.display_name} (${value.name_japanese})`);
    Logger.log(`    Role: ${value.role}`);
    Logger.log(`    Colors: ${JSON.stringify(value.color_palette)}`);
  }
}

/**
 * テスト用関数: ページフォーマット確認
 */
function testPageFormat() {
  Logger.log('Page Format Configuration:');
  Logger.log(JSON.stringify(PAGE_FORMAT, null, 2));
}
