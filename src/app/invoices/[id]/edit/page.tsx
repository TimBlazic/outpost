import { notFound, redirect } from "next/navigation";

import { InvoiceEditor } from "@/components/invoice-editor";
import { isArchived } from "@/lib/data";
import {
  getClients,
  getFirmSettings,
  getInvoiceById,
  getProjects,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, clients, projects, settings] = await Promise.all([
    getInvoiceById(id),
    getClients(),
    getProjects(),
    getFirmSettings(),
  ]);
  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/invoices/${id}`);

  return (
    <InvoiceEditor
      clients={clients.filter((c) => !isArchived(c))}
      projects={projects}
      settings={settings}
      invoice={invoice}
      mode="edit"
    />
  );
}
