import { MousePointerClick } from "lucide-react";

import {
  eventLabel,
  formatAttribution,
  type SiteEvent,
} from "@/lib/site-events";
import { fmtDateTime } from "@/lib/format";

export function SiteJourney({ events }: { events: SiteEvent[] }) {
  if (!events.length) return null;
  const attr = formatAttribution(events);

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        <MousePointerClick className="size-3.5" />
        Site journey
      </p>
      {attr ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {attr.source}
          {attr.campaign ? ` · ${attr.campaign}` : ""}
          {attr.landingPath ? ` · ${attr.landingPath}` : ""}
          {attr.gclid ? " · Google Ads" : ""}
        </p>
      ) : null}
      <ol className="space-y-2">
        {events.map((event) => (
          <li key={event.id} className="flex items-baseline justify-between gap-4 text-sm">
            <span>{eventLabel(event)}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {fmtDateTime(event.createdAt)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
