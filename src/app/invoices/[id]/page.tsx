import { notFound } from "next/navigation";

import { InvoiceDetail } from "@/components/invoice-detail";
import {
  getFirmSettings,
  getInvoiceById,
  getProjectById,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, settings] = await Promise.all([
    getInvoiceById(id),
    getFirmSettings(),
  ]);
  if (!invoice) notFound();

  const project = invoice.projectId
    ? await getProjectById(invoice.projectId)
    : null;

  return (
    <InvoiceDetail
      invoice={invoice}
      settings={settings}
      projectName={project?.name ?? null}
    />
  );
}
