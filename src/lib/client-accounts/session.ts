import { headers } from "next/headers";

import type { Client } from "@/lib/data";
import { getHostRole, getRequestHostname } from "@/lib/hosts";
import { getClients } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";

export async function getClientForAuthUser(userId: string): Promise<Client | null> {
  const client = (await getClients()).find((item) => item.authUserId === userId);
  return client ?? null;
}

export async function requireClientSession(): Promise<{
  userId: string;
  client: Client;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);
  if (!user) throw new Error("Not signed in");

  const client = await getClientForAuthUser(user.id);
  if (!client) throw new Error("No client profile linked");

  return { userId: user.id, client };
}

/** Client host, or localhost/unified with a linked client account. */
export async function tryClientPortalSession() {
  try {
    return await requireClientSession();
  } catch {
    return null;
  }
}

export async function shouldUseClientPortalUi() {
  const h = await headers();
  if (getHostRole(getRequestHostname(h.get("host"))) === "client") {
    return true;
  }
  return (await tryClientPortalSession()) !== null;
}
