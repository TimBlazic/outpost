import Link from "next/link";
import { Plus, Receipt } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { DashboardRangeSelect } from "@/components/dashboard-range-select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { InvoicesTable } from "@/components/invoices-table";
import { StatCard } from "@/components/stat-card";
import {
  dashboardRangeLabels,
  isDateInRange,
  outstandingInvoiceTotal,
  paidInvoiceRevenueInRange,
  parseDashboardRange,
  rangeBounds,
} from "@/lib/dashboard-range";
import { eur } from "@/lib/format";
import { getInvoices } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = parseDashboardRange(rangeParam);
  const bounds = rangeBounds(range);
  const rangeLabel = dashboardRangeLabels[range];

  const invoices = await getInvoices();
  const sorted = [...invoices].sort((a, b) =>
    a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0
  );

  const collected = paidInvoiceRevenueInRange(invoices, bounds);
  const outstanding = outstandingInvoiceTotal(invoices);
  const issuedTotal = invoices
    .filter(
      (i) =>
        (i.status === "issued" || i.status === "paid") &&
        isDateInRange(i.issueDate, bounds)
    )
    .reduce((s, i) => s + i.total, 0);
  const invoiceCount = invoices.filter(
    (i) => i.status !== "void" && isDateInRange(i.issueDate, bounds)
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        title="Invoices"
        description={`${sorted.length} invoice${sorted.length === 1 ? "" : "s"} · ${rangeLabel.toLowerCase()}`}
      >
        <DashboardRangeSelect value={range} basePath="/invoices" />
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="size-4" />
            New invoice
          </Link>
        </Button>
      </PageHeader>

      <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={eur(collected)}
          sub={rangeLabel}
        />
        <StatCard
          label="Outstanding"
          value={eur(outstanding)}
          sub="Issued unpaid"
        />
        <StatCard
          label="Issued"
          value={eur(issuedTotal)}
          sub={rangeLabel}
        />
        <StatCard
          label="Invoices"
          value={String(invoiceCount)}
          sub={rangeLabel}
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Create a draft for a client, issue to assign a number, then download the PDF."
          actionLabel="New invoice"
          actionHref="/invoices/new"
        />
      ) : (
        <InvoicesTable invoices={sorted} />
      )}
    </div>
  );
}
