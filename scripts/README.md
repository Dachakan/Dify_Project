# Dify Workflow Export Scripts

Dify CloudからワークフローをDSL形式でエクスポートするスクリプト。

## ファイル構成

```
scripts/
├── export_dify_workflows.py  # DSLエクスポート
├── prepare_poc_data.py       # PoCテストデータ生成
└── README.md                 # 本ファイル
```

## 実行方法

### 前提条件
- Python 3.11+
- `pip install requests pyyaml`
- Difyリフレッシュトークン（`/refresh-dify-token` で取得、30日有効）

### DSLエクスポート

```bash
export DIFY_REFRESH_TOKEN="your_token_here"
python scripts/export_dify_workflows.py
```

### 出力先

```
dsl/exported/
├── _manifest.json
└── {ワークフロー名}_{app_id}.yml
```

## 注意事項

- リフレッシュトークンは30日で失効
- 失効時は `/refresh-dify-token` で再取得
- シークレット変数はデフォルトでエクスポートされない
