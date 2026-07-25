import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { LeadsView } from "@/components/leads-view";
import { ExportLeadsButton } from "@/components/export-leads-button";
import {
  LeadQualifyDialog,
  LeadQualifyDialogFromSearch,
} from "@/components/lead-qualify-dialog";
import { getLeads } from "@/lib/store";
import { eur } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeads();
  const open = leads.filter(
    (l) => !["Won", "Lost", "Not suitable"].includes(l.status)
  );
  const openValue = open.reduce((s, l) => s + l.value, 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        title="Leads"
        description={`${open.length} open leads · ${eur(openValue)} in pipeline`}
      >
        <ExportLeadsButton leads={leads} />
        <LeadQualifyDialog />
        <Button asChild>
          <Link href="/leads/new">
            <Plus className="size-4" />
            New lead
          </Link>
        </Button>
      </PageHeader>
      <Suspense fallback={null}>
        <LeadQualifyDialogFromSearch />
      </Suspense>
      <div className="flex min-h-0 flex-1 flex-col">
        <LeadsView leads={leads} />
      </div>
    </div>
  );
}
