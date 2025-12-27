#!/usr/bin/env python3
"""
Dify Workflow DSL Exporter

Dify CloudからワークフローをDSL形式でエクスポートし、
リポジトリに保存するスクリプト。

使用方法:
    環境変数を設定してから実行:
    - DIFY_REFRESH_TOKEN: Dify Cloudのリフレッシュトークン
    - DIFY_BASE_URL: Dify CloudのベースURL（デフォルト: https://cloud.dify.ai）

トークン取得方法:
    Claude Codeで /refresh-dify-token スキルを実行
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path

import requests
import yaml


# 設定
DIFY_BASE_URL = os.environ.get("DIFY_BASE_URL", "https://cloud.dify.ai")
DIFY_REFRESH_TOKEN = os.environ.get("DIFY_REFRESH_TOKEN", "").strip()
INCLUDE_SECRET = os.environ.get("INCLUDE_SECRET", "false").lower() == "true"

# 出力先ディレクトリ
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR.parent / "dsl" / "exported"


def refresh_access_token() -> tuple[str, str]:
    """
    リフレッシュトークンから新しいaccess_tokenとcsrf_tokenを取得

    Returns:
        tuple[str, str]: (access_token, csrf_token)
    """
    url = f"{DIFY_BASE_URL}/console/api/refresh-token"

    # Cookieをヘッダーとして直接送信（curlと同じ動作）
    headers = {
        "Cookie": f"__Host-refresh_token={DIFY_REFRESH_TOKEN}"
    }

    response = requests.post(url, headers=headers)
    response.raise_for_status()

    # レスポンスのSet-Cookieからトークンを取得
    access_token = response.cookies.get("__Host-access_token", "")
    csrf_token = response.cookies.get("__Host-csrf_token", "")

    if not access_token:
        raise ValueError("access_tokenが取得できませんでした")

    return access_token, csrf_token


def get_request_headers(access_token: str, csrf_token: str = ""):
    """APIリクエスト用ヘッダーを生成（CookieとCSRFトークンを含む）"""
    headers = {
        "Content-Type": "application/json",
        "Cookie": f"__Host-access_token={access_token}; __Host-refresh_token={DIFY_REFRESH_TOKEN}"
    }
    if csrf_token:
        headers["X-CSRF-Token"] = csrf_token
    return headers


def get_apps(access_token: str, csrf_token: str = ""):
    """全アプリケーション一覧を取得"""
    url = f"{DIFY_BASE_URL}/console/api/apps"
    params = {"page": 1, "limit": 100}

    all_apps = []
    while True:
        response = requests.get(
            url,
            headers=get_request_headers(access_token, csrf_token),
            params=params
        )
        response.raise_for_status()
        data = response.json()

        apps = data.get("data", [])
        all_apps.extend(apps)

        # ページネーション
        if len(apps) < params["limit"]:
            break
        params["page"] += 1

    return all_apps


def export_app_dsl(app_id, app_name, access_token: str, csrf_token: str = ""):
    """アプリケーションのDSLをエクスポート"""
    include_param = "true" if INCLUDE_SECRET else "false"
    url = f"{DIFY_BASE_URL}/console/api/apps/{app_id}/export?include_secret={include_param}"

    response = requests.get(
        url,
        headers=get_request_headers(access_token, csrf_token)
    )
    response.raise_for_status()

    return response.text


def sanitize_filename(name):
    """ファイル名に使用できない文字を置換"""
    sanitized = re.sub(r'[<>:"/\\|?*]', "_", name)
    return sanitized[:100]


def save_dsl(app_name, dsl_content, app_id):
    """DSLをファイルに保存"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"{sanitize_filename(app_name)}_{app_id[:8]}.yml"
    filepath = OUTPUT_DIR / filename

    try:
        dsl_data = yaml.safe_load(dsl_content)
        formatted_content = yaml.dump(
            dsl_data,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
            width=120,
        )
    except yaml.YAMLError:
        formatted_content = dsl_content

    filepath.write_text(formatted_content, encoding="utf-8")
    return filepath


def create_manifest(apps_info):
    """エクスポートしたアプリの一覧マニフェストを作成"""
    manifest = {
        "exported_at": datetime.now().isoformat(),
        "total_apps": len(apps_info),
        "apps": apps_info,
    }

    manifest_path = OUTPUT_DIR / "_manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    return manifest_path


def main():
    """メイン処理"""
    # 環境変数チェック
    if not DIFY_REFRESH_TOKEN:
        print("ERROR: DIFY_REFRESH_TOKEN が設定されていません")
        print("Claude Codeで /refresh-dify-token スキルを実行してトークンを取得してください")
        return 1

    print(f"Dify Base URL: {DIFY_BASE_URL}")
    print(f"Include Secrets: {INCLUDE_SECRET}")
    print(f"Output Directory: {OUTPUT_DIR}")
    print(f"Token Length: {len(DIFY_REFRESH_TOKEN)}")
    print(f"Token Preview: {DIFY_REFRESH_TOKEN[:10]}...{DIFY_REFRESH_TOKEN[-10:]}")
    print("-" * 50)

    try:
        # リフレッシュトークンからアクセストークンとCSRFトークンを取得
        print("アクセストークンを取得中...")
        access_token, csrf_token = refresh_access_token()
        print(f"トークン取得成功 (CSRF: {'あり' if csrf_token else 'なし'})")
        print("-" * 50)

        # アプリ一覧を取得
        print("アプリケーション一覧を取得中...")
        apps = get_apps(access_token, csrf_token)
        print(f"取得したアプリ数: {len(apps)}")

        if not apps:
            print("エクスポート対象のアプリがありません")
            return 0

        # 各アプリをエクスポート
        apps_info = []
        for app in apps:
            app_id = app.get("id", "")
            app_name = app.get("name", "Unknown")
            app_mode = app.get("mode", "unknown")

            # workflowモードのアプリのみエクスポート
            if app_mode not in ["workflow", "advanced-chat"]:
                print(f"  SKIP: {app_name} (mode: {app_mode})")
                continue

            print(f"  Exporting: {app_name}...")
            try:
                dsl_content = export_app_dsl(app_id, app_name, access_token, csrf_token)
                filepath = save_dsl(app_name, dsl_content, app_id)
                apps_info.append({
                    "id": app_id,
                    "name": app_name,
                    "mode": app_mode,
                    "filename": filepath.name,
                })
                print(f"    -> {filepath.name}")
            except requests.HTTPError as e:
                print(f"    ERROR: {e}")
                continue

        # マニフェスト作成
        if apps_info:
            manifest_path = create_manifest(apps_info)
            print("-" * 50)
            print(f"エクスポート完了: {len(apps_info)} 件")
            print(f"マニフェスト: {manifest_path}")
        else:
            print("エクスポートしたアプリがありません")

        return 0

    except requests.HTTPError as e:
        print(f"API Error: {e}")
        if e.response is not None:
            print(f"Response: {e.response.text}")
        print("-" * 50)
        print("トークンが期限切れの可能性があります。")
        print("Claude Codeで /refresh-dify-token スキルを実行してトークンを更新してください。")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
