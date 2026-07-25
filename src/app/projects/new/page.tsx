import { ProjectForm } from "@/components/project-form";
import { getLeads, getClients } from "@/lib/store";
import { getTeamMembers } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; clientId?: string }>;
}) {
  const { leadId, clientId } = await searchParams;
  const [leads, clients, members] = await Promise.all([
    getLeads(),
    getClients(),
    getTeamMembers(),
  ]);
  return (
    <ProjectForm
      leads={leads}
      clients={clients}
      defaultLeadId={leadId}
      defaultClientId={clientId}
      members={members}
    />
  );
}
