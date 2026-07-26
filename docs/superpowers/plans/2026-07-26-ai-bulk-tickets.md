# AI Bulk Tickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let studio users generate a draft ticket list with AI, refine it in a Qualify-style fullscreen dialog (checkbox + edit + follow-up prompt), then bulk-create only the checked rows.

**Architecture:** Pure Anthropic helper builds JSON drafts from project context + existing titles + optional instruction. Server actions load context / persist bulk creates. Client dialog owns draft state, merge on refine, and calls create. UI entry sits next to New ticket in `TicketsPanel`.

**Tech Stack:** Next.js App Router, Anthropic SDK (`ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`), existing `createTicket` persistence patterns, Dialog shell from `lead-qualify-dialog.tsx`.

## Global Constraints

- Always preview before write — never create tickets on generate alone
- Create only checked drafts with non-empty titles
- Avoid duplicating existing board ticket titles
- Defaults on create: `status: "Todo"`, `assigneeKind: "studio"`, `assigneeId: null`, `dueAt: null`
- Provider: Anthropic only (same as quotes)
- Do not commit unless the user explicitly asks
- Read Next.js docs under `node_modules/next/dist/docs/` before new App Router APIs

## File map

| Path | Responsibility |
|------|----------------|
| `src/lib/tickets/ai.ts` | `generateTicketDrafts`, parse/normalize JSON, prompt |
| `src/lib/tickets/draft-merge.ts` | Client-safe merge of AI response into editable drafts |
| `src/lib/tickets/actions.ts` | `generateProjectTicketsAction`, `createTicketsBulkAction` |
| `src/components/generate-tickets-dialog.tsx` | Fullscreen dialog + review UI + prompt bar |
| `src/components/tickets-panel.tsx` | **Generate tickets** button + mount dialog |
| `src/components/project-workspace.tsx` | Pass `project` into `TicketsPanel` |
| `src/lib/delivery/templates.ts` | Reuse `phasesForProjectType` (or existing export) as soft AI hints |

---

### Task 1: AI draft generator + merge helper

**Files:**
- Create: `src/lib/tickets/ai.ts`
- Create: `src/lib/tickets/draft-merge.ts`
- Modify: `src/lib/delivery/templates.ts` only if a public helper for phase checklist titles is missing (prefer calling existing export)

**Interfaces:**
- Produces:
```ts
export type TicketAiDraft = { title: string; description: string };

export type GenerateTicketDraftsInput = {
  project: {
    name: string;
    type: string;
    description: string;
    phase: string;
    status: string;
    client: string;
  };
  existingTitles: string[];
  instruction?: string | null;
  phaseHints?: string[]; // e.g. delivery checklist titles
};

export async function generateTicketDrafts(
  input: GenerateTicketDraftsInput
): Promise<TicketAiDraft[]>;

export type EditableTicketDraft = {
  id: string; // client uuid for React keys
  title: string;
  description: string;
  checked: boolean;
  dirty: boolean; // user edited title/description
};

export function mergeTicketDrafts(opts: {
  current: EditableTicketDraft[];
  incoming: TicketAiDraft[];
  newId: () => string;
}): EditableTicketDraft[];
```

- [ ] **Step 1: Implement `src/lib/tickets/ai.ts`**

Mirror `src/lib/quotes/ai.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";

export type TicketAiDraft = { title: string; description: string };

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function stripFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseTicketDrafts(text: string): TicketAiDraft[] {
  const parsed = JSON.parse(stripFence(text)) as {
    tickets?: Array<{ title?: string; description?: string }>;
  };
  const tickets = (parsed.tickets ?? [])
    .map((t) => ({
      title: String(t.title ?? "").trim(),
      description: String(t.description ?? "").trim(),
    }))
    .filter((t) => t.title.length > 0);
  if (!tickets.length) throw new Error("AI returned no tickets");
  return tickets.slice(0, 20);
}

export async function generateTicketDrafts(input: {
  project: {
    name: string;
    type: string;
    description: string;
    phase: string;
    status: string;
    client: string;
  };
  existingTitles: string[];
  instruction?: string | null;
  phaseHints?: string[];
}): Promise<TicketAiDraft[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });
  const existing = input.existingTitles.filter(Boolean);
  const hints = input.phaseHints?.filter(Boolean) ?? [];
  const instruction = input.instruction?.trim() || "";

  const system = `You help a small studio plan project tickets.
Return ONLY valid JSON: {"tickets":[{"title":string,"description":string}]}
Rules:
- 6–12 tickets when board is empty; fewer (3–8) when filling gaps
- Concrete, actionable titles; short descriptions (1–3 sentences)
- Do NOT duplicate or rephrase existingTitles
- Prefer studio delivery work over fluff meetings
- Match language of project description when clear; else English
- No markdown fences outside JSON`;

  const user = JSON.stringify({
    project: input.project,
    existingTitles: existing,
    phaseHints: hints,
    instruction: instruction || null,
    mode: instruction
      ? "refine_or_extend_based_on_instruction"
      : existing.length
        ? "fill_gaps"
        : "kickoff",
  });

  const res = await client.messages.create({
    model: modelId(),
    max_tokens: 2500,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseTicketDrafts(text);
}
```

- [ ] **Step 2: Implement `src/lib/tickets/draft-merge.ts`**

```ts
import type { TicketAiDraft } from "@/lib/tickets/ai";

export type EditableTicketDraft = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  dirty: boolean;
};

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mergeTicketDrafts(opts: {
  current: EditableTicketDraft[];
  incoming: TicketAiDraft[];
  newId: () => string;
}): EditableTicketDraft[] {
  const kept = opts.current.filter((d) => d.dirty || (d.checked && d.title.trim()));
  const keptNorm = new Set(kept.map((d) => norm(d.title)).filter(Boolean));
  const added: EditableTicketDraft[] = [];
  for (const t of opts.incoming) {
    const n = norm(t.title);
    if (!n || keptNorm.has(n)) continue;
    keptNorm.add(n);
    added.push({
      id: opts.newId(),
      title: t.title,
      description: t.description,
      checked: true,
      dirty: false,
    });
  }
  // First generate (current empty): just map incoming
  if (opts.current.length === 0) {
    return opts.incoming.map((t) => ({
      id: opts.newId(),
      title: t.title,
      description: t.description,
      checked: true,
      dirty: false,
    }));
  }
  // Drop non-dirty unchecked AI rows; keep dirty + checked; append new
  const base = opts.current.filter((d) => d.dirty || d.checked);
  const baseNorm = new Set(base.map((d) => norm(d.title)).filter(Boolean));
  const next = [...base];
  for (const t of opts.incoming) {
    const n = norm(t.title);
    if (!n || baseNorm.has(n)) continue;
    baseNorm.add(n);
    next.push({
      id: opts.newId(),
      title: t.title,
      description: t.description,
      checked: true,
      dirty: false,
    });
  }
  return next;
}
```

Simplify if redundant — final merge should: (1) empty current → map incoming all checked; (2) else keep dirty rows + checked rows, append non-duplicate incoming as checked.

- [ ] **Step 3: Phase hints helper**

In `ai` caller (Task 2) use existing delivery templates. If export is `phasesForType(type)` / `PHASES_BY_TYPE`, collect checklist titles; otherwise add:

```ts
// in templates.ts if needed
export function checklistTitlesForProjectType(type: ProjectType): string[] {
  return phasesForProjectType(type).flatMap((p) =>
    p.checklist.map((c) => c.title)
  );
}
```

Use the real export name already in the file (`websitePhases` is private — find `export function` for type → phases).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`  
Expected: PASS (or only unrelated pre-existing errors)

---

### Task 2: Server actions

**Files:**
- Create: `src/lib/tickets/actions.ts`
- Modify: `src/lib/actions.ts` only if extracting shared ticket create internals is cleaner — prefer bulk in `tickets/actions.ts` reusing store helpers

**Interfaces:**
- Consumes: `generateTicketDrafts`, `getProjectById`, `getTickets`, `saveTickets`, `getCurrentProfile`, `uid`, `revalidatePath`, delivery checklist helper
- Produces:
```ts
"use server";
export async function generateProjectTicketsAction(
  projectId: string,
  opts?: { instruction?: string | null }
): Promise<TicketAiDraft[]>;

export async function createTicketsBulkAction(
  projectId: string,
  drafts: Array<{ title: string; description: string }>
): Promise<string[]>; // created ids
```

- [ ] **Step 1: `generateProjectTicketsAction`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireStudioSession } from "@/lib/auth/session";
import { getCurrentProfile } from "@/lib/auth/session"; // use whatever createTicket uses
import { getProjectById, getTickets, saveTickets, uid, type Ticket } from "@/lib/data";
// fix imports to match repo (profile may be from actions helpers)

export async function generateProjectTicketsAction(
  projectId: string,
  opts?: { instruction?: string | null }
) {
  await requireStudioSession();
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");
  const tickets = (await getTickets()).filter((t) => t.projectId === projectId);
  const phaseHints = checklistTitlesForProjectType(project.type);
  return generateTicketDrafts({
    project: {
      name: project.name,
      type: project.type,
      description: project.description ?? "",
      phase: project.phase,
      status: project.status,
      client: project.client,
    },
    existingTitles: tickets.map((t) => t.title),
    instruction: opts?.instruction,
    phaseHints,
  });
}
```

Copy auth/profile import style from `src/lib/quotes/actions.ts` / `createTicket`.

- [ ] **Step 2: `createTicketsBulkAction`**

```ts
export async function createTicketsBulkAction(
  projectId: string,
  drafts: Array<{ title: string; description: string }>
) {
  await requireStudioSession();
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");
  const author = await getCurrentProfile();
  const cleaned = drafts
    .map((d) => ({
      title: d.title.trim(),
      description: (d.description ?? "").trim(),
    }))
    .filter((d) => d.title.length > 0);
  if (!cleaned.length) throw new Error("No tickets to create");

  const existing = await getTickets();
  const now = new Date().toISOString();
  const created: Ticket[] = cleaned.map((d) => ({
    id: uid("tk"),
    projectId,
    title: d.title,
    description: d.description,
    status: "Todo",
    createdAt: now,
    dueAt: null,
    assigneeKind: "studio",
    assigneeId: null,
    createdByKind: "studio",
    createdByName: author.name,
  }));
  await saveTickets([...created, ...existing]);
  revalidatePath(`/projects/${projectId}`);
  return created.map((t) => t.id);
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`  
Expected: PASS

---

### Task 3: Generate tickets dialog UI

**Files:**
- Create: `src/components/generate-tickets-dialog.tsx`
- Reference chrome: `src/components/lead-qualify-dialog.tsx` (`DialogContent` with `inset-3` / `sm:inset-4`)

**Interfaces:**
- Consumes: `generateProjectTicketsAction`, `createTicketsBulkAction`, `mergeTicketDrafts`
- Produces: `<GenerateTicketsDialog projectId open onOpenChange />`

- [ ] **Step 1: Scaffold dialog shell**

Same DialogContent classes as Qualify:

```tsx
<DialogContent
  className={cn(
    "fixed inset-3 top-3 bottom-3 left-3 right-3 z-50 flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border bg-background p-0 shadow-2xl sm:inset-4 sm:top-4 sm:right-4 sm:bottom-4 sm:left-4",
    "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
  )}
>
```

Header: `app-display` title “Generate tickets”, subtitle with project name, Close.

- [ ] **Step 2: Load on open**

When `open` becomes true: reset drafts, `startTransition` → `generateProjectTicketsAction(projectId)` → `mergeTicketDrafts({ current: [], incoming, newId: crypto.randomUUID })`. Show spinner/error in body.

- [ ] **Step 3: Review list**

For each draft:
- Checkbox → toggles `checked`
- Input title → sets `dirty: true`
- Textarea description → sets `dirty: true`
- Optional trash removes row

Toolbar: Select all / Deselect all.

- [ ] **Step 4: Prompt bar + footer**

Prompt: controlled input + **Update** button → call `generateProjectTicketsAction(projectId, { instruction })` → `mergeTicketDrafts({ current: drafts, incoming, newId })`.

Footer sticky:
- Cancel → `onOpenChange(false)`
- **Create N tickets** → `createTicketsBulkAction` with checked non-empty → `onOpenChange(false)` + `router.refresh()` (or callback `onCreated`)

Disable Create when N=0 or pending.

- [ ] **Step 5: Verify manually**

With `ANTHROPIC_API_KEY` set: open dialog on a project, see drafts, edit one, follow-up “add SEO”, create 2 checked only → board shows those 2.

---

### Task 4: Wire into TicketsPanel + project workspace

**Files:**
- Modify: `src/components/tickets-panel.tsx`
- Modify: `src/components/project-workspace.tsx` (pass `project` if panel needs name in empty CTA; dialog only needs `projectId`)

**Interfaces:**
- Consumes: `GenerateTicketsDialog`
- Produces: button next to New ticket; empty state secondary action “Generate tickets”

- [ ] **Step 1: Header actions**

```tsx
const [generateOpen, setGenerateOpen] = useState(false);

// in header flex:
<div className="flex items-center gap-2">
  <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
    <Sparkles className="size-3.5" />
    Generate tickets
  </Button>
  <Button size="sm" onClick={() => { setSelectedId(null); setCreating(true); }}>
    <Plus className="size-3.5" />
    New ticket
  </Button>
</div>

<GenerateTicketsDialog
  projectId={projectId}
  open={generateOpen}
  onOpenChange={setGenerateOpen}
  onCreated={() => {
    // if panel keeps local state, router.refresh() from dialog is enough
    // or accept created ids and prepend optimistic rows
  }}
/>
```

- [ ] **Step 2: Empty state**

Update `EmptyState` description / add button to open generate dialog (“Generate a kickoff set with AI”).

- [ ] **Step 3: After create refresh**

`TicketsPanel` already syncs from props via effects if present — ensure `router.refresh()` in dialog after bulk create so RSC props update. If local-only state, merge created tickets or force refresh.

- [ ] **Step 4: Verify end-to-end**

1. Empty project → Generate → Create all → board filled  
2. Run Generate again → no near-duplicate of existing titles  
3. Uncheck half → only checked created  
4. Follow-up “break design into wireframes + visual” → list updates before create  

Run: `npx tsc --noEmit -p tsconfig.json`  
Expected: PASS

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Generate tickets entry on Tickets | 4 |
| Qualify-style fullscreen + padding | 3 |
| AI draft from project + existing titles | 1–2 |
| Checkbox / edit / select all | 3 |
| Follow-up prompt merge | 1 merge + 3 UI |
| Create checked only | 2–3 |
| Defaults Todo / studio / null assignee | 2 |
| Anthropic | 1 |
| No auto-write on generate | 3 |
| Delivery checklist as soft hints | 1–2 |
| Out of scope due/status UI | omitted |

## Placeholder / consistency scan

- Types: `TicketAiDraft`, `EditableTicketDraft`, action names fixed across tasks
- No streaming / due dates / assignee pickers in v1
- Commits optional — only if user asks
