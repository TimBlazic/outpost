"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Table2,
  KanbanSquare,
  Search,
  Users,
  X,
} from "lucide-react";

import {
  leadSources,
  leadStatuses,
  type Activity,
  type Attachment,
  type Lead,
  type Note,
  type Quote,
} from "@/lib/data";
import { getLeadDetailAction } from "@/lib/actions";
import { eur, fmtDate, fmtDateTime, dueState, leadStatusColor } from "@/lib/format";
import {
  filterLeads,
  isOpenStatusFilter,
  leadListQueryToSearchParams,
  parseLeadListQuery,
  sortLeadsWithNullsLast,
  toggleSourceInFilter,
  toggleStatusInFilter,
  type LeadListQuery,
  type LeadSortKey,
} from "@/lib/leads/list-query";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { SidePanel } from "@/components/side-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadsBulkQualifyBar } from "@/components/leads-bulk-qualify";

export function LeadsView({ leads: allLeads }: { leads: Lead[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const listQuery = useMemo(
    () => parseLeadListQuery(searchParams),
    [searchParams]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [queryDraft, setQueryDraft] = useState(listQuery.q);
  useEffect(() => {
    setQueryDraft(listQuery.q);
  }, [listQuery.q]);

  const replaceQuery = useCallback(
    (patch: Partial<LeadListQuery>) => {
      const next: LeadListQuery = { ...listQuery, ...patch };
      const params = leadListQueryToSearchParams(next, searchParams);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [listQuery, pathname, router, searchParams]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (queryDraft.trim() === listQuery.q) return;
      replaceQuery({ q: queryDraft.trim() });
    }, 250);
    return () => clearTimeout(t);
  }, [queryDraft, listQuery.q, replaceQuery]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<{
    activities: Activity[];
    notes: Note[];
    files: Attachment[];
    quotes: Quote[];
  } | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);

  const leads = useMemo(() => {
    const filtered = filterLeads(allLeads, listQuery);
    return sortLeadsWithNullsLast(filtered, listQuery.sort, listQuery.dir);
  }, [allLeads, listQuery]);

  const resetKey = useMemo(
    () =>
      [
        listQuery.q,
        listQuery.sort,
        listQuery.dir,
        Array.isArray(listQuery.status)
          ? listQuery.status.join(",")
          : listQuery.status,
        listQuery.sources.join(","),
      ].join("|"),
    [listQuery]
  );

  const { pageRows, page, setPage, pageCount, from, to, total } =
    useClientPagination(leads, 50, resetKey);

  const selectedLead =
    allLeads.find((l) => l.id === selectedId) ??
    leads.find((l) => l.id === selectedId) ??
    null;

  const filtersActive =
    listQuery.status !== "open" ||
    listQuery.sources.length > 0 ||
    Boolean(listQuery.q);

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
        quotes: data.quotes,
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

  function onSort(key: LeadSortKey) {
    if (listQuery.sort === key) {
      replaceQuery({ dir: listQuery.dir === "asc" ? "desc" : "asc" });
    } else {
      replaceQuery({
        sort: key,
        dir: key === "company" || key === "status" || key === "followUp"
          ? "asc"
          : "desc",
      });
    }
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

  const statusCount = Array.isArray(listQuery.status)
    ? listQuery.status.length
    : 0;

  return (
    <>
      <Tabs defaultValue="table" className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-col gap-3">
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
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                placeholder="Search company, contact…"
                className="h-9 pl-8"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LeadsBulkQualifyBar
              selectedIds={selectedIds}
              onClearSelection={() => setSelectedIds([])}
            />
            <Button
              type="button"
              size="sm"
              variant={isOpenStatusFilter(listQuery.status) ? "default" : "outline"}
              className="h-8"
              onClick={() => replaceQuery({ status: "open" })}
            >
              Open
            </Button>

            <FilterChecklist
              label={
                statusCount
                  ? `Status (${statusCount})`
                  : listQuery.status === "all"
                    ? "Status (all)"
                    : "Status"
              }
              active={statusCount > 0 || listQuery.status === "all"}
            >
              {leadStatuses.map((s) => {
                const checked =
                  Array.isArray(listQuery.status) &&
                  listQuery.status.includes(s);
                return (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        replaceQuery({
                          status: toggleStatusInFilter(listQuery.status, s),
                        })
                      }
                    />
                    <span>{s}</span>
                  </label>
                );
              })}
            </FilterChecklist>

            <FilterChecklist
              label={
                listQuery.sources.length
                  ? `Source (${listQuery.sources.length})`
                  : "Source"
              }
              active={listQuery.sources.length > 0}
            >
              {leadSources.map((s) => {
                const checked = listQuery.sources.includes(s);
                return (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        replaceQuery({
                          sources: toggleSourceInFilter(listQuery.sources, s),
                        })
                      }
                    />
                    <span>{s}</span>
                  </label>
                );
              })}
            </FilterChecklist>

            {filtersActive ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-muted-foreground"
                onClick={() => {
                  setQueryDraft("");
                  replaceQuery({
                    status: "all",
                    sources: [],
                    q: "",
                  });
                }}
              >
                <X className="size-3.5" /> Clear
              </Button>
            ) : null}

            <span className="ml-auto text-xs text-muted-foreground">
              {leads.length} shown
              {leads.length !== allLeads.length
                ? ` · ${allLeads.length} total`
                : ""}
            </span>
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
              description="Try a different filter, source, or search."
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          pageRows.length > 0 &&
                          pageRows.every((l) => selectedIds.includes(l.id))
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds((prev) => [
                              ...new Set([
                                ...prev,
                                ...pageRows.map((l) => l.id),
                              ]),
                            ]);
                          } else {
                            const pageSet = new Set(pageRows.map((l) => l.id));
                            setSelectedIds((prev) =>
                              prev.filter((id) => !pageSet.has(id))
                            );
                          }
                        }}
                        aria-label="Select page"
                      />
                    </TableHead>
                    <SortableHead
                      label="Company"
                      sortKey="company"
                      current={listQuery.sort}
                      dir={listQuery.dir}
                      onSort={onSort}
                    />
                    <TableHead>Contact</TableHead>
                    <SortableHead
                      label="Status"
                      sortKey="status"
                      current={listQuery.sort}
                      dir={listQuery.dir}
                      onSort={onSort}
                    />
                    <SortableHead
                      label="Fit"
                      sortKey="score"
                      current={listQuery.sort}
                      dir={listQuery.dir}
                      onSort={onSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Value"
                      sortKey="value"
                      current={listQuery.sort}
                      dir={listQuery.dir}
                      onSort={onSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Prob."
                      sortKey="probability"
                      current={listQuery.sort}
                      dir={listQuery.dir}
                      onSort={onSort}
                      className="text-right"
                    />
                    <SortableHead
                      label="Next follow-up"
                      sortKey="followUp"
                      current={listQuery.sort}
                      dir={listQuery.dir}
                      onSort={onSort}
                    />
                    <SortableHead
                      label="Added"
                      sortKey="added"
                      current={listQuery.sort}
                      dir={listQuery.dir}
                      onSort={onSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((l) => (
                    <ClickableRow key={l.id} onSelect={() => openLead(l.id)}>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.includes(l.id)}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) =>
                              checked
                                ? [...prev, l.id]
                                : prev.filter((id) => id !== l.id)
                            );
                          }}
                          aria-label={`Select ${l.company}`}
                        />
                      </TableCell>
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
                      <TableCell className="text-right tabular-nums text-sm">
                        {l.qualifyScore != null ? (
                          <span
                            className={cn(
                              "font-medium",
                              l.qualifyScore >= 75 &&
                                "text-emerald-600 dark:text-emerald-400",
                              l.qualifyScore >= 50 &&
                                l.qualifyScore < 75 &&
                                "text-amber-600 dark:text-amber-400",
                              l.qualifyScore < 50 &&
                                "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {l.qualifyScore}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                      <TableCell className="whitespace-nowrap tabular-nums text-sm text-muted-foreground">
                        {fmtDateTime(l.createdAt)}
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

      <SidePanel open={Boolean(selectedId)} onClose={closePanel}>
        {selectedLead && bundle ? (
          <LeadDetail
            lead={selectedLead}
            activities={bundle.activities}
            notes={bundle.notes}
            files={bundle.files}
            quotes={bundle.quotes}
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
      </SidePanel>
    </>
  );
}

function FilterChecklist({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={active ? "secondary" : "outline"}
          className="h-8 gap-1"
        >
          {label}
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="max-h-64 space-y-0.5 overflow-y-auto">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

function SortableHead({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: LeadSortKey;
  current: LeadSortKey;
  dir: "asc" | "desc";
  onSort: (key: LeadSortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  const right = className?.includes("text-right");
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground",
          right && "w-full justify-end",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
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
