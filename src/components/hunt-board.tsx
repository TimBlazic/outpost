"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, MapPin } from "lucide-react";

import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearHuntReview,
  keepProspect,
  searchAndPool,
  skipProspect,
} from "@/lib/hunt/actions";
import type { HuntSiteSignal } from "@/lib/hunt/preview";
import type { Prospect } from "@/lib/hunt/types";
import { enqueueQualify } from "@/lib/qualify/queue";
import { useQualifyQueue } from "@/lib/qualify/use-qualify-queue";
import { cn } from "@/lib/utils";

const LS_QUERY = "hunt:query";
const LS_CITY = "hunt:city";

function hostLabel(website: string | null): string | null {
  if (!website?.trim()) return null;
  try {
    const raw = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(raw).hostname.replace(/^www\./i, "");
  } catch {
    return website;
  }
}

function signalMeta(signal: HuntSiteSignal | null): {
  label: string;
  className: string;
} {
  switch (signal) {
    case "dated":
      return {
        label: "Dated",
        className:
          "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      };
    case "modern":
      return {
        label: "Modern",
        className:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      };
    case "ok":
      return {
        label: "OK",
        className:
          "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300",
      };
    case "down":
      return {
        label: "Down",
        className:
          "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300",
      };
    case "none":
      return {
        label: "No site",
        className: "border-border bg-muted text-muted-foreground",
      };
    default:
      return {
        label: "Pending",
        className: "border-border bg-muted text-muted-foreground",
      };
  }
}

export function HuntBoard({
  enabled,
  initialToday,
  reviewCount,
}: {
  enabled: boolean;
  initialToday: Prospect[];
  reviewCount: number;
}) {
  const router = useRouter();
  const qualifyQueue = useQualifyQueue();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastLeadId, setLastLeadId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const qualifyDepth =
    (qualifyQueue.depth ?? 0) > 0
      ? qualifyQueue.depth
      : (qualifyQueue.activeId ? 1 : 0) + qualifyQueue.pendingIds.length;

  useEffect(() => {
    try {
      setQuery(localStorage.getItem(LS_QUERY) ?? "");
      setCity(localStorage.getItem(LS_CITY) ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  if (!enabled) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Hunt needs Supabase</p>
          <p>
            Configure Supabase env, run migrations (incl.{" "}
            <code className="text-xs">20260726220000_prospect_site_preview.sql</code>
            ), and set <code className="text-xs">GOOGLE_PLACES_API_KEY</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  function persistSearch() {
    try {
      localStorage.setItem(LS_QUERY, query.trim());
      localStorage.setItem(LS_CITY, city.trim());
    } catch {
      /* ignore */
    }
  }

  function onSearch() {
    setError(null);
    setStatus(null);
    setLastLeadId(null);
    persistSearch();
    startTransition(async () => {
      try {
        const result = await searchAndPool(query, city);
        setStatus(
          `Fetched ${result.fetched} · imported ${result.imported}` +
            (result.skippedKnown
              ? ` · skipped ${result.skippedKnown} known`
              : "") +
            ` · previewed ${result.previewed}`
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      }
    });
  }

  function onClear() {
    setError(null);
    setLastLeadId(null);
    startTransition(async () => {
      try {
        const result = await clearHuntReview();
        setStatus(`Cleared ${result.cleared} from review`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Clear failed");
      }
    });
  }

  function onKeep(id: string) {
    setError(null);
    const prospect = initialToday.find((p) => p.id === id);
    startTransition(async () => {
      try {
        const result = await keepProspect(id);
        setLastLeadId(result.leadId);
        enqueueQualify(result.leadId);
        setStatus(
          result.alreadyExisted
            ? "Already a lead — qualifying in background"
            : prospect?.website?.trim()
              ? "Kept — qualifying in background"
              : "Kept — qualifying from company name (no website)"
        )
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Keep failed");
      }
    });
  }

  function onSkip(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await skipProspect(id);
        setStatus("Skipped");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Skip failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="hunt-query">Industry / query</Label>
              <Input
                id="hunt-query"
                placeholder="e.g. frizerski salon"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hunt-city">City</Label>
              <Input
                id="hunt-city"
                placeholder="e.g. Maribor"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={pending}
              />
            </div>
            <Button
              type="button"
              onClick={onSearch}
              disabled={pending || !query.trim() || !city.trim()}
            >
              {pending ? "Working…" : "Search"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {reviewCount} to review
              {qualifyDepth > 0
                ? ` · Qualifying ${qualifyDepth} in queue…`
                : null}
            </p>
            {reviewCount > 0 ? (
              <ConfirmDelete
                title="Clear review list?"
                description="Marks every prospect currently waiting for Keep/Skip as skipped. Kept leads are untouched. You can search again anytime."
                confirmLabel="Clear"
                pendingLabel="Clearing…"
                pending={pending}
                onConfirm={onClear}
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={pending}>
                    Clear review
                  </Button>
                }
              />
            ) : null}
          </div>
          {qualifyQueue.lastError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Qualify error: {qualifyQueue.lastError}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          ) : null}
          {status ? (
            <p className="text-sm text-muted-foreground">
              {status}
              {lastLeadId ? (
                <>
                  {" · "}
                  <Link
                    href={`/leads/${lastLeadId}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Open lead
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Results
        </h2>
        {initialToday.length === 0 ? (
          <Card>
            <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
              Search by industry and city — previews load with the results.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {initialToday.map((p) => {
              const host = hostLabel(p.website);
              const signal = signalMeta(p.siteSignal);
              return (
                <li key={p.id}>
                  <Card>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] uppercase", signal.className)}
                          >
                            {signal.label}
                          </Badge>
                          {p.siteCms ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {p.siteCms}
                            </Badge>
                          ) : null}
                        </div>
                        {p.siteTitle ? (
                          <p className="line-clamp-1 text-sm text-foreground/90">
                            {p.siteTitle}
                          </p>
                        ) : null}
                        {p.siteDescription ? (
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {p.siteDescription}
                          </p>
                        ) : null}
                        {p.address ? (
                          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 size-3.5 shrink-0" />
                            <span>{p.address}</span>
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          {p.website ? (
                            <a
                              href={p.website}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                            >
                              {host ?? "Website"}{" "}
                              <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                          {p.mapsUrl ? (
                            <a
                              href={p.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline"
                            >
                              Maps <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => onSkip(p.id)}
                        >
                          Skip
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => onKeep(p.id)}
                        >
                          Keep
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
