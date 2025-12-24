# Dify DSL Template Reference Map
# 用途別テンプレートカタログ（43テンプレート）

## カテゴリ別テンプレート一覧

### 1. Translation/Localization（翻訳・ローカライズ）- 7件
| Template | Node Types | Learning Points |
|----------|------------|-----------------|
| book_translation.yml | iteration, llm | 長文分割処理、チャンク翻訳 |
| duckduckgo_translation.yml | llm, tool | 検索結果の翻訳 |
| FileTranslation.yml | llm | ファイル翻訳 |
| translation_cn_to_en.yml | llm | 中→英翻訳 |
| translation_en_to_cn_optimized.yml | llm | 英→中翻訳（最適化版） |
| translation_workflow.yml | llm | 基本翻訳ワークフロー |
| TextPolishing_TranslationTool.yml | llm | テキスト校正・翻訳 |

### 2. Code/Development（コード・開発）- 4件
| Template | Node Types | Learning Points |
|----------|------------|-----------------|
| CodeConverter.yml | llm | コード変換 |
| CodeInterpreter.yml | code, llm | コード実行・解釈 |
| Python_Coding_Prompt.yml | llm | Pythonコード生成 |
| SQLCreator.yml | llm | SQL生成 |

### 3. Research/Analysis（調査・分析）- 6件
| Template | Node Types | Learning Points |
|----------|------------|-----------------|
| DeepResearch.yml | iteration, tool, llm, assigner | 深い調査、conversation_variables使用 |
| CustomerReviewAnalysis.yml | question-classifier, http-request | 分類と外部API連携 |
| InvestmentAnalysisReportCopilot.yml | llm | 投資分析レポート |
| SentimentAnalysis.yml | llm | 感情分析 |
| StrategicConsultingExpert.yml | llm | 戦略コンサルティング |
| YouTube_ChannelDataAnalysis.yml | http-request, llm | API連携・データ分析 |

### 4. Chat/Assistant（チャット・アシスタント）- 8件
| Template | Node Types | Learning Points |
|----------|------------|-----------------|
| Document_chat_template.yml | knowledge-retrieval, question-classifier, llm | RAG + 分類の組み合わせ |
| KnowledgeRetrieval_Chatbot.yml | knowledge-retrieval, llm | 基本的なRAGチャット |
| QuestionClassifier_Knowledge_Chatbot.yml | question-classifier, knowledge-retrieval, llm | 質問分類→KB検索 |
| PatientIntakeChatbot.yml | llm | 医療問診チャット |
| PersonalizedMemoryAssistant.yml | llm, assigner | 個人化、メモリ使用 |
| memory_test.yml | llm | メモリ機能テスト |
| intent_based_reply.yml | if-else, llm | 意図ベース応答 |
| llm2o1.cn.yml | llm | 中国語対応 |

### 5. Content Creation（コンテンツ作成）- 6件
| Template | Node Types | Learning Points |
|----------|------------|-----------------|
| MeetingMinutes_Summary.yml | llm | 議事録要約 |
| PopularScienceArticle_NestedParallel.yml | iteration, llm | 並列処理、科学記事生成 |
| SEO_Slug_Generator.yml | llm | SEOスラッグ生成 |
| SEOBlogGenerator.yml | llm | SEOブログ生成 |
| URL_CrossPlatform_Copywriting.yml | http-request, llm | URL→コンテンツ |
| viral_title_generator.yml | llm | バイラルタイトル生成 |

### 6. Visual/Design（ビジュアル・デザイン）- 4件
| Template | Node Types | Learning Points |
|----------|------------|-----------------|
| FlatStyleIllustration.yml | llm | フラットイラスト生成 |
| SVGLogoDesign.yml | llm | SVGロゴ生成 |
| Flat Style Illustration Generation.yml | llm | フラットイラスト（別版） |
| SVG Logo Design .yml | llm | SVGロゴ（別版） |

### 7. Search/Web（検索・Web）- 4件
| Template | Node Types | Learning Points |
|----------|------------|-----------------|
| search_master.yml | tool, llm | 検索統合 |
| WebContentSearch_Summarization.yml | http-request, llm | Web検索・要約 |
| ResearchAgentProcessFlow.yml | tool, llm | リサーチエージェント |
| Web Content Search and Summarization Workflow.yml | http-request, llm | Web検索・要約（別版） |

### 8. Base/Reference（基本・参照）- 4件
| Template | Node Types | Learning Points |
|----------|------------|-----------------|
| _base_template.yml | start, end | 基本構造、必須フィールド |
| _base_template_enhanced.yml | 全11種 | 全ノードテンプレート |
| Knowledge Retreival + Chatbot .yml | knowledge-retrieval | KB検索（重複） |
| Question Classifier + Knowledge + Chatbot .yml | question-classifier | 分類（重複） |

---

## ノードタイプ別逆引き

### iteration（繰り返し処理）が必要な場合
- book_translation.yml - 長文分割
- DeepResearch.yml - 複数調査
- PopularScienceArticle_NestedParallel.yml - 並列生成

### tool（外部ツール）が必要な場合
- DeepResearch.yml - Tavily検索
- duckduckgo_translation.yml - DuckDuckGo
- search_master.yml - 検索ツール
- ResearchAgentProcessFlow.yml - リサーチツール

### knowledge-retrieval（RAG）が必要な場合
- Document_chat_template.yml - 複数KB
- KnowledgeRetrieval_Chatbot.yml - 基本RAG
- QuestionClassifier_Knowledge_Chatbot.yml - 分類+RAG

### question-classifier（分類）が必要な場合
- Document_chat_template.yml - 意図分類
- CustomerReviewAnalysis.yml - レビュー分類
- QuestionClassifier_Knowledge_Chatbot.yml - 質問分類

### code（コード実行）が必要な場合
- CodeInterpreter.yml - Python実行
- book_translation.yml - チャンク分割

### assigner（変数代入）が必要な場合
- DeepResearch.yml - 状態管理
- PersonalizedMemoryAssistant.yml - メモリ更新

---

## 推奨テンプレート（用途別）

| 用途 | 推奨テンプレート | 理由 |
|------|-----------------|------|
| 基本構造理解 | _base_template_enhanced.yml | 全ノードタイプ収録 |
| RAGチャット | KnowledgeRetrieval_Chatbot.yml | シンプルで理解しやすい |
| 複雑な調査 | DeepResearch.yml | iteration+tool+assigner |
| 長文処理 | book_translation.yml | iteration+code |
| 分類→分岐 | CustomerReviewAnalysis.yml | question-classifier |
| API連携 | YouTube_ChannelDataAnalysis.yml | http-request |
