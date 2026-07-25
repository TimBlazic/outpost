# Outpost — Clients, Projects, Tickets

**Date:** 2026-07-24  
**Status:** Approved (blanket)

## Model

- **Lead** (sales) → Convert creates **Client** (if needed) + **Project**
- **Client** has many **Projects**
- **Project** has **Tickets** + **Files**
- Global **/tasks** remain lead follow-ups only

## Project fields

title, description, budget, cost, phase (select: current only), type, status, portal settings

## Tickets

title, markdown body, status, createdAt, dueAt, assignee (studio | client), createdBy (studio | client), images + file attachments  
Views: table / kanban · side drawer · full page `/projects/[id]/tickets/[ticketId]`

## Client portal permissions (default A)

- View tickets + files  
- Create tickets, upload on tickets  
- No delete  
- Toggles in project settings

## Portal UX

Style aligned with timblazic.dev: editorial, spacious, brand-forward, few sections (Overview · Tickets · Files). Token + PIN.

## Remove

Delivery hub stepper/checklist board as primary UI; phase = simple select.
