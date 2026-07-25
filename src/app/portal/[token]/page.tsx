import { redirect } from "next/navigation";

import { portalGetProjectByToken } from "@/lib/portal/repo";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let nextPath = "/projects";
  try {
    const project = await portalGetProjectByToken(token);
    if (project?.id) {
      nextPath = `/projects/${project.id}`;
    }
  } catch {
    // Token lookup can fail in local/dev setups; login still works without next.
  }

  redirect(`/client-login?next=${encodeURIComponent(nextPath)}`);
}
