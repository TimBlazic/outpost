# Lead Qualify Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a website URL in Outpost, run site + PageSpeed + Companywall + AI research, review the result, then save a lead and open a cold-email draft without retyping.

**Architecture:** Server-side orchestrator in `src/lib/qualify/*` returns an ephemeral `QualifyResult`. Client wizard at `/leads/qualify` shows progress + review gate. Save uses existing `createLead` / `addActivity` / `addNote`. Lighthouse via PageSpeed Insights API; Companywall best-effort scrape with paste fallback.

**Tech Stack:** Next.js App Router, Anthropic (existing), PageSpeed Insights API, `cheerio` for HTML parse, existing lead CRM actions.

**Spec:** `docs/superpowers/specs/2026-07-26-lead-qualify-pipeline-design.md`

## Global Constraints

- Studio-only (`requireStudioSession`); never expose on client host
- No new DB tables in v1
- Companywall / PSI failures must not abort the pipeline
- Review gate before any persist
- Mailto only — no SMTP
- Do not commit unless the user explicitly asks
- Read Next.js docs under `node_modules/next/dist/docs/` before new App Router APIs
- Add `PAGESPEED_API_KEY` to `.env.local` (optional; skip Lighthouse if missing)

## File map

| Path | Responsibility |
|------|----------------|
| `src/lib/qualify/types.ts` | `QualifyResult` and step status types |
| `src/lib/qualify/url.ts` | Normalize URL, extract host, duplicate host match |
| `src/lib/qualify/research-markdown.ts` | Compile description markdown from steps |
| `src/lib/qualify/fetch-site.ts` | Fetch HTML + extract title/meta/contacts/excerpt |
| `src/lib/qualify/pagespeed.ts` | PSI v5 mobile scores |
| `src/lib/qualify/companywall.ts` | Match + scrape (or fail) |
| `src/lib/qualify/verdict.ts` | Claude go/maybe/no-go + suggested fields |
| `src/lib/qualify/orchestrate.ts` | Run pipeline, assemble `QualifyResult` |
| `src/lib/qualify/actions.ts` | Server actions: `runLeadQualify`, `reviseQualifyDraft`, `saveQualifiedLead` |
| `src/components/lead-qualify-wizard.tsx` | Input → progress → review UI |
| `src/app/leads/qualify/page.tsx` | Route + `?url=` deep link |
| `src/app/leads/page.tsx` | “Qualify URL” button |
| `src/components/command-palette.tsx` | Palette action |
| `docs/SETUP-SUPABASE.md` or env docs | Document `PAGESPEED_API_KEY` |
| `package.json` | Add `cheerio` (+ `@types` if needed) |

---

### Task 1: Types + URL helpers + research markdown

**Files:**
- Create: `src/lib/qualify/types.ts`
- Create: `src/lib/qualify/url.ts`
- Create: `src/lib/qualify/research-markdown.ts`

**Interfaces:**
- Produces: `QualifyResult`, `normalizeWebsiteUrl(input: string): string`, `websiteHost(url: string): string`, `findLeadIdByWebsiteHost(leads, host): string | null`, `compileResearchMarkdown(parts): string`

- [ ] **Step 1: Add types**

```ts
// src/lib/qualify/types.ts
import type { Lead, LeadStatus } from "@/lib/data";

export type QualifyRating = "go" | "maybe" | "no-go";

export type QualifyResult = {
  website: string;
  site: {
    title: string | null;
    description: string | null;
    excerpt: string;
    emails: string[];
    phones: string[];
    error?: string;
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
    rating: QualifyRating;
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
    category: Lead["category"];
    source: "Cold email";
    value: number;
    description: string;
    status: LeadStatus;
  };
  duplicateLeadId: string | null;
};
```

- [ ] **Step 2: URL helpers**

```ts
// src/lib/qualify/url.ts
export function normalizeWebsiteUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("Website URL is required");
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const u = new URL(withProtocol);
  if (!u.hostname.includes(".")) throw new Error("Invalid website URL");
  u.hash = "";
  return u.toString().replace(/\/$/, "") || u.origin;
}

export function websiteHost(url: string): string {
  return new URL(normalizeWebsiteUrl(url)).hostname.replace(/^www\./i, "").toLowerCase();
}

export function findLeadIdByWebsiteHost(
  leads: { id: string; website: string }[],
  host: string
): string | null {
  const target = host.replace(/^www\./i, "").toLowerCase();
  for (const lead of leads) {
    if (!lead.website?.trim()) continue;
    try {
      if (websiteHost(lead.website) === target) return lead.id;
    } catch {
      /* ignore bad stored urls */
    }
  }
  return null;
}
```

- [ ] **Step 3: Research markdown compiler**

Build a function that concatenates sections: Site, Lighthouse, Companywall, AI notes into markdown used as `suggested.description`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`  
Expected: PASS (or only unrelated errors)

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/lib/qualify/types.ts src/lib/qualify/url.ts src/lib/qualify/research-markdown.ts
git commit -m "Add qualify pipeline types and URL helpers."
```

---

### Task 2: Site fetch

**Files:**
- Modify: `package.json` / `package-lock.json` — add `cheerio`
- Create: `src/lib/qualify/fetch-site.ts`

**Interfaces:**
- Consumes: `normalizeWebsiteUrl`
- Produces: `fetchSite(url: string): Promise<QualifyResult["site"]>`

- [ ] **Step 1: Install cheerio**

```bash
npm install cheerio
```

- [ ] **Step 2: Implement fetch + parse**

```ts
// src/lib/qualify/fetch-site.ts
import * as cheerio from "cheerio";
import { normalizeWebsiteUrl } from "./url";

const TIMEOUT_MS = 15_000;

export async function fetchSite(url: string): Promise<{
  title: string | null;
  description: string | null;
  excerpt: string;
  emails: string[];
  phones: string[];
  error?: string;
}> {
  const target = normalizeWebsiteUrl(url);
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "OutpostQualify/1.0 (+https://outpost.local)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return emptySite(`Fetch failed (${res.status})`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    const title = $("title").first().text().trim() || null;
    const description =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      null;
    const text = $("body").text().replace(/\s+/g, " ").trim();
    const excerpt = text.slice(0, 1200);
    const emails = [...new Set(html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])]
      .filter((e) => !/\.(png|jpg|gif|svg|webp)$/i.test(e))
      .slice(0, 8);
    const phones = [...new Set(text.match(/(?:\+|0)\d[\d\s/-]{6,}\d/g) ?? [])]
      .map((p) => p.replace(/\s+/g, " ").trim())
      .slice(0, 6);
    return { title, description, excerpt, emails, phones };
  } catch (e) {
    return emptySite(e instanceof Error ? e.message : "Fetch failed");
  }
}

function emptySite(error: string) {
  return {
    title: null,
    description: null,
    excerpt: "",
    emails: [] as string[],
    phones: [] as string[],
    error,
  };
}
```

- [ ] **Step 3: Smoke-test against a public URL** (optional local)

Run a quick `npx tsx` one-liner importing `fetchSite("https://example.com")` and confirm title/excerpt non-empty.

- [ ] **Step 4: Commit** (only if user asked)

---

### Task 3: PageSpeed Insights

**Files:**
- Create: `src/lib/qualify/pagespeed.ts`
- Modify: `docs/SETUP-SUPABASE.md` (or project env section) — document `PAGESPEED_API_KEY`

**Interfaces:**
- Produces: `runPageSpeed(url: string): Promise<QualifyResult["lighthouse"]>`

- [ ] **Step 1: Implement PSI client**

```ts
// src/lib/qualify/pagespeed.ts
export async function runPageSpeed(url: string): Promise<{
  status: "ok" | "skipped" | "fail";
  performance?: number;
  seo?: number;
  accessibility?: number;
  bestPractices?: number;
  error?: string;
}> {
  const key = process.env.PAGESPEED_API_KEY?.trim();
  if (!key) {
    return { status: "skipped", error: "PAGESPEED_API_KEY not set" };
  }
  try {
    const endpoint = new URL(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    );
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", "mobile");
    endpoint.searchParams.set("key", key);
    for (const cat of ["performance", "seo", "accessibility", "best-practices"]) {
      endpoint.searchParams.append("category", cat);
    }
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: "fail", error: `PSI HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number | null }>;
      };
    };
    const cats = data.lighthouseResult?.categories ?? {};
    const score = (id: string) => {
      const s = cats[id]?.score;
      return typeof s === "number" ? Math.round(s * 100) : undefined;
    };
    return {
      status: "ok",
      performance: score("performance"),
      seo: score("seo"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
    };
  } catch (e) {
    return {
      status: "fail",
      error: e instanceof Error ? e.message : "PSI failed",
    };
  }
}
```

- [ ] **Step 2: Document env key** in SETUP docs (one line under env vars).

- [ ] **Step 3: Commit** (only if user asked)

---

### Task 4: Companywall best-effort scrape

**Files:**
- Create: `src/lib/qualify/companywall.ts`

**Interfaces:**
- Produces: `lookupCompanywall(input: { companyName: string; domain: string; companywallUrl?: string | null }): Promise<QualifyResult["companywall"]>`

- [ ] **Step 1: Implement scrape module**

Behavior:
1. If `companywallUrl` provided and looks like `companywall.si` → `scrapeCompanyPage(url)`.
2. Else try search: `https://www.companywall.si/iskanje?q=` + encodeURIComponent(companyName or domain) — parse first `/podjetje/` link (cheerio). If none → `{ status: "fail", error: "No match" }`.
3. Scrape company page for revenue / profit / year using flexible text regexes (SI labels like “Prihodki”, “Čisti dobiček”, years). Isolate selectors in this file only.
4. Never throw — always return `ok` | `fail` | `skipped`.
5. Timeout 15s per request; User-Agent header set.

```ts
export async function lookupCompanywall(input: {
  companyName: string;
  domain: string;
  companywallUrl?: string | null;
}): Promise<QualifyResult["companywall"]> {
  // implement as above; on any error return { status: "fail", error }
}
```

- [ ] **Step 2: Manual check** with one known Companywall company URL (paste URL path) — expect `status: "ok"` or documented fail reason.

- [ ] **Step 3: Commit** (only if user asked)

---

### Task 5: AI verdict + qualify draft

**Files:**
- Create: `src/lib/qualify/verdict.ts`
- Modify: `src/lib/ai/email.ts` if needed — allow generating from a synthetic `Lead` (already accepts `lead: Lead`; qualify builds a temporary object)

**Interfaces:**
- Produces: `runQualifyVerdict(ctx): Promise<{ verdict; suggestedPartial }>`
- Produces: `runQualifyDraft(ctx): Promise<{ subject; body }>` using `generateLeadEmail` with synthetic lead + intent `"cold"`

- [ ] **Step 1: Verdict prompt**

Call Anthropic with JSON schema response:

```json
{
  "rating": "go" | "maybe" | "no-go",
  "reasons": ["...", "..."],
  "notesMarkdown": "...",
  "company": "...",
  "contact": "",
  "email": "",
  "phone": "",
  "country": "Slovenia",
  "category": "Local business",
  "value": 0
}
```

System prompt bias: SI website redesign / new site studio fit; use Lighthouse + finance + site excerpt. Category must be one of existing `leadCategories`.

- [ ] **Step 2: Map rating → suggested status**

- `go` → `Ready to contact`  
- `maybe` → `Researching`  
- `no-go` → `Not suitable`

- [ ] **Step 3: Draft via existing generator**

Build synthetic `Lead` from suggested fields + description, `activities: []`, then:

```ts
await generateLeadEmail({
  lead: synthetic,
  intent: "cold",
  brief: "Cold outreach after website + Companywall research.",
  activities: [],
  settings,
  senderName,
});
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 6: Orchestrator + server actions

**Files:**
- Create: `src/lib/qualify/orchestrate.ts`
- Create: `src/lib/qualify/actions.ts`

**Interfaces:**
- Consumes: fetchSite, runPageSpeed, lookupCompanywall, verdict, draft, compileResearchMarkdown, findLeadIdByWebsiteHost
- Produces:
  - `runLeadQualifyAction(input: { websiteUrl: string; companywallUrl?: string }): Promise<QualifyResult>`
  - `reviseQualifyDraftAction(input: { result: QualifyResult; revisionNotes: string }): Promise<{ subject: string; body: string }>`
  - `saveQualifiedLeadAction(input: { form: SaveForm; draft: { subject; body }; saveNote: boolean }): Promise<{ leadId: string }>`

- [ ] **Step 1: Orchestrate**

```ts
export async function qualifyLead(input: {
  websiteUrl: string;
  companywallUrl?: string | null;
}): Promise<QualifyResult> {
  await requireStudioSession();
  const website = normalizeWebsiteUrl(input.websiteUrl);
  const host = websiteHost(website);

  const [site, lighthouse, leads] = await Promise.all([
    fetchSite(website),
    runPageSpeed(website),
    getLeads(),
  ]);

  const companyGuess =
    site.title?.split(/[|\-–]/)[0]?.trim() || host;

  const companywall = await lookupCompanywall({
    companyName: companyGuess,
    domain: host,
    companywallUrl: input.companywallUrl,
  });

  const ai = await runQualifyVerdict({ website, site, lighthouse, companywall });
  const description = compileResearchMarkdown({
    website,
    site,
    lighthouse,
    companywall,
    verdict: ai.verdict,
  });

  const suggested = {
    ...ai.suggested,
    source: "Cold email" as const,
    description,
  };

  const draft = await runQualifyDraft({ suggested, settings, senderName });

  return {
    website,
    site,
    lighthouse,
    companywall,
    verdict: ai.verdict,
    draft,
    suggested,
    duplicateLeadId: findLeadIdByWebsiteHost(leads, host),
  };
}
```

- [ ] **Step 2: Save action**

```ts
export async function saveQualifiedLeadAction(input: {
  company: string;
  website: string;
  contact: string;
  email: string;
  phone: string;
  country: string;
  category: Lead["category"];
  status: LeadStatus;
  value: number;
  description: string;
  draftSubject: string;
  draftBody: string;
  saveDraftNote: boolean;
}) {
  const me = await requireStudioSession();
  const leadId = await createLead({
    company: input.company,
    website: input.website,
    contact: input.contact,
    email: input.email,
    phone: input.phone,
    country: input.country,
    category: input.category,
    source: "Cold email",
    ownerId: me.id,
    status: input.status,
    value: input.value,
    probability: input.status === "Ready to contact" ? 30 : 15,
    nextFollowUp: null,
    tags: ["qualified"],
    description: input.description,
  });
  await addActivity(leadId, {
    type: "note",
    title: "Qualified from URL",
    detail: input.website,
  });
  if (input.saveDraftNote && input.draftBody.trim()) {
    await addNote(leadId, {
      title: input.draftSubject || "Cold email draft",
      body: input.draftBody,
      pinned: false,
    });
  }
  return { leadId };
}
```

Check `ActivityType` union — if `"note"` is invalid, use the closest existing type (e.g. `"status"` or `"email"`) that fits.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit** (only if user asked)

---

### Task 7: Qualify wizard UI

**Files:**
- Create: `src/components/lead-qualify-wizard.tsx`

**Interfaces:**
- Consumes: `runLeadQualifyAction`, `reviseQualifyDraftAction`, `saveQualifiedLeadAction`
- Props: `{ initialUrl?: string }`

- [ ] **Step 1: Build wizard states**

States: `idle` | `running` | `review` | `saving`  
Running: show step list (Site / Lighthouse / Companywall / Verdict / Draft) — can be optimistic sequential labels while awaiting single action.

- [ ] **Step 2: Input form**

- Website URL (required)  
- Companywall URL (optional)  
- Run research button  

- [ ] **Step 3: Review layout**

Left / main: editable fields (company, website, contact, email, phone, country, category select from `leadCategories`, value, status select, description textarea).  
Side / cards: Lighthouse scores, Companywall (with paste overrides that update local state + description), AI verdict badges.  
Draft: subject + body textareas + Revise (revision notes → `reviseQualifyDraftAction`).

Duplicate banner: if `duplicateLeadId`, link to `/leads/[id]`.

Actions:
- Discard → reset to idle  
- Save lead → `saveQualifiedLeadAction` → `router.push(/leads/${id})`  
- Save + open mail → save → `window.location.href = mailto:...` (encode subject/body) then navigate to lead

- [ ] **Step 4: Visual pass** — match studio app shell (no purple AI aesthetic); use existing Button/Input/Label/Textarea/Card.

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 8: Route, nav, command palette, deep link

**Files:**
- Create: `src/app/leads/qualify/page.tsx`
- Modify: `src/app/leads/page.tsx` — add Qualify button next to New lead
- Modify: `src/components/command-palette.tsx` — add “Qualify URL” action → `/leads/qualify`
- Modify: `src/components/app-shell.tsx` only if a nav entry is desired (optional; button on Leads is enough)

- [ ] **Step 1: Page**

```tsx
// src/app/leads/qualify/page.tsx
import { LeadQualifyWizard } from "@/components/lead-qualify-wizard";
import { PageHeader } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function QualifyLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Qualify URL"
        description="Research a site, check fit, draft a cold email — then save."
      />
      <LeadQualifyWizard initialUrl={url ?? ""} />
    </div>
  );
}
```

- [ ] **Step 2: Leads header button** → `/leads/qualify` (variant outline, label “Qualify URL”).

- [ ] **Step 3: Command palette** entry in `STATIC_ACTIONS`:

```ts
{
  id: "qualify-url",
  title: "Qualify URL",
  subtitle: "Research site → lead + cold email",
  href: "/leads/qualify",
  icon: Sparkles, // or Search — reuse an imported lucide icon
  section: "Create",
}
```

- [ ] **Step 4: Manual navigation check** — `/leads/qualify?url=https://example.com` prefills input.

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 9: Docs + end-to-end manual QA

**Files:**
- Modify: `docs/SETUP-SUPABASE.md` (env: `PAGESPEED_API_KEY`)
- Modify: `docs/superpowers/specs/2026-07-26-lead-qualify-pipeline-design.md` — ensure Status remains Approved

- [ ] **Step 1: Document env**

```
PAGESPEED_API_KEY=   # optional; Google PageSpeed Insights for Qualify pipeline
```

- [ ] **Step 2: Manual QA checklist**

1. Happy path SI site + Companywall URL → review → Save + open mail  
2. No Companywall → paste revenue/profit → Save  
3. Duplicate host → warning + link  
4. No `PAGESPEED_API_KEY` → Lighthouse skipped  
5. AI no-go → status defaults Not suitable; Discard works  

- [ ] **Step 3: `npx tsc --noEmit`** — PASS

- [ ] **Step 4: Commit** (only if user asked)

```bash
git add docs src package.json package-lock.json
git commit -m "Add lead qualify pipeline from URL to review and save."
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| `/leads/qualify` + `?url=` | 8 |
| Fetch site | 2 |
| PSI Lighthouse | 3 |
| Companywall scrape + paste fallback | 4, 7 |
| AI verdict + cold draft | 5 |
| Review gate + save/mailto/discard/revise | 7, 6 |
| Duplicate warning | 1, 6, 7 |
| Studio auth | 6 |
| No DB migration | — |
| Wave 2 extension | out of scope (deep link only) |
| SETUP env docs | 3, 9 |

## Placeholder scan

None intentional. Companywall selectors live only in Task 4 module (implementation detail, not TBD in other tasks).
