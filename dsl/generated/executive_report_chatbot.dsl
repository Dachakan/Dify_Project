app:
  description: "全工事横断の月次予算管理レポート生成・経営分析質問に回答するチャットボット。GAS hub.gsからcross_summary/cross_healthを並列取得し、5セクション構成レポートまたは質問への回答を生成します。"
  icon: "\U0001F4C8"
  icon_background: '#E4FBCC'
  mode: advanced-chat
  name: "本社向け経営分析チャットボット"
kind: app
version: 0.1.2

workflow:
  conversation_variables: []
  environment_variables:
  - name: GAS_HUB_URL
    value: ""
    value_type: secret
  features:
    file_upload:
      image:
        enabled: false
        number_limits: 3
        transfer_methods:
        - local_file
        - remote_url
    opening_statement: "全工事横断の経営分析・月次レポートを生成します。年月や質問をどうぞ。\n例: 2026-01の月次レポートを作成してください"
    retriever_resource:
      enabled: false
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions:
    - "今月の全工事レポートを出して"
    - "予算超過している工事はある？"
    - "コスト削減の提案をください"
    suggested_questions_after_answer:
      enabled: false
    text_to_speech:
      enabled: false
      language: ''
      voice: ''

  graph:
    edges:
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: start
        targetType: code
      id: edge-001
      source: '1000000001'
      sourceHandle: source
      target: '1000000002'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: code
        targetType: http-request
      id: edge-002
      source: '1000000002'
      sourceHandle: source
      target: '1000000003'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: code
        targetType: http-request
      id: edge-003
      source: '1000000002'
      sourceHandle: source
      target: '1000000004'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: http-request
        targetType: template-transform
      id: edge-004
      source: '1000000003'
      sourceHandle: source
      target: '1000000005'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: http-request
        targetType: template-transform
      id: edge-005
      source: '1000000004'
      sourceHandle: source
      target: '1000000005'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: template-transform
        targetType: llm
      id: edge-006
      source: '1000000005'
      sourceHandle: source
      target: '1000000006'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: answer
      id: edge-007
      source: '1000000006'
      sourceHandle: source
      target: '1000000007'
      targetHandle: target
      type: custom
      zIndex: 0

    nodes:
    - data:
        desc: 'ユーザーの質問を受け取る'
        selected: false
        title: "開始"
        type: start
        variables: []
      height: 90
      id: '1000000001'
      position:
        x: 80
        y: 282
      positionAbsolute:
        x: 80
        y: 282
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 244

    - data:
        code: |
          import re
          from datetime import datetime

          def main(user_input: str) -> dict:
              # 年月抽出 (YYYY-MM形式)
              year_month_match = re.search(r'\d{4}-\d{2}', user_input)
              if year_month_match:
                  year_month = year_month_match.group(0)
              else:
                  year_month = datetime.now().strftime('%Y-%m')

              return {
                  'year_month': year_month,
                  'original_query': user_input
              }
        code_language: python3
        desc: 'ユーザー入力から年月を正規表現で抽出。未指定時は当月を使用'
        outputs:
          year_month:
            children: null
            type: string
          original_query:
            children: null
            type: string
        selected: false
        title: "パラメータ抽出"
        type: code
        variables:
        - value_selector:
          - '1000000001'
          - sys.query
          variable: user_input
      height: 178
      id: '1000000002'
      position:
        x: 380
        y: 282
      positionAbsolute:
        x: 380
        y: 282
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 244

    - data:
        authorization:
          config: null
          type: no-auth
        body:
          data: ''
          type: none
        desc: 'GAS hub.gsに全工事横断サマリーデータをGETリクエストで照会'
        headers: ''
        method: get
        params: "mode:cross_summary\nyear_month:{{#1000000002.year_month#}}"
        selected: false
        timeout:
          connect: 60
          read: 60
          write: 60
        title: "横断サマリー取得"
        type: http-request
        url: '{{#env.GAS_HUB_URL#}}'
        variables: []
      height: 178
      id: '1000000003'
      position:
        x: 680
        y: 160
      positionAbsolute:
        x: 680
        y: 160
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 244

    - data:
        authorization:
          config: null
          type: no-auth
        body:
          data: ''
          type: none
        desc: 'GAS hub.gsに全工事横断予実健康度データをGETリクエストで照会'
        headers: ''
        method: get
        params: "mode:cross_health\nyear_month:{{#1000000002.year_month#}}"
        selected: false
        timeout:
          connect: 60
          read: 60
          write: 60
        title: "予実健康度取得"
        type: http-request
        url: '{{#env.GAS_HUB_URL#}}'
        variables: []
      height: 178
      id: '1000000004'
      position:
        x: 680
        y: 400
      positionAbsolute:
        x: 680
        y: 400
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 244

    - data:
        desc: 'サマリーデータと予実健康度データを結合してLLM入力用に整形'
        selected: false
        template: |
          # 月次予算管理データ（対象年月: {{year_month}}）

          ## 1. 全工事横断サマリー（cross_summary）
          {{summary_data}}

          ## 2. 予実健康度データ（cross_health）
          {{health_data}}
        title: "データ結合"
        type: template-transform
        variables:
        - value_selector:
          - '1000000002'
          - year_month
          variable: year_month
        - value_selector:
          - '1000000003'
          - body
          variable: summary_data
        - value_selector:
          - '1000000004'
          - body
          variable: health_data
      height: 178
      id: '1000000005'
      position:
        x: 980
        y: 282
      positionAbsolute:
        x: 980
        y: 282
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 244

    - data:
        context:
          enabled: false
          variable_selector: []
        desc: '経営コンサルタント視点で月次レポートまたは質問への回答を生成'
        edition_type: basic
        model:
          completion_params:
            temperature: 0.3
          mode: chat
          name: gpt-4o-mini
          provider: openai
        prompt_template:
        - id: 'e1f2a3b4-c5d6-7890-abcd-ef1234567001'
          role: system
          text: |
            あなたは建設業の経営コンサルタントです。
            (株)森組の全工事横断の予実管理データを分析し、経営層に向けた回答を生成してください。

            以下の2つのモードで動作します：

            【レポートモード】ユーザーが「レポート」「月次」「まとめ」等を要求した場合、5セクション構成のMarkdownレポートを生成：
            ## 1. 概要
            - 対象年月、工事件数、全体の予算消化状況サマリー
            ## 2. 消化率ランキング
            - 消化率上位・下位の工事を表形式で整理
            ## 3. 超過リスク工事
            - 予算超過または超過リスクのある工事を特定
            ## 4. 注意工事（信号: yellow/red）
            - 注意・超過信号の工事をリストアップし推奨対応を記載
            ## 5. 推奨アクション
            - 具体的な改善提案を優先度順に3件以上記載

            【質問回答モード】ユーザーが具体的な質問をした場合、データに基づいて簡潔に回答。

            共通ルール：
            - 数値は必ずGASデータから引用（推測しない）
            - 建設業特有の文脈（長期下請関係、季節変動等）を考慮
            - データがない場合はその旨を明記
            - 回答は箇条書きを活用し、簡潔にまとめる
        - id: 'e1f2a3b4-c5d6-7890-abcd-ef1234567002'
          role: user
          text: |
            ユーザーの質問: {{#1000000002.original_query#}}

            対象年月: {{#1000000002.year_month#}}

            GASから取得した全工事横断データ:
            {{#1000000005.output#}}

            上記データを基に回答してください。
        selected: false
        structured_output_enabled: false
        title: "経営分析"
        type: llm
        variables: []
        vision:
          enabled: false
      height: 298
      id: '1000000006'
      position:
        x: 1280
        y: 282
      positionAbsolute:
        x: 1280
        y: 282
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 244

    - data:
        answer: '{{#1000000006.text#}}'
        desc: 'LLMの回答を出力'
        selected: false
        title: "回答"
        type: answer
        variables: []
      height: 90
      id: '1000000007'
      position:
        x: 1580
        y: 282
      positionAbsolute:
        x: 1580
        y: 282
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 244

    viewport:
      x: 0
      y: 0
      zoom: 1
