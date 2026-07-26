"use client";

import { Download } from "lucide-react";

import type { Invoice } from "@/lib/data";
import {
  normalizePortalLocale,
  portalT,
  type PortalLocale,
} from "@/lib/portal/i18n";
import { eur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortalUnpaidInvoices({
  invoices,
  locale = "en",
  className,
}: {
  invoices: Pick<
    Invoice,
    "id" | "invoiceNumber" | "total" | "currency" | "issueDate"
  >[];
  locale?: PortalLocale;
  className?: string;
}) {
  const t = portalT(normalizePortalLocale(locale));
  if (!invoices.length) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="rounded-xl border border-[var(--portal-line)] bg-[var(--portal-surface)] px-5 py-4 sm:px-6 sm:py-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-xl">
              <h2 className="portal-display text-xl italic sm:text-2xl">
                {t.unpaidInvoiceTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--portal-muted)]">
                {t.unpaidInvoiceBody}
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--portal-fg)]">
                {inv.invoiceNumber || "Invoice"} · {eur(inv.total)}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-[var(--portal-accent)] text-[var(--portal-bg)] hover:bg-[var(--portal-accent)] hover:text-[var(--portal-bg)] hover:opacity-90"
              asChild
            >
              <a href={`/api/portal/invoices/${inv.id}/pdf`}>
                <Download className="size-3.5" />
                {t.unpaidInvoiceDownload}
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
