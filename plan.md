# 施工計画爆速作成システム構成要素とDify再現計画

## 調査目的

施工計画爆速作成システム（work004）の構成要素を詳細に理解し、Difyでの再現方法を検討する。

---

## Part 1: 施工計画爆速作成システム（work004）の構成要素

### 1.1 システム概要

| 項目 | 内容 |
|------|------|
| システム名 | 施工計画爆速作成システム v8.0 |
| 目的 | あらゆる土木工事の施工計画書を完全自動生成 |
| 処理時間 | 約42分（v8.0） |
| 成果物 | Markdown施工計画書（1,400行）+ PDF + 図表5種 |
| 品質評価 | 5/5（本番環境デプロイ可能） |

### 1.2 アーキテクチャ全体像

```
+-- 施工計画爆速作成システム v8.0 ------------------------------------+
|                                                                    |
|  +-- Orchestrator (11フェーズ制御) -----------------------------+  |
|  |                                                              |  |
|  |  Phase 0: 初期化                                            |  |
|  |  Phase 1-3: Agent並列実行（設計分析、品質抽出、施工調査）    |  |
|  |  Phase 4: 品質検証（5サブフェーズ）                         |  |
|  |  Phase 5-6: 図表生成・検証                                  |  |
|  |  Phase 7-8: 文書統合・ユーザー確認                          |  |
|  |  Phase 9-11: Gammaプレゼン生成                              |  |
|  |                                                              |  |
|  +--------------------------------------------------------------+  |
|                              |                                     |
|  +-- Skills（10個） -----------------------------------------+  |
|  | 1. design-doc-analyzer       6. chart-generator             |  |
|  | 2. quality-criteria-extractor 7. emergency-contact-researcher|  |
|  | 3. construction-method-researcher 8. local-info-researcher  |  |
|  | 4. placeholder-detector      9. regulation-checker          |  |
|  | 5. fact-checker              10. stakeholder-mapper         |  |
|  +--------------------------------------------------------------+  |
|                              |                                     |
|  +-- 外部連携 -----------------------------------------------+  |
|  | MCP: felo-search, chrome-devtools, gamma-mcp, mcp-scholarly |  |
|  | RAG: Obsidian vault（/o-search コマンド）                    |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
+--------------------------------------------------------------------+
```

### 1.3 構成要素の詳細

#### A. オーケストレーター（エージェント）

**配置**: `.claude/agents/work004-construction-plan-orchestrator.md`
**役割**: 11フェーズの処理を中央調整

| フェーズ | 処理内容 | 時間 |
|---------|----------|------|
| Phase 0 | 初期化、ディレクトリ生成 | 2分 |
| Phase 1 | 設計図書分析→JSON構造化 | 3分 |
| Phase 2 | 品質基準抽出→Markdown表 | 2分 |
| Phase 3 | 施工方法・安全計画調査（Felo検索） | 5分 |
| Phase 4 | 品質検証（JSON構造、プレースホルダー、数値整合性） | 5分 |
| Phase 5 | 高品質図表生成（5種類） | 3分 |
| Phase 6 | 図表品質チェック | 2分 |
| Phase 7 | Markdown統合 | 2分 |
| Phase 8 | ユーザー最終確認 | 2分 |
| Phase 9-11 | Gammaプレゼン生成 | 5分 |

#### B. スキル（10個）

**配置**: `.claude/skills/work004-*/`

| スキル | 役割 | 入力 | 出力 | 使用ツール |
|--------|------|------|------|-----------|
| design-doc-analyzer | 設計図書→JSON構造化 | 設計図書MD | 工事データJSON | Read, Write |
| quality-criteria-extractor | 品質基準抽出 | 品質基準MD | Markdown表 | Read, Write |
| construction-method-researcher | 施工方法調査+Felo検索 | 設計図書 | 安全計画MD | Felo, Devtools |
| placeholder-detector | プレースホルダー検出 | MD/JSON | 検出レポート | Grep |
| fact-checker | 数値整合性チェック | JSON | 検証レポート | Python |
| chart-generator | Python図表生成 | JSON | PNG(300dpi) | matplotlib, Plotly |
| emergency-contact-researcher | 緊急連絡先調査 | 地域情報 | 連絡先一覧 | Felo 7回 |
| local-info-researcher | 近隣情報調査 | 地域情報 | 近隣情報MD | Felo 12回 |
| regulation-checker | 法規制確認 | 工事種別 | 規制一覧 | Felo 5回 |
| stakeholder-mapper | 関係者マッピング | 設計図書 | 関係者図 | Felo 4回 |

#### C. RAG連携（Obsidian）

**コマンド**: `/o-search {検索キーワード}`

**活用例**:
```bash
/o-search 河川土工 掘削 施工方法 --top-k 3
/o-search 護岸工 安全 --top-k 5
```

**効果**: 過去の施工計画書や技術資料から関連知識を検索

#### D. MCP サーバー連携

| MCP Server | 用途 | 実行回数(v8.0) |
|------------|------|---------------|
| felo-search | リアルタイムWeb検索（病院、法令等） | 22回 |
| chrome-devtools | ブラウザ自動操作、スクリーンショット | 22回 |
| gamma-mcp | 日本語プレゼン生成 | 1回 |
| mcp-scholarly | 学術情報検索 | 適宜 |

#### E. テンプレート・スキーマ

**配置**: `00_システム/`

| ファイル | 内容 |
|---------|------|
| テンプレート/設計図書_テンプレート.md | 設計図書入力フォーマット |
| テンプレート/0_INPUT配置ガイド.md | 入力ファイル配置ガイド |
| schemas/agent1_output_schema.json | 工事データJSONスキーマ |
| 基準書類/品質管理基準.md | 工種別品質基準 |

#### F. 品質保証メカニズム（3層検証）

```
Layer 1: JSON構造検証（schema-validator）
    |
Layer 2: プレースホルダー検出（grep + 正規表現）
    |
Layer 3: 数値整合性チェック（Python fact-checker）
```

**検証項目**:
- 工事金額整合性: sum(total_cost) ≒ contract_amount（許容誤差10,000円）
- 項目金額計算: quantity x unit_price = total_cost（許容誤差100円）
- 工期妥当性: working_days + holidays = total_days
- プレースホルダー: 0件達成

---

## Part 2: Difyでの再現方法

### 2.1 Dify概要

**Dify**はLLMアプリケーション開発のためのオープンソースプラットフォーム。
ノーコード/ローコードでエージェント、ワークフロー、RAGを構築可能。

**特徴**:
- Beehive Architecture（モジュール型マイクロサービス）
- Workflow/Chatflow によるオーケストレーション
- Knowledge Pipeline（RAG）
- MCP対応（v1.6.0+）

### 2.2 構成要素の対応関係

| Claude Code要素 | Dify対応 | 実装方法 |
|----------------|---------|---------|
| Orchestrator | **Workflow** | 11フェーズをノードで連結 |
| Skill | **Tool Plugin / Agent Node / Code Execution** | 機能に応じて選択 |
| MCP Server | **MCP Tool Plugin** | v1.6.0+ でネイティブ対応 |
| RAG (Obsidian) | **Knowledge Base** | ドキュメントをアップロード、ベクトル検索 |
| JSON Schema | **Output Variables / Code Validation** | LLMノードの出力定義 |
| 品質検証 | **If/Else + Code Execution** | Pythonで検証ロジック実装 |

### 2.3 Difyワークフロー設計案

```
+-- Dify Workflow: 施工計画爆速作成 ----------------------------------+
|                                                                    |
|  [Start] → 設計図書入力                                           |
|      |                                                             |
|  +-- 並列実行ブランチ（最大10） ---------------------------------+  |
|  |  Branch 1: Design Doc Analyzer (LLM Node)                    |  |
|  |  Branch 2: Quality Criteria Extractor (Knowledge Retrieval)  |  |
|  |  Branch 3: Construction Method Researcher (MCP: Felo)        |  |
|  +--------------------------------------------------------------+  |
|      |                                                             |
|  [Variable Aggregator] → 結果統合                                  |
|      |                                                             |
|  +-- 品質検証フェーズ -------------------------------------------+  |
|  |  [Code Execution] Placeholder Detector (Python)              |  |
|  |      |                                                        |
|  |  [If/Else] プレースホルダー検出?                              |  |
|  |      +-- Yes → [MCP: Felo] 補完検索                           |  |
|  |      +-- No → 次フェーズへ                                    |  |
|  |      |                                                        |
|  |  [Code Execution] Fact Checker (Python)                      |  |
|  +--------------------------------------------------------------+  |
|      |                                                             |
|  [Code Execution] Chart Generator (matplotlib)                     |
|      |                                                             |
|  [LLM Node] Markdown統合                                           |
|      |                                                             |
|  [HTTP Request] Gamma API (プレゼン生成)                           |
|      |                                                             |
|  [End] → 成果物出力                                                |
|                                                                    |
+--------------------------------------------------------------------+
```

### 2.4 スキル別の実装方法

#### A. design-doc-analyzer → LLM Node + Output Schema

```yaml
Node: LLM
Model: Claude / GPT-4
Prompt: |
  設計図書を読み込み、以下のJSON形式で構造化してください。
  プレースホルダー（○○、XXX等）は使用禁止。
  不明な情報は "UNKNOWN" と記載。
Output Variables:
  - project_name: string
  - location: string
  - contract_amount: number
  - work_categories: array
```

#### B. quality-criteria-extractor → Knowledge Retrieval

```yaml
Node: Knowledge Retrieval
Knowledge Base: 品質管理基準DB
Search Strategy: Hybrid (Keyword + Semantic)
Top-k: 5
Reranking: Enabled
```

#### C. construction-method-researcher → MCP Tool (Felo)

```yaml
Node: Tool (MCP)
Tool: Felo-search
Query: "{市区町村} 救急病院 24時間 電話番号"
Retry: 3回（クエリを段階的に広域化）
```

#### D. placeholder-detector → Code Execution

```python
# Dify Code Execution Node (Python 3.12+)
import re

def main(inputs):
    text = inputs["document_text"]
    patterns = [
        r'○○', r'△△', r'XXX', r'YYY', r'ZZZ',
        r'000-0000-0000', r'UNKNOWN', r'TBD', r'未定'
    ]

    findings = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        if matches:
            findings.extend(matches)

    return {
        "placeholder_count": len(findings),
        "placeholders": findings,
        "is_clean": len(findings) == 0
    }
```

#### E. fact-checker → Code Execution

```python
# Dify Code Execution Node (Python 3.12+)
import json

def main(inputs):
    data = json.loads(inputs["json_data"])
    errors = []

    # 工事金額整合性チェック
    sum_cost = sum(
        item['total_cost']
        for cat in data['work_categories']
        for item in cat['items']
    )
    contract = data['basic_info']['contract_amount']
    if abs(sum_cost - contract) > 10000:
        errors.append(f"金額不一致: {sum_cost} vs {contract}")

    return {
        "is_valid": len(errors) == 0,
        "errors": errors
    }
```

#### F. chart-generator → Code Execution (matplotlib)

```python
# Dify Code Execution Node
import matplotlib.pyplot as plt
import io
import base64

def main(inputs):
    # Gantt chart generation logic
    fig, ax = plt.subplots(figsize=(12, 8))
    # ... chart creation code ...

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300)
    buf.seek(0)

    return {
        "chart_base64": base64.b64encode(buf.read()).decode()
    }
```

### 2.5 RAG構築（Knowledge Base）

**手順**:
1. 品質管理基準.md をアップロード
2. 出来形管理基準.md をアップロード
3. 過去の施工計画書をアップロード（Obsidian vaultの代替）

**設定**:
- Chunking: 500-1000 tokens
- Embedding: OpenAI / Cohere
- Vector Store: Weaviate（デフォルト）
- Search: Hybrid (Keyword + Semantic)

### 2.6 Difyの制限事項

| 制限 | 内容 | 対策 |
|------|------|------|
| マルチエージェント | CrewAIほどの高度な編成なし | ワークフローで順次/並列実行 |
| ファイルサイズ | 15MB/ファイル上限 | 分割アップロード |
| メタデータフィルタ | 細粒度制御未対応（2025年初頭） | タグベースで回避 |
| 変数サイズ | Cloud版で制限あり | セルフホスト版を検討 |
| 図表生成 | matplotlib限定 | Plotly/NetworkXは外部連携 |

### 2.7 推奨アプローチ：ハイブリッド構成

**Dify単独では完全再現が難しい場合**、以下のハイブリッド構成を推奨：

```
+-- Dify Workflow --------------------------------+
| (基本文書生成 + RAG検索)              |
| - Design Doc Analyzer                  |
| - Quality Criteria Extractor           |
| - Construction Method Researcher       |
+------------------------------------------------+
         | JSON出力
+-- 外部処理（Python/Claude Code） ---------------+
| (高度な検証 + 図表生成)               |
| - Placeholder Detector                 |
| - Fact Checker                         |
| - Chart Generator (Plotly/NetworkX)    |
+------------------------------------------------+
         | 最終文書
+-- Dify / Gamma ---------------------------------+
| - プレゼン生成                         |
+------------------------------------------------+
```

---

## Part 3: 実装ステップ

### Step 1: Dify環境構築
- Docker / Kubernetes でセルフホスト版をデプロイ
- MCP対応のためv1.6.0以上を使用

### Step 2: Knowledge Base構築
- 品質管理基準、出来形管理基準をアップロード
- 過去の施工計画書をベクトル化

### Step 3: ワークフロー構築
- 11フェーズをノードで実装
- 並列実行ブランチを設定（最大10）

### Step 4: MCP統合
- Felo-search MCPを接続
- 緊急連絡先調査用のクエリテンプレート作成

### Step 5: 品質検証実装
- Code Executionノードでplaceholder-detector実装
- Code Executionノードでfact-checker実装

### Step 6: 図表生成
- matplotlibベースのchart-generatorをCode Execution化
- 複雑な図表は外部API連携を検討

### Step 7: 統合テスト
- プレースホルダー0件達成を確認
- 数値整合性チェックを確認
- 処理時間を計測

---

## 決定事項（ユーザー確認済み）

| 項目 | 決定内容 |
|------|---------|
| Dify環境 | **Cloud版** |
| 再現範囲 | **全10スキル完全再現**（Dify機能に合わせて調整） |
| RAG構成 | **新規構築**（品質管理基準、出来形管理基準、施工計画書ノウハウ） |

---

## Part 4: Dify Cloud版での全スキル実現計画

### 4.1 Cloud版の制限と対策

| 制限 | 内容 | 対策 |
|------|------|------|
| ファイルサイズ | 15MB/ファイル | 基準書を分割アップロード |
| 変数サイズ | 制限あり | JSONを分割処理 |
| Code Execution | Python 3.12限定 | matplotlib使用、Plotly不可 |
| 並列ブランチ | 最大10 | 11フェーズを適切に分割 |

### 4.2 Knowledge Base構成（3つ）

```
+-- Knowledge Base 1: 品質管理基準DB --------------------------+
| - 品質管理基準.md（工種別試験項目、試験方法、頻度）     |
| - 出来形管理基準.md（測定項目、規格値、許容誤差）       |
| - Chunking: 500 tokens                                  |
| - Search: Hybrid                                        |
+-------------------------------------------------------------+

+-- Knowledge Base 2: 施工ノウハウDB --------------------------+
| - 過去の施工計画書（匿名化）                            |
| - 施工方法の詳細手順                                    |
| - 安全管理のベストプラクティス                          |
| - Chunking: 800 tokens                                  |
| - Search: Semantic                                      |
+-------------------------------------------------------------+

+-- Knowledge Base 3: 法規制DB --------------------------------+
| - 労働安全衛生法（抜粋）                                |
| - 騒音規制法・振動規制法                                |
| - 道路法・河川法                                        |
| - Chunking: 600 tokens                                  |
| - Search: Hybrid                                        |
+-------------------------------------------------------------+
```

### 4.3 全10スキルの実現方法（Dify Cloud版）

#### Skill 1: design-doc-analyzer
```
実現方法: LLM Node + JSON Mode
ノード構成:
  [LLM Node]
  - Model: Claude 3.5 Sonnet / GPT-4o
  - System Prompt: 設計図書解析用プロンプト
  - Output Format: JSON (Structured Output)
  - Variables: basic_info, work_categories, materials, equipment

検証: If/Else Node でJSON構造チェック
```

#### Skill 2: quality-criteria-extractor
```
実現方法: Knowledge Retrieval + LLM Node
ノード構成:
  [Knowledge Retrieval]
  - Knowledge Base: 品質管理基準DB
  - Query: work_categoriesから工種名を取得
  - Top-k: 10
  - Reranking: Enabled
      |
  [LLM Node]
  - 検索結果をMarkdown表に整形
```

#### Skill 3: construction-method-researcher
```
実現方法: Knowledge Retrieval + HTTP Request (Felo)
ノード構成:
  [Knowledge Retrieval]
  - Knowledge Base: 施工ノウハウDB
  - Query: 工種名 + "施工方法"
      |
  [HTTP Request] (Felo API代替)
  - URL: 外部Felo検索API
  - Query: "{市区町村} 救急病院 24時間"
      |
  [LLM Node]
  - 施工方法 + 緊急連絡先を統合
```

**注意**: Dify Cloud版ではMCP直接接続が制限される可能性。HTTP Requestで代替。

#### Skill 4: placeholder-detector
```
実現方法: Code Execution Node
ノード構成:
  [Code Execution]
  - Language: Python
  - Input: 生成されたMarkdown/JSON
  - Logic: 正規表現でプレースホルダー検出
  - Output: { count, placeholders, is_clean }
```

#### Skill 5: fact-checker
```
実現方法: Code Execution Node
ノード構成:
  [Code Execution]
  - Language: Python
  - Input: 工事データJSON
  - Logic:
    1. 金額整合性: sum(total_cost) vs contract_amount
    2. 項目計算: quantity x unit_price = total_cost
    3. 工期計算: total_days = end - start + 1
  - Output: { is_valid, errors }
```

#### Skill 6: chart-generator
```
実現方法: Code Execution Node (matplotlib)
ノード構成:
  [Code Execution]
  - Language: Python
  - Input: 工事データJSON
  - Logic: matplotlib で5種類の図表生成
  - Output: Base64エンコード画像

制限:
- Plotly/NetworkX不可 → matplotlib のみ
- 300dpi PNG出力は可能
- 複雑な図表（施工体制図）は簡略化

代替案:
- 外部Chart API（QuickChart等）をHTTP Requestで呼び出し
```

#### Skill 7: emergency-contact-researcher
```
実現方法: HTTP Request (Felo代替) + LLM Node
ノード構成:
  [HTTP Request] x 4 (並列)
  - 病院検索: "{市区町村} 救急病院"
  - 労基署検索: "{都道府県} 労働基準監督署"
  - 警察検索: "{市区町村} 警察署"
  - 消防検索: "{市区町村} 消防署"
      |
  [Variable Aggregator]
      |
  [LLM Node]
  - 検索結果から連絡先を抽出・整形
```

#### Skill 8: local-info-researcher
```
実現方法: HTTP Request + Knowledge Retrieval
ノード構成:
  [HTTP Request] x 3 (並列)
  - 学校検索: "{施工場所} 近隣 学校"
  - イベント検索: "{市区町村} イベント カレンダー"
  - 自治会検索: "{町名} 自治会 連絡先"
      |
  [LLM Node]
  - 近隣情報を整理
```

#### Skill 9: regulation-checker
```
実現方法: Knowledge Retrieval + LLM Node
ノード構成:
  [Knowledge Retrieval]
  - Knowledge Base: 法規制DB
  - Query: 工事種別 + "規制"
      |
  [LLM Node]
  - 適用法規制を一覧化
```

#### Skill 10: stakeholder-mapper
```
実現方法: LLM Node + HTTP Request
ノード構成:
  [LLM Node]
  - 設計図書から関係者を抽出
      |
  [HTTP Request]
  - 埋設物管理者検索
  - 河川管理者検索
      |
  [LLM Node]
  - 関係者マップ作成
```

### 4.4 完全ワークフロー設計

```
+-- Dify Workflow: 施工計画爆速作成 (Cloud版) -----------------------+
|                                                                      |
|  [Start] 設計図書URL入力                                            |
|      |                                                               |
|  [Doc Extractor] 設計図書読み込み                                   |
|      |                                                               |
|  +-- 並列Phase 1-3 ----------------------------------------------+   |
|  |                                                                |   |
|  |  Branch 1: [LLM] design-doc-analyzer                          |   |
|  |      |                                                         |   |
|  |  Branch 2: [Knowledge Retrieval] → [LLM] quality-extractor    |   |
|  |      |                                                         |   |
|  |  Branch 3: [Knowledge Retrieval] → [HTTP] → [LLM] method      |   |
|  |                                                                |   |
|  +----------------------------------------------------------------+   |
|      |                                                               |
|  [Variable Aggregator] Phase1-3結果統合                             |
|      |                                                               |
|  +-- Phase 4: 品質検証 ------------------------------------------+   |
|  |                                                                |   |
|  |  [Code] placeholder-detector                                   |   |
|  |      |                                                         |   |
|  |  [If/Else] プレースホルダー検出?                              |   |
|  |      +-- Yes → [HTTP] Felo補完検索 → [LLM] 補完                |   |
|  |      +-- No → 次へ                                             |   |
|  |      |                                                         |   |
|  |  [Code] fact-checker                                           |   |
|  |      |                                                         |   |
|  |  [If/Else] 検証エラー?                                        |   |
|  |      +-- Yes → [LLM] エラー修正                                |   |
|  |      +-- No → 次へ                                             |   |
|  |                                                                |   |
|  +----------------------------------------------------------------+   |
|      |                                                               |
|  +-- 並列: 情報収集 ---------------------------------------------+   |
|  |  Branch 1: [HTTP] x 4 emergency-contact-researcher            |   |
|  |  Branch 2: [HTTP] x 3 local-info-researcher                   |   |
|  |  Branch 3: [Knowledge] regulation-checker                     |   |
|  |  Branch 4: [HTTP] x 2 stakeholder-mapper                      |   |
|  +----------------------------------------------------------------+   |
|      |                                                               |
|  [Code] chart-generator (matplotlib)                                 |
|      |                                                               |
|  [LLM] Markdown施工計画書統合                                        |
|      |                                                               |
|  [HTTP Request] Gamma API (プレゼン生成)                             |
|      |                                                               |
|  [End] 成果物出力                                                    |
|                                                                      |
+----------------------------------------------------------------------+
```

### 4.5 実装優先順位

| 順序 | スキル | 理由 |
|------|--------|------|
| 1 | design-doc-analyzer | 基盤となるJSON生成 |
| 2 | quality-criteria-extractor | RAG活用の検証 |
| 3 | placeholder-detector | 品質保証の核 |
| 4 | fact-checker | 品質保証の核 |
| 5 | construction-method-researcher | HTTP Request検証 |
| 6 | emergency-contact-researcher | 外部検索の検証 |
| 7 | local-info-researcher | 外部検索の拡張 |
| 8 | regulation-checker | RAG活用の拡張 |
| 9 | stakeholder-mapper | 複合処理の検証 |
| 10 | chart-generator | matplotlib制限の検証 |

### 4.6 Cloud版での課題と代替策

| 課題 | 代替策 |
|------|--------|
| MCP非対応 | HTTP Requestで外部API呼び出し |
| matplotlib制限 | QuickChart API、Mermaid.js |
| 変数サイズ制限 | JSONを分割処理、チャンク化 |
| 15MBファイル制限 | 基準書を章ごとに分割 |
| リアルタイム検索 | 外部Felo APIをHTTP Request経由で利用 |

---

## Part 5: DSL自動生成による効率的な移行戦略（ブラッシュアップ版）

### 5.1 新しいアプローチ：LLMベースDSL生成

Perplexityの調査結果を踏まえた効率的な移行戦略：

```
+-- 従来のアプローチ -----------------------------------------------+
|  GUIでノードを1つずつ配置 → 設定 → 接続 → テスト（時間がかかる）   |
+------------------------------------------------------------------+
                              |
+-- 新しいアプローチ（DSL自動生成） --------------------------------+
|  1. CLAUDE.md に要件記述                                           |
|  2. Claude Code で YAML DSL を自動生成                             |
|  3. Dify にインポート                                              |
|  4. 微調整・テスト                                                 |
|  5. Git でバージョン管理                                           |
+------------------------------------------------------------------+
```

### 5.2 プロジェクトディレクトリ構成

```
施工計画爆速作成_Dify/
+-- CLAUDE.md                          # プロジェクトコンテキスト
+-- README.md                          # 使用方法
|
+-- dsl/                               # DSLファイル格納
|   +-- main_workflow.yml              # メインワークフロー
|   +-- sub_quality_check.yml          # 品質検証サブワークフロー
|   +-- sub_chart_generator.yml        # 図表生成サブワークフロー
|
+-- knowledge_base/                    # Knowledge Base用データ
|   +-- 品質管理基準/
|   |   +-- 河川土工.md
|   |   +-- コンクリート工.md
|   |   +-- ...
|   +-- 出来形管理基準/
|   |   +-- ...
|   +-- 施工ノウハウ/
|   |   +-- ...
|   +-- 法規制/
|       +-- ...
|
+-- prompts/                           # LLMプロンプト
|   +-- design_doc_analyzer.md         # Skill 1用
|   +-- quality_criteria_extractor.md  # Skill 2用
|   +-- construction_method.md         # Skill 3用
|   +-- ...
|
+-- code_nodes/                        # Code Executionノード用
|   +-- placeholder_detector.py        # Skill 4
|   +-- fact_checker.py                # Skill 5
|   +-- chart_generator.py             # Skill 6
|
+-- tests/                             # テストケース
    +-- test_workflow.py
    +-- sample_input/
        +-- 設計図書_サンプル.md
```

### 5.3 CLAUDE.md テンプレート（Dify DSL生成用）

```markdown
# 施工計画爆速作成システム - Dify移行プロジェクト

## Context
- 担当：建設業界のAI実装
- 目的：施工計画書の完全自動生成
- 言語：日本語
- ワークフロー標準：Dify DSL (YAML v0.5.0+)
- 環境：Dify Cloud版

## システム概要
- 入力：設計図書（Markdown）
- 出力：施工計画書（1,400行）+ 図表5種 + プレゼン
- 処理時間目標：45分以内

## Knowledge Base構成（3つ）
1. 品質管理基準DB (dataset_id: TBD)
2. 施工ノウハウDB (dataset_id: TBD)
3. 法規制DB (dataset_id: TBD)

## ノード構成（10スキル対応）
1. design-doc-analyzer → LLM Node
2. quality-criteria-extractor → Knowledge Retrieval + LLM
3. construction-method-researcher → Knowledge Retrieval + HTTP
4. placeholder-detector → Code Execution (Python)
5. fact-checker → Code Execution (Python)
6. chart-generator → Code Execution (matplotlib)
7. emergency-contact-researcher → HTTP Request x 4
8. local-info-researcher → HTTP Request x 3
9. regulation-checker → Knowledge Retrieval
10. stakeholder-mapper → LLM + HTTP

## 制約事項
- Cloud版制限：15MB/ファイル、変数サイズ制限
- MCP非対応 → HTTP Requestで代替
- matplotlib のみ（Plotly/NetworkX不可）

## DSL生成時の注意
- version: 0.5.0 を使用
- 変数参照: {{ node-id.variable }}
- 日本語プロンプトを使用
- display: true を全ノードに設定
```

### 5.4 施工計画爆速作成システムのDSL構造設計

#### メインワークフロー（main_workflow.yml）

```yaml
app:
  description: "施工計画書を完全自動生成するAIシステム"
  icon: "building_construction"
  icon_background: "#2196F3"
  mode: workflow
  name: "施工計画爆速作成システム v1.0"

kind: app
version: 0.5.0

workflow:
  conversation_variables: []
  environment_variables:
    - variable: felo_api_key
      name: "Felo API Key"
      type: secret
      required: false

  features:
    file_upload:
      enabled: true
    retrieval_resources:
      enabled: true

  graph:
    edges:
      # Phase 0-1: Start → Design Doc Analyzer
      - id: edge-start-to-analyzer
        source: start-1
        target: llm-design-analyzer
        # ... 接続定義

      # Phase 1-3: 並列実行（3ブランチ）
      - id: edge-analyzer-to-quality
        source: llm-design-analyzer
        target: kr-quality-criteria
      - id: edge-analyzer-to-method
        source: llm-design-analyzer
        target: kr-construction-method
      - id: edge-analyzer-to-emergency
        source: llm-design-analyzer
        target: http-emergency-hospital

      # Phase 4: 品質検証
      - id: edge-aggregator-to-placeholder
        source: variable-aggregator-1
        target: code-placeholder-detector
      - id: edge-placeholder-to-fact
        source: code-placeholder-detector
        target: code-fact-checker

      # Phase 5-6: 図表生成
      - id: edge-fact-to-chart
        source: code-fact-checker
        target: code-chart-generator

      # Phase 7: 統合
      - id: edge-chart-to-final
        source: code-chart-generator
        target: llm-document-integrator

      # End
      - id: edge-final-to-end
        source: llm-document-integrator
        target: end-1

    nodes:
      # ========== Phase 0: 開始 ==========
      - id: start-1
        type: start
        title: "設計図書入力"
        position: { x: 0, y: 200 }
        data:
          outputs:
            - type: string
              variable: design_document
              label: "設計図書（Markdown）"
            - type: string
              variable: project_location
              label: "工事場所（市区町村）"
        display: true

      # ========== Phase 1: 設計図書分析 ==========
      - id: llm-design-analyzer
        type: llm
        title: "Skill1: 設計図書分析"
        position: { x: 250, y: 200 }
        data:
          model:
            provider: anthropic
            name: claude-3-5-sonnet-20241022
            mode: chat
          temperature: 0.3
          max_tokens: 4000
          prompt_template:
            - type: system
              text: |
                あなたは土木工事の設計図書を分析するエキスパートです。
                以下のルールに従って、設計図書からJSON形式で情報を抽出してください。

                【絶対ルール】
                - プレースホルダー禁止（○○、XXX、UNKNOWN等）
                - 設計図書に記載がない情報は "データなし" と記載
                - 数値は必ず整数または小数で記載

                【出力形式】
                {
                  "basic_info": {
                    "project_name": "工事名",
                    "location": "工事場所",
                    "purpose": "施工理由",
                    "duration": {
                      "start": "YYYY-MM-DD",
                      "end": "YYYY-MM-DD",
                      "total_days": 数値
                    },
                    "client": "発注者名",
                    "contract_amount": 数値
                  },
                  "work_categories": [
                    {
                      "category": "工種名",
                      "items": [
                        {
                          "name": "項目名",
                          "quantity": 数値,
                          "unit": "単位",
                          "unit_price": 数値,
                          "total_cost": 数値
                        }
                      ]
                    }
                  ],
                  "materials": [...],
                  "equipment": [...],
                  "constraints": [...]
                }
            - type: user
              text: |
                以下の設計図書を分析してください：

                {{ start-1.design_document }}
          output:
            type: string
            variable: project_json
        display: true

      # ========== Phase 2: 品質基準抽出 ==========
      - id: kr-quality-criteria
        type: knowledge-retrieval
        title: "Skill2: 品質基準検索"
        position: { x: 500, y: 100 }
        data:
          dataset_ids:
            - "QUALITY_CRITERIA_DB_ID"
          retrieval_mode: hybrid
          top_k: 10
          score_threshold: 0.6
          query: "{{ llm-design-analyzer.project_json }}"
        display: true

      - id: llm-quality-formatter
        type: llm
        title: "品質基準表作成"
        position: { x: 750, y: 100 }
        data:
          model:
            provider: anthropic
            name: claude-3-5-sonnet-20241022
            mode: chat
          temperature: 0.3
          prompt_template:
            - type: user
              text: |
                以下の品質基準情報をMarkdown表形式に整形してください：

                工事データ：{{ llm-design-analyzer.project_json }}

                品質基準情報：{{ kr-quality-criteria.result }}

                出力形式：
                ## {工種名}
                | 試験項目 | 試験方法 | 試験頻度 | 規格値 |
                |---------|---------|---------|--------|
        display: true

      # ========== Phase 3: 施工方法調査 ==========
      - id: kr-construction-method
        type: knowledge-retrieval
        title: "Skill3: 施工ノウハウ検索"
        position: { x: 500, y: 200 }
        data:
          dataset_ids:
            - "CONSTRUCTION_KNOWHOW_DB_ID"
          retrieval_mode: semantic
          top_k: 5
          query: "{{ llm-design-analyzer.project_json }} 施工方法 安全管理"
        display: true

      # ========== 緊急連絡先調査（HTTP Request） ==========
      - id: http-emergency-hospital
        type: http-request
        title: "Skill7: 病院検索"
        position: { x: 500, y: 300 }
        data:
          method: GET
          url: "https://api.felo.ai/search"
          headers:
            - key: Authorization
              value: "Bearer {{ env.felo_api_key }}"
          body:
            type: json
            data:
              query: "{{ start-1.project_location }} 救急病院 24時間 電話番号"
          timeout: 30
        display: true

      # ========== 変数集約 ==========
      - id: variable-aggregator-1
        type: variable-aggregator
        title: "Phase1-3結果統合"
        position: { x: 750, y: 200 }
        data:
          variables:
            - "{{ llm-design-analyzer.project_json }}"
            - "{{ llm-quality-formatter.answer }}"
            - "{{ kr-construction-method.result }}"
            - "{{ http-emergency-hospital.body }}"
        display: true

      # ========== Phase 4: 品質検証 ==========
      - id: code-placeholder-detector
        type: code
        title: "Skill4: プレースホルダー検出"
        position: { x: 1000, y: 200 }
        data:
          language: python
          input_variables:
            - variable_name: document_text
              type: string
          code: |
            import re
            import json

            patterns = [
                r'○○', r'△△', r'□□', r'XXX', r'YYY', r'ZZZ',
                r'000-0000-0000', r'\d{2,4}-XXX-\d{4}',
                r'UNKNOWN', r'TBD', r'TODO', r'未定', r'検討中', r'仮'
            ]

            findings = []
            for pattern in patterns:
                matches = re.findall(pattern, document_text)
                findings.extend(matches)

            result = {
                "placeholder_count": len(findings),
                "placeholders": list(set(findings)),
                "is_clean": len(findings) == 0
            }
          output_variables:
            - variable_name: result
              type: object
        display: true

      - id: code-fact-checker
        type: code
        title: "Skill5: 数値整合性チェック"
        position: { x: 1250, y: 200 }
        data:
          language: python
          input_variables:
            - variable_name: json_data
              type: string
          code: |
            import json

            try:
                data = json.loads(json_data)
                errors = []

                # 金額整合性チェック
                if 'work_categories' in data and 'basic_info' in data:
                    sum_cost = sum(
                        item.get('total_cost', 0)
                        for cat in data.get('work_categories', [])
                        for item in cat.get('items', [])
                    )
                    contract = data['basic_info'].get('contract_amount', 0)
                    if contract > 0 and abs(sum_cost - contract) > 100000:
                        errors.append(f"金額不一致: 合計{sum_cost} vs 契約{contract}")

                # 項目金額チェック
                for cat in data.get('work_categories', []):
                    for item in cat.get('items', []):
                        qty = item.get('quantity', 0)
                        price = item.get('unit_price', 0)
                        total = item.get('total_cost', 0)
                        if qty > 0 and price > 0:
                            calc = qty * price
                            if abs(calc - total) > 100:
                                errors.append(f"{item['name']}: {qty}x{price}={calc} vs {total}")

                result = {
                    "is_valid": len(errors) == 0,
                    "error_count": len(errors),
                    "errors": errors
                }
            except Exception as e:
                result = {
                    "is_valid": False,
                    "error_count": 1,
                    "errors": [str(e)]
                }
          output_variables:
            - variable_name: result
              type: object
        display: true

      # ========== Phase 5: 図表生成 ==========
      - id: code-chart-generator
        type: code
        title: "Skill6: 図表生成"
        position: { x: 1500, y: 200 }
        data:
          language: python
          input_variables:
            - variable_name: project_data
              type: string
          code: |
            import json
            import base64
            from io import BytesIO

            # matplotlibは Dify Cloud では制限あり
            # 代替: Mermaid.js コードを生成

            data = json.loads(project_data)
            basic = data.get('basic_info', {})

            # ガントチャート用Mermaid
            gantt_mermaid = f"""
            gantt
                title {basic.get('project_name', '工事')}
                dateFormat YYYY-MM-DD
                section 準備工
                準備作業 :a1, {basic.get('duration', {}).get('start', '2024-01-01')}, 7d
                section 本体工
                本体工事 :a2, after a1, 60d
                section 仕上工
                仕上作業 :a3, after a2, 14d
            """

            # 組織図用Mermaid
            org_mermaid = """
            flowchart TB
                A[発注者] --> B[元請会社]
                B --> C[現場代理人]
                C --> D[主任技術者]
                C --> E[安全管理者]
                D --> F[協力会社A]
                D --> G[協力会社B]
            """

            result = {
                "gantt_chart": gantt_mermaid,
                "organization_chart": org_mermaid,
                "charts_generated": 2
            }
          output_variables:
            - variable_name: result
              type: object
        display: true

      # ========== Phase 7: 文書統合 ==========
      - id: llm-document-integrator
        type: llm
        title: "施工計画書統合"
        position: { x: 1750, y: 200 }
        data:
          model:
            provider: anthropic
            name: claude-3-5-sonnet-20241022
            mode: chat
          temperature: 0.5
          max_tokens: 8000
          prompt_template:
            - type: system
              text: |
                あなたは施工計画書を作成するエキスパートです。
                以下の情報を統合して、完全な施工計画書（Markdown形式）を作成してください。

                【構成】
                1. 工事概要
                2. 施工体制
                3. 施工方法
                4. 品質管理計画
                5. 安全管理計画
                6. 環境保全計画
                7. 緊急時対応
                8. 工程表
            - type: user
              text: |
                【工事データ】
                {{ llm-design-analyzer.project_json }}

                【品質基準】
                {{ llm-quality-formatter.answer }}

                【施工ノウハウ】
                {{ kr-construction-method.result }}

                【緊急連絡先】
                {{ http-emergency-hospital.body }}

                【品質検証結果】
                プレースホルダー: {{ code-placeholder-detector.result }}
                数値整合性: {{ code-fact-checker.result }}

                【図表（Mermaid）】
                {{ code-chart-generator.result }}
        display: true

      # ========== 終了 ==========
      - id: end-1
        type: end
        title: "施工計画書出力"
        position: { x: 2000, y: 200 }
        data:
          output_type: object
          output_selector:
            - variable: "{{ llm-document-integrator.answer }}"
              label: "施工計画書（Markdown）"
            - variable: "{{ code-chart-generator.result }}"
              label: "図表データ（Mermaid）"
            - variable: "{{ code-placeholder-detector.result }}"
              label: "品質検証結果"
        display: true
```

### 5.5 実装ステップ（詳細版）

#### Step 1: Dify Cloud版でKnowledge Base作成

```
1. https://cloud.dify.ai にログイン
2. 「ナレッジ」→「作成」
3. 以下の3つを作成：
   - 品質管理基準DB
   - 施工ノウハウDB
   - 法規制DB
4. 各DBのdataset_idをメモ（DSLファイルに記載）
```

#### Step 2: Knowledge Baseにデータアップロード

```
品質管理基準DB:
  - 品質管理基準.md を分割アップロード
  - 出来形管理基準.md を分割アップロード
  - Chunking: 500 tokens
  - Embedding: text-embedding-3-small

施工ノウハウDB:
  - 過去の施工計画書（匿名化）
  - 施工方法詳細.md
  - Chunking: 800 tokens

法規制DB:
  - 労働安全衛生法.md
  - 騒音規制法.md
  - Chunking: 600 tokens
```

#### Step 3: DSLファイル生成

```bash
# Claude Codeで実行
cd 施工計画爆速作成_Dify

# CLAUDE.mdのコンテキストを読み込み
# DSLファイルを生成
# → dsl/main_workflow.yml が生成される
```

#### Step 4: DSLファイルの調整

```yaml
# dataset_ids を実際のIDに置換
dataset_ids:
  - "QUALITY_CRITERIA_DB_ID"  # → 実際のUUID
```

#### Step 5: Difyにインポート

```
1. Dify Cloud → アプリ作成
2. 「DSLファイルをインポート」を選択
3. main_workflow.yml をアップロード
4. インポート完了
```

#### Step 6: テスト実行

```
1. サンプル設計図書で実行テスト
2. 各ノードの出力を確認
3. エラーがあれば調整
```

#### Step 7: 微調整・最適化

```
- プロンプト調整（出力品質向上）
- Top-k値調整（RAG精度向上）
- 温度設定調整（創造性/確実性バランス）
```

### 5.6 Dify CLIによる自動化（オプション）

```bash
#!/bin/bash
# dify-deploy.sh

# ログイン
dify login

# DSLエクスポート（バックアップ）
dify export $APP_ID false > backup_$(date +%Y%m%d).yml

# DSLインポート（デプロイ）
dify import ./dsl/main_workflow.yml

# テスト実行
dify execute $WORKFLOW_ID --input '{
  "design_document": "...",
  "project_location": "仙台市青葉区"
}'
```

### 5.7 Git管理とCI/CD

```yaml
# .github/workflows/dify-deploy.yml
name: Dify Deploy

on:
  push:
    branches: [main]
    paths:
      - 'dsl/*.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Dify CLI
        run: |
          curl -sL https://raw.githubusercontent.com/.../dify-cli.sh -o dify-cli.sh
          chmod +x dify-cli.sh
      - name: Deploy to Dify
        env:
          DIFY_API_KEY: ${{ secrets.DIFY_API_KEY }}
        run: |
          ./dify-cli.sh import ./dsl/main_workflow.yml
```

---

## Part 6: 移行のロードマップ

### Phase 1: 基盤構築（1日目）

| タスク | 詳細 |
|--------|------|
| Dify Cloud登録 | アカウント作成、APIキー取得 |
| Knowledge Base作成 | 3つのDB作成、データアップロード |
| プロジェクト構成作成 | ディレクトリ構造、CLAUDE.md |

### Phase 2: DSL生成・インポート（2日目）

| タスク | 詳細 |
|--------|------|
| DSLファイル生成 | Claude Codeで main_workflow.yml 生成 |
| dataset_id設定 | 実際のUUIDに置換 |
| Difyインポート | DSLファイルをインポート |

### Phase 3: テスト・調整（3-4日目）

| タスク | 詳細 |
|--------|------|
| 単体テスト | 各ノードの動作確認 |
| 統合テスト | ワークフロー全体の実行 |
| プロンプト調整 | 出力品質の最適化 |

### Phase 4: 本番運用（5日目以降）

| タスク | 詳細 |
|--------|------|
| 本番デプロイ | 最終版をデプロイ |
| ドキュメント整備 | 使用方法、トラブルシューティング |
| 継続改善 | フィードバックを反映 |

---

## 参考資料

- Dify公式ドキュメント: https://docs.dify.ai/
- Dify GitHub: https://github.com/langgenius/dify
- MCP統合ガイド: https://docs.dify.ai/en/guides/application-publishing/publish-mcp
- Knowledge Pipeline: https://dify.ai/blog/introducing-knowledge-pipeline
- LLMによるDSL自動生成: https://zenn.dev/masato13/articles/2faf95f8d9f46a
- Dify DSL完全ガイド: https://myuuu.co.jp/media/1223/
- Awesome-Dify-Workflow: https://github.com/svcvit/Awesome-Dify-Workflow
- DifyWorkFlowGenerator: https://github.com/Tomatio13/DifyWorkFlowGenerator
