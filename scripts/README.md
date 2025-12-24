# Dify Workflow Export Scripts

Dify CloudからワークフローをDSL形式でエクスポートするスクリプト群。

## ファイル構成

```
scripts/
└── export_dify_workflows.py  # DSLエクスポートスクリプト

.github/workflows/
└── export_dify_workflows.yml # GitHub Actions ワークフロー

dsl/exported/                 # エクスポート先ディレクトリ
```

## セットアップ手順

### 1. Dify Console Token の取得

1. [Dify Cloud](https://cloud.dify.ai) にログイン
2. ブラウザの開発者ツールを開く（F12 または右クリック > 検証）
3. **Network** タブを選択
4. ページをリロードして任意のAPIリクエストをクリック
5. **Request Headers** の `Authorization: Bearer xxxxx...` をコピー
6. `Bearer ` より後の文字列がトークン

### 2. GitHub Secrets の設定

リポジトリの Settings > Secrets and variables > Actions で以下を設定:

| Secret Name | 値 | 必須 |
|-------------|------|------|
| `DIFY_CONSOLE_TOKEN` | 上記で取得したトークン | 必須 |
| `DIFY_BASE_URL` | `https://cloud.dify.ai` | 任意（デフォルト値あり） |

### 3. ワークフローの実行

**手動実行:**
1. GitHub リポジトリの **Actions** タブを開く
2. 左メニューから **Export Dify Workflows** を選択
3. **Run workflow** ボタンをクリック
4. オプション設定後 **Run workflow** を実行

**自動実行:**
- 毎週日曜日 9:00（JST）に自動実行されます

## 出力

エクスポートされたDSLファイルは `dsl/exported/` に保存されます:

```
dsl/exported/
├── _manifest.json           # エクスポート一覧
├── workflow_name_abc12345.yml
└── another_workflow_def67890.yml
```

## ローカル実行

```bash
# 環境変数を設定
export DIFY_CONSOLE_TOKEN="your_token_here"
export DIFY_BASE_URL="https://cloud.dify.ai"

# 依存関係をインストール
pip install requests pyyaml

# 実行
python scripts/export_dify_workflows.py
```

## 注意事項

- Console Tokenは定期的に失効します（通常1-7日程度）
- 失効した場合は再取得してSecretを更新してください
- シークレット変数（APIキーなど）はデフォルトでエクスポートされません
