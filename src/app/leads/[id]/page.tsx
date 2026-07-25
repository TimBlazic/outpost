import { notFound } from "next/navigation";

import { LeadDetail } from "@/components/lead-detail";
import {
  getLeadById,
  getActivitiesForLead,
  getNotesForLead,
  getAttachmentsFor,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const [activities, notes, files] = await Promise.all([
    getActivitiesForLead(id),
    getNotesForLead(id),
    getAttachmentsFor("lead", id),
  ]);

  return (
    <LeadDetail lead={lead} activities={activities} notes={notes} files={files} />
  );
}
