app:
  description: "全工事横断の月次予算管理レポートをMarkdown形式で自動生成するワークフロー。cross_summary/cross_healthを並列取得し、5セクション構成のレポートを出力します。"
  icon: "\U0001F4C8"
  icon_background: '#E4FBCC'
  mode: workflow
  name: "月次予算管理レポート"
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
    opening_statement: ''
    retriever_resource:
      enabled: false
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions: []
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
        targetType: http-request
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
        sourceType: start
        targetType: http-request
      id: edge-002
      source: '1000000001'
      sourceHandle: source
      target: '1000000003'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: http-request
        targetType: template-transform
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
      target: '1000000004'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: template-transform
        targetType: llm
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
        sourceType: llm
        targetType: end
      id: edge-006
      source: '1000000005'
      sourceHandle: source
      target: '1000000006'
      targetHandle: target
      type: custom
      zIndex: 0

    nodes:
    - data:
        desc: '対象年月を受け取る（例: 2026-01）'
        selected: false
        title: "開始"
        type: start
        variables:
        - label: "対象年月"
          max_length: 7
          options: []
          required: true
          type: text-input
          variable: year_month
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
        authorization:
          config: null
          type: no-auth
        body:
          data: ''
          type: none
        desc: 'GAS hub.gsに全工事横断サマリーデータをGETリクエストで照会'
        headers: ''
        method: get
        params: "mode:cross_summary\nyear_month:{{#1000000001.year_month#}}"
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
      id: '1000000002'
      position:
        x: 380
        y: 160
      positionAbsolute:
        x: 380
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
        params: "mode:cross_health\nyear_month:{{#1000000001.year_month#}}"
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
      id: '1000000003'
      position:
        x: 380
        y: 400
      positionAbsolute:
        x: 380
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
          - '1000000001'
          - year_month
          variable: year_month
        - value_selector:
          - '1000000002'
          - body
          variable: summary_data
        - value_selector:
          - '1000000003'
          - body
          variable: health_data
      height: 178
      id: '1000000004'
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
        desc: '5セクション構成の月次Markdownレポートを生成'
        edition_type: basic
        model:
          completion_params:
            temperature: 0.3
          mode: chat
          name: gpt-4o-mini
          provider: openai
        prompt_template:
        - id: 'c3d4e5f6-a7b8-9012-cdef-123456789012'
          role: system
          text: |
            あなたは建設業の工事予算管理の専門家です。
            GASシステムから取得した全工事横断の予実管理データを分析し、
            以下の5セクション構成でMarkdown形式のレポートを生成してください。

            # レポート構成（必須）

            ## 1. 概要
            - 対象年月、工事件数、全体の予算消化状況サマリー

            ## 2. 消化率ランキング
            - 消化率上位・下位の工事を表形式で整理
            - 消化率の高低の評価コメント

            ## 3. 超過リスク工事
            - 予算超過または超過リスクのある工事を特定
            - 超過金額または予測超過金額を明示

            ## 4. 注意工事（信号: yellow/red）
            - yellowまたはred信号の工事をリストアップ
            - 各工事の状況と推奨対応を記載

            ## 5. 推奨アクション
            - 本月のデータに基づく具体的な改善提案
            - 優先度順に3件以上記載

            データがない場合や取得エラーの場合は、その旨を明確に記載してください。
        - id: 'd4e5f6a7-b8c9-0123-defa-234567890123'
          role: user
          text: |
            以下のデータを基に月次予算管理レポートを生成してください。

            {{#1000000004.output#}}

            上記データを分析し、5セクション構成のMarkdown形式レポートを出力してください。
        selected: false
        structured_output_enabled: false
        title: "レポート生成"
        type: llm
        variables: []
        vision:
          enabled: false
      height: 298
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
        desc: ''
        outputs:
        - value_selector:
          - '1000000005'
          - text
          variable: report
        selected: false
        title: "終了"
        type: end
      height: 90
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

    viewport:
      x: 0
      y: 0
      zoom: 1
