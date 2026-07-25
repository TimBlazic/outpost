import { notFound } from "next/navigation";

import { InvoiceEditor } from "@/components/invoice-editor";
import { isArchived } from "@/lib/data";
import {
  getClients,
  getFirmSettings,
  getInvoiceById,
  getProjects,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    clientId?: string;
    projectId?: string;
  }>;
}) {
  const { from, clientId, projectId } = await searchParams;
  const [clients, projects, settings, source] = await Promise.all([
    getClients(),
    getProjects(),
    getFirmSettings(),
    from ? getInvoiceById(from) : Promise.resolve(undefined),
  ]);

  if (from && !source) notFound();

  const activeClients = clients.filter((c) => !isArchived(c));

  return (
    <InvoiceEditor
      clients={activeClients}
      projects={projects}
      settings={settings}
      invoice={source ?? undefined}
      defaultClientId={clientId}
      defaultProjectId={projectId}
      mode={source ? "duplicate" : "create"}
    />
  );
}
