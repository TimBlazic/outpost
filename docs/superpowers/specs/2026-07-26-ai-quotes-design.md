# AI Quotes (Ponudbe) — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation  

**Approach:** B — Quote CRM module + AI draft wizard; PDF that is not invoice-looking

## Goal

After cold email → interest → discovery, produce a **personalized quote PDF** from lead context + Tim’s notes. Simple fixed-price line items (e.g. website €1200 + SEO €300), with AI-written intro and scope/phases. Looks like a proposal, not a račun.

## User flow (locked)

1. Cold outreach happens outside / via Resend (existing).
2. Lead replies interested; Tim asks clarifying questions (email/notes).
3. From lead (or Quotes list): **New quote**
4. Prefill recipient from lead; Tim adds **discovery notes** + optional price hints
5. Choose **SL / EN** → **Generate with AI**
6. AI fills intro, scope (phases), suggested line items, short notes/terms
7. Tim edits → Save draft → **Download PDF** and/or **Mark sent**
8. Optional later: Accepted / Declined (no auto invoice in v1)

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Persist | Yes — `quotes` table + list/detail |
| Numbering | `P-YY-NNNN` assigned on **Mark sent** |
| Statuses | `draft` \| `sent` \| `accepted` \| `declined` |
| Locale | User picks SL / EN at generate time (`locale` on quote) |
| Line items | Simple: description + amount (EUR); no tax/qty complexity in v1 |
| PDF | Proposal layout — **no** IBAN, due date, payable, payment block |
| AI | Anthropic (same stack as email/qualify); editable after generate |
| Email send of PDF | Out of scope v1 (download + send yourself) |
| Convert → invoice | Out of scope v1 |

## Data model

### `quotes`

| Column | Type | Notes |
|--------|------|--------|
| `id` | text/uuid | PK |
| `lead_id` | text | nullable FK → leads |
| `status` | text | draft / sent / accepted / declined |
| `locale` | text | `sl` \| `en` |
| `number` | text | nullable until sent; unique when set |
| `year` | int | nullable; for sequence |
| `sequence` | int | nullable |
| `client_name` | text | snapshot |
| `client_company` | text | nullable |
| `client_email` | text | nullable |
| `intro` | text | AI / edited |
| `scope` | text | AI / edited (phases, bullets) |
| `notes` | text | terms / exclusions / validity prose |
| `line_items` | jsonb | `{ description: string, amount: number }[]` |
| `currency` | text | default `EUR` |
| `subtotal` | numeric | sum of amounts |
| `total` | numeric | = subtotal in v1 |
| `valid_until` | date | nullable |
| `discovery_notes` | text | Tim’s input for AI (not necessarily on PDF) |
| `created_at` / `updated_at` | timestamptz | |
| `sent_at` | timestamptz | nullable |

Firm sequence: e.g. `firm_settings.quote_next_sequence_by_year` (mirror invoices) or dedicated counter.

Studio RLS: authenticated, same posture as invoices.

## AI generate

**Input:** lead company/contact/category/country/description/value, discovery notes, optional manual line hints, locale.

**Output (JSON):**
- `intro` — short personalized opening
- `scope` — phases / what’s included (markdown-ish plain text)
- `line_items` — `{ description, amount }[]` (respect Tim’s price hints if given)
- `notes` — validity, exclusions, next step
- `valid_until` suggestion (e.g. +14 days) optional

Regenerate overwrites AI fields but keeps Tim’s discovery notes; confirm if editor dirty.

## UI

- Nav: **Quotes** near Invoices
- `/quotes` list (status, client, total, number)
- `/quotes/new?leadId=` wizard/editor
- `/quotes/[id]` detail + Download PDF + status actions
- Lead detail: **New quote** CTA
- Command palette: Quotes / New quote

Editor sections: recipient · locale · discovery notes · Generate · intro · scope · line items · notes · valid until.

## PDF

Distinct from Harvey invoice PDF:

- Title: **Ponudba** / **Quote**
- Issuer: Tim Blažič / timblazic.dev (from firm settings where sensible)
- Recipient block
- Intro → Scope → Line items table → Total → Notes
- Number + date + valid until
- No payment/IBAN/due/payable copy

On-demand route: `/api/quotes/[id]/pdf`

## Mark sent

- Assign `P-YY-NNNN` if missing
- `status = sent`, `sent_at = now`
- Optional: lead activity `proposal` + if lead status before Proposal sent, suggest/set **Proposal sent** (or only activity — prefer activity + set status to Proposal sent when currently earlier in funnel)

## Out of scope (v1)

- Resend attachment of PDF
- E-signature / accept link in portal
- Quote → Invoice conversion
- VAT line breakdown
- Multi-currency

## Success

- From an interested lead, Tim produces a personalized SL/EN PDF in a few minutes
- PDF is clearly a quote, not an invoice
- Quotes are listed, numbered when sent, and tied to the lead

## Implementation notes

- Reuse Anthropic patterns from `src/lib/ai/email.ts`
- New: `src/lib/quotes/*`, migration, PDF with pdf-lib (separate renderer from invoices)
- Do not reuse invoice PDF template beyond shared font/helpers
