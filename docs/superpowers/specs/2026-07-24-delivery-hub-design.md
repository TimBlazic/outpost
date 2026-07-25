# Outpost — Delivery Hub + Client Review Portal

**Date:** 2026-07-24  
**Status:** Approved (blanket — start building)

## Goal

Projects are a **delivery workspace** for website / web app / mobile work: lead converts → template phases + checklist + runbook + board. Client portal is a **review hub** (not a chat clone).

## Decisions

| Topic | Choice |
|-------|--------|
| Internal project UI | Full hub: phases + checklist + board + runbook + waiting-on-client |
| Phases | Templates by product type |
| Client portal | Review hub (C): phase, progress, staging, waiting-on-you, approve, upload |
| Access | Existing token + PIN |
| Payments | Secondary tab (not the hero) |

## Phase templates

- **Website / Website redesign / New website / Maintenance:** Discovery → Design → Build → Review → Launch → Handoff  
- **Web app:** Discovery → Design → Build → Review → Launch → Handoff  
- **Mobile app:** Discovery → Design → MVP → Iterate → Launch → Handoff  
- **AI agent / Consulting:** Discovery → Delivery → Review → Handoff  

Each phase has default checklist items. Current phase drives progress %.

## Data

- `project_phases` — project_id, key, label, sort_order, status (`upcoming`|`active`|`done`)
- `phase_checklist_items` — phase_id, title, done, client_visible, waiting_on_client
- Project runbook fields: `staging_url`, `figma_url`, `repo_url`, `brief_url` (+ existing portal intro)
- `portal_approvals` — project_id, kind (`design`|`staging`|`launch`), approved_at, approved_by_name, note

Tasks keep `clientVisible` / `waitingOnClient` for board + portal.

## Internal project detail layout

1. Header: name, type, status, dates  
2. **Runbook** strip: staging / Figma / repo / brief  
3. **Phase stepper** + advance phase  
4. **This phase checklist**  
5. **Board:** Now / Next / Waiting on client / Done (project tasks)  
6. Tabs secondary: Payments, Files, Portal access (PIN/link)

## Client portal (`/portal/[token]`)

1. PIN gate (existing)  
2. Header: project name, current phase, progress bar  
3. Staging CTA  
4. Waiting on you (checklist + tasks) — mark done / upload  
5. Approvals: Approve design / Approve staging (when relevant)  
6. Visible milestones (client-visible open tasks) — no full internal board, no money, no chat feed as hero  

## Seed on create

`createProject` / convert lead applies template for `project.type`.
