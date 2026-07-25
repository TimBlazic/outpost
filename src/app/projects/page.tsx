import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { ArchiveTabs } from "@/components/archive-tabs";
import { ProjectsTable } from "@/components/projects-table";
import { PortalFrame } from "@/components/portal-frame";
import {
  requireClientSession,
  tryClientPortalSession,
} from "@/lib/client-accounts/session";
import { listProjectsForClient } from "@/lib/client-accounts/projects";
import { isArchived, paidAmount, type Project } from "@/lib/data";
import { getProjects } from "@/lib/store";
import { getTeamMembers } from "@/lib/auth/session";
import { eur } from "@/lib/format";
import { getHostRole, getRequestHostname } from "@/lib/hosts";

export const dynamic = "force-dynamic";

async function renderClientProjectsHome() {
  const { client } = await requireClientSession();
  if (!client.onboardingCompletedAt) {
    redirect("/onboarding");
  }
  const projects = await listProjectsForClient(client.id);
  if (projects.length === 1) {
    redirect(`/projects/${projects[0].id}`);
  }
  return (
    <PortalFrame>
      <ClientProjectPicker projects={projects} clientName={client.name} />
    </PortalFrame>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const reqHeaders = await headers();
  const role = getHostRole(getRequestHostname(reqHeaders.get("host")));

  if (role === "client") {
    return renderClientProjectsHome();
  }

  if (role === "unified" && (await tryClientPortalSession())) {
    return renderClientProjectsHome();
  }

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

// ---- Client project picker (session portal) ----

function ClientProjectPicker({
  projects,
  clientName,
}: {
  projects: Project[];
  clientName: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto px-6 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--portal-muted)]">
            {clientName}
          </p>
          <h1 className="portal-display mt-2 text-3xl italic leading-none">
            Your projects
          </h1>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--portal-muted)]">
            No active projects yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded-xl border border-[var(--portal-line)] bg-[var(--portal-surface)] px-5 py-4 transition-colors hover:border-[var(--portal-accent)]"
                >
                  <p className="font-medium text-[var(--portal-fg)]">{p.name}</p>
                  <p className="mt-1 text-sm text-[var(--portal-muted)]">
                    {p.status}
                    {p.phase ? ` · ${p.phase}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
