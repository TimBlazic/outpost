/**
 * Supabase-backed collection API mirroring the file store shape.
 * Used when NEXT_PUBLIC_SUPABASE_* is set and OUTPOST_USE_FILE_STORE is unset.
 */

import { createClient } from "./server";
import type {
  Lead,
  Project,
  Task,
  Note,
  Activity,
  Attachment,
  Doc,
  Payment,
  FirmSettings,
  Invoice,
  InvoiceClientSnapshot,
  InvoiceLineItem,
  PortalUpdate,
  PortalComment,
  ProjectPhase,
  PhaseChecklistItem,
  PortalApproval,
  Client,
  Ticket,
  TicketComment,
  TicketCommentReaction,
} from "../data";
import {
  defaultFirmSettings,
  normalizeClient,
  normalizeFirmSettings,
  normalizeInvoice,
  normalizeLead,
  normalizeProject,
  normalizeTask,
  normalizeTicket,
} from "../data";

function throwIf(error: { message: string } | null) {
  if (error) {
    const hint = error.message.includes("schema cache")
      ? " Run supabase/migrations/20260724120000_init.sql (and firm_settings migration) in the Supabase SQL Editor."
      : "";
    throw new Error(error.message + hint);
  }
}

/** Postgres rejects "" for date columns — coerce blanks to null. */
function dateOrNull(value: string | null | undefined) {
  if (value == null) return null;
  const v = String(value).trim();
  return v.length ? v : null;
}

function mapLead(row: Record<string, unknown>): Lead {
  return normalizeLead({
    id: row.id as string,
    company: row.company as string,
    website: (row.website as string) ?? "",
    contact: (row.contact as string) ?? "",
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    country: (row.country as string) ?? "",
    category: row.category as Lead["category"],
    source: row.source as Lead["source"],
    ownerId: row.owner_id as string,
    status: row.status as Lead["status"],
    value: Number(row.value),
    probability: Number(row.probability),
    firstContact: (row.first_contact as string) ?? null,
    lastContact: (row.last_contact as string) ?? null,
    nextFollowUp: (row.next_follow_up as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    notes: Number(row.notes_count ?? 0),
    createdBy: row.created_by as string,
    description: (row.description as string) ?? "",
  });
}

function leadRow(l: Lead) {
  return {
    id: l.id,
    company: l.company,
    website: l.website,
    contact: l.contact,
    email: l.email,
    phone: l.phone,
    country: l.country,
    category: l.category,
    source: l.source,
    owner_id: l.ownerId,
    status: l.status,
    value: l.value,
    probability: l.probability,
    first_contact: dateOrNull(l.firstContact),
    last_contact: dateOrNull(l.lastContact),
    next_follow_up: dateOrNull(l.nextFollowUp),
    tags: l.tags,
    created_by: l.createdBy,
    description: l.description ?? "",
  };
}

function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    label: row.label as string,
    percent: Number(row.percent),
    dueOn: (row.due_on as string) ?? null,
    paid: Boolean(row.paid),
    paidOn: (row.paid_on as string) ?? null,
  };
}

function mapProject(
  row: Record<string, unknown>,
  payments: Payment[]
): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    client: row.client as string,
    clientId: (row.client_id as string) ?? null,
    description: (row.description as string) ?? "",
    phase: (row.phase as string) ?? "Discovery",
    type: row.type as Project["type"],
    value: Number(row.value),
    status: row.status as Project["status"],
    start: row.start_date as string,
    estimatedEnd: row.estimated_end as string,
    actualEnd: (row.actual_end as string) ?? null,
    ownerId: row.owner_id as string,
    cost: Number(row.cost),
    source: row.source as Project["source"],
    leadId: (row.lead_id as string) || undefined,
    payments,
    portalEnabled: Boolean(row.portal_enabled),
    portalToken: (row.portal_token as string) ?? null,
    portalPinHash: (row.portal_pin_hash as string) ?? null,
    stagingUrl: (row.staging_url as string) ?? null,
    portalIntro: (row.portal_intro as string) ?? null,
    figmaUrl: (row.figma_url as string) ?? null,
    repoUrl: (row.repo_url as string) ?? null,
    briefUrl: (row.brief_url as string) ?? null,
    clientCanViewTickets: row.client_can_view_tickets !== false,
    clientCanCreateTickets: row.client_can_create_tickets !== false,
    clientCanUploadFiles: row.client_can_upload_files !== false,
    clientCanComment: row.client_can_comment !== false,
    portalLocale: row.portal_locale === "sl" ? "sl" : "en",
    archivedAt: (row.archived_at as string) ?? null,
  };
}

function mapClient(row: Record<string, unknown>): Client {
  return normalizeClient({
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    company: (row.company as string) ?? "",
    website: (row.website as string) ?? "",
    country: (row.country as string) ?? "",
    notes: (row.notes as string) ?? "",
    leadId: (row.lead_id as string) || undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    archivedAt: (row.archived_at as string) ?? null,
    billingAddress: (row.billing_address as string) ?? "",
    taxNumber: (row.tax_number as string) ?? "",
    vatId: (row.vat_id as string) ?? "",
    registrationNumber: (row.registration_number as string) ?? "",
    paymentTermsDays:
      row.payment_terms_days == null
        ? null
        : Number(row.payment_terms_days),
  });
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  return normalizeInvoice({
    id: row.id as string,
    clientId: (row.client_id as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    clientSnapshot: (row.client_snapshot as InvoiceClientSnapshot) ?? {
      name: "",
      email: "",
      companyName: "",
      address: "",
      vatId: "",
      taxNumber: "",
      registrationNumber: "",
    },
    invoiceNumber: (row.invoice_number as string) ?? null,
    year: row.year == null ? null : Number(row.year),
    sequence: row.sequence == null ? null : Number(row.sequence),
    status: row.status as Invoice["status"],
    issueDate: row.issue_date as string,
    dueDate: row.due_date as string,
    paidAt: (row.paid_at as string) ?? null,
    currency: (row.currency as Invoice["currency"]) ?? "EUR",
    lineItems: (row.line_items as InvoiceLineItem[]) ?? [],
    subtotal: Number(row.subtotal ?? 0),
    taxTotal: Number(row.tax_total ?? 0),
    total: Number(row.total ?? 0),
    notes: (row.notes as string) ?? "",
    createdBy: (row.created_by as string) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  });
}

function mapTicket(row: Record<string, unknown>): Ticket {
  return normalizeTicket({
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    status: row.status as Ticket["status"],
    createdAt: row.created_at as string,
    dueAt: (row.due_at as string) ?? null,
    assigneeKind: row.assignee_kind as Ticket["assigneeKind"],
    assigneeId: (row.assignee_id as string) ?? null,
    createdByKind: row.created_by_kind as Ticket["createdByKind"],
    createdByName: (row.created_by_name as string) ?? "",
  });
}

function mapTask(row: Record<string, unknown>): Task {
  return normalizeTask({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    leadId: (row.lead_id as string) || undefined,
    projectId: (row.project_id as string) || undefined,
    assignedTo: row.assigned_to as string,
    due: row.due as string,
    priority: row.priority as Task["priority"],
    status: row.status as Task["status"],
    reminder: Boolean(row.reminder),
    clientVisible: Boolean(row.client_visible),
    waitingOnClient: Boolean(row.waiting_on_client),
  });
}

function mapPortalUpdate(row: Record<string, unknown>): PortalUpdate {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    body: row.body as string,
    authorKind: row.author_kind as PortalUpdate["authorKind"],
    authorName: (row.author_name as string) ?? "",
    createdAt: row.created_at as string,
  };
}

function mapPortalComment(row: Record<string, unknown>): PortalComment {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    targetType: row.target_type as PortalComment["targetType"],
    targetId: row.target_id as string,
    body: row.body as string,
    authorKind: row.author_kind as PortalComment["authorKind"],
    authorName: (row.author_name as string) ?? "",
    createdAt: row.created_at as string,
  };
}

function mapNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    title: row.title as string,
    body: row.body as string,
    pinned: Boolean(row.pinned),
    date: row.date as string,
    userId: row.user_id as string,
  };
}

function mapActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    type: row.type as Activity["type"],
    title: row.title as string,
    detail: (row.detail as string) || undefined,
    date: row.date as string,
    userId: row.user_id as string,
  };
}

function mapAttachment(row: Record<string, unknown>): Attachment {
  return {
    id: row.id as string,
    parentType: row.parent_type as Attachment["parentType"],
    parentId: row.parent_id as string,
    label: row.label as string,
    kind: row.kind as Attachment["kind"],
    url: (row.url as string) ?? null,
    storagePath: (row.storage_path as string) ?? null,
    mime: (row.mime as string) ?? null,
    size: row.size == null ? null : Number(row.size),
  };
}

function mapDoc(row: Record<string, unknown>): Doc {
  return {
    id: row.id as string,
    title: row.title as string,
    category: row.category as Doc["category"],
    excerpt: row.excerpt as string,
    authorId: row.author_id as string,
    lastEdited: row.last_edited as string,
    tags: (row.tags as string[]) ?? [],
    favorite: Boolean(row.favorite),
    body: row.body as string,
  };
}

export async function getLeads() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  throwIf(error);
  const leads = (data ?? []).map(mapLead);
  // Attach note counts
  const { data: notes } = await supabase.from("notes").select("lead_id");
  const counts = new Map<string, number>();
  for (const n of notes ?? []) {
    const id = n.lead_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return leads.map((l) => ({ ...l, notes: counts.get(l.id) ?? 0 }));
}

export async function saveLeads(leads: Lead[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("leads").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(leads.map((l) => l.id));

  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("leads").delete().in("id", toDelete);
    throwIf(error);
  }

  if (leads.length) {
    const { error } = await supabase.from("leads").upsert(leads.map(leadRow));
    throwIf(error);
  }
}

export async function getProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  throwIf(error);
  const { data: pays, error: payErr } = await supabase.from("payments").select("*");
  throwIf(payErr);
  const byProject = new Map<string, Payment[]>();
  for (const p of pays ?? []) {
    const pay = mapPayment(p);
    const list = byProject.get(p.project_id as string) ?? [];
    list.push(pay);
    byProject.set(p.project_id as string, list);
  }
  return (data ?? []).map((row) =>
    normalizeProject(mapProject(row, byProject.get(row.id as string) ?? []))
  );
}

export async function saveProjects(projects: Project[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("projects").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(projects.map((p) => p.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("projects").delete().in("id", toDelete);
    throwIf(error);
  }

  for (const p of projects) {
    const { error } = await supabase.from("projects").upsert({
      id: p.id,
      name: p.name,
      client: p.client,
      client_id: p.clientId,
      description: p.description,
      phase: p.phase,
      type: p.type,
      value: p.value,
      status: p.status,
      start_date: dateOrNull(p.start),
      estimated_end: dateOrNull(p.estimatedEnd),
      actual_end: dateOrNull(p.actualEnd),
      owner_id: p.ownerId,
      cost: p.cost,
      source: p.source,
      lead_id: p.leadId ?? null,
      portal_enabled: p.portalEnabled,
      portal_token: p.portalToken,
      portal_pin_hash: p.portalPinHash,
      staging_url: p.stagingUrl,
      portal_intro: p.portalIntro,
      figma_url: p.figmaUrl,
      repo_url: p.repoUrl,
      brief_url: p.briefUrl,
      client_can_view_tickets: p.clientCanViewTickets,
      client_can_create_tickets: p.clientCanCreateTickets,
      client_can_upload_files: p.clientCanUploadFiles,
      client_can_comment: p.clientCanComment,
      portal_locale: p.portalLocale === "sl" ? "sl" : "en",
      archived_at: p.archivedAt ?? null,
    });
    throwIf(error);

    const { data: existingPays } = await supabase
      .from("payments")
      .select("id")
      .eq("project_id", p.id);
    const payIds = new Set(p.payments.map((x) => x.id));
    const stale = (existingPays ?? [])
      .map((x) => x.id as string)
      .filter((id) => !payIds.has(id));
    if (stale.length) {
      const { error: delErr } = await supabase.from("payments").delete().in("id", stale);
      throwIf(delErr);
    }
    if (p.payments.length) {
      const { error: payErr } = await supabase.from("payments").upsert(
        p.payments.map((pay) => ({
          id: pay.id,
          project_id: p.id,
          label: pay.label,
          percent: pay.percent,
          due_on: dateOrNull(pay.dueOn),
          paid: pay.paid,
          paid_on: dateOrNull(pay.paidOn),
        }))
      );
      throwIf(payErr);
    }
  }
}

export async function getTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").order("due");
  throwIf(error);
  return (data ?? []).map(mapTask);
}

export async function saveTasks(tasks: Task[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tasks").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(tasks.map((t) => t.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("tasks").delete().in("id", toDelete);
    throwIf(error);
  }
  if (tasks.length) {
    const { error } = await supabase.from("tasks").upsert(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        lead_id: t.leadId ?? null,
        project_id: t.projectId ?? null,
        assigned_to: t.assignedTo,
        due: dateOrNull(t.due),
        priority: t.priority,
        status: t.status,
        reminder: t.reminder,
        client_visible: t.clientVisible,
        waiting_on_client: t.waitingOnClient,
      }))
    );
    throwIf(error);
  }
}

export async function getPortalUpdates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portal_updates")
    .select("*")
    .order("created_at", { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapPortalUpdate);
}

export async function savePortalUpdates(items: PortalUpdate[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("portal_updates").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(items.map((u) => u.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("portal_updates")
      .delete()
      .in("id", toDelete);
    throwIf(error);
  }
  if (items.length) {
    const { error } = await supabase.from("portal_updates").upsert(
      items.map((u) => ({
        id: u.id,
        project_id: u.projectId,
        body: u.body,
        author_kind: u.authorKind,
        author_name: u.authorName,
        created_at: u.createdAt,
      }))
    );
    throwIf(error);
  }
}

export async function getPortalComments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portal_comments")
    .select("*")
    .order("created_at", { ascending: true });
  throwIf(error);
  return (data ?? []).map(mapPortalComment);
}

export async function savePortalComments(items: PortalComment[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("portal_comments")
    .select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(items.map((c) => c.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("portal_comments")
      .delete()
      .in("id", toDelete);
    throwIf(error);
  }
  if (items.length) {
    const { error } = await supabase.from("portal_comments").upsert(
      items.map((c) => ({
        id: c.id,
        project_id: c.projectId,
        target_type: c.targetType,
        target_id: c.targetId,
        body: c.body,
        author_kind: c.authorKind,
        author_name: c.authorName,
        created_at: c.createdAt,
      }))
    );
    throwIf(error);
  }
}

export async function getNotes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notes").select("*").order("date", { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapNote);
}

export async function saveNotes(notes: Note[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("notes").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(notes.map((n) => n.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("notes").delete().in("id", toDelete);
    throwIf(error);
  }
  if (notes.length) {
    const { error } = await supabase.from("notes").upsert(
      notes.map((n) => ({
        id: n.id,
        lead_id: n.leadId,
        title: n.title,
        body: n.body,
        pinned: n.pinned,
        date: n.date,
        user_id: n.userId,
      }))
    );
    throwIf(error);
  }
}

export async function getActivities() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("date", { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapActivity);
}

export async function saveActivities(activities: Activity[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("activities").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(activities.map((a) => a.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("activities").delete().in("id", toDelete);
    throwIf(error);
  }
  if (activities.length) {
    const { error } = await supabase.from("activities").upsert(
      activities.map((a) => ({
        id: a.id,
        lead_id: a.leadId,
        type: a.type,
        title: a.title,
        detail: a.detail ?? null,
        date: a.date,
        user_id: a.userId,
      }))
    );
    throwIf(error);
  }
}

export async function getAttachments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .order("created_at", { ascending: false });
  throwIf(error);
  const items = (data ?? []).map(mapAttachment);

  // Private bucket — mint short-lived signed URLs for storage objects.
  return Promise.all(
    items.map(async (a) => {
      if (a.url) return a;
      if (!a.storagePath || a.storagePath.startsWith("local:")) return a;
      const { data: signed } = await supabase.storage
        .from("attachments")
        .createSignedUrl(a.storagePath, 60 * 60);
      return { ...a, url: signed?.signedUrl ?? null };
    })
  );
}

export async function saveAttachments(items: Attachment[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("attachments").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(items.map((a) => a.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("attachments").delete().in("id", toDelete);
    throwIf(error);
  }
  if (items.length) {
    const { error } = await supabase.from("attachments").upsert(
      items.map((a) => ({
        id: a.id,
        parent_type: a.parentType,
        parent_id: a.parentId,
        label: a.label,
        kind: a.kind,
        url: a.url,
        storage_path: a.storagePath ?? null,
        mime: a.mime ?? null,
        size: a.size ?? null,
      }))
    );
    throwIf(error);
  }
}

export async function getDocs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("docs")
    .select("*")
    .order("last_edited", { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapDoc);
}

export async function saveDocs(docs: Doc[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("docs").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(docs.map((d) => d.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("docs").delete().in("id", toDelete);
    throwIf(error);
  }
  if (docs.length) {
    const { error } = await supabase.from("docs").upsert(
      docs.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        excerpt: d.excerpt,
        body: d.body ?? "",
        author_id: d.authorId,
        last_edited: d.lastEdited,
        tags: d.tags,
        favorite: d.favorite,
      }))
    );
    throwIf(error);
  }
}

export async function getFirmSettings(): Promise<FirmSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("firm_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  throwIf(error);
  if (!data) return { ...defaultFirmSettings };
  return normalizeFirmSettings({
    firmName: (data.firm_name as string) || defaultFirmSettings.firmName,
    revenueGoal: Number(data.revenue_goal ?? defaultFirmSettings.revenueGoal),
    goalYear: Number(data.goal_year ?? defaultFirmSettings.goalYear),
    avgProjectValue: Number(
      data.avg_project_value ?? defaultFirmSettings.avgProjectValue
    ),
    monthlyRevenue:
      (data.monthly_revenue as FirmSettings["monthlyRevenue"]) ??
      defaultFirmSettings.monthlyRevenue,
    billingCompanyName: (data.billing_company_name as string) ?? "",
    billingAddress: (data.billing_address as string) ?? "",
    billingEmail: (data.billing_email as string) ?? "",
    billingPhone: (data.billing_phone as string) ?? "",
    taxNumber: (data.tax_number as string) ?? "",
    vatId: (data.vat_id as string) ?? "",
    vatStatus: (data.vat_status as string) ?? "",
    registrationNumber: (data.registration_number as string) ?? "",
    iban: (data.iban as string) ?? "",
    bic: (data.bic as string) ?? "",
    bankName: (data.bank_name as string) ?? "",
    issuePlace: (data.issue_place as string) ?? "",
    signaturePath: (data.signature_path as string) ?? null,
    invoicePrefix: (data.invoice_prefix as string) ?? "",
    invoiceNextSequenceByYear:
      (data.invoice_next_sequence_by_year as Record<string, number>) ?? {},
    defaultCurrency:
      (data.default_currency as FirmSettings["defaultCurrency"]) ?? "EUR",
    defaultPaymentTermsDays: Number(
      data.default_payment_terms_days ??
        defaultFirmSettings.defaultPaymentTermsDays
    ),
    aiEmailSystemPrompt: (data.ai_email_system_prompt as string) ?? "",
  });
}

export async function saveFirmSettings(settings: FirmSettings) {
  const supabase = await createClient();
  const s = normalizeFirmSettings(settings);
  const { error } = await supabase.from("firm_settings").upsert({
    id: "default",
    firm_name: s.firmName,
    revenue_goal: s.revenueGoal,
    goal_year: s.goalYear,
    avg_project_value: s.avgProjectValue,
    monthly_revenue: s.monthlyRevenue,
    billing_company_name: s.billingCompanyName,
    billing_address: s.billingAddress,
    billing_email: s.billingEmail,
    billing_phone: s.billingPhone,
    tax_number: s.taxNumber,
    vat_id: s.vatId,
    vat_status: s.vatStatus,
    registration_number: s.registrationNumber,
    iban: s.iban,
    bic: s.bic,
    bank_name: s.bankName,
    issue_place: s.issuePlace,
    signature_path: s.signaturePath,
    invoice_prefix: s.invoicePrefix,
    invoice_next_sequence_by_year: s.invoiceNextSequenceByYear,
    default_currency: s.defaultCurrency,
    default_payment_terms_days: s.defaultPaymentTermsDays,
    ai_email_system_prompt: s.aiEmailSystemPrompt,
    updated_at: new Date().toISOString(),
  });
  throwIf(error);
}

export async function getProjectPhases(): Promise<ProjectPhase[]> {
  const supabase = await createClient();
  const { data: phases, error } = await supabase
    .from("project_phases")
    .select("*")
    .order("sort_order");
  throwIf(error);
  const { data: items, error: itemsErr } = await supabase
    .from("phase_checklist_items")
    .select("*");
  throwIf(itemsErr);

  const byPhase = new Map<string, PhaseChecklistItem[]>();
  for (const row of items ?? []) {
    const item: PhaseChecklistItem = {
      id: row.id as string,
      phaseId: row.phase_id as string,
      title: row.title as string,
      done: Boolean(row.done),
      clientVisible: Boolean(row.client_visible),
      waitingOnClient: Boolean(row.waiting_on_client),
    };
    const list = byPhase.get(item.phaseId) ?? [];
    list.push(item);
    byPhase.set(item.phaseId, list);
  }

  return (phases ?? []).map(
    (row): ProjectPhase => ({
      id: row.id as string,
      projectId: row.project_id as string,
      key: row.key as string,
      label: row.label as string,
      sortOrder: Number(row.sort_order),
      status: row.status as ProjectPhase["status"],
      checklist: byPhase.get(row.id as string) ?? [],
    })
  );
}

export async function saveProjectPhases(phases: ProjectPhase[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("project_phases").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(phases.map((p) => p.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("project_phases")
      .delete()
      .in("id", toDelete);
    throwIf(error);
  }

  if (phases.length) {
    const { error } = await supabase.from("project_phases").upsert(
      phases.map((p) => ({
        id: p.id,
        project_id: p.projectId,
        key: p.key,
        label: p.label,
        sort_order: p.sortOrder,
        status: p.status,
      }))
    );
    throwIf(error);
  }

  const allItems = phases.flatMap((p) => p.checklist);
  const { data: existingItems } = await supabase
    .from("phase_checklist_items")
    .select("id");
  const existingItemIds = new Set(
    (existingItems ?? []).map((r) => r.id as string)
  );
  const nextItemIds = new Set(allItems.map((i) => i.id));
  const staleItems = [...existingItemIds].filter((id) => !nextItemIds.has(id));
  if (staleItems.length) {
    const { error } = await supabase
      .from("phase_checklist_items")
      .delete()
      .in("id", staleItems);
    throwIf(error);
  }
  if (allItems.length) {
    const { error } = await supabase.from("phase_checklist_items").upsert(
      allItems.map((i) => ({
        id: i.id,
        phase_id: i.phaseId,
        title: i.title,
        done: i.done,
        client_visible: i.clientVisible,
        waiting_on_client: i.waitingOnClient,
      }))
    );
    throwIf(error);
  }
}

export async function getPortalApprovals(): Promise<PortalApproval[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("portal_approvals").select("*");
  throwIf(error);
  return (data ?? []).map(
    (row): PortalApproval => ({
      id: row.id as string,
      projectId: row.project_id as string,
      kind: row.kind as PortalApproval["kind"],
      approvedAt: row.approved_at as string,
      approvedByName: (row.approved_by_name as string) ?? "",
      note: (row.note as string) ?? null,
    })
  );
}

export async function savePortalApprovals(items: PortalApproval[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("portal_approvals")
    .select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(items.map((a) => a.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("portal_approvals")
      .delete()
      .in("id", toDelete);
    throwIf(error);
  }
  if (items.length) {
    const { error } = await supabase.from("portal_approvals").upsert(
      items.map((a) => ({
        id: a.id,
        project_id: a.projectId,
        kind: a.kind,
        approved_at: a.approvedAt,
        approved_by_name: a.approvedByName,
        note: a.note,
      }))
    );
    throwIf(error);
  }
}

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapClient);
}

export async function saveClients(clients: Client[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("clients").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(clients.map((c) => c.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("clients").delete().in("id", toDelete);
    throwIf(error);
  }
  if (clients.length) {
    const { error } = await supabase.from("clients").upsert(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        website: c.website,
        country: c.country,
        notes: c.notes,
        lead_id: c.leadId ?? null,
        created_at: c.createdAt,
        archived_at: c.archivedAt ?? null,
        billing_address: c.billingAddress,
        tax_number: c.taxNumber,
        vat_id: c.vatId,
        registration_number: c.registrationNumber,
        payment_terms_days: c.paymentTermsDays,
      }))
    );
    throwIf(error);
  }
}

export async function getInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("issue_date", { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapInvoice);
}

export async function saveInvoices(invoices: Invoice[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("invoices").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(invoices.map((i) => i.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("invoices")
      .delete()
      .in("id", toDelete);
    throwIf(error);
  }
  if (invoices.length) {
    const { error } = await supabase.from("invoices").upsert(
      invoices.map((i) => ({
        id: i.id,
        client_id: i.clientId,
        project_id: i.projectId,
        client_snapshot: i.clientSnapshot,
        invoice_number: i.invoiceNumber,
        year: i.year,
        sequence: i.sequence,
        status: i.status,
        issue_date: i.issueDate,
        due_date: i.dueDate,
        paid_at: i.paidAt,
        currency: i.currency,
        line_items: i.lineItems,
        subtotal: i.subtotal,
        tax_total: i.taxTotal,
        total: i.total,
        notes: i.notes,
        created_by: i.createdBy,
        created_at: i.createdAt,
        updated_at: i.updatedAt,
      }))
    );
    throwIf(error);
  }
}

export async function getTickets(): Promise<Ticket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapTicket);
}

export async function saveTickets(tickets: Ticket[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tickets").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(tickets.map((t) => t.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("tickets").delete().in("id", toDelete);
    throwIf(error);
  }
  if (tickets.length) {
    const { error } = await supabase.from("tickets").upsert(
      tickets.map((t) => ({
        id: t.id,
        project_id: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        created_at: t.createdAt,
        due_at: dateOrNull(t.dueAt),
        assignee_kind: t.assigneeKind,
        assignee_id: t.assigneeId,
        created_by_kind: t.createdByKind,
        created_by_name: t.createdByName,
      }))
    );
    throwIf(error);
  }
}

function mapTicketComment(row: Record<string, unknown>): TicketComment {
  return {
    id: row.id as string,
    ticketId: row.ticket_id as string,
    parentId: (row.parent_id as string) ?? null,
    body: (row.body as string) ?? "",
    authorKind: row.author_kind as TicketComment["authorKind"],
    authorName: (row.author_name as string) ?? "",
    authorId: (row.author_id as string) ?? null,
    createdAt: row.created_at as string,
    editedAt: (row.edited_at as string) ?? null,
  };
}

function mapTicketCommentReaction(
  row: Record<string, unknown>
): TicketCommentReaction {
  return {
    id: row.id as string,
    commentId: row.comment_id as string,
    emoji: row.emoji as string,
    authorKind: row.author_kind as TicketCommentReaction["authorKind"],
    authorName: (row.author_name as string) ?? "",
    createdAt: row.created_at as string,
  };
}

export async function getTicketComments(): Promise<TicketComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_comments")
    .select("*")
    .order("created_at", { ascending: true });
  throwIf(error);
  return (data ?? []).map(mapTicketComment);
}

export async function saveTicketComments(comments: TicketComment[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("ticket_comments").select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(comments.map((c) => c.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("ticket_comments")
      .delete()
      .in("id", toDelete);
    throwIf(error);
  }
  if (comments.length) {
    const { error } = await supabase.from("ticket_comments").upsert(
      comments.map((c) => ({
        id: c.id,
        ticket_id: c.ticketId,
        parent_id: c.parentId,
        body: c.body,
        author_kind: c.authorKind,
        author_name: c.authorName,
        author_id: c.authorId,
        created_at: c.createdAt,
        edited_at: c.editedAt,
      }))
    );
    throwIf(error);
  }
}

export async function getTicketCommentReactions(): Promise<
  TicketCommentReaction[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_comment_reactions")
    .select("*")
    .order("created_at", { ascending: true });
  throwIf(error);
  return (data ?? []).map(mapTicketCommentReaction);
}

export async function saveTicketCommentReactions(
  reactions: TicketCommentReaction[]
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ticket_comment_reactions")
    .select("id");
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const nextIds = new Set(reactions.map((r) => r.id));
  const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("ticket_comment_reactions")
      .delete()
      .in("id", toDelete);
    throwIf(error);
  }
  if (reactions.length) {
    const { error } = await supabase.from("ticket_comment_reactions").upsert(
      reactions.map((r) => ({
        id: r.id,
        comment_id: r.commentId,
        emoji: r.emoji,
        author_kind: r.authorKind,
        author_name: r.authorName,
        created_at: r.createdAt,
      }))
    );
    throwIf(error);
  }
}
