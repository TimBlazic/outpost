#!/usr/bin/env node
/**
 * Import Harvey invoice export into Outpost (Supabase).
 *
 * Reads root `invoices.json` + `customers.json` (JS object literals from Convex).
 * Only imports invoices for HARVEY_USER_ID, creates clients only for companies
 * that appear on those invoices, upserts idempotently.
 *
 * Usage:
 *   node scripts/import-harvey-invoices.mjs
 *   node scripts/import-harvey-invoices.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const HARVEY_USER_ID = "j57ang39bpzn8n5vazeeg9zg3d83e1fs";
const DRY = process.argv.includes("--dry-run");

function loadEnvLocal() {
  const path = resolve(ROOT, ".env.local");
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error("Missing .env.local");
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseJsLiteralFile(filename) {
  const raw = readFileSync(resolve(ROOT, filename), "utf8");
  return new Function(`return (${raw})`)();
}

function msToIsoDate(ms) {
  if (ms == null || ms === 0 || !Number.isFinite(Number(ms))) return null;
  return new Date(Number(ms)).toISOString().slice(0, 10);
}

function msToIso(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) {
    return new Date().toISOString();
  }
  return new Date(Number(ms)).toISOString();
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "unknown";
}

function companyKey(snapshot, customer) {
  const fromSnap =
    snapshot?.companyName?.trim() ||
    snapshot?.name?.trim() ||
    "";
  const fromCust =
    customer?.companyName?.trim() ||
    customer?.name?.trim() ||
    "";
  return (fromSnap || fromCust).toLowerCase();
}

function inferCountry(address) {
  const a = (address || "").toLowerCase();
  if (a.includes("slovenia") || a.includes("slovenija")) return "Slovenia";
  if (a.includes("united states") || a.includes("usa") || a.includes("amerik"))
    return "United States";
  return "";
}

function clientIdForKey(key) {
  return `cli_import_${slug(key)}`;
}

function invoiceIdForNumber(num) {
  return `inv_import_${String(num).replace(/[^a-zA-Z0-9-]/g, "_")}`;
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const sourceInvoices = parseJsLiteralFile("invoices.json");
const sourceCustomers = parseJsLiteralFile("customers.json");
const customersById = new Map(sourceCustomers.map((c) => [c._id, c]));

const filtered = sourceInvoices.filter((i) => i.userId === HARVEY_USER_ID);
if (!filtered.length) {
  console.error("No invoices for user", HARVEY_USER_ID);
  process.exit(1);
}

// Deduplicate by invoice number (keep newest) — shouldn't happen for this user.
const byNumber = new Map();
for (const inv of filtered) {
  const num = inv.invoiceNumber;
  if (!num) continue;
  const prev = byNumber.get(num);
  if (!prev || (inv.updatedAt || 0) > (prev.updatedAt || 0)) {
    byNumber.set(num, inv);
  }
}

// 24-0001…24-0004 live under older Harvey userIds only — backfill those gaps.
const yyNnnn = /^\d{2}-\d{4}$/;
const backfill = [];
for (const inv of sourceInvoices) {
  const num = inv.invoiceNumber;
  if (!num || !yyNnnn.test(num) || byNumber.has(num)) continue;
  // Only fill missing numbers from the same YY-NNNN series (real Tim invoices).
  if (!num.startsWith("24-") && !num.startsWith("25-") && !num.startsWith("26-")) {
    continue;
  }
  const prev = backfill.find((x) => x.invoiceNumber === num);
  const score = (x) =>
    (x.status === "paid" ? 1e12 : 0) + (x.updatedAt || 0);
  if (!prev || score(inv) > score(prev)) {
    const idx = backfill.findIndex((x) => x.invoiceNumber === num);
    if (idx >= 0) backfill[idx] = inv;
    else backfill.push(inv);
  }
}
if (backfill.length) {
  console.log(
    "Backfilling missing numbers from other Harvey users:",
    backfill.map((i) => i.invoiceNumber).sort().join(", ")
  );
  for (const inv of backfill) byNumber.set(inv.invoiceNumber, inv);
}

const invoices = [...byNumber.values()].sort((a, b) =>
  String(a.invoiceNumber).localeCompare(String(b.invoiceNumber))
);

// Only customers referenced by these invoices (by customerId).
const referencedCustomerIds = new Set(
  invoices.map((i) => i.customerId).filter(Boolean)
);

// Build client records: referenced customers + snapshot-only companies.
/** @type {Map<string, object>} key -> client row */
const clients = new Map();

function upsertClientFromCustomer(customer, snapshot) {
  const key = companyKey(snapshot, customer);
  if (!key) return null;
  const id = clientIdForKey(key);
  const existing = clients.get(key);
  const company =
    customer.companyName?.trim() ||
    snapshot?.companyName?.trim() ||
    customer.name?.trim() ||
    snapshot?.name?.trim() ||
    "";
  const name =
    customer.name?.trim() ||
    company;
  const address =
    customer.address?.trim() ||
    snapshot?.address?.trim() ||
    existing?.billing_address ||
    "";
  const row = {
    id,
    name,
    email: customer.email?.trim() || snapshot?.email?.trim() || existing?.email || "",
    phone: existing?.phone || "",
    company,
    website: existing?.website || "",
    country: inferCountry(address) || existing?.country || "",
    notes: "Imported from Harvey",
    lead_id: null,
    created_at: msToIso(customer.createdAt || snapshot?.createdAt),
    archived_at: null,
    billing_address: address,
    tax_number:
      customer.taxNumber?.trim() ||
      snapshot?.taxNumber?.trim() ||
      existing?.tax_number ||
      "",
    vat_id:
      customer.vatId?.trim() ||
      snapshot?.vatId?.trim() ||
      existing?.vat_id ||
      "",
    registration_number:
      customer.registrationNumber?.trim() ||
      snapshot?.registrationNumber?.trim() ||
      existing?.registration_number ||
      "",
    payment_terms_days:
      customer.paymentTermsDays ?? existing?.payment_terms_days ?? null,
  };
  clients.set(key, row);
  return id;
}

function upsertClientFromSnapshot(snapshot) {
  const key = companyKey(snapshot, null);
  if (!key) return null;
  if (clients.has(key)) return clients.get(key).id;
  const company =
    snapshot.companyName?.trim() || snapshot.name?.trim() || "";
  const address = snapshot.address?.trim() || "";
  const id = clientIdForKey(key);
  clients.set(key, {
    id,
    name: company,
    email: snapshot.email?.trim() || "",
    phone: "",
    company,
    website: "",
    country: inferCountry(address),
    notes: "Imported from Harvey",
    lead_id: null,
    created_at: new Date().toISOString(),
    archived_at: null,
    billing_address: address,
    tax_number: snapshot.taxNumber?.trim() || "",
    vat_id: snapshot.vatId?.trim() || "",
    registration_number: snapshot.registrationNumber?.trim() || "",
    payment_terms_days: null,
  });
  return id;
}

// Seed clients from referenced customer rows first.
for (const cid of referencedCustomerIds) {
  const customer = customersById.get(cid);
  if (!customer) {
    console.warn("Referenced customer missing from customers.json:", cid);
    continue;
  }
  upsertClientFromCustomer(customer, null);
}

// Ensure every invoice company has a client; enrich from snapshots.
for (const inv of invoices) {
  const snap = inv.clientSnapshot || {};
  if (inv.customerId && customersById.has(inv.customerId)) {
    upsertClientFromCustomer(customersById.get(inv.customerId), snap);
  } else {
    upsertClientFromSnapshot(snap);
  }
}

const skippedCustomers = sourceCustomers.filter(
  (c) => !referencedCustomerIds.has(c._id)
);

const invoiceRows = invoices.map((inv) => {
  const snap = inv.clientSnapshot || {};
  const key = companyKey(snap, customersById.get(inv.customerId));
  const client = clients.get(key);
  const issueDate = msToIsoDate(inv.issueDate);
  let dueDate = msToIsoDate(inv.dueDate);
  if (!dueDate && issueDate) {
    const d = new Date(`${issueDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 14);
    dueDate = d.toISOString().slice(0, 10);
  }
  const lineItems = (inv.lineItems || []).map((l) => ({
    description: l.description ?? "",
    qty: Number(l.qty) || 0,
    unit: l.unit ?? "",
    unitPrice: Number(l.unitPrice) || 0,
    taxRate: Number(l.taxRate) || 0,
  }));
  let subtotal = 0;
  let taxTotal = 0;
  for (const l of lineItems) {
    const lt = l.qty * l.unitPrice;
    subtotal += lt;
    taxTotal += (lt * l.taxRate) / 100;
  }
  subtotal = round2(inv.subtotal ?? subtotal);
  taxTotal = round2(inv.taxTotal ?? taxTotal);
  const total = round2(inv.total ?? subtotal + taxTotal);

  const status = ["draft", "issued", "paid", "void"].includes(inv.status)
    ? inv.status
    : "issued";

  const companyName =
    snap.companyName?.trim() ||
    client?.company ||
    snap.name?.trim() ||
    "";

  return {
    id: invoiceIdForNumber(inv.invoiceNumber),
    client_id: client?.id ?? null,
    project_id: null,
    client_snapshot: {
      name: "",
      email: snap.email?.trim() || client?.email || "",
      companyName,
      address: snap.address?.trim() || client?.billing_address || "",
      vatId: snap.vatId?.trim() || client?.vat_id || "",
      taxNumber: snap.taxNumber?.trim() || client?.tax_number || "",
      registrationNumber:
        snap.registrationNumber?.trim() || client?.registration_number || "",
    },
    invoice_number: inv.invoiceNumber,
    // Prefer YY from number (source `year` is wrong on some 24-* rows).
    year: (() => {
      const m = String(inv.invoiceNumber || "").match(/^(\d{2})-/);
      if (m) return 2000 + Number(m[1]);
      return inv.year ?? new Date().getFullYear();
    })(),
    sequence: (() => {
      if (inv.sequence != null) return Number(inv.sequence);
      const n = Number(String(inv.invoiceNumber || "").split("-")[1]);
      return Number.isFinite(n) ? n : null;
    })(),
    status,
    issue_date: issueDate,
    due_date: dueDate || issueDate,
    paid_at: status === "paid" ? issueDate : null,
    currency: inv.currency || "EUR",
    line_items: lineItems,
    subtotal,
    tax_total: taxTotal,
    total,
    notes: inv.notes ?? "",
    created_by: null,
    created_at: msToIso(inv.createdAt),
    updated_at: msToIso(inv.updatedAt || inv.createdAt),
  };
});

// Next sequence per year for firm_settings
const nextByYear = {};
for (const row of invoiceRows) {
  const y = String(row.year);
  const seq = Number(row.sequence) || 0;
  nextByYear[y] = Math.max(nextByYear[y] ?? 1, seq + 1);
}

console.log("Harvey user:", HARVEY_USER_ID);
console.log("Invoices to import:", invoiceRows.length);
console.log(
  "  ",
  invoiceRows.map((r) => `${r.invoice_number} (${r.status})`).join(", ")
);
console.log("Clients to create:", clients.size);
for (const c of clients.values()) {
  console.log(`  - ${c.company} [${c.id}]`);
}
console.log(
  "Customers skipped (no invoice for this user):",
  skippedCustomers.map((c) => c.name).join(", ") || "(none)"
);
console.log("Sequence next by year:", nextByYear);

if (DRY) {
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Detect optional columns from a later migration (project_id / paid_at).
let hasProjectPaidCols = true;
{
  const { error } = await supabase
    .from("invoices")
    .select("id, project_id, paid_at")
    .limit(1);
  if (error && /project_id|paid_at/i.test(error.message)) {
    hasProjectPaidCols = false;
    console.warn(
      "Note: invoices.project_id / paid_at missing — run migration 20260725220000_invoice_project_paid.sql"
    );
  }
}

const clientRows = [...clients.values()];
{
  const { error } = await supabase.from("clients").upsert(clientRows);
  if (error) throw new Error(`clients upsert: ${error.message}`);
  console.log(`Upserted ${clientRows.length} clients`);
}

{
  const rows = hasProjectPaidCols
    ? invoiceRows
    : invoiceRows.map(({ project_id, paid_at, ...rest }) => rest);
  const { error } = await supabase.from("invoices").upsert(rows);
  if (error) throw new Error(`invoices upsert: ${error.message}`);
  console.log(`Upserted ${rows.length} invoices`);
}

{
  const { data: settings, error: readErr } = await supabase
    .from("firm_settings")
    .select("id, invoice_next_sequence_by_year")
    .limit(1)
    .maybeSingle();
  if (readErr) throw new Error(`firm_settings read: ${readErr.message}`);
  if (settings) {
    const merged = {
      ...(settings.invoice_next_sequence_by_year || {}),
    };
    for (const [y, n] of Object.entries(nextByYear)) {
      merged[y] = Math.max(Number(merged[y]) || 1, n);
    }
    const { error } = await supabase
      .from("firm_settings")
      .update({ invoice_next_sequence_by_year: merged })
      .eq("id", settings.id);
    if (error) throw new Error(`firm_settings update: ${error.message}`);
    console.log("Updated invoice_next_sequence_by_year:", merged);
  } else {
    console.warn("No firm_settings row — skip sequence update");
  }
}

console.log("\nDone.");
