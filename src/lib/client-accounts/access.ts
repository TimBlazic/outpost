import { getProjectById } from "@/lib/store";
import { requireClientSession } from "./session";

/**
 * Verify the current Supabase-auth client session owns the given project.
 * Throws if not authenticated or the project doesn't belong to the client.
 */
export async function assertClientProjectAccess(projectId: string) {
  const { client, userId } = await requireClientSession();
  const project = await getProjectById(projectId);
  if (!project || project.clientId !== client.id) {
    throw new Error("Forbidden");
  }
  return { client, project, userId };
}
