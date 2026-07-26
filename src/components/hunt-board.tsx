"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  keepProspect,
  searchAndPool,
  skipProspect,
} from "@/lib/hunt/actions";
import type { Prospect } from "@/lib/hunt/types";
import { enqueueQualify } from "@/lib/qualify/queue";
import { useQualifyQueue } from "@/lib/qualify/use-qualify-queue";

const LS_QUERY = "hunt:query";
const LS_CITY = "hunt:city";

export function HuntBoard({
  enabled,
  initialToday,
  pooledCount,
}: {
  enabled: boolean;
  initialToday: Prospect[];
  pooledCount: number;
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
    (qualifyQueue.activeId ? 1 : 0) + qualifyQueue.pendingIds.length;

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
            Configure Supabase env, run migration{" "}
            <code className="text-xs">20260726120000_prospects.sql</code>, and
            set <code className="text-xs">GOOGLE_PLACES_API_KEY</code>. See
            SETUP-SUPABASE.md.
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
              : "")
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
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
        const canQualify = Boolean(prospect?.website?.trim());
        if (canQualify) {
          enqueueQualify(result.leadId);
          setStatus(
            result.alreadyExisted
              ? "Already a lead — qualifying in background"
              : "Kept — qualifying in background"
          );
        } else {
          setStatus(
            result.alreadyExisted
              ? "Already a lead — marked kept (no website)"
              : "Kept as new lead (no website to qualify)"
          );
        }
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
          <p className="text-sm text-muted-foreground">
            {pooledCount} waiting in pool
            {qualifyDepth > 0
              ? ` · Qualifying ${qualifyDepth} in queue…`
              : null}
          </p>
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
          Today
        </h2>
        {initialToday.length === 0 ? (
          <Card>
            <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
              {pooledCount === 0
                ? "Search to fill the pool — then review five a day."
                : "Come back tomorrow, or search again to refill."}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {initialToday.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
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
                            Website <ExternalLink className="size-3" />
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
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
