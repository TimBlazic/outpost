# Installment Invoices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed project payment schedules, create one draft invoice per installment on demand (drawer preview), and show unpaid issued invoices with PDF on the client portal overview until marked paid.

**Architecture:** Extend existing `payments` rows with `invoice_id` and `invoices` with `payment_id`. `createProject` seeds 30/30/40 or 100%. `createInvoiceFromPayment` builds a draft from project value × percent, links both sides, and the project UI opens the existing invoice side drawer. Portal loads issued unpaid invoices for the project and serves PDF via a client-authenticated API route. `markInvoicePaid` flips the linked payment to paid.

**Tech Stack:** Next.js App Router, Supabase (`payments` + `invoices` tables), existing invoice PDF/render + SidePanel/InvoiceDetail patterns, portal i18n.

## Global Constraints

- Never bulk-create invoices for all installments; only on **Invoice this**
- Invoice numbers only on **Issue** (existing `issueInvoice`)
- Default split: `value > 500` → 30/30/40; else → one 100% installment
- Portal: only `issued` + unpaid (not draft/void/paid); PDF download allowed
- Do not commit unless the user explicitly asks
- Read Next.js docs under `node_modules/next/dist/docs/` before new App Router APIs

## File map

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260726160000_payment_invoice_link.sql` | `payments.invoice_id`, `invoices.payment_id` |
| `src/lib/data.ts` | `Payment.invoiceId`, `Invoice.paymentId`, `defaultPaymentSchedule(value)` |
| `src/lib/supabase/db.ts` | map/upsert new columns |
| `src/lib/actions.ts` | seed payments in `createProject`; keep payment CRUD aware of `invoiceId` |
| `src/lib/invoices/actions.ts` | `createInvoiceFromPayment`, sync paid→payment; `getInvoiceDetailAction` already exists |
| `src/components/payment-schedule.tsx` | Invoice this / Open invoice + status |
| `src/components/project-detail.tsx` | Host invoice drawer after create / open |
| `src/app/projects/[id]/page.tsx` | Pass unpaid issued invoices into portal view |
| `src/components/portal-unpaid-invoices.tsx` | Overview card + PDF link |
| `src/components/portal-client-view.tsx` | Mount unpaid card on overview |
| `src/lib/portal/i18n.ts` | EN/SL strings |
| `src/app/api/portal/invoices/[id]/pdf/route.ts` | Client-session PDF download |

---

### Task 1: Schema + types for payment↔invoice link

**Files:**
- Create: `supabase/migrations/20260726160000_payment_invoice_link.sql`
- Modify: `src/lib/data.ts` (`Payment`, `Invoice`, `normalizeInvoice`, helper `defaultPaymentSchedule`)
- Modify: `src/lib/supabase/db.ts` (`mapPayment`, payment upsert, `mapInvoice`, invoice upsert)

**Interfaces:**
- Produces: `Payment.invoiceId: string | null`, `Invoice.paymentId: string | null`
- Produces: `defaultPaymentSchedule(value: number): Omit<Payment, "id">[]` (caller assigns ids)

- [ ] **Step 1: Migration**

```sql
-- Link project installments ↔ invoices (create one invoice at a time)

alter table public.payments
  add column if not exists invoice_id text references public.invoices (id) on delete set null;

alter table public.invoices
  add column if not exists payment_id text;

create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists invoices_payment_idx on public.invoices (payment_id);
```

- [ ] **Step 2: Types + default schedule helper in `data.ts`**

```ts
export type Payment = {
  id: string;
  label: string;
  percent: number;
  dueOn: string | null;
  paid: boolean;
  paidOn: string | null;
  invoiceId: string | null;
};

// on Invoice type:
paymentId: string | null;

export function defaultPaymentSchedule(value: number): Array<{
  label: string;
  percent: number;
  dueOn: null;
  paid: false;
  paidOn: null;
  invoiceId: null;
}> {
  if (value > 500) {
    return [
      { label: "Deposit", percent: 30, dueOn: null, paid: false, paidOn: null, invoiceId: null },
      { label: "Midway", percent: 30, dueOn: null, paid: false, paidOn: null, invoiceId: null },
      { label: "Final", percent: 40, dueOn: null, paid: false, paidOn: null, invoiceId: null },
    ];
  }
  return [
    { label: "Full payment", percent: 100, dueOn: null, paid: false, paidOn: null, invoiceId: null },
  ];
}
```

Update `normalizeInvoice` to default `paymentId: inv.paymentId ?? null`. Ensure seed/demo payments include `invoiceId: null`.

- [ ] **Step 3: DB map/upsert**

In `mapPayment` add `invoiceId: (row.invoice_id as string) ?? null`.  
In payment upsert add `invoice_id: pay.invoiceId`.  
In `mapInvoice` / invoice upsert add `payment_id` ↔ `paymentId`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`  
Expected: errors only where Payment literals lack `invoiceId` — fix those call sites in this task.

---

### Task 2: Seed schedule on `createProject`

**Files:**
- Modify: `src/lib/actions.ts` (`createProject`)

**Interfaces:**
- Consumes: `defaultPaymentSchedule` from `@/lib/data`
- Produces: new projects with non-empty `payments` array

- [ ] **Step 1: Seed payments when creating a project**

Replace `payments: []` in `createProject` with:

```ts
import { defaultPaymentSchedule, paymentAmount } from "@/lib/data";

payments: defaultPaymentSchedule(input.value).map((p) => ({
  ...p,
  id: uid("pay"),
})),
```

(`paymentAmount` import only if needed later; omit if unused.)

- [ ] **Step 2: Manual check**

Create a project with value `1200` → Payments tab shows Deposit 30 / Midway 30 / Final 40.  
Create with value `400` → one Full payment 100%.

---

### Task 3: `createInvoiceFromPayment` + mark-paid sync

**Files:**
- Modify: `src/lib/invoices/actions.ts`
- Modify: `src/lib/actions.ts` (`togglePaymentPaid` — do not clear `invoiceId`)
- Modify: `src/lib/data.ts` (`paymentAmount` already exists)

**Interfaces:**
- Produces: `createInvoiceFromPayment(projectId: string, paymentId: string): Promise<string>` (invoice id)
- Consumes: `createInvoice` patterns, `getProjects` / `saveProjects`, `getClients`, `paymentAmount`

- [ ] **Step 1: Implement `createInvoiceFromPayment`**

```ts
export async function createInvoiceFromPayment(
  projectId: string,
  paymentId: string
): Promise<string> {
  await requireStudioSession(); // if not already used in file — add import
  const projects = await getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  const payment = project.payments.find((p) => p.id === paymentId);
  if (!payment) throw new Error("Installment not found");
  if (payment.invoiceId) return payment.invoiceId; // open existing

  const amount = paymentAmount(project.value, payment.percent);
  if (amount <= 0) throw new Error("Installment amount is zero");

  const client = project.clientId
    ? await getClientById(project.clientId)
    : null;

  const clientSnapshot = {
    name: client?.name ?? project.client,
    email: client?.email ?? "",
    companyName: client?.companyName ?? client?.name ?? project.client,
    address: client?.address ?? "",
    vatId: client?.vatId ?? "",
    taxNumber: client?.taxNumber ?? "",
    registrationNumber: client?.registrationNumber ?? "",
  };

  const description = `${payment.label} (${payment.percent}%) — ${project.name}`;
  const invoiceId = await createInvoice({
    clientId: project.clientId,
    projectId: project.id,
    clientSnapshot,
    issueDate: today(),
    dueDate: payment.dueOn || today(),
    currency: "EUR",
    lineItems: [
      {
        description,
        qty: 1,
        unit: "service",
        unitPrice: amount,
        taxRate: 0,
      },
    ],
    notes: "",
  });

  // Link both sides
  const invoices = await getInvoices();
  await saveInvoices(
    invoices.map((i) =>
      i.id === invoiceId
        ? normalizeInvoice({ ...i, paymentId, updatedAt: new Date().toISOString() })
        : i
    )
  );
  await saveProjects(
    projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            payments: p.payments.map((pay) =>
              pay.id === paymentId ? { ...pay, invoiceId } : pay
            ),
          }
        : p
    )
  );

  revalidateInvoices(invoiceId, project.clientId);
  revalidatePath(`/projects/${projectId}`);
  return invoiceId;
}
```

Wire imports: `getProjects`, `saveProjects`, `getClientById`, `paymentAmount`, `normalizeInvoice`, `requireStudioSession` as needed. Align `clientSnapshot` fields with existing `InvoiceClientSnapshot` / client shape in the repo (use same mapping as invoice editor prefill if one exists).

- [ ] **Step 2: Sync on `markInvoicePaid`**

After setting invoice to paid, if `existing.paymentId` and `existing.projectId`:

```ts
const projects = await getProjects();
await saveProjects(
  projects.map((p) =>
    p.id === existing.projectId
      ? {
          ...p,
          payments: p.payments.map((pay) =>
            pay.id === existing.paymentId || pay.invoiceId === id
              ? { ...pay, paid: true, paidOn: today() }
              : pay
          ),
        }
      : p
  )
);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`  
Expected: exit 0.

---

### Task 4: Payment schedule UI + project invoice drawer

**Files:**
- Modify: `src/components/payment-schedule.tsx`
- Modify: `src/components/project-detail.tsx`
- Optionally reuse: `src/components/side-panel.tsx`, `src/components/invoice-detail.tsx`, `getInvoiceDetailAction`

**Interfaces:**
- Consumes: `createInvoiceFromPayment(projectId, paymentId): Promise<string>`
- Produces: UI callbacks `onOpenInvoice(invoiceId: string)`

- [ ] **Step 1: Extend `PaymentSchedule` props**

```tsx
export function PaymentSchedule({
  projectId,
  value,
  payments,
  invoicesById, // Record<string, { status: InvoiceStatus }> or pass full Invoice[]
  variant = "card",
  onOpenInvoice,
}: {
  projectId: string;
  value: number;
  payments: Payment[];
  invoicesById?: Record<string, Pick<Invoice, "id" | "status" | "invoiceNumber" | "total">>;
  variant?: "card" | "plain";
  onOpenInvoice?: (invoiceId: string) => void;
})
```

Per row actions:
- No `invoiceId` → button **Invoice this** → `createInvoiceFromPayment` then `onOpenInvoice(id)`
- Has `invoiceId` → button **Open invoice** → `onOpenInvoice(invoiceId)`
- Status pill from linked invoice status, or “Paid” if `payment.paid`

- [ ] **Step 2: Drawer on `ProjectDetail`**

Mirror `InvoicesView` pattern: `selectedInvoiceId` state, `getInvoiceDetailAction`, `SidePanel` + `InvoiceDetail mode="drawer"`. Pass `onOpenInvoice={setSelectedInvoiceId}` into `PaymentSchedule`. Load project’s invoices on the studio project page and pass a map into schedule (or fetch detail only on open).

Studio project page (`src/app/projects/[id]/edit` or detail — the CRM project detail, not client portal) must load `getInvoices()` filtered by `projectId` for status chips.

- [ ] **Step 3: Manual check**

Invoice this on Deposit → draft in drawer, no number. Issue from drawer → number assigned. Midway still has no invoice until clicked.

---

### Task 5: Portal unpaid invoices + PDF route

**Files:**
- Create: `src/components/portal-unpaid-invoices.tsx`
- Create: `src/app/api/portal/invoices/[id]/pdf/route.ts`
- Modify: `src/lib/portal/i18n.ts`
- Modify: `src/components/portal-client-view.tsx`
- Modify: `src/app/projects/[id]/page.tsx` (client portal page that renders `PortalClientView`)

**Interfaces:**
- Consumes: invoices with `projectId`, `status === "issued"`, `!paidAt`
- Produces: PDF via client session check that invoice.projectId is in client’s projects

- [ ] **Step 1: i18n keys**

EN/SL in `portalT`:
- `unpaidInvoiceTitle`: "New invoice to pay" / "Nov račun za plačilo"
- `unpaidInvoiceBody`: "Download the PDF and settle when ready." / "Prenesite PDF in poravnajte, ko ste pripravljeni."
- `unpaidInvoiceDownload`: "Download PDF" / "Prenesi PDF"

- [ ] **Step 2: PDF API route**

`src/app/api/portal/invoices/[id]/pdf/route.ts`:
1. Resolve current client via `getCurrentClient()` / existing client-accounts session helper (same as portal project page).
2. Load invoice by id; require `status === "issued"` (or paid still downloadable? Spec: card only for unpaid — allow PDF for issued unpaid only).
3. Verify `invoice.projectId` belongs to a project with `clientId === client.id`.
4. `renderInvoicePdf` + return attachment bytes (copy headers from studio invoice PDF route).

- [ ] **Step 3: `PortalUnpaidInvoices` component**

List each unpaid issued invoice: title, optional total, link `href={`/api/portal/invoices/${id}/pdf`}`.

- [ ] **Step 4: Wire portal overview**

In `PortalClientView`, accept `unpaidInvoices: Array<{ id, invoiceNumber, total, currency }>`.  
Render `<PortalUnpaidInvoices />` above/near `PortalWelcome` when length > 0.

In client `projects/[id]/page.tsx`, load invoices for project where `status === "issued"` and not paid; pass down.

- [ ] **Step 5: Manual check**

Issue installment invoice → appear on client overview + PDF downloads. Mark paid in studio → card gone; payment row paid.

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Seed 30/30/40 or 100% on create/convert | Task 2 |
| Invoice this → draft only | Task 3–4 |
| Side drawer preview | Task 4 |
| Number only on Issue | existing + Task 4 |
| payment↔invoice link | Task 1 + 3 |
| Mark paid → installment paid | Task 3 |
| Portal unpaid card + PDF | Task 5 |
| No bulk invoice create | Tasks 3–4 (single create) |

## Placeholder scan

None intentional. Commit steps omitted per repo rule (user commits).
