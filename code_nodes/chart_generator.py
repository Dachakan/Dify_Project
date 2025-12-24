"""
Dify Code Execution Node: Chart Generator (Skill 6)

図表生成スクリプト
工事データからMermaid.jsコード（ガントチャート、組織図等）を生成する

Note: Dify Cloud版ではmatplotlib/Plotlyに制限があるため、
Mermaid.jsコードを生成して後続処理でレンダリングする方式を採用

Input:
  - project_data: str - 工事データJSON文字列

Output:
  - result: dict
    - gantt_chart: str - ガントチャートのMermaidコード
    - organization_chart: str - 組織図のMermaidコード
    - charts_generated: int - 生成した図表数
"""

import json


def main(inputs: dict) -> dict:
    """
    Dify Code Executionノードのエントリーポイント
    """
    project_data = inputs.get("project_data", "{}")

    try:
        data = json.loads(project_data)
        basic = data.get('basic_info', {})
        duration = basic.get('duration', {})

        # プロジェクト名（デフォルト値設定）
        project_name = basic.get('project_name', '工事')
        start_date = duration.get('start', '2024-01-01')

        # ========== ガントチャート ==========
        gantt_mermaid = f"""gantt
    title {project_name}
    dateFormat YYYY-MM-DD

    section 準備工
    現場準備・測量    :a1, {start_date}, 7d
    仮設工            :a2, after a1, 5d

    section 本体工
    本体工事          :a3, after a2, 60d

    section 仕上工
    仕上・片付け      :a4, after a3, 14d
    竣工検査          :a5, after a4, 3d
"""

        # ========== 組織図 ==========
        # 発注者情報
        client = basic.get('client', '発注者')

        org_mermaid = f"""flowchart TB
    subgraph 発注者側
        A[{client}]
        A1[監督員]
    end

    subgraph 受注者側
        B[元請会社]
        C[現場代理人]
        D[主任技術者]
        E[安全管理者]
    end

    subgraph 協力会社
        F[土工業者]
        G[コンクリート業者]
        H[その他専門業者]
    end

    A --> A1
    A1 -.->|監督| C
    B --> C
    C --> D
    C --> E
    D --> F
    D --> G
    D --> H
"""

        # ========== 安全管理体制図（追加） ==========
        safety_mermaid = """flowchart TB
    A[統括安全衛生責任者] --> B[安全衛生責任者]
    B --> C[安全衛生推進者]
    C --> D1[土工班長]
    C --> D2[型枠班長]
    C --> D3[鉄筋班長]

    E[安全パトロール] -.-> B
    F[安全教育] -.-> C
"""

        # ========== 工程進捗図（追加） ==========
        # work_categoriesから動的生成
        work_categories = data.get('work_categories', [])
        progress_items = []
        for i, cat in enumerate(work_categories[:5], 1):  # 最大5工種
            category = cat.get('category', f'工種{i}')
            progress_items.append(f"    {category} :done, w{i}, 0%")

        if progress_items:
            progress_mermaid = "pie title 工種別進捗\n" + "\n".join(progress_items)
        else:
            progress_mermaid = """pie title 工種別進捗
    "準備工" : 100
    "土工" : 80
    "コンクリート工" : 60
    "仕上工" : 0
"""

        result = {
            "gantt_chart": gantt_mermaid,
            "organization_chart": org_mermaid,
            "safety_chart": safety_mermaid,
            "progress_chart": progress_mermaid,
            "charts_generated": 4
        }

    except json.JSONDecodeError as e:
        result = {
            "gantt_chart": "",
            "organization_chart": "",
            "safety_chart": "",
            "progress_chart": "",
            "charts_generated": 0,
            "error": f"JSONパースエラー: {str(e)}"
        }
    except Exception as e:
        result = {
            "gantt_chart": "",
            "organization_chart": "",
            "safety_chart": "",
            "progress_chart": "",
            "charts_generated": 0,
            "error": f"予期しないエラー: {str(e)}"
        }

    return {"result": result}


# ローカルテスト用
if __name__ == "__main__":
    test_input = {
        "project_data": json.dumps({
            "basic_info": {
                "project_name": "広瀬川護岸工事",
                "client": "宮城県土木部",
                "duration": {
                    "start": "2024-04-01",
                    "end": "2024-09-30",
                    "total_days": 183
                }
            },
            "work_categories": [
                {"category": "土工", "items": []},
                {"category": "護岸工", "items": []},
                {"category": "付帯工", "items": []}
            ]
        })
    }
    output = main(test_input)
    print(json.dumps(output, ensure_ascii=False, indent=2))
