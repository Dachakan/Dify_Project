# Dify DSL Vibe Coding プロジェクト

> **グローバルルール継承**: ~/.claude/CLAUDE.md を参照

## Context
- 担当：Dify DSL自動生成（バイブコーディング）
- 目的：自然言語からDify Cloudワークフローを自動生成
- 言語：日本語
- ワークフロー標準：Dify DSL (YAML v0.1.2)
- 環境：Dify Cloud版

---

## プロジェクト固有スキル

| スキル | 用途 | 場所 |
|--------|------|------|
| **dify-dsl-generator** | Dify DSL YAML自動生成（520行） | `.claude/skills/dify-dsl-generator/` |
| **gas-webapp-generator** | スプレッドシート連携用GAS生成 | `.claude/skills/gas-webapp-generator/` |
| **refresh-dify-token** | Difyトークン更新 | `.claude/skills/refresh-dify-token/` |

---

## ディレクトリ構成

```
Dify_project/
├── CLAUDE.md                    # 本ファイル
├── .claude/
│   └── skills/
│       ├── dify-dsl-generator/  # DSL生成スキル（520行）
│       ├── gas-webapp-generator/ # GAS生成スキル
│       └── refresh-dify-token/  # トークン更新
├── .github/
│   └── workflows/
│       └── export_dify_workflows.yml  # 週次自動バックアップ
├── dsl/
│   ├── templates/               # 47テンプレート（Awesome-Dify-Workflow）
│   ├── exported/                # バックアップDSL（GitHub Actions生成）
│   └── generated/               # 生成DSL出力先
├── gas_templates/               # GASコード出力先
└── scripts/
    ├── export_dify_workflows.py # エクスポートスクリプト
    └── README.md
```

---

## DSL生成ワークフロー

### Step 1: 要件定義
ユーザーが自然言語で実現したいワークフローを記述。

### Step 2: テンプレート選択
47のテンプレートから類似ワークフローを選択：
```
dsl/templates/
├── agent/                # エージェント系（16テンプレート）
├── chatbot/              # チャットボット系（5テンプレート）
├── chatflow/             # チャットフロー系（8テンプレート）
├── completion/           # 補完系（6テンプレート）
└── workflow/             # ワークフロー系（12テンプレート）
```

### Step 3: DSL生成
`dify-dsl-generator`スキルを使用してYAML生成。

### Step 4: 品質検証
生成されたDSLを検証チェックリストで確認。

### Step 5: Difyインポート
DSLをDify Cloudにインポートして動作確認。

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
- `dsl/templates/` - 47テンプレート集

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

## 週次自動バックアップ

GitHub Actionsで毎週日曜5:00（JST）にDify Cloudからワークフローを自動エクスポート。

### 設定済みシークレット
- `DIFY_CONSOLE_TOKEN` - Difyコンソールトークン
- `DIFY_REFRESH_TOKEN` - リフレッシュトークン

### エクスポート先
```
dsl/exported/
└── {ワークフロー名}_{app_id}.yml
```

---

## バイブコーディングのベストプラクティス

### 1. 具体的な要件を伝える
```
NG: 「チャットボットを作って」
OK: 「PDFをアップロードし、内容に基づいて質問回答するRAGチャットボットを作成。
     Knowledge Retrievalで検索し、GPT-4oで回答生成。」
```

### 2. ノードタイプを明示
使用したいノードタイプを明記（11種類）：
- Start, End, LLM, HTTP Request, Code
- If-Else, Iteration, Knowledge Retrieval
- Tools, Template Transform, Variable Assignment

### 3. 入出力変数を定義
ワークフローの入力パラメータと出力変数を事前に定義。

### 4. テンプレートを参照指示
類似テンプレートがあれば明示的に参照を指示。

---

## クイックスタート

```bash
# DSL生成スキルを呼び出し
@dify-dsl-generator

# GAS生成スキルを呼び出し
@gas-webapp-generator

# トークン更新スキルを呼び出し
@refresh-dify-token
```
