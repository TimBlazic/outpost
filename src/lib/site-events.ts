export const SITE_EVENT_NAMES = [
  "page_view",
  "cta_click",
  "form_start",
  "form_submit",
  "example_click",
] as const;

export type SiteEventName = (typeof SITE_EVENT_NAMES)[number];

export type SiteAttribution = {
  landingPath?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
};

export type SiteEvent = {
  id: string;
  sessionId: string;
  leadId: string | null;
  event: SiteEventName;
  target: string;
  path: string;
  locale: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  createdAt: string;
};

export type InboundSiteEventPayload = {
  sessionId: string;
  event: string;
  target?: string;
  path?: string;
  locale?: string;
  referrer?: string;
  attribution?: SiteAttribution;
};

export function isSiteEventName(value: string): value is SiteEventName {
  return (SITE_EVENT_NAMES as readonly string[]).includes(value);
}

export function formatAttribution(events: SiteEvent[]) {
  const first = events[0];
  if (!first) return null;
  return {
    source: first.utmSource || first.referrer || "direct",
    medium: first.utmMedium,
    campaign: first.utmCampaign,
    gclid: first.gclid,
    landingPath: first.path,
    referrer: first.referrer,
  };
}

export function eventLabel(event: SiteEvent) {
  if (event.event === "page_view") return `Viewed ${event.path || "/"}`;
  if (event.event === "form_start") return "Started the form";
  if (event.event === "form_submit") return "Submitted the form";
  if (event.event === "example_click") return "Clicked example site";
  const targets: Record<string, string> = {
    hero_primary: "Clicked hero CTA",
    nav: "Clicked nav CTA",
    package: "Clicked package CTA",
    custom: "Clicked custom-project CTA",
  };
  return targets[event.target] || `Clicked ${event.target || "CTA"}`;
}
