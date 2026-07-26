"use server";

import { revalidatePath } from "next/cache";

import { setLeadStatus } from "@/lib/actions";
import { getCurrentUserId, requireStudioSession } from "@/lib/auth/session";
import {
  computeQuoteTotals,
  formatQuoteNumber,
  leadStatuses,
  normalizeQuote,
  type QuoteLineItem,
  type QuoteStatus,
} from "@/lib/data";
import {
  getActivities,
  getFirmSettings,
  getLeadById,
  getLeads,
  getQuotes,
  saveActivities,
  saveFirmSettings,
  saveLeads,
  saveQuotes,
} from "@/lib/store";
import { sendStudioEmail } from "@/lib/email/resend";
import { generateQuoteDraft } from "./ai";
import { generateQuoteEmail } from "./email";
import { renderQuotePdf } from "./render";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function revalidateQuotes(id?: string, leadId?: string | null) {
  revalidatePath("/quotes");
  if (id) {
    revalidatePath(`/quotes/${id}`);
    revalidatePath(`/quotes/${id}/edit`);
  }
  if (leadId) {
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
  }
}

export type QuoteInput = {
  leadId: string | null;
  locale: "sl" | "en";
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  intro: string;
  scope: string;
  notes: string;
  discoveryNotes: string;
  projectDuration: string;
  lineItems: QuoteLineItem[];
  validUntil: string | null;
};

// Note: do not `export type { Quote }` from this "use server" module —
// Next re-exports actions as values and crashes with Quote is not defined.

function buildFields(input: QuoteInput) {
  const lineItems = input.lineItems;
  const totals = computeQuoteTotals(lineItems);
  return {
    leadId: input.leadId,
    locale: input.locale,
    clientName: input.clientName.trim(),
    clientCompany: input.clientCompany.trim(),
    clientEmail: input.clientEmail.trim(),
    intro: input.intro,
    scope: input.scope,
    notes: input.notes,
    discoveryNotes: input.discoveryNotes,
    projectDuration: input.projectDuration.trim(),
    lineItems,
    currency: "EUR" as const,
    validUntil: input.validUntil?.trim() || null,
    ...totals,
  };
}

async function allocateQuoteNumber(): Promise<{
  number: string;
  year: number;
  sequence: number;
}> {
  const settings = await getFirmSettings();
  const year = new Date().getFullYear();
  const yearKey = String(year);
  const sequence = settings.quoteNextSequenceByYear[yearKey] ?? 1;
  const number = formatQuoteNumber(year, sequence);
  await saveFirmSettings({
    ...settings,
    quoteNextSequenceByYear: {
      ...settings.quoteNextSequenceByYear,
      [yearKey]: sequence + 1,
    },
  });
  return { number, year, sequence };
}

export async function createQuote(input: QuoteInput) {
  await requireStudioSession();
  const quotes = await getQuotes();
  const now = new Date().toISOString();
  const { number, year, sequence } = await allocateQuoteNumber();
  const quote = normalizeQuote({
    id: uid("q"),
    status: "draft",
    number,
    year,
    sequence,
    sentAt: null,
    createdBy: await getCurrentUserId(),
    createdAt: now,
    updatedAt: now,
    ...buildFields(input),
  });
  await saveQuotes([quote, ...quotes]);
  revalidateQuotes(quote.id, quote.leadId);
  revalidatePath("/settings");
  return quote.id;
}

/** Assign P-YY-NNNN if the quote still has no number (legacy drafts). */
export async function ensureQuoteNumbered(id: string) {
  await requireStudioSession();
  const quotes = await getQuotes();
  const existing = quotes.find((q) => q.id === id);
  if (!existing) return null;
  if (existing.number) return existing;

  const { number, year, sequence } = await allocateQuoteNumber();
  const next = normalizeQuote({
    ...existing,
    number,
    year,
    sequence,
    updatedAt: new Date().toISOString(),
  });
  await saveQuotes(quotes.map((q) => (q.id === id ? next : q)));
  revalidateQuotes(id, next.leadId);
  revalidatePath("/settings");
  return next;
}

export async function updateQuote(id: string, input: QuoteInput) {
  await requireStudioSession();
  const quotes = await getQuotes();
  const existing = quotes.find((q) => q.id === id);
  if (!existing) throw new Error("Quote not found");
  if (existing.status !== "draft") {
    throw new Error("Only draft quotes can be edited");
  }
  const allocated =
    existing.number == null ? await allocateQuoteNumber() : null;
  const next = normalizeQuote({
    ...existing,
    ...buildFields(input),
    ...(allocated
      ? {
          number: allocated.number,
          year: allocated.year,
          sequence: allocated.sequence,
        }
      : {}),
    updatedAt: new Date().toISOString(),
  });
  await saveQuotes(quotes.map((q) => (q.id === id ? next : q)));
  revalidateQuotes(id, next.leadId);
  if (allocated) revalidatePath("/settings");
}

export async function deleteQuote(id: string) {
  await requireStudioSession();
  const quotes = await getQuotes();
  const existing = quotes.find((q) => q.id === id);
  if (!existing) throw new Error("Quote not found");
  if (existing.status !== "draft" && existing.status !== "declined") {
    throw new Error("Only draft or declined quotes can be deleted");
  }
  await saveQuotes(quotes.filter((q) => q.id !== id));
  revalidateQuotes(undefined, existing.leadId);
}

export async function markQuoteSent(id: string) {
  await requireStudioSession();
  const quotes = await getQuotes();
  const existing = quotes.find((q) => q.id === id);
  if (!existing) throw new Error("Quote not found");
  if (existing.status !== "draft") {
    throw new Error("Only draft quotes can be marked sent");
  }

  let number = existing.number;
  let year = existing.year;
  let sequence = existing.sequence;
  if (!number) {
    const allocated = await allocateQuoteNumber();
    number = allocated.number;
    year = allocated.year;
    sequence = allocated.sequence;
  }

  const nowIso = new Date().toISOString();
  const next = normalizeQuote({
    ...existing,
    status: "sent",
    year,
    sequence,
    number,
    sentAt: nowIso,
    updatedAt: nowIso,
  });
  await saveQuotes(quotes.map((q) => (q.id === id ? next : q)));

  if (existing.leadId) {
    const followUpOn = await resetLeadFollowUpForQuote(existing.leadId);
    const me = await getCurrentUserId();
    const activities = await getActivities();
    await saveActivities([
      {
        id: uid("a"),
        leadId: existing.leadId,
        type: "proposal",
        title: `Quote sent: ${number}`,
        detail: `Follow up on quote by ${followUpOn} · Total €${next.total.toFixed(0)} · ${next.locale.toUpperCase()}`,
        date: today(),
        userId: me,
      },
      ...activities,
    ]);

    await advanceLeadToProposalSent(existing.leadId);
  }

  revalidateQuotes(id, existing.leadId);
  revalidatePath("/settings");
  return number;
}

/** Days until next follow-up after a quote is sent (replaces any prior schedule). */
const QUOTE_FOLLOW_UP_DAYS = 3;

function quoteFollowUpDate(days = QUOTE_FOLLOW_UP_DAYS): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function advanceLeadToProposalSent(leadId: string) {
  const lead = (await getLeads()).find((l) => l.id === leadId);
  if (!lead) return;
  if (["Won", "Lost", "Not suitable", "Proposal sent"].includes(lead.status)) {
    return;
  }
  const proposalIdx = leadStatuses.indexOf("Proposal sent");
  const curIdx = leadStatuses.indexOf(lead.status);
  if (curIdx < 0 || (proposalIdx >= 0 && curIdx < proposalIdx)) {
    await setLeadStatus(leadId, "Proposal sent");
  }
}

/** Wipe any prior follow-up and schedule a fresh one for the quote. */
async function resetLeadFollowUpForQuote(leadId: string) {
  const followUpOn = quoteFollowUpDate();
  const now = today();
  const leads = await getLeads();
  if (!leads.some((l) => l.id === leadId)) return followUpOn;

  await saveLeads(
    leads.map((l) =>
      l.id === leadId
        ? {
            ...l,
            lastContact: now,
            firstContact: l.firstContact ?? now,
            nextFollowUp: followUpOn,
          }
        : l
    )
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return followUpOn;
}

export async function setQuoteStatus(
  id: string,
  status: Extract<QuoteStatus, "accepted" | "declined" | "draft">
) {
  await requireStudioSession();
  const quotes = await getQuotes();
  const existing = quotes.find((q) => q.id === id);
  if (!existing) throw new Error("Quote not found");
  if (status === "draft") {
    throw new Error("Cannot revert to draft");
  }
  if (existing.status !== "sent" && existing.status !== status) {
    throw new Error("Only sent quotes can be accepted or declined");
  }
  const next = normalizeQuote({
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  });
  await saveQuotes(quotes.map((q) => (q.id === id ? next : q)));
  revalidateQuotes(id, existing.leadId);
}

/** Bundle for the quotes list side drawer. */
export async function getQuoteDetailAction(id: string) {
  await requireStudioSession();
  let quote = (await getQuotes()).find((q) => q.id === id);
  if (!quote) return null;
  if (!quote.number) {
    quote = (await ensureQuoteNumbered(id)) ?? quote;
  }
  const [settings, lead] = await Promise.all([
    getFirmSettings(),
    quote.leadId ? getLeadById(quote.leadId) : Promise.resolve(null),
  ]);
  return {
    quote,
    settings,
    leadId: lead?.id ?? null,
    leadName: lead?.company ?? null,
    leadEmail: lead?.email ?? null,
  };
}

export async function generateQuoteDraftAction(input: {
  leadId?: string | null;
  discoveryNotes: string;
  locale: "sl" | "en";
  lineHints?: QuoteLineItem[];
}) {
  await requireStudioSession();
  const lead = input.leadId ? ((await getLeadById(input.leadId)) ?? null) : null;
  return generateQuoteDraft({
    lead,
    discoveryNotes: input.discoveryNotes,
    locale: input.locale,
    lineHints: input.lineHints,
  });
}

export async function generateQuoteEmailAction(input: {
  quoteId: string;
  revisionNotes?: string;
  previousDraft?: { subject: string; body: string } | null;
}) {
  await requireStudioSession();
  let quote = (await getQuotes()).find((q) => q.id === input.quoteId);
  if (!quote) throw new Error("Quote not found");
  if (!quote.number) {
    quote = (await ensureQuoteNumbered(quote.id)) ?? quote;
  }
  const lead = quote.leadId
    ? ((await getLeadById(quote.leadId)) ?? null)
    : null;
  return generateQuoteEmail({
    quote,
    lead,
    revisionNotes: input.revisionNotes,
    previousDraft: input.previousDraft,
  });
}

/**
 * Send quote via Resend with PDF attached.
 * Recipient override does not change the lead's email.
 * Draft quotes are marked sent after a successful send.
 */
export async function sendQuoteEmailAction(input: {
  quoteId: string;
  to: string;
  subject: string;
  body: string;
}) {
  await requireStudioSession();
  let quote = (await getQuotes()).find((q) => q.id === input.quoteId);
  if (!quote) throw new Error("Quote not found");
  if (!quote.number) {
    quote = (await ensureQuoteNumbered(quote.id)) ?? quote;
  }

  const settings = await getFirmSettings();
  const pdf = await renderQuotePdf(quote, settings);
  const filename = `${quote.number || "ponudba"}.pdf`;

  await sendStudioEmail({
    to: input.to,
    subject: input.subject,
    body: input.body,
    leadId: quote.leadId,
    // Quote path owns follow-up reset (see markQuoteSent / below).
    followUpInDays: null,
    attachments: [
      {
        filename,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  // Quote → sent + lead → Proposal sent + fresh follow-up for the quote.
  if (quote.status === "draft") {
    await markQuoteSent(quote.id);
  } else if (quote.leadId) {
    await advanceLeadToProposalSent(quote.leadId);
    await resetLeadFollowUpForQuote(quote.leadId);
  }

  revalidateQuotes(quote.id, quote.leadId);
  if (quote.leadId) {
    revalidatePath(`/leads/${quote.leadId}`);
    revalidatePath("/leads");
  }
  return { ok: true as const };
}

export type QuoteLeadSearchHit = {
  id: string;
  company: string;
  contact: string;
  email: string;
  description: string;
  value: number;
  status: string;
};

/** Typeahead for quote editor — does not load the full lead list into the client. */
export async function searchLeadsForQuote(query: string): Promise<QuoteLeadSearchHit[]> {
  await requireStudioSession();
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];

  const leads = await getLeads();
  return leads
    .filter(
      (l) =>
        l.company.toLowerCase().includes(q) ||
        l.contact.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.country.toLowerCase().includes(q)
    )
    .slice(0, 12)
    .map((l) => ({
      id: l.id,
      company: l.company,
      contact: l.contact,
      email: l.email,
      description: l.description,
      value: l.value,
      status: l.status,
    }));
}
