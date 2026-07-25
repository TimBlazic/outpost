import { notFound } from "next/navigation";

import { LeadForm } from "@/components/lead-form";
import { getLeadById } from "@/lib/store";
import { getTeamMembers } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lead, members] = await Promise.all([
    getLeadById(id),
    getTeamMembers(),
  ]);
  if (!lead) notFound();
  return <LeadForm lead={lead} members={members} />;
}
