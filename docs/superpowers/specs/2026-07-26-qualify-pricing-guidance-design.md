# Qualify pricing guidance (Settings)

## Goal

Let the studio edit a short pricing note in Settings so AI lead qualify suggests deal values that match current SI solo rates and site complexity — without hardcoded band lists in the qualify prompt, and without per-service price inputs.

## User story

As the studio owner, I want to tweak an approximate pricing note in Settings whenever my rates shift, so qualify stops proposing agency-sized values while still scaling by how complex the site/job looks.

## Design

### Settings UI (AI tab)

- Add textarea **Qualify pricing guidance**, below the existing AI email system prompt.
- Same save pattern as `aiEmailSystemPrompt`: store empty in DB when equal to the built-in default (so defaults can evolve in code); show default in the form when empty.
- Helper copy: used only for AI qualify deal `value` estimates; scale by complexity; Slovenia / solo studio context.

### Default guidance text (app constant)

Something in this spirit (exact wording can be tuned in code):

- Price by site/job complexity for a Slovenia solo studio — not US/EU agency rates.
- Simple marketing site (few pages, no heavy features): roughly 500–1000 EUR.
- Mid (more pages + a light feature): roughly 1000–2500 EUR.
- Complex / more features (admin, booking, e-com, etc.): higher within a still-realistic solo band; prefer round numbers.
- Always set a realistic `value` when rating is go or maybe (not 0).

### Data

- Migration: `firm_settings.ai_qualify_pricing_prompt text not null default ''`.
- `FirmSettings.aiQualifyPricingPrompt: string` (+ normalize / save / load in Supabase mapper).

### Qualify prompt (`verdict.ts`)

- Remove the hardcoded Pricing bullet list (local 1200–3500 / SaaS 2500–6000 / 8k cap language).
- Keep a short fixed instruction: estimate EUR `value` from complexity + studio pricing guidance below; SI-realistic; not agency rates; go/maybe must have non-zero value when possible.
- Append the resolved guidance string (settings trim, else default constant).
- Pass `pricingGuidance` (or full settings) into `runQualifyVerdict` from `qualifyLead` / requalify paths that already load firm settings.

### Safety clamp (keep)

- Keep `clampSlValue` / `clampSloveniaDealValue` as a hard ceiling so a bad model output cannot write absurd values.
- Align ceilings loosely with guidance (e.g. min ~500, localish max ~4500, other max ~8000) — clamps are a backstop, not the primary pricing source.

## Out of scope

- Structured min/max inputs per service or add-on.
- Changing AI email prompt behavior.
- Changing fit score / rating logic unrelated to `value`.

## Acceptance

1. Settings → AI shows editable qualify pricing guidance; save persists.
2. Qualify (manual + background jobs) uses that text in the verdict system prompt.
3. Empty settings field falls back to the built-in default.
4. Hardcoded SI band bullets are gone from the qualify system prompt.
5. Absurd high values still get clamped on apply.
