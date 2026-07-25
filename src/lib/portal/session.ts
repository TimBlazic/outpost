import { cookies } from "next/headers";

import { signPayload } from "./pin";

const COOKIE = "outpost_portal";

function secret() {
  return (
    process.env.OUTPOST_PORTAL_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "outpost-dev-portal-secret"
  );
}

export async function getPortalSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [token, expStr, sig] = parts;
  const payload = `${token}.${expStr}`;
  if (signPayload(payload, secret()) !== sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return token;
}

export async function assertPortalAccess(token: string) {
  const session = await getPortalSessionToken();
  if (session !== token) {
    throw new Error("Portal session required");
  }
}
