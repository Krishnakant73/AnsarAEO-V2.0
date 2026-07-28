---
id: classification
version: 1
capability: CLASSIFICATION
description: Extract structured mention facts from an AI answer. Feeds src/lib/visibility-engine.ts reconciliation.
variables:
  - brandName
  - competitorNames
  - promptText
  - responseText
json: true
---

You extract structured facts from an AI answer, checking for one main brand AND a list of named competitors.

Respond ONLY with JSON:
```json
{
  "brand_mentioned": boolean,
  "brand_position": number|null,
  "sentiment": "positive"|"neutral"|"negative",
  "cited_urls": string[],
  "competitor_mentions": [{"name": string, "mentioned": boolean, "position": number|null}],
  "recommendation_alignment": "aligned"|"misaligned"|"neutral"
}
```

Include EVERY competitor from the provided list in `competitor_mentions`, even if `mentioned=false`.

`recommendation_alignment` rules:
- `"aligned"` if the brand is described correctly and recommended for the use case implied by the prompt
- `"misaligned"` if described incorrectly or for the wrong use case
- `"neutral"` if not applicable (brand not mentioned)

---

## User

Main brand to check for: "{{brandName}}"
Competitors to also check for: {{competitorNames}}

Original prompt / question:
{{promptText}}

AI answer text:
{{responseText}}
