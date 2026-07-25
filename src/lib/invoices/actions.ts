"use server";

import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";

import {
  computeInvoiceTotals,
  formatInvoiceNumber,
  normalizeInvoice,
  type FirmSettings,
  type Invoice,
  type InvoiceClientSnapshot,
  type InvoiceLineItem,
} from "@/lib/data";
import {
  getFirmSettings,
  getInvoices,
  saveFirmSettings,
  saveInvoices,
} from "@/lib/store";
import { getCurrentUserId } from "@/lib/auth/session";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function revalidateInvoices(id?: string, clientId?: string | null) {
  revalidatePath("/invoices");
  revalidatePath("/");
  revalidatePath("/clients");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (id) {
    revalidatePath(`/invoices/${id}`);
    revalidatePath(`/invoices/${id}/edit`);
  }
}

export type InvoiceInput = {
  clientId: string | null;
  projectId: string | null;
  clientSnapshot: InvoiceClientSnapshot;
  issueDate: string;
  dueDate: string;
  currency: Invoice["currency"];
  lineItems: InvoiceLineItem[];
  notes: string;
};

function buildMoneyFields(input: InvoiceInput) {
  const totals = computeInvoiceTotals(input.lineItems);
  return {
    clientId: input.clientId,
    projectId: input.projectId,
    clientSnapshot: input.clientSnapshot,
    issueDate: input.issueDate || today(),
    dueDate: input.dueDate || today(),
    currency: input.currency || "EUR",
    lineItems: input.lineItems,
    notes: input.notes ?? "",
    ...totals,
  };
}

function revalidateProject(projectId: string | null | undefined) {
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createInvoice(input: InvoiceInput) {
  const invoices = await getInvoices();
  const now = new Date().toISOString();
  const invoice = normalizeInvoice({
    id: uid("inv"),
    invoiceNumber: null,
    year: null,
    sequence: null,
    status: "draft",
    paidAt: null,
    createdBy: await getCurrentUserId(),
    createdAt: now,
    updatedAt: now,
    ...buildMoneyFields(input),
  });
  await saveInvoices([invoice, ...invoices]);
  revalidateInvoices(invoice.id, invoice.clientId);
  revalidateProject(invoice.projectId);
  return invoice.id;
}

export async function updateInvoice(id: string, input: InvoiceInput) {
  const invoices = await getInvoices();
  const existing = invoices.find((i) => i.id === id);
  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "draft") {
    throw new Error("Only draft invoices can be edited");
  }
  const next = normalizeInvoice({
    ...existing,
    ...buildMoneyFields(input),
    updatedAt: new Date().toISOString(),
  });
  await saveInvoices(invoices.map((i) => (i.id === id ? next : i)));
  revalidateInvoices(id, next.clientId);
  revalidateProject(existing.projectId);
  revalidateProject(next.projectId);
}

export async function issueInvoice(id: string) {
  const invoices = await getInvoices();
  const existing = invoices.find((i) => i.id === id);
  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "draft") {
    throw new Error("Only draft invoices can be issued");
  }

  const settings = await getFirmSettings();
  const year = Number(existing.issueDate.slice(0, 4));
  const yearKey = String(year);
  const sequence = settings.invoiceNextSequenceByYear[yearKey] ?? 1;
  const invoiceNumber = formatInvoiceNumber(year, sequence);

  const nextSettings: FirmSettings = {
    ...settings,
    invoiceNextSequenceByYear: {
      ...settings.invoiceNextSequenceByYear,
      [yearKey]: sequence + 1,
    },
  };
  await saveFirmSettings(nextSettings);

  const next = normalizeInvoice({
    ...existing,
    status: "issued",
    year,
    sequence,
    invoiceNumber,
    updatedAt: new Date().toISOString(),
  });
  await saveInvoices(invoices.map((i) => (i.id === id ? next : i)));
  revalidateInvoices(id, next.clientId);
  revalidatePath("/settings");
}

export async function markInvoicePaid(id: string) {
  const invoices = await getInvoices();
  const existing = invoices.find((i) => i.id === id);
  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "issued") {
    throw new Error("Only issued invoices can be marked paid");
  }
  await saveInvoices(
    invoices.map((i) =>
      i.id === id
        ? normalizeInvoice({
            ...i,
            status: "paid",
            paidAt: today(),
            updatedAt: new Date().toISOString(),
          })
        : i
    )
  );
  revalidateInvoices(id, existing.clientId);
  revalidateProject(existing.projectId);
}

export async function voidInvoice(id: string) {
  const invoices = await getInvoices();
  const existing = invoices.find((i) => i.id === id);
  if (!existing) throw new Error("Invoice not found");
  if (existing.status === "void") return;
  await saveInvoices(
    invoices.map((i) =>
      i.id === id
        ? normalizeInvoice({
            ...i,
            status: "void",
            paidAt: null,
            updatedAt: new Date().toISOString(),
          })
        : i
    )
  );
  revalidateInvoices(id, existing.clientId);
  revalidateProject(existing.projectId);
}

export async function deleteInvoice(id: string) {
  const invoices = await getInvoices();
  const existing = invoices.find((i) => i.id === id);
  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "draft" && existing.status !== "void") {
    throw new Error("Only draft or void invoices can be deleted");
  }
  await saveInvoices(invoices.filter((i) => i.id !== id));
  revalidateInvoices(undefined, existing.clientId);
}

export async function uploadInvoiceSignature(formData: FormData) {
  const file = formData.get("signature");
  if (!(file instanceof File) || !file.size) {
    throw new Error("No signature file provided");
  }
  const allowed = ["image/png", "image/jpeg", "image/jpg"];
  if (!allowed.includes(file.type) && !file.type.startsWith("image/")) {
    throw new Error("Signature must be a PNG or JPEG image");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Signature must be under 2MB");
  }

  const ext =
    file.type.includes("jpeg") || file.type.includes("jpg")
      ? "jpg"
      : file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "png";
  const safeExt = ext === "jpeg" ? "jpg" : ext === "jpg" ? "jpg" : "png";
  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getFirmSettings();
  let signaturePath: string;

  if (isSupabaseEnabled()) {
    const storagePath = `signatures/signature.${safeExt}`;
    const supabase = await createSupabaseServerClient();
    // Clear sibling extensions so loaders don't pick a stale file
    await supabase.storage
      .from("attachments")
      .remove([
        "signatures/signature.png",
        "signatures/signature.jpg",
        "signatures/signature.jpeg",
      ])
      .catch(() => undefined);
    const { error } = await supabase.storage
      .from("attachments")
      .upload(storagePath, buffer, {
        contentType: safeExt === "jpg" ? "image/jpeg" : "image/png",
        upsert: true,
      });
    if (error) throw new Error(error.message);
    signaturePath = storagePath;
  } else {
    const rel = path.join("signatures", `signature.${safeExt}`);
    const dest = path.join(process.cwd(), "data", "uploads", rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    signaturePath = `signatures/signature.${safeExt}`;
  }

  await saveFirmSettings({ ...settings, signaturePath });
  revalidatePath("/settings");
  revalidatePath("/invoices");
  return signaturePath;
}

export async function clearInvoiceSignature() {
  const settings = await getFirmSettings();
  if (settings.signaturePath) {
    const clean = settings.signaturePath.split("?")[0];
    if (isSupabaseEnabled() && !clean.startsWith("/")) {
      const supabase = await createSupabaseServerClient();
      await supabase.storage
        .from("attachments")
        .remove([
          clean,
          "signatures/signature.png",
          "signatures/signature.jpg",
          "signatures/signature.jpeg",
        ]);
    } else {
      const rel = clean.startsWith("/api/files/")
        ? clean.replace(/^\/api\/files\//, "")
        : clean.replace(/^\//, "");
      if (rel && !rel.includes("://")) {
        await fs
          .unlink(path.join(process.cwd(), "data", "uploads", ...rel.split("/")))
          .catch(() => undefined);
      }
    }
  }
  await saveFirmSettings({ ...settings, signaturePath: null });
  revalidatePath("/settings");
  revalidatePath("/invoices");
}
