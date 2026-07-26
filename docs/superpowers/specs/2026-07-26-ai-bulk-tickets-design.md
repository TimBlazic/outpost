# AI bulk tickets — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation  

**Approach:** Generate → review in qualify-style fullscreen dialog → optional follow-up prompt → create only checked drafts

## Goal

Let Tim seed (or extend) a project’s ticket board with AI so kickoff and later gap-filling don’t require creating every ticket by hand. Always preview first; never silent-write to the board.

## User flow (locked)

1. On project detail → **Tickets** → **Generate tickets** (next to New ticket).
2. Opens **fullscreen dialog** with outer padding (`inset-3` / `sm:inset-4`), same shell as Qualify lead.
3. On open: loading state while AI proposes a draft list from project context + existing ticket titles (avoid duplicates). Target ~6–12 items when the board is empty; fewer when filling gaps.
4. **Review list**
   - Each row: checkbox (default on), editable **title**, editable short **description**.
   - Defaults for create: `status: Todo`, `assigneeKind: studio`, `assigneeId: null` (or project owner if already used elsewhere — prefer null / unassigned studio).
   - Header: Select all / Deselect all.
   - Manual add empty row optional (nice-to-have; prompt bar covers “add one more”).
5. **Prompt bar** (bottom of scroll / above footer): free text e.g. “Break down Design into design + review” or “Add SEO tickets”. Submit → AI returns an updated draft list; merge strategy:
   - Keep rows the user already edited (dirty) and checked when possible.
   - Replace unchecked / untouched AI rows with the new proposal, or append net-new items and drop near-duplicates by title.
   - Simpler v1 OK: replace unchecked AI-origin rows; never wipe user-edited titles/descriptions; append new suggestions; de-dupe against existing board titles + current draft titles.
6. Footer: **Cancel** · **Create N tickets** (N = checked with non-empty title). Disabled if N = 0 or generating.
7. On create: server creates tickets for checked rows only → close dialog → tickets board refreshes (router.refresh / existing panel reload).

Works whether the board is empty or already has tickets (always suggest **new** work, not regenerate the whole board).

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Preview before write | Always (approach A + chat loop) |
| Dialog chrome | Qualify-style fullscreen + padding |
| When board has tickets | Still available; AI must avoid duplicating existing titles |
| Create scope | Checked rows only |
| Follow-up prompt | Yes — refine / break down / add |
| Per-row status/assignee in UI | Out of scope v1 (defaults only) |
| Due dates from AI | Out of scope v1 |
| Delivery hub checklist auto-import | Out of scope as primary path; may inform prompt as soft hints |
| Portal visibility | Normal ticket rules; AI-created = studio `createdBy` |
| Provider | Anthropic (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) like quotes |

## AI contract

**Input context (server-assembled):**
- Project: name, type, description, phase, status, client name
- Existing ticket titles (and maybe statuses) for de-dupe
- Optional: short delivery-template phase titles for this `ProjectType` as hints (not hard requirements)
- User follow-up instruction (empty on first generate)

**Output JSON:**
```json
{
  "tickets": [
    { "title": string, "description": string }
  ]
}
```

- Titles: concrete, actionable, studio-facing
- Descriptions: 1–3 short sentences or bullets; no fluff
- No tickets that only restate existing board titles
- Language: match project/description language when clear; else English

**Actions:**
- `generateProjectTicketsAction(projectId, { instruction?, keepDrafts? })` → draft list
- `createTicketsBulkAction(projectId, drafts[])` → creates via same persistence as `createTicket`

## UI pieces

- `TicketsPanel`: **Generate tickets** button
- `GenerateTicketsDialog` + wizard body (list + prompt + footer)
- Pass `project` (or enough fields) into panel / load entirely in server action

## Out of scope (v1)

- Auto-assign members / due dates from AI
- Creating tickets without preview
- Replacing or editing existing tickets via AI
- Client-facing “AI generated” labels
- Streaming token UI (spinner is enough)

## Success

- Empty project → useful kickoff board in one dialog pass
- Mid-project → gap suggestions that don’t clone existing work
- Follow-up prompt can break one big ticket into smaller ones before create
- Create never inserts unchecked or empty-title rows
