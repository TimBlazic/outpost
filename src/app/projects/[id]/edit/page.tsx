import { notFound } from "next/navigation";

import { ProjectForm } from "@/components/project-form";
import { getProjectById, getLeads, getClients } from "@/lib/store";
import { getTeamMembers } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, leads, clients, members] = await Promise.all([
    getProjectById(id),
    getLeads(),
    getClients(),
    getTeamMembers(),
  ]);
  if (!project) notFound();
  return (
    <ProjectForm
      project={project}
      leads={leads}
      clients={clients}
      members={members}
    />
  );
}
