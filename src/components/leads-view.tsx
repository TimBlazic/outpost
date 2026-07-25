"use client";

import { useState } from "react";
import { Table2, KanbanSquare, Search, Users } from "lucide-react";

import { type Lead } from "@/lib/data";
import { eur, fmtDate, dueState, leadStatusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { LeadsKanban } from "@/components/leads-kanban";
import { EmptyState } from "@/components/empty-state";
import { DataTable } from "@/components/data-table";
import { ClickableRow } from "@/components/clickable-row";
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

  const leads = allLeads.filter((l) => {
    const q = query.toLowerCase();
    return (
      l.company.toLowerCase().includes(q) ||
      l.contact.toLowerCase().includes(q) ||
      l.country.toLowerCase().includes(q)
    );
  });

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
    <Tabs defaultValue="table" className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <TabsContent value="table">
        {leads.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching leads"
            description="Try a different company, contact, or country."
            className="py-10"
          />
        ) : (
          <DataTable>
            <Table>
              <TableHeader>
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
                {leads.map((l) => (
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
          </DataTable>
        )}
      </TabsContent>

      <TabsContent value="kanban">
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
