# Installment invoices + portal unpaid notice — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation  

**Approach:** Payment schedule on project is the plan; **Invoice this** creates one draft at a time (no pre-numbering); portal shows unpaid issued invoices with PDF until marked paid.

## Goal

For larger jobs (typically &gt; €500), Tim wants **obročno plačevanje** (e.g. 30% / 30% / 40%) without creating all invoices up front. Invoice numbers must stay chronological — only assign a number when an installment is actually issued. Clients see a clear “new invoice to pay” on the portal overview with PDF download; the notice disappears when the invoice is marked paid.

## User flow (locked)

### Studio

1. **Create / convert → project** with a value:
   - If `value > 500` and no payments yet → seed schedule **30% / 30% / 40%** (labels: Deposit / Midway / Final, or SL equivalents where UI is SL).
   - If `value ≤ 500` and no payments → seed **100%** single installment (or leave empty — prefer one 100% so “Invoice this” still works).
   - Tim can edit %, labels, add/remove installments anytime (existing payment schedule UI).
2. On an installment with **no linked invoice**: **Invoice this**
   - Creates a **draft** invoice for that installment amount only.
   - Line item e.g. `1. obrok (30%) — {project name}` (locale from firm/project defaults; EN fallback OK in v1).
   - Opens **side drawer** with invoice preview (same pattern as invoices list).
3. In drawer Tim can:
   - Leave as **Create** (draft saved; close drawer), or
   - **Issue** / **Send** later via existing invoice actions (number assigned on Issue only).
4. If installment already has a draft/issued invoice → button opens that invoice (drawer), no duplicate.
5. When invoice is **marked paid** → linked payment installment marked `paid` (+ `paidOn`).

### Portal (client)

1. Overview tab (same area as welcome card): if project has one or more **issued** (not paid, not void) invoices linked to this project → show **unpaid invoice card(s)**.
2. Card copy: “New invoice to pay” / “Nov račun za plačilo” + **Download PDF**.
3. When studio marks invoice **paid** → card disappears.
4. Draft / void invoices never appear.
5. Intentional exception to “no money in portal”: client may see that an invoice exists and download the PDF (amounts live in the PDF; card can show total for clarity).

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| When to create invoice rows | Only on **Invoice this** — never bulk-create all installments |
| Invoice number | Only on **Issue** (existing behavior) |
| Default split | `value > 500` → 30/30/40; else → 100% |
| Drawer after create | Yes — quick preview; send/issue optional |
| Payment ↔ invoice | Store `invoice_id` on payment (or `payment_id` on invoice); one active link |
| Portal visibility | Issued + unpaid only; PDF download via portal-safe route |
| Mark paid sync | Invoice paid → installment paid |
| Quote → schedule | Out of scope v1 (project value drives schedule) |

## Data model

### `Payment` (project JSON / existing structure)

Add optional link:

| Field | Type | Notes |
|--------|------|--------|
| `invoiceId` | text \| null | FK-ish → invoices.id; set when Invoice this runs |

### `invoices` (optional column)

| Column | Type | Notes |
|--------|------|--------|
| `payment_id` | text \| null | Optional denormalized reverse link for queries |

Prefer **both** or at least `payments[].invoiceId` in project JSON (current storage) plus `invoices.payment_id` if invoices are relational — match existing Supabase invoice schema.

### Portal fetch

- Load issued unpaid invoices for `project_id` (studio server for portal page / portal action with assert access).
- PDF: authenticated portal route e.g. `/api/portal/[token]/invoices/[id]/pdf` (or client-session equivalent) — do **not** expose studio `/api/invoices/.../pdf` without portal auth.

## UI

### Payment schedule (`PaymentSchedule`)

- Per row: status chip (No invoice / Draft / Issued / Paid).
- **Invoice this** when no invoice linked.
- **Open invoice** when linked.
- Keep existing add/edit/remove installment.

### Invoice drawer

- Reuse invoices list side drawer; after create from installment, open that invoice id in drawer on the project page (or navigate to `/invoices` with open id — prefer stay on project + drawer).

### Portal overview

- New `PortalUnpaidInvoices` card above/beside welcome (or replaces welcome slot when unpaid invoices exist).
- i18n EN/SL in `portal/i18n.ts`.

## Out of scope v1

- Auto-email invoice from “Invoice this” (drawer Issue/Send is enough).
- Client portal online payment (Stripe etc.).
- Auto-seeding schedule from accepted quote line items.
- Reminder emails for unpaid installments.

## Success criteria

- Convert a €1200 project → see 30/30/40 without manual add.
- Invoice first installment → draft only; no number; drawer opens.
- Issue later → gets next invoice number; other installments still unnumbered.
- Portal shows unpaid issued invoice + PDF; paid clears the card.
- Midway “Invoice this” after another client’s invoice was issued → numbers stay in real issue order.

## Spec self-review

- [x] No placeholders / TBD left in locked decisions
- [x] No contradiction with “don’t pre-create invoice numbers”
- [x] Scope tight: schedule seed + Invoice this + portal unpaid card
- [x] Portal auth for PDF called out
