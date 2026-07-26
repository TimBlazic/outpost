"use server";

import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";

import {
  computeInvoiceTotals,
  formatInvoiceNumber,
  normalizeInvoice,
  paymentAmount,
  snapshotFromClient,
  type FirmSettings,
  type Invoice,
  type InvoiceClientSnapshot,
  type InvoiceLineItem,
} from "@/lib/data";
import {
  getClientById,
  getFirmSettings,
  getInvoiceById,
  getInvoices,
  getProjectById,
  getProjects,
  saveFirmSettings,
  saveInvoices,
  saveProjects,
} from "@/lib/store";
import { getCurrentUserId, requireStudioSession } from "@/lib/auth/session";
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

/** Bundle for the invoices list side drawer. */
export async function getInvoiceDetailAction(id: string) {
  await requireStudioSession();
  const invoice = await getInvoiceById(id);
  if (!invoice) return null;
  const [settings, project] = await Promise.all([
    getFirmSettings(),
    invoice.projectId
      ? getProjectById(invoice.projectId)
      : Promise.resolve(null),
  ]);
  return {
    invoice,
    settings,
    projectName: project?.name ?? null,
  };
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
    paymentId: null,
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

/** Draft invoice for one project installment — does not assign a number. */
export async function createInvoiceFromPayment(
  projectId: string,
  paymentId: string
): Promise<string> {
  await requireStudioSession();
  const projects = await getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  const payment = project.payments.find((p) => p.id === paymentId);
  if (!payment) throw new Error("Installment not found");
  if (payment.invoiceId) return payment.invoiceId;

  const amount = paymentAmount(project.value, payment.percent);
  if (amount <= 0) throw new Error("Installment amount is zero");

  const client = project.clientId
    ? ((await getClientById(project.clientId)) ?? null)
    : null;

  const emptySnap: InvoiceClientSnapshot = {
    name: "",
    email: "",
    companyName: project.client,
    address: "",
    vatId: "",
    taxNumber: "",
    registrationNumber: "",
  };
  const clientSnapshot = client ? snapshotFromClient(client) : emptySnap;
  if (!clientSnapshot.companyName.trim()) {
    clientSnapshot.companyName = project.client;
  }

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

  const invoices = await getInvoices();
  await saveInvoices(
    invoices.map((i) =>
      i.id === invoiceId
        ? normalizeInvoice({
            ...i,
            paymentId,
            updatedAt: new Date().toISOString(),
          })
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
  const paidOn = today();
  await saveInvoices(
    invoices.map((i) =>
      i.id === id
        ? normalizeInvoice({
            ...i,
            status: "paid",
            paidAt: paidOn,
            updatedAt: new Date().toISOString(),
          })
        : i
    )
  );

  if (existing.projectId) {
    const projects = await getProjects();
    await saveProjects(
      projects.map((p) =>
        p.id === existing.projectId
          ? {
              ...p,
              payments: p.payments.map((pay) =>
                pay.id === existing.paymentId || pay.invoiceId === id
                  ? { ...pay, paid: true, paidOn }
                  : pay
              ),
            }
          : p
      )
    );
  }

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

  await saveInvoices(invoices.filter((i) => i.id !== id));

  // Unlink installment so "Invoice this" can create a new draft.
  if (existing.projectId) {
    const projects = await getProjects();
    await saveProjects(
      projects.map((p) =>
        p.id === existing.projectId
          ? {
              ...p,
              payments: p.payments.map((pay) =>
                pay.id === existing.paymentId || pay.invoiceId === id
                  ? {
                      ...pay,
                      invoiceId: null,
                      paid: false,
                      paidOn: null,
                    }
                  : pay
              ),
            }
          : p
      )
    );
  }

  revalidateInvoices(undefined, existing.clientId);
  revalidateProject(existing.projectId);
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
