"use client";

import { useMemo, useState } from "react";
import { Table2, KanbanSquare, Search, Users } from "lucide-react";

import { type Lead } from "@/lib/data";
import { eur, fmtDate, dueState, leadStatusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { LeadsKanban } from "@/components/leads-kanban";
import { EmptyState } from "@/components/empty-state";
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

export function LeadsView({ leads: allLeads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");

  const leads = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allLeads;
    return allLeads.filter(
      (l) =>
        l.company.toLowerCase().includes(q) ||
        l.contact.toLowerCase().includes(q) ||
        l.country.toLowerCase().includes(q)
    );
  }, [allLeads, query]);

  const { pageRows, page, setPage, pageCount, from, to, total } =
    useClientPagination(leads, undefined, query);

  if (allLeads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No leads yet"
        description="Add your first company to start tracking outreach, follow-ups, and the pipeline."
        actionLabel="New lead"
        actionHref="/leads/new"
      />
    );
  }

  return (
    <Tabs defaultValue="table" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="table">
            <Table2 className="size-4" /> Table
          </TabsTrigger>
          <TabsTrigger value="kanban">
            <KanbanSquare className="size-4" /> Kanban
          </TabsTrigger>
        </TabsList>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter leads…"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <TabsContent
        value="table"
        className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
      >
        {leads.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching leads"
            description="Try a different company, contact, or country."
            className="py-10"
          />
        ) : (
          <PaginatedDataTable
            total={total}
            from={from}
            to={to}
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            emptyLabel="No leads"
          >
            <Table>
              <TableHeader className={stickyTableHeaderClass}>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Prob.</TableHead>
                  <TableHead>Next follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((l) => (
                  <ClickableRow key={l.id} href={`/leads/${l.id}`}>
                    <TableCell>
                      <span className="font-medium">{l.company}</span>
                      <span className="block text-xs text-muted-foreground">
                        {l.country} · {l.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{l.contact}</span>
                      <span className="block text-xs text-muted-foreground">
                        {l.source}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={l.status}
                        className={leadStatusColor[l.status]}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {eur(l.value)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {l.probability}%
                    </TableCell>
                    <TableCell>
                      <FollowUpCell date={l.nextFollowUp} />
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </PaginatedDataTable>
        )}
      </TabsContent>

      <TabsContent
        value="kanban"
        className="mt-0 min-h-0 flex-1 overflow-auto data-[state=inactive]:hidden"
      >
        {leads.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching leads"
            description="Clear the filter to see your board."
            className="py-10"
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Drag a card into another column to update its status.
            </p>
            <LeadsKanban leads={leads} />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

function FollowUpCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-sm text-muted-foreground">—</span>;
  const state = dueState(date);
  return (
    <span
      className={cn(
        "text-sm",
        state === "overdue" && "font-medium text-rose-600",
        state === "today" && "font-medium text-amber-600"
      )}
    >
      {fmtDate(date)}
      {state === "overdue" && " ⚠"}
    </span>
  );
}
