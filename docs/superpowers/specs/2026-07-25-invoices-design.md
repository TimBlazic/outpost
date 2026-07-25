# Invoices (Harvey port) — Design

Date: 2026-07-25  
Status: approved for implementation

## Goal

Make Outpost the main business app for Tim Blažič s.p., including invoice generation that is **visually and structurally identical** to Harvey’s PDF/invoices. Bill-to parties are existing **Clients** (no separate finance customers). Issuer + signature live in **Settings**.

Primary use case: monthly contractor invoices to one regular client — create/edit, **Duplicate as form prefill only**, Issue → PDF → Mark paid.

## Scope (v1)

- Invoices nav module: list, new/edit, detail
- Issuer billing fields + signature upload in Settings
- Client billing fields (address, tax/VAT) for bill-to
- Draft → Issue (number assigned on Issue) → Paid / Void
- Duplicate: `/invoices/new?from=<id>` prefills editor; **no DB row until Save**
- Harvey-identical PDF via `pdf-lib` (on-demand, no PDF blob storage)
- Numbering: optional prefix + `YY-NNNN` per issue year

## Out of scope

- Recurring cron / email reminders
- AI PDF import
- e-račun / FURS
- Stripe
- Linking invoices ↔ project payment installments
- Separate finance customers / Vault year folders
- Persisted PDF files in Storage (regenerate each download)

## Data model

### Firm settings (extend)

Billing/issuer on `firm_settings` (or JSON column / sibling fields):

- address, email, phone
- taxNumber, vatId, vatStatus, registrationNumber
- iban, bic, bankName, issuePlace
- signaturePath / signatureUrl (Storage)
- invoicePrefix (optional string)
- invoiceNextSequenceByYear (jsonb map year → next int)
- defaultCurrency (`EUR` default)
- defaultPaymentTermsDays (number, default 14)

Keep existing: firmName, revenueGoal, goalYear, …

### Client (extend)

- billingAddress (text)
- taxNumber, vatId, registrationNumber (optional)
- paymentTermsDays (optional override)

### Invoice

- id, clientId (nullable only if snapshot-only; prefer required clientId)
- clientSnapshot: `{ name, email?, companyName?, address?, vatId?, taxNumber?, registrationNumber? }`
- invoiceNumber (null while draft)
- year, sequence (null while draft; set on Issue)
- status: `draft | issued | paid | void`
- issueDate, dueDate (date strings YYYY-MM-DD)
- currency
- lineItems: `[{ description, qty, unit?, unitPrice, taxRate? }]`
- subtotal, taxTotal, total
- notes
- createdAt, updatedAt
- createdBy (profile id)

## UX

### List `/invoices`

Number · client · status · issue · due · total. Actions: New, open detail, Duplicate, Download PDF (issued+), status changes.

### Editor `/invoices/new`, `/invoices/[id]/edit`

Client picker → snapshot fields editable for this invoice. Dates, line items, notes, live totals.  
Duplicate query `?from=` loads source into form state only.  
Save as **draft** (no number). **Issue** assigns number + locks line items.

### Detail `/invoices/[id]`

On-screen preview matching PDF. Download PDF, Edit (draft only), Mark paid, Void, Duplicate.

### Settings

Section **Invoice / Billing**: issuer fields, signature upload, numbering prefix, default terms/currency.

## PDF

Port Harvey `src/lib/finance/pdf.ts` layout 1:1 (A4, palette, sections, English labels). Unicode font for čžš. Signature from settings. Generate in Route Handler / server action from DB rows.

## Status rules

- draft → issued | void  
- issued → paid | void  
- paid → void  
After issue: lock line items + number (dates/notes optional lock — v1 lock all money fields).

## Success criteria

1. Fill s.p. + signature in Settings  
2. New invoice for Client or Duplicate → edit date/amount → Save draft → Issue  
3. PDF matches Harvey  
4. Mark paid; history visible on list  
