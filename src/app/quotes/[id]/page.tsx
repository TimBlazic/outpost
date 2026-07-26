import { notFound } from "next/navigation";

import { QuoteDetail } from "@/components/quote-detail";
import { ensureQuoteNumbered } from "@/lib/quotes/actions";
import { getFirmSettings, getLeadById, getQuoteById } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let quote = await getQuoteById(id);
  if (!quote) notFound();
  if (!quote.number) {
    quote = (await ensureQuoteNumbered(id)) ?? quote;
  }
  const settings = await getFirmSettings();

  const lead = quote.leadId ? await getLeadById(quote.leadId) : null;

  return (
    <QuoteDetail
      quote={quote}
      settings={settings}
      leadId={lead?.id ?? null}
      leadName={lead?.company ?? null}
      leadEmail={lead?.email ?? null}
    />
  );
}
