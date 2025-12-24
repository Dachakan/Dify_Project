"""
Dify Code Execution Node: Placeholder Detector (Skill 4)

プレースホルダー検出スクリプト
施工計画書内の禁止パターン（○○、XXX等）を検出する

Input:
  - document_text: str - 検査対象のMarkdown/JSONテキスト

Output:
  - result: dict
    - placeholder_count: int - 検出数
    - placeholders: list[str] - 検出されたプレースホルダー一覧
    - is_clean: bool - プレースホルダーなしならTrue
"""

import re
import json


def main(inputs: dict) -> dict:
    """
    Dify Code Executionノードのエントリーポイント
    """
    document_text = inputs.get("document_text", "")

    # 禁止パターン定義
    patterns = [
        r'○○',           # 丸記号系
        r'△△',
        r'□□',
        r'XXX',          # アルファベット系
        r'YYY',
        r'ZZZ',
        r'000-0000-0000', # 電話番号プレースホルダー
        r'\d{2,4}-XXX-\d{4}',
        r'UNKNOWN',       # 未定義系
        r'TBD',
        r'TODO',
        r'未定',
        r'検討中',
        r'仮',
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

    return {"result": result}


# ローカルテスト用
if __name__ == "__main__":
    test_input = {
        "document_text": """
        工事名: ○○河川護岸工事
        施工場所: XXX市YYY区
        電話番号: 000-0000-0000
        契約金額: 50000000円
        """
    }
    output = main(test_input)
    print(json.dumps(output, ensure_ascii=False, indent=2))
