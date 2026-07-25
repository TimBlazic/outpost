import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
import { DataTable } from "@/components/data-table";
import { isArchived } from "@/lib/data";
import { getClients, getProjects } from "@/lib/store";
import { fmtDate } from "@/lib/format";

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

  const countByClient = new Map<string, number>();
  for (const p of projects) {
    if (!p.clientId || isArchived(p)) continue;
    countByClient.set(p.clientId, (countByClient.get(p.clientId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
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

      <ArchiveTabs
        basePath="/clients"
        view={view}
        activeCount={activeClients.length}
        archivedCount={archivedClients.length}
      />

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
        <DataTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((c) => (
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
                    {countByClient.get(c.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(c.createdAt)}
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
