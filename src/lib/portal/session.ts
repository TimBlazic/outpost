import { cookies } from "next/headers";

import { signPayload } from "./pin";

const COOKIE = "outpost_portal";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function secret() {
  return (
    process.env.OUTPOST_PORTAL_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "outpost-dev-portal-secret"
  );
}

export async function setPortalSession(token: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `${token}.${exp}`;
  const sig = signPayload(payload, secret());
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearPortalSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
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
