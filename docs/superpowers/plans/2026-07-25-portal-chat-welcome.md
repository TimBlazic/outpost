# Portal Chat + Welcome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared project Messages thread (studio ↔ client portal) plus minimal dismissible welcome card; admin inbox page, client detail entry, and project tab.

**Architecture:** New `portal_messages` table; shared `PortalChat` client component; studio actions via authenticated Supabase; portal actions via existing `assertPortalAccess` + admin client. Welcome dismiss in `localStorage`.

**Tech Stack:** Next.js App Router, Supabase, existing portal PIN session, server actions, Tailwind/shadcn patterns already in app.

## Global Constraints

- No email/Slack notifications in v1  
- No websockets — revalidatePath + optional ~15–20s poll while chat open  
- Money stays hidden in portal  
- Ticket comments unchanged  
- i18n EN/SL for portal strings via `src/lib/portal/i18n.ts`  
- Follow existing dual store: file JSON + `src/lib/supabase/db.ts`  
- Spec: `docs/superpowers/specs/2026-07-25-portal-chat-welcome-design.md`

---

## File map

| Path | Role |
|------|------|
| `supabase/migrations/20260725250000_portal_messages.sql` | Table + RLS |
| `supabase/scripts/wipe-app-data.sql` | Include `portal_messages` |
| `src/lib/data.ts` | `PortalMessage` type |
| `src/lib/store.ts` | get/save/getByProject helpers |
| `src/lib/supabase/db.ts` | map + CRUD |
| `src/lib/portal/message-actions.ts` | studio + portal post/list actions |
| `src/components/portal-chat.tsx` | Shared chat UI |
| `src/components/portal-welcome.tsx` | Dismissible welcome card |
| `src/components/portal-client-view.tsx` | Messages tab + welcome |
| `src/lib/portal/i18n.ts` | New copy keys |
| `src/app/messages/page.tsx` | Admin inbox |
| `src/app/messages/[projectId]/page.tsx` | Admin full chat |
| `src/components/messages-inbox.tsx` | Inbox list UI |
| `src/app/clients/[id]/page.tsx` | Project chats section |
| `src/components/project-workspace.tsx` | Messages tab |
| `src/components/app-shell.tsx` | Nav item |
| `src/components/command-palette.tsx` | Go/create shortcuts |
| `docs/SETUP-SUPABASE.md` | Migration bullet |

---

### Task 1: Migration + types + store/db

**Files:** migration, `data.ts`, `store.ts`, `db.ts`, `wipe-app-data.sql`, `SETUP-SUPABASE.md`

- [ ] Add `portal_messages` migration (columns per spec; RLS authenticated all; index on project_id, created_at)
- [ ] Add `PortalMessage` type + normalize helper in `data.ts`
- [ ] File store: `getPortalMessages` / `savePortalMessages`; `getPortalMessagesForProject(projectId)`
- [ ] Supabase: `mapPortalMessage`, get/save mirroring tickets pattern
- [ ] Add table to wipe script + SETUP list
- [ ] Verify: `npx tsc --noEmit`

---

### Task 2: Server actions

**Files:** `src/lib/portal/message-actions.ts` (new); wire revalidate paths

- [ ] `listPortalMessagesForStudio(projectId)` — auth required
- [ ] `postStudioPortalMessage(projectId, body)` — author from current profile
- [ ] `listPortalMessagesForClient(token)` — `assertPortalAccess`
- [ ] `postClientPortalMessage(token, body)` — author_kind client, name from project client
- [ ] Revalidate `/messages`, `/messages/[id]`, `/projects/[id]`, `/portal/[token]`, `/clients/[clientId]` as needed
- [ ] Verify: tsc clean

---

### Task 3: Shared `PortalChat` + welcome component

**Files:** `portal-chat.tsx`, `portal-welcome.tsx`, i18n keys

- [ ] `PortalChat`: message list, composer, viewer `"studio" | "portal"`, auto-scroll, optional poll calling router.refresh
- [ ] `PortalWelcome`: intro + links to setActiveTab; dismiss → `localStorage` `outpost.portalWelcome.<token>`
- [ ] Add EN/SL strings (welcome title, empty chat, placeholder, continue)
- [ ] Verify: components typecheck

---

### Task 4: Portal UI

**Files:** `portal-client-view.tsx`, portal page data loading if needed

- [ ] Add `messages` tab; load messages in `/portal/[token]/page.tsx` and pass down
- [ ] Show `PortalWelcome` after unlock when not dismissed
- [ ] Wire portal post action
- [ ] Manual check: unlock → welcome → Messages → send

---

### Task 5: Admin Messages pages + nav

**Files:** `src/app/messages/page.tsx`, `src/app/messages/[projectId]/page.tsx`, `messages-inbox.tsx`, `app-shell.tsx`, `command-palette.tsx`

- [ ] Inbox: portal-enabled projects (or with messages), sort by last message time
- [ ] Detail page: header (project + client links) + `PortalChat` viewer=studio
- [ ] Sidebar + palette: Messages
- [ ] Manual check: open inbox → thread → reply

---

### Task 6: Client detail + project workspace

**Files:** `src/app/clients/[id]/page.tsx`, `project-workspace.tsx`, project page data

- [ ] Client page: “Project chats” list → `/messages/[projectId]`
- [ ] Project workspace: Messages tab with same `PortalChat`
- [ ] Load messages in project page server component
- [ ] Manual check: client page → chat; project tab → same thread

---

### Task 7: Polish + verify

- [ ] Empty states, disabled when portal off (studio can still chat? **Yes** — studio may message before client opens; inbox includes portal-enabled projects primarily)
- [ ] `tsc --noEmit`
- [ ] Remind user to run migration `20260725250000_portal_messages.sql`

---

## Done when

- [ ] Portal: welcome once + Messages send/receive  
- [ ] Admin `/messages` + `/messages/[projectId]` work  
- [ ] Client detail links into chat  
- [ ] Project Messages tab shows same thread  
