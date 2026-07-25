import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ArchiveTabs } from "@/components/archive-tabs";
import { ClientsTable } from "@/components/clients-table";
import { isArchived } from "@/lib/data";
import { getClients, getProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view = viewParam === "archived" ? "archived" : "active";
  const [clients, projects] = await Promise.all([getClients(), getProjects()]);
  const activeClients = clients.filter((c) => !isArchived(c));
  const archivedClients = clients.filter((c) => isArchived(c));
  const shown = view === "archived" ? archivedClients : activeClients;

  const projectCountByClient: Record<string, number> = {};
  for (const p of projects) {
    if (!p.clientId || isArchived(p)) continue;
    projectCountByClient[p.clientId] =
      (projectCountByClient[p.clientId] ?? 0) + 1;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        title="Clients"
        description={`${activeClients.length} active · ${archivedClients.length} archived`}
      >
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="size-4" />
            New client
          </Link>
        </Button>
      </PageHeader>

      <div className="shrink-0">
        <ArchiveTabs
          basePath="/clients"
          view={view}
          activeCount={activeClients.length}
          archivedCount={archivedClients.length}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={view === "archived" ? "No archived clients" : "No clients yet"}
          description={
            view === "archived"
              ? "Finished clients you archive will show up here."
              : "Clients hold projects and portal access. Convert a won lead or add one manually."
          }
          actionLabel={view === "archived" ? undefined : "New client"}
          actionHref={view === "archived" ? undefined : "/clients/new"}
        />
      ) : (
        <ClientsTable
          clients={shown}
          projectCountByClient={projectCountByClient}
        />
      )}
    </div>
  );
}
