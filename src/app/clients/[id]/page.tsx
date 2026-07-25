import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";

import { deleteClient } from "@/lib/actions";
import {
  getClientById,
  getInvoices,
  getProjectsForClient,
} from "@/lib/store";
import { isArchived, type Invoice } from "@/lib/data";
import { eur, fmtDate, projectStatusColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ArchiveToggle } from "@/components/archive-toggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { ClickableRow } from "@/components/clickable-row";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const invoiceStatusColor: Record<Invoice["status"], string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  issued: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  void: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

function invoiceMoney(currency: string, n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const [projects, allInvoices] = await Promise.all([
    getProjectsForClient(id),
    getInvoices(),
  ]);
  const invoices = allInvoices
    .filter((inv) => inv.clientId === id)
    .sort((a, b) =>
      a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0
    );

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clients
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="app-display text-3xl italic tracking-tight sm:text-4xl">
              {client.name}
            </h1>
            {isArchived(client) ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Archived
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {[client.email, client.country].filter(Boolean).join(" · ") ||
              "No contact details yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ArchiveToggle
            kind="client"
            id={client.id}
            archived={isArchived(client)}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
          <ConfirmDelete
            title="Delete client?"
            description="This only works if the client has no projects."
            onConfirm={deleteClient.bind(null, client.id)}
          />
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_minmax(14rem,18rem)] lg:items-start">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <dt className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Company
            </dt>
            <dd className="truncate text-sm font-medium">
              {client.company || "—"}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Email
            </dt>
            <dd className="truncate text-sm font-medium">
              {client.email || "—"}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Phone
            </dt>
            <dd className="truncate text-sm font-medium">
              {client.phone || "—"}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Website
            </dt>
            <dd className="truncate text-sm font-medium">
              {client.website ? (
                <a
                  href={
                    client.website.startsWith("http")
                      ? client.website
                      : `https://${client.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {client.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Country
            </dt>
            <dd className="truncate text-sm font-medium">
              {client.country || "—"}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Added
            </dt>
            <dd className="truncate text-sm font-medium">
              {fmtDate(client.createdAt)}
            </dd>
          </div>
        </dl>

        {client.notes ? (
          <aside className="rounded-xl border border-border/70 bg-card/60 px-4 py-3 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
            <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Notes
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {client.notes}
            </p>
          </aside>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Projects{" "}
            <span className="font-normal text-muted-foreground">
              ({projects.length})
            </span>
          </h2>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/projects/new?clientId=${client.id}`}>
              <Plus className="size-3.5" />
              New project
            </Link>
          </Button>
        </div>

        {projects.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No projects for this client yet.
          </p>
        ) : (
          <DataTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <ClickableRow key={p.id} href={`/projects/${p.id}`}>
                    <TableCell>
                      <span className="font-medium">{p.name}</span>
                      {isArchived(p) ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Archived
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.phase}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={p.status}
                        className={projectStatusColor[p.status]}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{eur(p.value)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(p.actualEnd ?? p.estimatedEnd)}
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Invoices{" "}
            <span className="font-normal text-muted-foreground">
              ({invoices.length})
            </span>
          </h2>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/invoices/new?clientId=${client.id}`}>
              <Plus className="size-3.5" />
              New invoice
            </Link>
          </Button>
        </div>

        {invoices.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No invoices for this client yet.
          </p>
        ) : (
          <DataTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <ClickableRow key={inv.id} href={`/invoices/${inv.id}`}>
                    <TableCell className="font-medium">
                      {inv.invoiceNumber ?? "Draft"}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={inv.status}
                        className={cn(invoiceStatusColor[inv.status])}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(inv.issueDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(inv.dueDate)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {invoiceMoney(inv.currency, inv.total)}
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        )}
      </section>
    </div>
  );
}
