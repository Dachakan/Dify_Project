# Dify DSL テンプレート一覧

収集元: [Awesome-Dify-Workflow](https://github.com/svcvit/Awesome-Dify-Workflow)

---

## カテゴリ別テンプレート

### 翻訳（5件）

| ファイル名 | 元ファイル名 | 説明 | 学習ポイント |
|------------|--------------|------|--------------|
| translation_cn_to_en.yml | 中译英.yml | 直訳→反思→意訳の翻訳フロー | LLM連鎖、反復処理 |
| duckduckgo_translation.yml | DuckDuckGo翻译+LLM二次翻译.yml | 翻訳エンジン+LLM組み合わせ | HTTP+LLM連携 |
| translation_workflow.yml | - | 多言語パラメータ対応 | パラメータ処理 |
| translation_en_to_cn_optimized.yml | 宝玉的英译中优化版.yml | 科技記事翻訳最適化 | 専門分野対応 |
| book_translation.yml | 全书翻译.yml | 長文セグメント化→反復処理 | ループ処理、大規模テキスト |

### ツール（5件）

| ファイル名 | 元ファイル名 | 説明 | 学習ポイント |
|------------|--------------|------|--------------|
| SEO_Slug_Generator.yml | - | URL用スラッグ自動生成 | テキスト変換 |
| Document_chat_template.yml | - | ナレッジベースチャット | Knowledge Retrieval |
| search_master.yml | 搜索大师.yml | SearXNG + Jina検索 | 外部API連携 |
| viral_title_generator.yml | 标题党创作.yml | バイラルタイトル生成 | クリエイティブ生成 |
| llm2o1.cn.yml | - | タスク分解→実行→要約 | 複雑なワークフロー |

### チャットボット（2件）

| ファイル名 | 元ファイル名 | 説明 | 学習ポイント |
|------------|--------------|------|--------------|
| intent_based_reply.yml | 根据用户的意图进行回复.yml | 意図分類→分岐応答 | If-Else分岐 |
| memory_test.yml | 记忆测试.yml | 短期メモリ+CoT思考 | 会話変数、記憶 |

### コード（1件）

| ファイル名 | 元ファイル名 | 説明 | 学習ポイント |
|------------|--------------|------|--------------|
| Python_Coding_Prompt.yml | - | 対話型コード生成 | Code実行ノード |

### ベーステンプレート（2件）

| ファイル名 | 説明 | 用途 |
|------------|------|------|
| _base_template.yml | 最小構成テンプレート | 基本構造確認 |
| _base_template_enhanced.yml | 全11ノードタイプ収録 | 新規DSL作成時のスケルトン |

### リファレンス（1件）

| ファイル名 | 説明 | 用途 |
|------------|------|------|
| TEMPLATE_REFERENCE_MAP.md | 用途別43テンプレートカタログ | 類似テンプレート検索 |

### Dify公式テンプレート（23件）- version 0.5.0

| ファイル名 | 説明 | 学習ポイント |
|------------|------|--------------|
| DeepResearch.yml | 深層リサーチエージェント | 会話変数、Tavily検索、ループ処理 |
| TextPolishing_TranslationTool.yml | テキスト校正・翻訳ツール | Firecrawl、多プロバイダLLM |
| FileTranslation.yml | ファイル翻訳（チャット型） | document-extractor、assigner |
| URL_CrossPlatform_Copywriting.yml | URLからマルチプラットフォーム用コピー生成 | Web scraping、コンテンツ変換 |
| MeetingMinutes_Summary.yml | 会議議事録・要約 | 音声→テキスト、要約 |
| YouTube_ChannelDataAnalysis.yml | YouTubeチャンネル分析 | API連携、データ分析 |
| CustomerReviewAnalysis.yml | 顧客レビュー分析 | 感情分析、レポート生成 |
| ResearchAgentProcessFlow.yml | リサーチエージェントプロセス | 複雑なエージェントフロー |
| PatientIntakeChatbot.yml | 患者受付チャットボット | 医療系チャットボット |
| SEOBlogGenerator.yml | SEOブログ生成 | コンテンツ生成、SEO最適化 |
| PopularScienceArticle_NestedParallel.yml | 科学記事作成（ネスト並列） | 並列処理、ネスト構造 |
| PersonalizedMemoryAssistant.yml | パーソナライズドメモリアシスタント | 長期記憶、パーソナライズ |
| SentimentAnalysis.yml | 感情分析 | テキスト分析、分類 |
| SQLCreator.yml | SQL生成 | コード生成、DB連携 |
| InvestmentAnalysisReportCopilot.yml | 投資分析レポート | 財務分析、レポート生成 |
| StrategicConsultingExpert.yml | 戦略コンサルティング | ビジネス分析 |
| CodeInterpreter.yml | コードインタプリタ | コード実行、分析 |
| CodeConverter.yml | コード変換 | 言語間変換 |
| WebContentSearch_Summarization.yml | Webコンテンツ検索・要約 | 検索、要約生成 |
| SVGLogoDesign.yml | SVGロゴデザイン | 画像生成、SVG |
| FlatStyleIllustration.yml | フラットスタイルイラスト生成 | 画像生成 |
| QuestionClassifier_Knowledge_Chatbot.yml | 質問分類+ナレッジ+チャットボット | 分類、RAG |
| KnowledgeRetrieval_Chatbot.yml | ナレッジ検索+チャットボット | RAG、チャットボット |

---

## 用途別参照ガイド

| 実装したい機能 | 参照テンプレート | 理由 |
|----------------|------------------|------|
| HTTP+LLM連携 | duckduckgo_translation.yml | 外部API呼び出しとLLM処理の組み合わせ |
| If-Else分岐 | intent_based_reply.yml | 意図分類による条件分岐の実装例 |
| ループ処理 | book_translation.yml | イテレーション処理の実装例 |
| 検索連携 | search_master.yml | 複数検索エンジン統合 |
| Knowledge Retrieval | Document_chat_template.yml | ナレッジベース検索とLLM応答 |
| 会話変数 | memory_test.yml | コンテキスト保持と記憶処理 |
| Code実行 | Python_Coding_Prompt.yml | Pythonコード生成と実行 |

---

## バージョン情報

- Dify DSL Version: 0.1.0 / 0.1.2（Dify Cloud互換）、0.5.0（公式テンプレート）
- 収集日: 2024-12-24
- ファイル数: 43件

## 注意事項

- version 0.5.0 のテンプレートは最新のDify機能を使用
- Dify Cloudで使用する場合は version 0.1.2 への変換が必要な場合あり
- 公式テンプレートは構造学習のリファレンスとして活用
