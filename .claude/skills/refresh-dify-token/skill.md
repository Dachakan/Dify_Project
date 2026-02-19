# Dify Refresh Token Skill

Dify Cloudのリフレッシュトークンを取得・更新するスキル。
DSLエクスポートスクリプトの実行に必要。

## 使用方法

```
/refresh-dify-token
```

## 処理フロー

1. メールアドレスを確認（デフォルト: naieco2006@gmail.com）
2. 認証コードをメールに送信
3. ユーザーがコードを入力
4. リフレッシュトークンを取得
5. GitHub Secretsへの設定を案内

## 実行手順

### Step 1: 認証コード送信

```bash
curl -X POST "https://cloud.dify.ai/console/api/email-code-login" \
  -H "Content-Type: application/json" \
  -d '{"email": "USER_EMAIL", "language": "ja-JP"}'
```

### Step 2: ユーザーにコード入力を依頼

メールに届いた6桁のコードを入力してもらう。

### Step 3: トークン取得

```bash
curl -v -X POST "https://cloud.dify.ai/console/api/email-code-login/validity" \
  -H "Content-Type: application/json" \
  -d '{"email": "USER_EMAIL", "code": "CODE", "token": "TOKEN"}' \
  2>&1 | grep -i "set-cookie.*refresh_token"
```

### Step 4: 環境変数設定案内

取得したrefresh_tokenを環境変数として設定するよう案内:
- 変数名: `DIFY_REFRESH_TOKEN`
- 有効期限: 30日

## 注意事項

- 認証コードは5分以内に入力が必要
- リフレッシュトークンは30日間有効
- トークンが失効したら（30日）、このスキルで更新
