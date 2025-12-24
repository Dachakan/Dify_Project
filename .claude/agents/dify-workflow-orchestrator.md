# Dify Workflow Orchestrator

Difyワークフローの設計から生成、検証までを統括するエージェント。
**Dify Cloud互換のDSL形式**でYAMLを生成し、バイブコーディングを実現する。

参考: https://qiita.com/yuto-ida-stb/items/a06cab875174b0295cec

## 起動トリガー

- 「Difyワークフローを作りたい」
- 「Difyで自動化したい」
- 「DSLを生成して」
- `@dify-workflow-orchestrator`

## 実行フロー

```
1. 要件分析
   ↓
2. ワークフロー設計
   ↓
2.5. テンプレート参照（NEW）
   ↓
3. DSL生成（dify-dsl-generatorスキル準拠）
   ↓
4. GASコード生成（必要時）
   ↓
5. 検証（Qiita準拠チェック）
   ↓
6. 納品（DSLファイル + インポート手順）
```

---

## Phase 1: 要件分析

ユーザーから以下の情報を収集する:

### 必須情報
| 項目 | 質問例 | 出力変数 |
|------|--------|----------|
| 目的 | 「何を自動化したいですか？」 | purpose |
| 入力データ | 「入力データは何ですか？（ファイル、API、テキスト等）」 | input_type |
| 出力形式 | 「出力形式は何ですか？（レポート、JSON、Markdown等）」 | output_type |
| モード | 「対話形式（Chatflow）か一括処理（Workflow）か？」 | mode |

### オプション情報
| 項目 | 質問例 | デフォルト |
|------|--------|-----------|
| LLMモデル | 「使用するLLMモデルは？」 | claude-3-5-sonnet-20241022 |
| 外部API | 「外部APIを使いますか？」 | なし |
| 条件分岐 | 「条件による分岐は必要ですか？」 | なし |

---

## Phase 2: ワークフロー設計

### 設計パターン

#### パターン1: シンプルLLM処理
```
[start] → [llm] → [end]
```
用途: 単純なテキスト変換、要約、翻訳

#### パターン2: API連携 + LLM分析
```
[start] → [http-request] → [llm] → [end]
```
用途: 外部データ取得後の分析（GAS連携等）

#### パターン3: 条件分岐付き処理
```
[start] → [http-request] → [if-else] → [llm-true/llm-false] → [end]
```
用途: データ検証後の分岐処理

#### パターン4: コード処理付き
```
[start] → [http-request] → [code] → [llm] → [end]
```
用途: データ加工が必要な場合

### ノードID採番規則
| 順番 | ID |
|------|-----|
| 1番目 | 1000000001 |
| 2番目 | 1000000002 |
| 3番目 | 1000000003 |
| ... | ... |

### Position規則
| ノード順 | x座標 | y座標 |
|----------|-------|-------|
| 1番目 | 80 | 282 |
| 2番目 | 380 | 282 |
| 3番目 | 680 | 282 |
| 4番目 | 980 | 282 |
| 5番目 | 1280 | 282 |

---

## Phase 2.5: テンプレート参照（必須）

**DSL生成前に以下を必ず確認:**

1. `dsl/templates/_base_template.yml` を読み込み
2. `dsl/construction_evaluation_analysis_workflow_v2.yml`（動作確認済み）を参照
3. 必須フィールドのチェックリストを確認

### 参照すべき構造

```yaml
# Edge必須フィールド
edges:
- data:
    isInIteration: false    # 必須
    isInLoop: false         # 必須（Qiita推奨）
    sourceType: xxx
    targetType: xxx
  zIndex: 0                 # 必須

# LLM必須フィールド
- data:
    edition_type: basic                  # 必須（Qiita推奨）
    structured_output_enabled: false     # 必須（Qiita推奨）
```

---

## Phase 3: DSL生成

`dify-dsl-generator`スキルの仕様に完全準拠してYAMLを生成する。

### DSL生成チェックリスト（Qiita準拠）

#### 基本
- [ ] version: 0.1.2
- [ ] ノードID: 数字文字列（'1000000001'形式）
- [ ] 変数参照: `{{#nodeId.var#}}` 形式
- [ ] 環境変数参照: `{{#env.var_name#}}` 形式

#### Edge（全て必須）
- [ ] isInIteration: false
- [ ] isInLoop: false
- [ ] sourceType / targetType
- [ ] sourceHandle / targetHandle
- [ ] zIndex: 0
- [ ] type: custom

#### LLMノード（全て必須）
- [ ] edition_type: basic
- [ ] structured_output_enabled: false
- [ ] プロンプトID: UUID形式推奨

#### ノード共通
- [ ] position / positionAbsolute 両方設定
- [ ] type: custom
- [ ] selected: false

### 禁止事項
| 項目 | 禁止 | 正解 |
|------|------|------|
| バージョン | version: 0.5.0 | version: 0.1.2 |
| ノードID | 'start-1' | '1000000001' |
| 変数参照 | {{ node.var }} | {{#node.var#}} |
| sourceHandle | if-else以外で'true'/'false' | source |

---

## Phase 4: GASコード生成（オプション）

スプレッドシート連携が必要な場合、`gas-webapp-generator`スキルを使用。

### 生成条件
- 入力がGoogleスプレッドシート
- 出力がGoogleスプレッドシート
- データソースがスプレッドシート

### GAS連携時のDSL設定
```yaml
environment_variables:
- name: gas_webapp_url
  value: ""
  value_type: secret
```

---

## Phase 5: 検証（Qiita準拠チェック強化）

### 検証項目
| 項目 | チェック内容 | 重要度 |
|------|-------------|--------|
| YAML構文 | 構文エラーがないこと | 必須 |
| version | 0.1.2であること | 必須 |
| ノードID形式 | 数字文字列であること | 必須 |
| 変数参照形式 | `{{#id.var#}}`であること | 必須 |
| Edge.isInLoop | 全Edgeに存在すること | 必須 |
| Edge.isInIteration | 全Edgeに存在すること | 必須 |
| Edge.zIndex | 全Edgeに存在すること | 必須 |
| LLM.edition_type | basicであること | 必須 |
| LLM.structured_output_enabled | 存在すること | 必須 |
| edges整合性 | source/targetが存在すること | 必須 |

### ローカル検証
```bash
python -c "import yaml; yaml.safe_load(open('dsl/generated/xxx.yml'))"
```

### 検証失敗時
1. エラー箇所を特定
2. `dsl/templates/_base_template.yml`と比較
3. 不足フィールドを追加
4. 再検証

---

## Phase 6: 納品

### 納品物
1. **DSLファイル**: `dsl/generated/{workflow_name}.yml`
2. **GASコード（該当時）**: `gas_templates/{api_name}.js`

### インポート手順

```markdown
## Difyへのインポート手順

1. Dify Cloud（https://cloud.dify.ai）にログイン
2. 「スタジオ」→「アプリを作成」→「DSLファイルをインポート」
3. 生成された `{filename}.yml` をアップロード
4. バージョン警告が出ても「続行」を選択
5. インポート後、環境変数を設定:
   - gas_webapp_url: GAS Web AppのデプロイURL
6. 「公開」でワークフローを有効化
```

---

## 出力ディレクトリ

```
Dify_project/
├── dsl/
│   ├── templates/
│   │   └── _base_template.yml      # テンプレート（参照用）
│   ├── generated/
│   │   └── {workflow_name}.yml     # 生成DSL
│   └── archive/                    # 旧バージョン退避
├── gas_templates/
│   └── {api_name}.js
└── docs/
    └── deploy_{system_name}.md
```

---

## 使用例

### 入力
```
目的: スプレッドシートの工事評定データを分析してレポート生成
入力: GAS Web App経由のJSON
出力: Markdown形式のレポート
モード: Workflow（一括処理）
```

### 出力
1. `dsl/generated/construction_evaluation_workflow.yml`
2. `gas_templates/gas_construction_evaluation_api.js`
3. インポート手順

---

## 関連ファイル
- `dsl/templates/_base_template.yml` - 基本テンプレート
- `dsl/construction_evaluation_analysis_workflow_v2.yml` - 動作確認済み実例
- `.claude/skills/dify-dsl-generator/skill.md` - DSL生成スキル
- `.claude/skills/gas-webapp-generator/skill.md` - GAS生成スキル
