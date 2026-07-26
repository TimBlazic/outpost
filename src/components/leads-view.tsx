"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Table2, KanbanSquare, Search, Users } from "lucide-react";

import {
  type Activity,
  type Attachment,
  type Lead,
  type Note,
} from "@/lib/data";
import { getLeadDetailAction } from "@/lib/actions";
import { eur, fmtDate, dueState, leadStatusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { LeadsKanban } from "@/components/leads-kanban";
import { LeadDetail } from "@/components/lead-detail";
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

function LeadSidePanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={cn(
          "absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 m-3 flex h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function LeadsView({ leads: allLeads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<{
    activities: Activity[];
    notes: Note[];
    files: Attachment[];
  } | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);

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

  const selectedLead =
    allLeads.find((l) => l.id === selectedId) ??
    leads.find((l) => l.id === selectedId) ??
    null;

  // Lead removed (e.g. deleted) while drawer was open — don't keep fetching.
  useEffect(() => {
    if (selectedId && !allLeads.some((l) => l.id === selectedId)) {
      setSelectedId(null);
      setBundle(null);
    }
  }, [allLeads, selectedId]);

  const loadBundle = useCallback(async (id: string) => {
    setBundleLoading(true);
    try {
      const data = await getLeadDetailAction(id);
      if (!data) {
        setBundle(null);
        setSelectedId(null);
        return;
      }
      setBundle({
        activities: data.activities,
        notes: data.notes,
        files: data.files,
      });
    } finally {
      setBundleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setBundle(null);
      return;
    }
    void loadBundle(selectedId);
  }, [selectedId, loadBundle]);

  function openLead(id: string) {
    setSelectedId(id);
  }

  function closePanel() {
    setSelectedId(null);
    setBundle(null);
  }

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
    <>
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
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
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
                    <ClickableRow key={l.id} onSelect={() => openLead(l.id)}>
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
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
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
              <p className="mb-3 shrink-0 text-xs text-muted-foreground">
                Drag to change status. Click a card to open the drawer — full
                page from there if you need it.
              </p>
              <div className="min-h-0 flex-1">
                <LeadsKanban leads={leads} onOpen={openLead} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <LeadSidePanel open={Boolean(selectedId)} onClose={closePanel}>
        {selectedLead && bundle ? (
          <LeadDetail
            lead={selectedLead}
            activities={bundle.activities}
            notes={bundle.notes}
            files={bundle.files}
            mode="drawer"
            onClose={closePanel}
            onChanged={() => {
              if (selectedId) void loadBundle(selectedId);
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {bundleLoading || selectedId ? "Loading lead…" : null}
          </div>
        )}
      </LeadSidePanel>
    </>
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
