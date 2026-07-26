import { notFound } from "next/navigation";

import { QuoteEditor } from "@/components/quote-editor";
import { getLeadById, getQuoteById } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();
  if (quote.status !== "draft") notFound();

  const lead = quote.leadId ? await getLeadById(quote.leadId) : null;

  return (
    <QuoteEditor
      mode="edit"
      quote={quote}
      initialLead={
        lead
          ? {
              id: lead.id,
              company: lead.company,
              contact: lead.contact,
              email: lead.email,
              description: lead.description,
              value: lead.value,
              status: lead.status,
            }
          : null
      }
    />
  );
}
