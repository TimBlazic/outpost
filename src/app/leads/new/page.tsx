import { LeadForm } from "@/components/lead-form";
import { getTeamMembers } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const members = await getTeamMembers();
  return <LeadForm members={members} />;
}
