import { isArchived } from "@/lib/data";
import { getProjects } from "@/lib/store";

/**
 * Returns all non-archived projects belonging to the given client.
 * Used on the client host to drive the project picker / auto-redirect.
 */
export async function listProjectsForClient(clientId: string) {
  const projects = await getProjects();
  return projects.filter((p) => p.clientId === clientId && !isArchived(p));
}
