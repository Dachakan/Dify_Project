# Skill 2: 品質基準表作成プロンプト

## 用途
Dify LLMノード「llm-quality-formatter」のプロンプト

## モデル設定
- Provider: Anthropic
- Model: claude-3-5-sonnet-20241022
- Temperature: 0.3

---

## User Prompt Template

以下の品質基準情報をMarkdown表形式に整形してください：

### 工事データ
{{ llm-design-analyzer.project_json }}

### 品質基準情報（Knowledge Baseから取得）
{{ kr-quality-criteria.result }}

---

## 出力形式

工種ごとに以下の形式で出力してください：

```markdown
## {工種名}

### 品質管理基準
| 試験項目 | 試験方法 | 試験頻度 | 規格値 |
|---------|---------|---------|--------|
| ... | ... | ... | ... |

### 出来形管理基準
| 測定項目 | 規格値 | 測定頻度 | 測定方法 |
|---------|--------|---------|---------|
| ... | ... | ... | ... |
```

### 注意事項
- 設計図書に記載の工種のみ出力
- Knowledge Baseに該当情報がない場合は「基準データなし」と記載
- プレースホルダー（○○、XXX等）は使用禁止
