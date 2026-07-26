/** Built-in qualify pricing guidance when Settings field is empty. */
export const DEFAULT_AI_QUALIFY_PRICING_PROMPT = `Price EUR for a Slovenia solo studio. Most leads are SMALL jobs — default LOW, not mid-agency.

Default assumption: simple marketing site / redesign → 500–1200 EUR.
- Few pages, brochure/local business, WordPress refresh, no custom backend: 500–1000
- A bit more pages OR one light feature (forms, basic booking widget, blog): 1000–1800
- Only go 1800–2500 if several pages + a real feature (booking flow, newsletter setup, light admin)
- Above 2500 ONLY with clear evidence of custom admin, e-commerce, or multi-feature app work — still usually ≤3500 for solo SI
- Almost never above 3500

Prefer round numbers: 700, 900, 1200, 1500, 1800, 2200.
If unsure between two bands, pick the LOWER one.
Always set a value when rating is go or maybe (not 0).`;
