# Dify ワークフロー開発プロジェクト

> **グローバルルール継承**: ~/.claude/CLAUDE.md を参照

## Context
- 担当：AI自動化ワークフロー開発
- 目的：Difyを使った業務自動化ワークフローの構築
- 言語：日本語
- ワークフロー標準：Dify DSL (YAML v0.1.2)
- 環境：Dify Cloud版

## プロジェクト固有スキル

| スキル | 用途 | 場所 |
|--------|------|------|
| **dify-dsl-generator** | Dify DSL YAML自動生成 | `.claude/skills/dify-dsl-generator/` |
| **gas-webapp-generator** | GASウェブアプリ（JSON API）生成 | `.claude/skills/gas-webapp-generator/` |

## 参照ファイル
- **施工計画設計書**: plan.md（1,398行）
- **元システム**: 施工計画爆速作成/ （work004）

---

## DSL生成ルール（Qiita記事準拠）

参考: https://qiita.com/yuto-ida-stb/items/a06cab875174b0295cec

### バージョン
| 使用 | 禁止 |
|------|------|
| `version: 0.1.2` | `version: 0.5.0`（Dify Cloud非互換） |

### テンプレート参照（必須）
DSL生成時は以下を必ず参照:
- `dsl/templates/_base_template.yml` - 基本構造
- `dsl/construction_evaluation_analysis_workflow_v2.yml` - 動作確認済み実例

### 必須フィールド

#### Edge
```yaml
data:
  isInIteration: false    # 必須
  isInLoop: false         # 必須（Qiita推奨）
  sourceType: xxx
  targetType: xxx
zIndex: 0                 # 必須
```

#### LLMノード
```yaml
edition_type: basic                  # 必須（Qiita推奨）
structured_output_enabled: false     # 必須（Qiita推奨）
```

### 変数参照形式
| OK | NG |
|----|-----|
| `{{#1000000001.variable#}}` | `{{ node-id.variable }}` |
| `{{#env.api_url#}}` | `{{ env.api_url }}` |

### ノードID形式
| OK | NG |
|----|-----|
| `'1000000001'`（数字文字列） | `'start-1'`（文字列ID） |

### プレースホルダー禁止
```
禁止: XXX, YYY, TBD, TODO, 未定, 検討中, 仮
```

---

## ディレクトリ構成

```
Dify_project/
├── CLAUDE.md                    # 本ファイル
├── plan.md                      # 施工計画移行計画書（1,398行）
├── .claude/
│   ├── agents/
│   │   └── dify-workflow-orchestrator.md
│   └── skills/
│       ├── dify-dsl-generator/  # DSL生成スキル
│       └── gas-webapp-generator/ # GAS生成スキル
├── dsl/
│   ├── templates/               # テンプレート（参照用）
│   │   └── _base_template.yml
│   ├── generated/               # 生成DSL格納
│   ├── archive/                 # 旧バージョン退避
│   └── construction_evaluation_analysis_workflow_v2.yml  # 動作確認済み
├── gas_templates/               # GASテンプレート格納
├── code_nodes/                  # Code Executionノード用Python
│   ├── placeholder_detector.py
│   ├── fact_checker.py
│   └── chart_generator.py
├── prompts/                     # LLMプロンプト
│   ├── design_doc_analyzer.md
│   ├── quality_formatter.md
│   └── document_integrator.md
├── knowledge_base/              # Knowledge Base用データ
│   ├── 品質管理基準/
│   ├── 施工ノウハウ/
│   └── 法規制/
└── tests/                       # テストケース
```

---

## Knowledge Base構成（3つ）
1. 品質管理基準DB (dataset_id: TBD)
2. 施工ノウハウDB (dataset_id: TBD)
3. 法規制DB (dataset_id: TBD)

---

## ワークフロー概要

### 処理フェーズ（11段階）
| Phase | 処理内容 |
|-------|----------|
| 0 | 初期化、ディレクトリ生成 |
| 1 | 設計図書分析 → JSON構造化 |
| 2 | 品質基準抽出 → Markdown表 |
| 3 | 施工方法・安全計画調査（Felo検索） |
| 4 | 品質検証（JSON構造、プレースホルダー、数値整合性） |
| 5-6 | 図表生成・検証 |
| 7-8 | Markdown統合・ユーザー確認 |
| 9-11 | Gammaプレゼン生成 |

### スキル対応（10個）
| # | Claude Codeスキル | Dify実装 |
|---|------------------|----------|
| 1 | design-doc-analyzer | LLM Node + JSON Mode |
| 2 | quality-criteria-extractor | Knowledge Retrieval + LLM |
| 3 | construction-method-researcher | Knowledge Retrieval + HTTP |
| 4 | placeholder-detector | Code Execution (Python) |
| 5 | fact-checker | Code Execution (Python) |
| 6 | chart-generator | Code Execution (matplotlib/Mermaid) |
| 7 | emergency-contact-researcher | HTTP Request x 4 |
| 8 | local-info-researcher | HTTP Request x 3 |
| 9 | regulation-checker | Knowledge Retrieval |
| 10 | stakeholder-mapper | LLM + HTTP |

---

## 品質保証

### 3層検証
1. **JSON構造検証**: スキーマ準拠チェック
2. **プレースホルダー検出**: 禁止パターン（XXX等）0件
3. **数値整合性**: 金額・工期の計算チェック

---

## 次のステップ

1. Dify Cloudにログイン
2. Knowledge Base作成（3つ）
3. dataset_idを取得してワークフローに設定
4. DSLファイルをDifyにインポート
5. テスト実行
