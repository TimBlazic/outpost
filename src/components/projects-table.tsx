"use client";

import {
  isFullyPaid,
  memberById,
  paidAmount,
  type Member,
  type Project,
} from "@/lib/data";
import { eur, fmtDate, projectStatusColor } from "@/lib/format";
import { ClickableRow } from "@/components/clickable-row";
import {
  PaginatedDataTable,
  stickyTableHeaderClass,
  useClientPagination,
} from "@/components/paginated-data-table";
import { StatusPill } from "@/components/status-pill";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ProjectsTable({
  projects,
  members,
}: {
  projects: Project[];
  members: Member[];
}) {
  const { pageRows, page, setPage, pageCount, from, to, total } =
    useClientPagination(projects);

  return (
    <PaginatedDataTable
      total={total}
      from={from}
      to={to}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      emptyLabel="No projects"
    >
      <Table>
        <TableHeader className={stickyTableHeaderClass}>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead>Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((p) => (
            <ClickableRow key={p.id} href={`/projects/${p.id}`}>
              <TableCell>
                <span className="font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.client} · {p.source}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{p.type}</Badge>
              </TableCell>
              <TableCell>
                <StatusPill
                  label={p.status}
                  className={projectStatusColor[p.status]}
                />
              </TableCell>
              <TableCell className="text-right font-medium">
                {eur(p.value)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    member={memberById(p.ownerId, members)}
                    className="size-6"
                    fallbackClassName="bg-muted text-[10px] text-foreground"
                  />
                  <span className="text-sm">
                    {memberById(p.ownerId, members).name}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {fmtDate(p.start)} → {fmtDate(p.actualEnd ?? p.estimatedEnd)}
              </TableCell>
              <TableCell>
                {p.payments.length === 0 ? (
                  <Badge variant="outline">No schedule</Badge>
                ) : isFullyPaid(p) ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Paid
                  </Badge>
                ) : (
                  <span className="text-sm">
                    <span className="font-medium">{eur(paidAmount(p))}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {eur(p.value)}
                    </span>
                  </span>
                )}
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </PaginatedDataTable>
  );
}
