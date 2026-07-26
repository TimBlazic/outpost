"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";

import {
  searchLeadsForQuote,
  type QuoteLeadSearchHit,
} from "@/lib/quotes/actions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type LeadSearchPickerValue = QuoteLeadSearchHit;

export function LeadSearchPicker({
  value,
  onChange,
}: {
  value: LeadSearchPickerValue | null;
  onChange: (lead: LeadSearchPickerValue | null) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<QuoteLeadSearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const next = await searchLeadsForQuote(q);
        setHits(next);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{value.company}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[value.contact, value.email, value.status]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={() => onChange(null)}
        >
          <X className="size-4" /> Clear
        </Button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search leads by company, contact, email…"
          className="h-9 pl-8"
        />
      </div>
      {open && query.trim().length > 0 ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {pending && hits.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Searching…
            </p>
          ) : null}
          {!pending && hits.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No matching leads
            </p>
          ) : null}
          {hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              role="option"
              className={cn(
                "flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              )}
              onClick={() => {
                onChange(hit);
                setQuery("");
                setHits([]);
                setOpen(false);
              }}
            >
              <span className="font-medium">{hit.company}</span>
              <span className="text-xs text-muted-foreground">
                {[hit.contact, hit.email, hit.status]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
