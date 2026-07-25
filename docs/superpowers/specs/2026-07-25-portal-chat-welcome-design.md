# Portal chat + welcome — Design

Date: 2026-07-25  
Status: implemented

## Goal

Give each delivery project a **shared Messages thread** between studio and client, plus a **minimal first-visit welcome** in the portal so clients know where to go. Chat must exist on **both** sides:

1. **Client portal** — Messages tab  
2. **Admin** — dedicated Messages page **and** on the **Client** detail page  

Tickets stay for structured requests; Messages is free-form project chat.

## Decisions

| Topic | Choice |
|-------|--------|
| Chat model | One thread per project (`portal_messages`) |
| Portal kickoff | Minimal welcome card (portalIntro + tab links), dismissible |
| Admin surfaces | `/messages` inbox page + Client detail chats + Project workspace Messages tab |
| Realtime | v1: revalidate / light poll — no websockets |
| Notifications | Out of scope v1 (no email/Slack) |
| Money | Still hidden from portal |
| Ticket comments | Unchanged |

## Data model

### `portal_messages`

| Column | Notes |
|--------|--------|
| `id` | text PK |
| `project_id` | FK → projects, cascade delete |
| `body` | text, required |
| `author_kind` | `studio` \| `client` |
| `author_id` | nullable (studio profile id; null for client) |
| `author_name` | display name snapshot |
| `created_at` | timestamptz |
| `attachment_id` | nullable FK/path to attachment (optional v1) |

Indexes: `(project_id, created_at)`.

RLS: authenticated studio full access. Portal writes via existing service-role / assertPortalAccess pattern (same as ticket comments).

### Optional later

- `read_at` / unread per side — not required for v1 UI (can show “latest message” only)
- Attachments on messages — nice-to-have; can land after text-only if faster

## Surfaces

### A. Client portal (`/portal/[token]`)

**Tabs:** Overview · **Messages** · Tickets · Files  

**Welcome (minimal)**  
- After PIN unlock, if not dismissed: card with title, `portalIntro` (or short default), links: Messages / Tickets / Files  
- Dismiss → localStorage key `outpost.portalWelcome.<token>`  
- Overview keeps a compact “About” blurb (intro) always  

**Messages tab**  
- Chronological bubbles (client right/studio left or clear author labels)  
- Composer: text (+ attach if easy)  
- Empty state: “Say hi — Tim will reply here.”  
- Permission: always on when portal enabled (no separate toggle in v1), or reuse `clientCanComment` if we want one kill-switch  

### B. Admin — Messages page (`/messages`)

Dedicated nav item **Messages** (sidebar + command palette).

- List projects that have `portalEnabled` (or any with ≥1 message), sorted by latest message  
- Columns/cards: project name · client · last message preview · time · unread badge (optional v1: skip unread)  
- Click → `/messages/[projectId]` **full chat page** (same thread component as below)  

This is the “dejanski page” for day-to-day studio chat, not buried only in project settings.

### C. Admin — Client detail (`/clients/[id]`)

Section **Project chats** (or Messages):

- List this client’s projects (prefer portal-enabled)  
- Each row: project name · last message · Open chat → `/messages/[projectId]`  

So from a client you jump into the right thread without hunting projects.

### D. Admin — Project workspace

Add **Messages** tab next to Tickets/Files (same `PortalChat` component embedded). Deep-link from `/messages/[projectId]` can redirect here **or** use the dedicated page layout — prefer **one shared chat component**, two hosts:

- Full page shell at `/messages/[projectId]`  
- Embedded tab in project workspace  

## Shared UI

`PortalChat` (client component):

- props: `projectId`, `messages`, `viewer: "studio" | "portal"`, `projectName`, `clientLabel`  
- studio posts via authenticated action; portal via `assertPortalAccess`  
- Auto-scroll to bottom; poll every ~15–20s while tab visible (optional)

## Permissions & auth

- Portal: existing token + PIN session  
- Studio: Supabase auth; any team member can read/write project messages  
- Portal never sees other projects’ messages  

## i18n

Portal copy in EN/SL via existing `portalLocale` / `i18n.ts` (welcome, empty, composer placeholder).

## Out of scope (v1)

- Email/Slack notifications  
- Typing indicators / presence  
- Edit/delete messages  
- Group DM across projects  
- Guided multi-step tour / waiting-on-you checklist (explicitly deferred; welcome stays minimal)  
- Converting chat → ticket  

## Implementation order

1. Migration + types + store/db  
2. Shared `PortalChat` + actions  
3. Portal tab + welcome card  
4. Admin `/messages` + `/messages/[projectId]`  
5. Client detail section  
6. Project workspace Messages tab  
7. Nav + command palette  

## Success criteria

- Client can unlock portal, see welcome once, open Messages, send a note  
- Studio can open **Messages** from sidebar, pick a project, reply  
- From **Client** page, studio can open that client’s project chat in one click  
