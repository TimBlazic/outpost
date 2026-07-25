import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ArchiveTabs } from "@/components/archive-tabs";
import { ProjectsTable } from "@/components/projects-table";
import { isArchived, paidAmount } from "@/lib/data";
import { getProjects } from "@/lib/store";
import { getTeamMembers } from "@/lib/auth/session";
import { eur } from "@/lib/format";

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
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
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

      <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active projects" value={String(inFlight.length)} />
        <StatCard label="Active value" value={eur(activeValue)} />
        <StatCard label="Outstanding" value={eur(outstanding)} />
        <StatCard label="Completed" value={String(completed)} />
      </div>

      <div className="shrink-0">
        <ArchiveTabs
          basePath="/projects"
          view={view}
          activeCount={activeProjects.length}
          archivedCount={archivedProjects.length}
        />
      </div>

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
        <ProjectsTable projects={shown} members={members} />
      )}
    </div>
  );
}
