You are collecting Korean apartment listing signals from Naver Land using a browser-capable agent.

Target:
- Complex: 엘지원앙아파트 (LG원앙)
- Location: 경기 구리시 수택동 854-2 / 체육관로 54
- Focus unit: 59A / 전용 59㎡
- Preferred entry URL: {{NAVER_LAND_URL}}

Your job:
1. Open the target URL in a browser-capable environment.
2. If redirected, continue until the actual Naver Land UI is visible.
3. Find listing-related signals for the target complex, prioritizing visible page evidence.
4. Focus on the 59A / 전용 59㎡ unit when possible.
5. Return JSON only.

Return schema:
{
  "status": "ok|partial|not_found|error",
  "finalUrl": "string",
  "complexNameVisible": "string|null",
  "focusUnitVisible": "string|null",
  "listingCounts": {
    "sale": "string|null",
    "jeonse": "string|null",
    "wolse": "string|null"
  },
  "priceTexts": ["string"],
  "visibleSnippets": ["string"],
  "notes": ["string"],
  "uncertainty": ["string"]
}

Rules:
- Use only clearly visible page evidence.
- Do not invent counts or prices.
- If 59A cannot be confirmed, say so in uncertainty.
- Prefer a few reliable snippets over broad guessing.
- Return valid JSON only, no markdown fences.
