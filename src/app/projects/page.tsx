import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { StatusPill } from "@/components/status-pill";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ArchiveTabs } from "@/components/archive-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableRow } from "@/components/clickable-row";
import { isArchived, memberById, paidAmount, isFullyPaid } from "@/lib/data";
import { getProjects } from "@/lib/store";
import { getTeamMembers } from "@/lib/auth/session";
import { eur, fmtDate, projectStatusColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view = viewParam === "archived" ? "archived" : "active";
  const [projects, members] = await Promise.all([
    getProjects(),
    getTeamMembers(),
  ]);
  const activeProjects = projects.filter((p) => !isArchived(p));
  const archivedProjects = projects.filter((p) => isArchived(p));
  const shown = view === "archived" ? archivedProjects : activeProjects;

  const inFlight = activeProjects.filter((p) =>
    ["Discovery", "Proposal accepted", "In progress", "Client review"].includes(
      p.status
    )
  );
  const activeValue = inFlight.reduce((s, p) => s + p.value, 0);
  const outstanding = activeProjects.reduce(
    (s, p) => s + (p.value - paidAmount(p)),
    0
  );
  const completed = activeProjects.filter(
    (p) => p.status === "Completed"
  ).length;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Projects"
        description="Active and delivered client work."
      >
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" />
            New project
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active projects" value={String(inFlight.length)} />
        <StatCard label="Active value" value={eur(activeValue)} />
        <StatCard label="Outstanding" value={eur(outstanding)} />
        <StatCard label="Completed" value={String(completed)} />
      </div>

      <ArchiveTabs
        basePath="/projects"
        view={view}
        activeCount={activeProjects.length}
        archivedCount={archivedProjects.length}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={
            view === "archived" ? "No archived projects" : "No projects yet"
          }
          description={
            view === "archived"
              ? "Finished projects you archive will show up here."
              : "When you win a lead, convert it to a project to track value, timeline, and payments."
          }
          actionLabel={view === "archived" ? undefined : "New project"}
          actionHref={view === "archived" ? undefined : "/projects/new"}
        />
      ) : (
        <DataTable>
          <Table>
            <TableHeader>
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
              {shown.map((p) => (
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
                    {fmtDate(p.start)} →{" "}
                    {fmtDate(p.actualEnd ?? p.estimatedEnd)}
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
        </DataTable>
      )}
    </div>
  );
}
