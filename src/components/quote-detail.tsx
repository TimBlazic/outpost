"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Pencil, X } from "lucide-react";
import { ArrowLeft } from "lucide-react";

import type { FirmSettings, Quote } from "@/lib/data";
import { ConfirmDelete } from "@/components/confirm-delete";
import { QuotePreview } from "@/components/quote-preview";
import { QuoteStatusActions } from "@/components/quote-status-actions";
import { SendQuoteButton } from "@/components/send-quote-button";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { eur, fmtDateLong } from "@/lib/format";
import { deleteQuote } from "@/lib/quotes/actions";
import { cn } from "@/lib/utils";

const statusColor: Record<Quote["status"], string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  sent: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  accepted:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  declined: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function QuoteDetail({
  quote,
  settings,
  leadId,
  leadName,
  leadEmail,
  mode = "page",
  onClose,
  onChanged,
}: {
  quote: Quote;
  settings: FirmSettings;
  leadId?: string | null;
  leadName?: string | null;
  leadEmail?: string | null;
  mode?: "page" | "drawer";
  onClose?: () => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const title = quote.number || "Draft quote";
  const canEdit = quote.status === "draft";
  const defaultTo = (leadEmail || quote.clientEmail || "").trim();
  const drawer = mode === "drawer";

  async function onDelete() {
    await deleteQuote(quote.id);
    onChanged?.();
    if (drawer) {
      onClose?.();
      router.refresh();
      return;
    }
    router.push("/quotes");
    router.refresh();
  }

  const body = (
    <>
      {!drawer ? (
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Quotes
        </Link>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className={cn(
                "app-display italic tracking-tight",
                drawer ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
              )}
            >
              {title}
            </h1>
            <StatusPill
              label={quote.status}
              className={cn("capitalize", statusColor[quote.status])}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {quote.clientCompany || quote.clientName || "No recipient"} ·{" "}
            {eur(quote.total)}
            {quote.monthlyTotal > 0
              ? ` · ${eur(quote.monthlyTotal)}/mo`
              : ""}
            {quote.validUntil
              ? ` · Valid ${fmtDateLong(quote.validUntil)}`
              : ""}
          </p>
          {leadId && leadName ? (
            <p className="text-sm text-muted-foreground">
              Lead:{" "}
              <Link
                href={`/leads/${leadId}`}
                className="underline-offset-2 hover:underline hover:text-foreground"
              >
                {leadName}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/quotes/${quote.id}/edit`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/quotes/${quote.id}/pdf`}>
              <Download className="size-3.5" />
              PDF
            </a>
          </Button>
          <SendQuoteButton
            quoteId={quote.id}
            quoteNumber={quote.number}
            defaultTo={defaultTo}
            onSent={onChanged}
          />
          <QuoteStatusActions quote={quote} onChanged={onChanged} />
          <ConfirmDelete
            title="Delete quote?"
            description={
              quote.status === "draft"
                ? "This permanently removes the draft quote."
                : `This permanently removes the ${quote.status} quote${quote.number ? ` ${quote.number}` : ""}. This cannot be undone.`
            }
            confirmLabel="Delete"
            onConfirm={onDelete}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Delete
              </Button>
            }
          />
        </div>
      </header>

      <QuotePreview quote={quote} settings={settings} />
    </>
  );

  if (drawer) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/80 bg-background/95 px-5 py-3 backdrop-blur-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {quote.clientCompany || quote.clientName || "Quote"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Open full page"
              className="size-8"
            >
              <Link href={`/quotes/${quote.id}`}>
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                title="Close"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-5">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-6">{body}</div>
  );
}
