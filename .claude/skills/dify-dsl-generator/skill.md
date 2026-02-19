# Dify DSL Generator

Difyワークフロー用のDSL（YAML形式）を自動生成するスキル。
**Dify Cloud互換形式**で出力し、バイブコーディングを実現する。

参考: https://qiita.com/yuto-ida-stb/items/a06cab875174b0295cec

---

## 絶対ルール（厳守）

### 1. バージョン
| 使用 | 禁止 |
|------|------|
| `version: 0.1.2` | `version: 0.5.0`（Dify Cloud非互換） |

### 2. ノードID形式
| OK | NG |
|----|-----|
| `'1000000001'`（数字文字列） | `'start-1'`（文字列ID） |
| `'1734567890001'`（タイムスタンプ形式） | `1000000001`（数値型） |

### 3. 変数参照形式
| OK | NG |
|----|-----|
| `{{#1000000001.variable#}}` | `{{ node-id.variable }}` |
| `{{#env.api_url#}}` | `{{ env.api_url }}` |

### 4. 生成前の必須参照（優先順位順）
DSL生成前に以下を優先順位順で確認:
1. `dsl/exported/` - 自分の動作確認済みワークフロー（最優先）
2. `dsl/templates/_base_template_enhanced.yml` - 全11ノードタイプのテンプレート
3. `dsl/templates/TEMPLATE_REFERENCE_MAP.md` - 用途別38テンプレートカタログ

---

## DSL生成ワークフロー

### Step 1: 要件確認
- 目的は何か？（翻訳/分析/チャット/検索/コンテンツ生成）
- 必要なノードタイプは？（LLM/HTTP/Code/Iteration/Tool等）
- 入出力形式は？

### Step 2: テンプレート選択
TEMPLATE_REFERENCE_MAP.md を参照し、類似テンプレートを特定:
- 翻訳 → book_translation.yml
- RAG → KnowledgeRetrieval_Chatbot.yml
- 調査 → DeepResearch.yml
- 分類 → CustomerReviewAnalysis.yml

### Step 3: DSL生成
1. _base_template_enhanced.yml をコピー
2. 選択したテンプレートの構造を参考に
3. 必須フィールドチェックリストを確認

### Step 4: 品質検証
以下を全て確認:
- version: 0.1.2
- ノードID: 数字文字列
- Edge: isInIteration, isInLoop, zIndex
- LLM: edition_type, structured_output_enabled
- 変数参照: {{#id.var#}} 形式

---

## Edge（接続）必須フィールド

**全てのEdgeに以下を含めること:**

```yaml
edges:
- data:
    isInIteration: false    # 必須: Iteration内かどうか
    isInLoop: false         # 必須: Loop内かどうか（Qiita推奨）
    sourceType: start       # 必須: 接続元ノードタイプ
    targetType: http-request # 必須: 接続先ノードタイプ
  id: edge-001
  source: '1000000001'
  sourceHandle: source      # 必須: 通常は'source'、if-elseは'true'/'false'
  target: '1000000002'
  targetHandle: target      # 必須: 常に'target'
  type: custom              # 必須: 常に'custom'
  zIndex: 0                 # 必須: 常に0
```

### If-Elseの分岐エッジ
```yaml
# trueの場合
- data:
    isInIteration: false
    isInLoop: false
    sourceType: if-else
    targetType: llm
  id: edge-true
  source: '1000000006'
  sourceHandle: 'true'      # 'true' または 'false'
  target: '1000000007'
  targetHandle: target
  type: custom
  zIndex: 0
```

---

## LLMノード必須フィールド

**Qiita記事準拠: 以下のフィールドを必ず含めること**

```yaml
- data:
    context:
      enabled: false
      variable_selector: []
    desc: 'LLMで処理'
    edition_type: basic                    # 必須（Qiita推奨）
    model:
      completion_params:
        temperature: 0.3
      mode: chat
      name: claude-3-5-sonnet-20241022
      provider: anthropic
    prompt_template:
    - id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'  # UUID形式推奨
      role: system
      text: |
        システムプロンプト
    - id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
      role: user
      text: |
        ユーザープロンプト
        変数参照: {{#1000000001.input_var#}}
    selected: false
    structured_output_enabled: false       # 必須（Qiita推奨）
    title: "LLM処理"
    type: llm
    variables: []
    vision:
      enabled: false
  height: 298
  id: '1000000003'
  position:
    x: 680
    y: 282
  positionAbsolute:
    x: 680
    y: 282
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 244
```

---

## ノード定義形式

### 共通構造
```yaml
- data:
    desc: '説明'
    selected: false
    title: "タイトル"
    type: ノードタイプ
    # 以下ノード固有のプロパティ
  height: 90
  id: '1000000001'        # 数字文字列のID
  position:
    x: 80                 # 300px間隔で配置
    y: 282
  positionAbsolute:
    x: 80
    y: 282
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 244
```

### Position規則
| ノード順 | x座標 | y座標 |
|----------|-------|-------|
| 1番目 | 80 | 282 |
| 2番目 | 380 | 282 |
| 3番目 | 680 | 282 |
| 4番目 | 980 | 282 |
| 5番目 | 1280 | 282 |

---

## ノードタイプ別定義

### 1. Startノード（開始）
```yaml
- data:
    desc: '入力を受け取る'
    selected: false
    title: "開始"
    type: start
    variables:
    - label: "入力ラベル"
      max_length: 1000
      options: []           # select型の場合は選択肢
      required: true
      type: text-input      # text-input, paragraph, select, number
      variable: input_var
  height: 90
  id: '1000000001'
  position:
    x: 80
    y: 282
  positionAbsolute:
    x: 80
    y: 282
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 244
```

#### 入力変数タイプ
| type | 用途 |
|------|------|
| text-input | 短いテキスト |
| paragraph | 長文テキスト |
| select | 選択肢（optionsに配列指定） |
| number | 数値 |

### 2. Endノード（終了）
```yaml
- data:
    desc: ''
    outputs:
    - value_selector:
      - '1000000003'        # 参照元ノードID
      - text                # 参照する変数名
      variable: output_name
    selected: false
    title: "終了"
    type: end
  height: 90
  id: '1000000004'
  position:
    x: 980
    y: 282
  positionAbsolute:
    x: 980
    y: 282
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 244
```

### 3. HTTP Requestノード
```yaml
- data:
    authorization:
      config: null
      type: no-auth         # no-auth, api-key, basic
    body:
      data: ''
      type: none            # none, json, form-data
    desc: 'API呼び出し'
    headers: ''
    method: get             # get, post, put, delete
    params: 'key:value'     # クエリパラメータ
    selected: false
    timeout:
      connect: 60
      read: 60
      write: 60
    title: "HTTP Request"
    type: http-request
    url: '{{#env.api_url#}}'
    variables: []
  height: 178
  id: '1000000002'
  position:
    x: 380
    y: 282
  positionAbsolute:
    x: 380
    y: 282
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 244
```

### 4. Codeノード（Python）
```yaml
- data:
    code: |
      def main(input_var: str) -> dict:
          result = {"output": input_var.upper()}
          return result
    code_language: python3
    desc: 'Pythonコード実行'
    outputs:
      output:
        children: null
        type: object
    selected: false
    title: "コード実行"
    type: code
    variables:
    - value_selector:
      - '1000000001'
      - input_var
      variable: input_var
  height: 178
  id: '1000000005'
  position:
    x: 380
    y: 282
  positionAbsolute:
    x: 380
    y: 282
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 244
```

### 5. If-Elseノード（条件分岐）
```yaml
- data:
    cases:
    - case_id: 'true'
      conditions:
      - comparison_operator: is-not-empty
        id: cond-001
        value: ''
        varType: string
        variable_selector:
        - '1000000002'
        - body
      id: case-true
      logical_operator: and
    desc: '条件分岐'
    selected: false
    title: "条件分岐"
    type: if-else
  height: 178
  id: '1000000006'
  position:
    x: 680
    y: 282
  positionAbsolute:
    x: 680
    y: 282
  selected: false
  sourcePosition: right
  targetPosition: left
  type: custom
  width: 244
```

#### 比較演算子
| 演算子 | 説明 |
|--------|------|
| is-empty | 空である |
| is-not-empty | 空でない |
| contains | 含む |
| not-contains | 含まない |
| equal | 等しい |
| not-equal | 等しくない |
| greater-than | より大きい |
| less-than | より小さい |

---

## 基本構造テンプレート

```yaml
app:
  description: "アプリの説明"
  icon: "\U0001F4CA"
  icon_background: '#E4FBCC'
  mode: workflow            # または chatflow
  name: "アプリ名"
kind: app
version: 0.1.2              # 必ず0.1.2

workflow:
  conversation_variables: []
  environment_variables:
  - name: variable_name
    value: ""
    value_type: secret      # または string
  features:
    file_upload:
      image:
        enabled: false
        number_limits: 3
        transfer_methods:
        - local_file
        - remote_url
    opening_statement: ''
    retriever_resource:
      enabled: false
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions: []
    suggested_questions_after_answer:
      enabled: false
    text_to_speech:
      enabled: false
      language: ''
      voice: ''
  graph:
    edges: []
    nodes: []
    viewport:
      x: 0
      y: 0
      zoom: 1
```

---

## 生成チェックリスト

DSL生成後、以下を全て確認:

- [ ] `version: 0.1.2` になっている
- [ ] 全ノードIDが数字文字列（'1000000001'形式）
- [ ] 全Edgeに `isInIteration: false` がある
- [ ] 全Edgeに `isInLoop: false` がある
- [ ] 全Edgeに `zIndex: 0` がある
- [ ] 全Edgeに `sourceHandle` / `targetHandle` がある
- [ ] LLMノードに `edition_type: basic` がある
- [ ] LLMノードに `structured_output_enabled: false` がある
- [ ] 変数参照が `{{#id.var#}}` 形式
- [ ] プロンプトIDがUUID形式（推奨）
- [ ] position と positionAbsolute が両方設定されている
- [ ] 全ノードの type が `custom`

---

## 禁止事項

| 項目 | 禁止 | 正解 |
|------|------|------|
| バージョン | `version: 0.5.0` | `version: 0.1.2` |
| ノードID | `'start-1'`, `'llm-node'` | `'1000000001'` |
| 変数参照 | `{{ node.var }}` | `{{#node.var#}}` |
| Edge sourceHandle | if-else以外で`'true'`/`'false'` | `source` |
| プレースホルダー | `XXX`, `TBD`, `未定` | 実際の値または空文字 |

---

## 出力先

```
Dify_project/dsl/generated/{workflow_name}.yml
```

---

## 使用例

### 入力
```
目的: スプレッドシートのデータを分析してレポート生成
入力: GAS Web App経由のJSON
出力: Markdown形式のレポート
モード: Workflow
```

### 出力
`dsl/generated/data_analysis_workflow.yml`

---

## コンテキスト拡充の考え方

手動エクスポートされるDSLは「動作確認済み」の実例。
これを最優先で参照することで、「それっぽい推測」ではなく
「実際に動いたパターン」に基づいたDSL生成が可能。

参照: https://qiita.com/yuto-ida-stb/items/a06cab875174b0295cec

---

## 関連ファイル

- `dsl/exported/` - 動作確認済みワークフロー（最優先参照）
- `dsl/templates/_base_template_enhanced.yml` - 全ノードタイプテンプレート
- `dsl/templates/TEMPLATE_REFERENCE_MAP.md` - 用途別テンプレートカタログ

---

## 参照テンプレート一覧（Awesome-Dify-Workflow）

DSL生成時、実装したい機能に応じて以下のテンプレートを参照:

### 用途別参照ガイド

| 実装したい機能 | 参照テンプレート | 理由 |
|----------------|------------------|------|
| HTTP+LLM連携 | `dsl/templates/duckduckgo_translation.yml` | 外部API呼び出しとLLM処理の組み合わせ |
| If-Else分岐 | `dsl/templates/intent_based_reply.yml` | 意図分類による条件分岐の実装例 |
| ループ処理 | `dsl/templates/book_translation.yml` | イテレーション処理の実装例 |
| 検索連携 | `dsl/templates/search_master.yml` | 複数検索エンジン統合 |
| Knowledge Retrieval | `dsl/templates/Document_chat_template.yml` | ナレッジベース検索とLLM応答 |
| 会話変数 | `dsl/templates/memory_test.yml` | コンテキスト保持と記憶処理 |
| Code実行 | `dsl/templates/Python_Coding_Prompt.yml` | Pythonコード生成と実行 |
| LLM連鎖 | `dsl/templates/translation_cn_to_en.yml` | 直訳→反思→意訳の連鎖処理 |
| 複雑なワークフロー | `dsl/templates/llm2o1.cn.yml` | タスク分解→実行→要約 |

### テンプレート一覧

詳細は `dsl/templates/TEMPLATE_REFERENCE_MAP.md` を参照。

| カテゴリ | ファイル数 | 学習ポイント |
|----------|------------|--------------|
| 翻訳 | 5件 | LLM連鎖、HTTP+LLM、ループ処理 |
| ツール | 5件 | 検索連携、Knowledge Retrieval、API統合 |
| チャットボット | 2件 | If-Else分岐、会話変数 |
| コード | 1件 | Code実行ノード |
