"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";

import type { FirmSettings, Invoice } from "@/lib/data";
import {
  deleteInvoice,
  issueInvoice,
  markInvoicePaid,
  voidInvoice,
} from "@/lib/invoices/actions";
import { InvoicePreview } from "@/components/invoice-preview";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { fmtDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusColor: Record<Invoice["status"], string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  issued: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  void: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

function money(currency: string, n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function InvoiceDetail({
  invoice,
  settings,
  projectName,
}: {
  invoice: Invoice;
  settings: FirmSettings;
  projectName?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>, redirectTo?: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  const title = invoice.invoiceNumber || "Draft invoice";
  const canEdit = invoice.status === "draft";
  const canIssue = invoice.status === "draft";
  const canPay = invoice.status === "issued";
  const canVoid = invoice.status !== "void";
  const canDelete =
    invoice.status === "draft" || invoice.status === "void";
  const canPdf =
    invoice.status === "issued" ||
    invoice.status === "paid" ||
    invoice.status === "void" ||
    invoice.status === "draft";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-6">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Invoices
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="app-display text-3xl italic tracking-tight sm:text-4xl">
              {title}
            </h1>
            <StatusPill
              label={invoice.status}
              className={cn("capitalize", statusColor[invoice.status])}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.clientSnapshot.companyName || "No client"} ·{" "}
            {money(invoice.currency, invoice.total)} · Issue{" "}
            {fmtDateLong(invoice.issueDate)}
            {invoice.paidAt ? ` · Paid ${fmtDateLong(invoice.paidAt)}` : ""}
          </p>
          {invoice.projectId && projectName ? (
            <p className="text-sm text-muted-foreground">
              Project:{" "}
              <Link
                href={`/projects/${invoice.projectId}`}
                className="underline-offset-2 hover:underline hover:text-foreground"
              >
                {projectName}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/invoices/new?from=${invoice.id}`}>
              <Copy className="size-3.5" />
              Duplicate
            </Link>
          </Button>
          {canPdf ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/invoices/${invoice.id}/pdf`}>
                <Download className="size-3.5" />
                PDF
              </a>
            </Button>
          ) : null}
          {canIssue ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => issueInvoice(invoice.id))}
            >
              Issue
            </Button>
          ) : null}
          {canPay ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => markInvoicePaid(invoice.id))}
            >
              Mark paid
            </Button>
          ) : null}
          {canVoid ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!confirm("Void this invoice?")) return;
                run(() => voidInvoice(invoice.id));
              }}
            >
              Void
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!confirm("Delete this invoice permanently?")) return;
                run(() => deleteInvoice(invoice.id), "/invoices");
              }}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <InvoicePreview invoice={invoice} settings={settings} />
    </div>
  );
}
