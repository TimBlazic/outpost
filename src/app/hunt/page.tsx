import { PageHeader } from "@/components/app-shell";
import { HuntBoard } from "@/components/hunt-board";
import { getHuntPageData } from "@/lib/hunt/actions";

export const dynamic = "force-dynamic";

export default async function HuntPage() {
  const data = await getHuntPageData();
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Hunt"
        description="Find firms. Review five a day."
      />
      <HuntBoard
        enabled={data.enabled}
        initialToday={data.today}
        pooledCount={data.pooledCount}
      />
    </div>
  );
}
