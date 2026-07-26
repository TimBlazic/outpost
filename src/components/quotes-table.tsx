"use client";

import type { Quote } from "@/lib/data";
import { eur, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PaginatedDataTable,
  stickyTableHeaderClass,
  useClientPagination,
} from "@/components/paginated-data-table";
import { ClickableRow } from "@/components/clickable-row";

const statusTone: Record<Quote["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  accepted:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export function QuotesTable({
  quotes,
  onOpen,
}: {
  quotes: Quote[];
  onOpen: (id: string) => void;
}) {
  const sorted = [...quotes].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0
  );
  const { pageRows, page, setPage, pageCount, from, to, total } =
    useClientPagination(sorted);

  return (
    <PaginatedDataTable
      total={total}
      from={from}
      to={to}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      emptyLabel="No quotes"
    >
      <Table>
        <TableHeader className={stickyTableHeaderClass}>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Valid until</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((q) => (
            <ClickableRow key={q.id} onSelect={() => onOpen(q.id)}>
              <TableCell className="font-medium">
                {q.number || "Draft"}
              </TableCell>
              <TableCell>
                <span className="font-medium">
                  {q.clientCompany || q.clientName || "—"}
                </span>
                {q.clientEmail ? (
                  <span className="block text-xs text-muted-foreground">
                    {q.clientEmail}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>
                <StatusPill
                  label={q.status}
                  className={cn("capitalize", statusTone[q.status])}
                />
              </TableCell>
              <TableCell className="text-right font-medium">
                {eur(q.total)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {q.validUntil ? fmtDate(q.validUntil) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {fmtDate(q.updatedAt.slice(0, 10))}
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </PaginatedDataTable>
  );
}
