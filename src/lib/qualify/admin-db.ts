import {
  defaultFirmSettings,
  normalizeFirmSettings,
  normalizeLead,
  type Activity,
  type FirmSettings,
  type Lead,
  type Note,
} from "@/lib/data";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";

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
    createdAt: (row.created_at as string) ?? "",
    description: (row.description as string) ?? "",
    qualifyScore:
      row.qualify_score == null || row.qualify_score === ""
        ? null
        : Number(row.qualify_score),
    qualifyRating: (() => {
      const r = row.qualify_rating as string | null | undefined;
      return r === "go" || r === "maybe" || r === "no-go" ? r : null;
    })(),
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
    created_at: l.createdAt || new Date().toISOString(),
    description: l.description ?? "",
    qualify_score: l.qualifyScore,
    qualify_rating: l.qualifyRating,
  };
}

function mapFirmSettings(data: Record<string, unknown>): FirmSettings {
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
    quoteNextSequenceByYear:
      (data.quote_next_sequence_by_year as Record<string, number>) ?? {},
    defaultCurrency:
      (data.default_currency as FirmSettings["defaultCurrency"]) ?? "EUR",
    defaultPaymentTermsDays: Number(
      data.default_payment_terms_days ??
        defaultFirmSettings.defaultPaymentTermsDays
    ),
    aiEmailSystemPrompt: (data.ai_email_system_prompt as string) ?? "",
    aiQualifyPricingPrompt: (data.ai_qualify_pricing_prompt as string) ?? "",
    outboundFromName: (data.outbound_from_name as string) ?? "",
    outboundFromEmail: (data.outbound_from_email as string) ?? "",
    dashboardKpis:
      (data.dashboard_kpis as string[]) ?? defaultFirmSettings.dashboardKpis,
  });
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function adminGetLeadById(leadId: string): Promise<Lead | null> {
  if (!hasAdminClient()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapLead(data as Record<string, unknown>) : null;
}

export async function adminGetFirmSettings(): Promise<FirmSettings> {
  if (!hasAdminClient()) return { ...defaultFirmSettings };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("firm_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ...defaultFirmSettings };
  return mapFirmSettings(data as Record<string, unknown>);
}

export async function adminUpsertLead(lead: Lead): Promise<void> {
  if (!hasAdminClient()) throw new Error("Admin client unavailable");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("leads")
    .upsert(leadRow(normalizeLead(lead)));
  if (error) throw new Error(error.message);
}

export async function adminInsertActivity(
  leadId: string,
  input: { type: Activity["type"]; title: string; detail: string },
  userId: string
): Promise<void> {
  if (!hasAdminClient()) throw new Error("Admin client unavailable");
  const supabase = createAdminClient();
  const { error } = await supabase.from("activities").insert({
    id: uid("a"),
    lead_id: leadId,
    type: input.type,
    title: input.title,
    detail: input.detail || null,
    date: today(),
    user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function adminInsertNote(
  leadId: string,
  input: { title: string; body: string; pinned: boolean },
  userId: string
): Promise<void> {
  if (!hasAdminClient()) throw new Error("Admin client unavailable");
  const supabase = createAdminClient();
  const note: Note = {
    id: uid("n"),
    leadId,
    title: input.title || "Untitled note",
    body: input.body,
    pinned: input.pinned,
    date: today(),
    userId,
  };
  const { error } = await supabase.from("notes").insert({
    id: note.id,
    lead_id: note.leadId,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    date: note.date,
    user_id: note.userId,
  });
  if (error) throw new Error(error.message);
}
