import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { QuotesView } from "@/components/quotes-view";
import { eur } from "@/lib/format";
import { getQuotes } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const quotes = await getQuotes();
  const open = quotes.filter((q) => q.status === "draft" || q.status === "sent");
  const openValue = open.reduce((s, q) => s + q.total, 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        title="Quotes"
        description={`${quotes.length} quote${quotes.length === 1 ? "" : "s"} · ${eur(openValue)} open`}
      >
        <Button asChild>
          <Link href="/quotes/new">
            <Plus className="size-4" />
            New quote
          </Link>
        </Button>
      </PageHeader>

      {quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotes yet"
          description="Create a personalized ponudba from a lead after discovery — AI drafts intro, scope, and line items."
          actionLabel="New quote"
          actionHref="/quotes/new"
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <QuotesView quotes={quotes} />
        </div>
      )}
    </div>
  );
}
