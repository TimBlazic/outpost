import { promises as fs } from "fs";
import path from "path";

import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { rangeBounds, type DashboardRange } from "@/lib/dashboard-range";
import {
  isSiteEventName,
  type InboundSiteEventPayload,
  type SiteEvent,
  type SiteEventName,
} from "@/lib/site-events";

export type { InboundSiteEventPayload, SiteEvent, SiteEventName };
export { isSiteEventName };

const FILE = path.join(process.cwd(), "data", "site-events.json");

function uid() {
  return `se_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function clean(value: string | undefined | null) {
  return (value ?? "").trim().slice(0, 500);
}

function fromRow(row: Record<string, unknown>): SiteEvent {
  return {
    id: String(row.id),
    sessionId: String(row.session_id ?? row.sessionId ?? ""),
    leadId: (row.lead_id as string | null) ?? (row.leadId as string | null) ?? null,
    event: row.event as SiteEventName,
    target: String(row.target ?? ""),
    path: String(row.path ?? ""),
    locale: String(row.locale ?? ""),
    referrer: String(row.referrer ?? ""),
    utmSource: String(row.utm_source ?? row.utmSource ?? ""),
    utmMedium: String(row.utm_medium ?? row.utmMedium ?? ""),
    utmCampaign: String(row.utm_campaign ?? row.utmCampaign ?? ""),
    utmContent: String(row.utm_content ?? row.utmContent ?? ""),
    utmTerm: String(row.utm_term ?? row.utmTerm ?? ""),
    gclid: String(row.gclid ?? ""),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

async function readFileEvents(): Promise<SiteEvent[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return (JSON.parse(raw) as Record<string, unknown>[]).map(fromRow);
  } catch {
    return [];
  }
}

async function writeFileEvents(events: SiteEvent[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(events, null, 2), "utf8");
}

function toInsert(event: SiteEvent) {
  return {
    id: event.id,
    session_id: event.sessionId,
    lead_id: event.leadId,
    event: event.event,
    target: event.target,
    path: event.path,
    locale: event.locale,
    referrer: event.referrer,
    utm_source: event.utmSource,
    utm_medium: event.utmMedium,
    utm_campaign: event.utmCampaign,
    utm_content: event.utmContent,
    utm_term: event.utmTerm,
    gclid: event.gclid,
    created_at: event.createdAt,
  };
}

export async function ingestSiteEvent(payload: InboundSiteEventPayload) {
  const sessionId = clean(payload.sessionId);
  if (!sessionId || sessionId.length < 8) {
    throw new Error("sessionId is required");
  }
  if (!isSiteEventName(payload.event)) {
    throw new Error("Invalid event");
  }

  const attr = payload.attribution ?? {};
  const event: SiteEvent = {
    id: uid(),
    sessionId,
    leadId: null,
    event: payload.event,
    target: clean(payload.target),
    path: clean(payload.path || attr.landingPath),
    locale: clean(payload.locale).slice(0, 8),
    referrer: clean(payload.referrer || attr.referrer),
    utmSource: clean(attr.utmSource),
    utmMedium: clean(attr.utmMedium),
    utmCampaign: clean(attr.utmCampaign),
    utmContent: clean(attr.utmContent),
    utmTerm: clean(attr.utmTerm),
    gclid: clean(attr.gclid),
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseEnabled()) {
    if (!hasAdminClient()) {
      throw new Error("Inbound API needs SUPABASE_SERVICE_ROLE_KEY when Supabase is enabled");
    }
    const supabase = createAdminClient();

    if (event.event === "page_view" || event.event === "form_start") {
      let query = supabase
        .from("site_events")
        .select("id")
        .eq("session_id", event.sessionId)
        .eq("event", event.event)
        .limit(1);
      if (event.event === "page_view") {
        query = query.eq("path", event.path);
      }
      const { data: existing } = await query;
      if (existing?.length) {
        return { id: existing[0].id as string, deduped: true as const };
      }
    }

    const { error } = await supabase.from("site_events").insert(toInsert(event));
    if (error) throw new Error(error.message);
    return { id: event.id, deduped: false as const };
  }

  const events = await readFileEvents();
  const dup = events.find((row) => {
    if (row.sessionId !== event.sessionId || row.event !== event.event) return false;
    if (event.event === "page_view") return row.path === event.path;
    if (event.event === "form_start") return true;
    return false;
  });
  if (dup && (event.event === "page_view" || event.event === "form_start")) {
    return { id: dup.id, deduped: true as const };
  }
  await writeFileEvents([event, ...events]);
  return { id: event.id, deduped: false as const };
}

export async function attachSessionToLead(sessionId: string, leadId: string) {
  const id = clean(sessionId);
  if (!id) return;

  if (isSupabaseEnabled()) {
    if (!hasAdminClient()) return;
    const supabase = createAdminClient();
    await supabase.from("site_events").update({ lead_id: leadId }).eq("session_id", id);
    return;
  }

  const events = await readFileEvents();
  await writeFileEvents(
    events.map((event) => (event.sessionId === id ? { ...event, leadId } : event)),
  );
}

export async function getSiteEventsForLead(leadId: string): Promise<SiteEvent[]> {
  if (isSupabaseEnabled()) {
    if (!hasAdminClient()) return [];
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("site_events")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((row) => fromRow(row as Record<string, unknown>));
  }

  return (await readFileEvents())
    .filter((event) => event.leadId === leadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type FunnelReport = {
  sessions: number;
  pageViews: number;
  ctaClicks: number;
  formStarts: number;
  formSubmits: number;
  packageInfo: number;
  bySource: { key: string; sessions: number; submits: number }[];
  byCampaign: { key: string; sessions: number; submits: number }[];
};

export async function getFunnelReport(range: DashboardRange): Promise<FunnelReport> {
  const { start, end } = rangeBounds(range);
  const empty: FunnelReport = {
    sessions: 0,
    pageViews: 0,
    ctaClicks: 0,
    formStarts: 0,
    formSubmits: 0,
    packageInfo: 0,
    bySource: [],
    byCampaign: [],
  };

  let events: SiteEvent[] = [];

  if (isSupabaseEnabled()) {
    if (!hasAdminClient()) return empty;
    const supabase = createAdminClient();
    let query = supabase.from("site_events").select("*").lte("created_at", end.toISOString());
    if (start) query = query.gte("created_at", start.toISOString());
    const { data, error } = await query;
    if (error || !data) return empty;
    events = data.map((row) => fromRow(row as Record<string, unknown>));
  } else {
    events = (await readFileEvents()).filter((event) => {
      const at = new Date(event.createdAt).getTime();
      if (at > end.getTime()) return false;
      if (start && at < start.getTime()) return false;
      return true;
    });
  }

  const sessions = new Map<string, SiteEvent[]>();
  for (const event of events) {
    const list = sessions.get(event.sessionId) ?? [];
    list.push(event);
    sessions.set(event.sessionId, list);
  }

  const countSessions = (name: SiteEventName) =>
    [...sessions.values()].filter((list) => list.some((event) => event.event === name)).length;

  const sourceMap = new Map<string, { sessions: number; submits: number }>();
  const campaignMap = new Map<string, { sessions: number; submits: number }>();

  for (const list of sessions.values()) {
    const first = list[0];
    const source = first?.utmSource || first?.referrer || "direct";
    const campaign = first?.utmCampaign || "(none)";
    const submitted = list.some((event) => event.event === "form_submit");
    const add = (map: Map<string, { sessions: number; submits: number }>, key: string) => {
      const row = map.get(key) ?? { sessions: 0, submits: 0 };
      row.sessions += 1;
      if (submitted) row.submits += 1;
      map.set(key, row);
    };
    add(sourceMap, source);
    add(campaignMap, campaign);
  }

  const rank = (map: Map<string, { sessions: number; submits: number }>) =>
    [...map.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);

  return {
    sessions: sessions.size,
    pageViews: countSessions("page_view"),
    ctaClicks: countSessions("cta_click"),
    formStarts: countSessions("form_start"),
    formSubmits: countSessions("form_submit"),
    packageInfo:
      countSessions("package_info") + countSessions("example_click"),
    bySource: rank(sourceMap),
    byCampaign: rank(campaignMap),
  };
}
