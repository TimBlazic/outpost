"use client";

import type { Client } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { ClickableRow } from "@/components/clickable-row";
import {
  PaginatedDataTable,
  stickyTableHeaderClass,
  useClientPagination,
} from "@/components/paginated-data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ClientsTable({
  clients,
  projectCountByClient,
}: {
  clients: Client[];
  projectCountByClient: Record<string, number>;
}) {
  const { pageRows, page, setPage, pageCount, from, to, total } =
    useClientPagination(clients);

  return (
    <PaginatedDataTable
      total={total}
      from={from}
      to={to}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      emptyLabel="No clients"
    >
      <Table>
        <TableHeader className={stickyTableHeaderClass}>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Projects</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((c) => (
            <ClickableRow key={c.id} href={`/clients/${c.id}`}>
              <TableCell>
                <span className="font-medium">{c.name}</span>
                {c.company && c.company !== c.name && (
                  <p className="text-xs text-muted-foreground">{c.company}</p>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.email || "—"}
              </TableCell>
              <TableCell className="text-sm">
                {projectCountByClient[c.id] ?? 0}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {fmtDate(c.createdAt)}
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </PaginatedDataTable>
  );
}
