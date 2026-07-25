# Lead Qualify Pipeline — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation  

**Approach:** In-app Qualify wizard (A) with review gate; browser extension wave 2

## Goal

Collapse the cold-lead research loop into Outpost:

**Paste website URL → research (site + Lighthouse + Companywall + AI verdict) → review → save lead + cold email draft**

Today this is split across browser tabs, ChatGPT, and manual CRM entry. The existing **Generate email** feature stays; Qualify feeds it with a rich `description` and optional first draft.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Scope | Full pipeline (URL → research → qualify → draft) |
| Finance data | Best-effort Companywall scrape + paste fallback |
| Entry (v1) | In-app `/leads/qualify` |
| Entry (wave 2) | Bookmarklet / extension → same flow with `?url=` |
| After research | **Review gate** (edit → Save / Save+mail / Discard) |
| Lighthouse | PageSpeed Insights API (not self-hosted Chrome) |

## User flow (v1)

### Entry

- Leads list / nav: **Qualify URL**
- Command palette: “Qualify URL”
- Optional deep link: `/leads/qualify?url=https://…`

### Input

- Required: website URL  
- Optional: Companywall URL (skip search if provided)

### Pipeline progress (single page)

Shown as sequential steps (some work parallel under the hood):

1. **Fetch site** — title, meta description, text excerpt, emails/phones if present in HTML  
2. **Lighthouse (PSI)** — mobile scores: performance, SEO, accessibility, best-practices  
3. **Companywall** — match by company name / domain → scrape revenue, profit, year (or fail)  
4. **AI verdict** — `go` / `maybe` / `no-go` + short reasons + suggested lead fields  
5. **Cold email draft** — reuse existing AI email system prompt + qualify context

### Review gate

Editable fields (prefilled):

- company, website, contact, email, phone, country  
- category, estimated value  
- description (compiled research markdown)  
- email subject / body  

Scorecards (read-only + override where noted):

- Lighthouse scores (or “skipped”)  
- Companywall block (`ok` | `fail` | `skipped`) + paste override for URL / revenue / profit / year  
- AI verdict + reasons  

Actions:

- **Save lead** — create lead; status `Ready to contact` if verdict is `go`, else `Researching` (if `no-go`, suggest `Not suitable` but user can override before save)  
- **Save + open mail** — save + `mailto:` with draft  
- **Discard** — nothing persisted  
- **Revise email** — short note → regenerate draft only  

On save: activity “Qualified from URL”; description stores compiled research (site + Lighthouse + finance + AI notes). Draft may also be saved as a note (same pattern as Generate email).

## Architecture

```
UI /leads/qualify
    → qualifyLead(url, companywallUrl?)   // server action or POST /api/leads/qualify
        → fetchSite(url)
        → pageSpeed(url)          // parallel with fetch where possible
        → companywall(match|url)  // after name/domain known
        → aiVerdict(context)
        → aiColdDraft(context)    // existing AI email path
    → QualifyResult (not yet in DB)
UI review → createLead(...) / mailto / discard
```

### Auth

- Studio session only (`Admin` / `Member`). Not available on client host / Client role.

### `QualifyResult` (ephemeral)

```ts
type QualifyResult = {
  website: string;
  site: {
    title: string | null;
    description: string | null;
    excerpt: string;
    emails: string[];
    phones: string[];
  };
  lighthouse: {
    status: "ok" | "skipped" | "fail";
    performance?: number;
    seo?: number;
    accessibility?: number;
    bestPractices?: number;
    error?: string;
  };
  companywall: {
    status: "ok" | "skipped" | "fail";
    url?: string;
    matchedName?: string;
    revenue?: string;
    profit?: string;
    year?: string;
    error?: string;
  };
  verdict: {
    rating: "go" | "maybe" | "no-go";
    reasons: string[];
    notesMarkdown: string;
  };
  draft: { subject: string; body: string };
  suggested: {
    company: string;
    contact: string;
    email: string;
    phone: string;
    country: string;
    category: string; // existing Lead category union
    source: "Cold email";
    value: number | null;
    description: string; // full research markdown
    status: LeadStatus; // suggested default
  };
};
```

No new DB tables required for v1. Optional later: store qualify runs for history.

### Integrations

| Step | Implementation | Env |
|------|----------------|-----|
| Site fetch | Server `fetch` + HTML parse (cheerio or similar) | — |
| Lighthouse | Google PageSpeed Insights API v5 | `PAGESPEED_API_KEY` |
| Companywall | Best-effort HTML scrape of companywall.si | — |
| Verdict + draft | Anthropic (existing stack) | `ANTHROPIC_API_KEY` |

### Companywall strategy

1. If user pasted a Companywall URL → scrape that page.  
2. Else search/match by company name from site title / domain (best-effort).  
3. On failure → `status: "fail"`; review UI shows paste fields.  
4. Never block the rest of the pipeline on Companywall failure.

### Duplicate detection

Before/during review: if another lead already has the same normalized website host, show warning + link. User may still save.

## UI placement

- New route: `src/app/leads/qualify/page.tsx`  
- Wizard component: e.g. `src/components/lead-qualify-wizard.tsx`  
- Lib: `src/lib/qualify/*` (fetch, psi, companywall, orchestrate)  
- Leads index + command palette entry  
- Reuse AI email helpers where possible (`src/lib/ai/email.ts`)

## Error handling

| Failure | Behavior |
|---------|----------|
| Invalid URL | Block run |
| Site fetch fail | Partial result; user fills fields manually |
| PSI fail / no key | `lighthouse.skipped`; continue |
| Companywall fail | `companywall.fail` + paste override |
| AI fail | Show error; allow retry of AI steps only |
| Timeout | Soft timeouts per step; return partial QualifyResult |

## Out of scope (v1)

- Chrome extension UI (only prepare `?url=` deep link)  
- SMTP / Gmail send (mailto only)  
- Automated discovery (Instagram / Google ads scraping)  
- Guaranteed Companywall coverage for every Slovenian company  
- Storing full PSI JSON or HTML snapshots  
- Multi-URL batch qualify

## Wave 2 (documented, not built)

- Bookmarklet or lightweight extension: send current tab URL to `/leads/qualify?url=`  
- Same API; no parallel research engine

## Success criteria

- Typical run completes in ~30–45s end-to-end  
- Save creates a lead with research in `description` without retyping  
- Cold draft ready in the same session  
- Companywall/PSI failures degrade gracefully

## Manual test plan

1. SI marketing site with contacts + known Companywall page → full happy path → Save + open mail  
2. Site with no Companywall match → paste finance → Save  
3. Duplicate website → warning shown  
4. Missing `PAGESPEED_API_KEY` → Lighthouse skipped, rest works  
5. AI `no-go` → can Discard or save as Not suitable  

## Open notes

- Exact Companywall HTML selectors TBD during implementation (fragile; isolate in one module).  
- Verdict prompt should bias toward website-redesign / new-site studio fit (SI market), aligned with existing cold-email voice in Settings → AI.
