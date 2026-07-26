import { QuoteEditor } from "@/components/quote-editor";
import { getLeadById } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;
  const lead = leadId ? await getLeadById(leadId) : null;

  return (
    <QuoteEditor
      mode="create"
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
      initial={
        lead
          ? {
              clientName: lead.contact,
              clientCompany: lead.company,
              clientEmail: lead.email,
            }
          : undefined
      }
    />
  );
}
