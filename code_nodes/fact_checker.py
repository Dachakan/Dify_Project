"""
Dify Code Execution Node: Fact Checker (Skill 5)

数値整合性チェックスクリプト
工事データJSONの金額計算・工期計算の整合性を検証する

Input:
  - json_data: str - 工事データJSON文字列

Output:
  - result: dict
    - is_valid: bool - 全チェック通過ならTrue
    - error_count: int - エラー数
    - errors: list[str] - エラーメッセージ一覧
"""

import json


def main(inputs: dict) -> dict:
    """
    Dify Code Executionノードのエントリーポイント
    """
    json_data = inputs.get("json_data", "{}")

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

            # 許容誤差: 100,000円
            if contract > 0 and abs(sum_cost - contract) > 100000:
                errors.append(f"金額不一致: 合計{sum_cost:,} vs 契約{contract:,}")

        # 項目金額チェック（数量 x 単価 = 金額）
        for cat in data.get('work_categories', []):
            for item in cat.get('items', []):
                qty = item.get('quantity', 0)
                price = item.get('unit_price', 0)
                total = item.get('total_cost', 0)

                if qty > 0 and price > 0:
                    calc = qty * price
                    # 許容誤差: 100円
                    if abs(calc - total) > 100:
                        errors.append(
                            f"{item.get('name', '不明')}: "
                            f"{qty}x{price:,}={calc:,} vs 記載{total:,}"
                        )

        # 工期チェック（オプション）
        if 'basic_info' in data and 'duration' in data['basic_info']:
            duration = data['basic_info']['duration']
            total_days = duration.get('total_days', 0)
            start = duration.get('start', '')
            end = duration.get('end', '')

            if start and end and total_days > 0:
                try:
                    from datetime import datetime
                    start_date = datetime.strptime(start, '%Y-%m-%d')
                    end_date = datetime.strptime(end, '%Y-%m-%d')
                    calc_days = (end_date - start_date).days + 1

                    if abs(calc_days - total_days) > 1:
                        errors.append(
                            f"工期不一致: 計算{calc_days}日 vs 記載{total_days}日"
                        )
                except (ValueError, ImportError):
                    pass  # 日付パースエラーは無視

        result = {
            "is_valid": len(errors) == 0,
            "error_count": len(errors),
            "errors": errors
        }

    except json.JSONDecodeError as e:
        result = {
            "is_valid": False,
            "error_count": 1,
            "errors": [f"JSONパースエラー: {str(e)}"]
        }
    except Exception as e:
        result = {
            "is_valid": False,
            "error_count": 1,
            "errors": [f"予期しないエラー: {str(e)}"]
        }

    return {"result": result}


# ローカルテスト用
if __name__ == "__main__":
    test_input = {
        "json_data": json.dumps({
            "basic_info": {
                "project_name": "テスト工事",
                "contract_amount": 50000000,
                "duration": {
                    "start": "2024-04-01",
                    "end": "2024-09-30",
                    "total_days": 183
                }
            },
            "work_categories": [
                {
                    "category": "土工",
                    "items": [
                        {"name": "掘削工", "quantity": 1000, "unit": "m3", "unit_price": 5000, "total_cost": 5000000},
                        {"name": "盛土工", "quantity": 500, "unit": "m3", "unit_price": 3000, "total_cost": 1500000}
                    ]
                }
            ]
        })
    }
    output = main(test_input)
    print(json.dumps(output, ensure_ascii=False, indent=2))
