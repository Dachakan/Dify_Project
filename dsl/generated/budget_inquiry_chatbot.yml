app:
  description: "GAS hub.gsと連携して工事予算の予実状況を照会するチャットボット。工事IDと年月を自然言語で入力すると、消化率・出来高率・信号を日本語で解説します。"
  icon: "\U0001F4CA"
  icon_background: '#FFEAD5'
  mode: advanced-chat
  name: "予実照会チャットボット"
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
    opening_statement: "工事予算の予実状況を照会します。工事IDと年月を教えてください。\n例: P004の今月の状況を教えてください"
    retriever_resource:
      enabled: false
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions:
    - "P004の今月の状況を教えてください"
    - "全工事の2026-01の予実状況は？"
    - "P001の予算消化状況を確認したい"
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
        sourceType: http-request
        targetType: llm
      id: edge-003
      source: '1000000003'
      sourceHandle: source
      target: '1000000004'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: answer
      id: edge-004
      source: '1000000004'
      sourceHandle: source
      target: '1000000005'
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
              # 工事ID抽出 (P[0-9]+形式)
              project_match = re.search(r'P\d+', user_input)
              project_id = project_match.group(0) if project_match else 'all'

              # 年月抽出 (YYYY-MM形式)
              year_month_match = re.search(r'\d{4}-\d{2}', user_input)
              if year_month_match:
                  year_month = year_month_match.group(0)
              else:
                  year_month = datetime.now().strftime('%Y-%m')

              return {
                  'project_id': project_id,
                  'year_month': year_month,
                  'original_query': user_input
              }
        code_language: python3
        desc: 'ユーザー入力から工事IDと年月を正規表現で抽出。未指定時はall/当月を使用'
        outputs:
          project_id:
            children: null
            type: string
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
        desc: 'GAS hub.gsに予実データをGETリクエストで照会'
        headers: ''
        method: get
        params: "mode:cross_health\nproject_id:{{#1000000002.project_id#}}\nyear_month:{{#1000000002.year_month#}}"
        selected: false
        timeout:
          connect: 60
          read: 60
          write: 60
        title: "GAS予実照会"
        type: http-request
        url: '{{#env.GAS_HUB_URL#}}'
        variables: []
      height: 178
      id: '1000000003'
      position:
        x: 680
        y: 282
      positionAbsolute:
        x: 680
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
        desc: '予実データを消化率・出来高率・信号ごとに日本語で解説'
        edition_type: basic
        model:
          completion_params:
            temperature: 0.3
          mode: chat
          name: gpt-4o-mini
          provider: openai
        prompt_template:
        - id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
          role: system
          text: |
            あなたは工事予算管理の専門家です。
            GASシステムから取得した予実管理データを、現場担当者にわかりやすく日本語で解説してください。

            以下の点を必ず説明してください：
            1. 消化率（支払実績/実行予算）の現状と評価
            2. 出来高率（工事進捗に対する支払いバランス）の現状と評価
            3. 信号ステータス（green/yellow/red）の意味と必要な対応
            4. 超過リスクや注意事項があれば具体的に指摘

            データがない場合や取得エラーの場合は、その旨を明確に伝えてください。
            回答は箇条書きを活用し、簡潔にまとめてください。
        - id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
          role: user
          text: |
            ユーザーの質問: {{#1000000002.original_query#}}

            照会した工事ID: {{#1000000002.project_id#}}
            対象年月: {{#1000000002.year_month#}}

            GASから取得した予実データ:
            {{#1000000003.body#}}

            上記データを基に、予実状況を日本語でわかりやすく解説してください。
        selected: false
        structured_output_enabled: false
        title: "予実解説"
        type: llm
        variables: []
        vision:
          enabled: false
      height: 298
      id: '1000000004'
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
        answer: '{{#1000000004.text#}}'
        desc: 'LLMの解説を回答として出力'
        selected: false
        title: "回答"
        type: answer
        variables: []
      height: 90
      id: '1000000005'
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

    viewport:
      x: 0
      y: 0
      zoom: 1
