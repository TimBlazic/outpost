# Resend Studio Email — Design

**Date:** 2026-07-26  
**Status:** Approved — implementing Wave 1  

## Goal

Send emails from Outpost via Resend after the user reviews and edits the draft. Nothing sends automatically.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Scope | Wide (leads first; invoices/invite later) — always manual Send |
| From | Settings: name + email; default `Tim` / `tim@timblazic.dev` |
| Reply-To | Same as From |
| Mailto | Kept under “More” |
| Auto cron/reminders | Out of scope |

## Wave 1

1. Firm settings: `outboundFromName`, `outboundFromEmail`
2. `RESEND_API_KEY` env
3. `sendStudioEmail` server action (plain text)
4. Shared compose UX on Generate email drawer + Qualify save actions
5. On send with `leadId`: activity “Email sent: {subject}”

## Wave 2

Same compose for invoice PDF / portal invite — still click-to-send only.
