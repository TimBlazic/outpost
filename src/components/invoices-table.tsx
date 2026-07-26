"use client";

import type { Invoice } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClickableRow } from "@/components/clickable-row";
import {
  PaginatedDataTable,
  stickyTableHeaderClass,
  useClientPagination,
} from "@/components/paginated-data-table";
import { StatusPill } from "@/components/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export function InvoicesTable({
  invoices,
  onOpen,
}: {
  invoices: Invoice[];
  onOpen: (id: string) => void;
}) {
  const { pageRows, page, setPage, pageCount, from, to, total } =
    useClientPagination(invoices);

  return (
    <PaginatedDataTable
      total={total}
      from={from}
      to={to}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      emptyLabel="No invoices"
    >
      <Table>
        <TableHeader className={stickyTableHeaderClass}>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((inv) => (
            <ClickableRow key={inv.id} onSelect={() => onOpen(inv.id)}>
              <TableCell>
                <span className="font-medium">
                  {inv.invoiceNumber || "Draft"}
                </span>
              </TableCell>
              <TableCell className="text-sm">
                {inv.clientSnapshot.companyName || "—"}
              </TableCell>
              <TableCell>
                <StatusPill
                  label={inv.status}
                  className={cn("capitalize", statusColor[inv.status])}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {fmtDate(inv.issueDate)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {fmtDate(inv.dueDate)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {money(inv.currency, inv.total)}
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </PaginatedDataTable>
  );
}
