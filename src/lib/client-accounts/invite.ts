"use server";

// Creates the Auth user + links the client row. Does NOT email a magic link —
// studio shares the stable /client-login URL; the client requests a fresh OTP
// when they are ready to sign in.

import { headers } from "next/headers";

import {
  getClientAuthCallbackUrl,
  getClientPortalLoginUrl,
} from "@/lib/hosts";
import {
  getClientById,
  getClients,
  getProjects,
  saveClients,
  saveProjects,
} from "@/lib/store";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizePortalEmail(portalEmail: string) {
  return portalEmail.trim().toLowerCase();
}

function assertPortalEmail(portalEmail: string) {
  const email = normalizePortalEmail(portalEmail);
  if (!email.includes("@")) throw new Error("Valid portal email required");
  return email;
}

async function requestOrigin() {
  const h = await headers();
  const host = h.get("host")?.trim() || "localhost:3000";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

export async function getClientLoginShareUrl(
  portalEmail?: string | null,
  portalLocale?: "en" | "sl" | null
) {
  return getClientPortalLoginUrl(
    await requestOrigin(),
    portalEmail,
    portalLocale
  );
}

async function linkClientAuth(
  clientId: string,
  portalEmail: string,
  userId: string,
  portalLocale?: "en" | "sl"
) {
  const clients = await getClients();
  await saveClients(
    clients.map((client) =>
      client.id === clientId
        ? {
            ...client,
            authUserId: userId,
            portalEmail,
            ...(portalLocale ? { portalLocale } : {}),
          }
        : client
    )
  );
}

/** Keep linked projects' portalLocale in sync for legacy readers. */
async function syncProjectsLocale(clientId: string, portalLocale: "en" | "sl") {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.clientId === clientId ? { ...p, portalLocale } : p
    )
  );
}

function isAlreadyRegisteredError(message: string) {
  const msg = message.toLowerCase();
  return (
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    msg.includes("email address is already")
  );
}

/** Resolve existing auth user id without sending email (discard generated link). */
async function findAuthUserIdByEmail(email: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: getClientAuthCallbackUrl(await requestOrigin()),
    },
  });
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error("Could not resolve auth user for email");
  return userId;
}

async function ensureClientProfileRole(userId: string, name: string) {
  const supabase = createAdminClient();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  await supabase.from("profiles").upsert({
    id: userId,
    name,
    initials,
    role: "Client",
  });
}

async function ensureAuthUserForClient(input: {
  clientId: string;
  email: string;
  name: string;
}) {
  const supabase = createAdminClient();
  const metadata = {
    kind: "client",
    client_id: input.clientId,
    name: input.name,
  } as const;

  const created = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!created.error && created.data.user?.id) {
    await ensureClientProfileRole(created.data.user.id, input.name);
    return created.data.user.id;
  }

  const message = (created.error?.message ?? "").trim();
  if (!isAlreadyRegisteredError(message)) {
    throw new Error(message || "Failed to create portal account");
  }

  const userId = await findAuthUserIdByEmail(input.email);
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  });
  await ensureClientProfileRole(userId, input.name);
  return userId;
}

export async function inviteClientPortalAccount(
  clientId: string,
  portalEmail: string,
  portalLocale: "en" | "sl" = "en"
): Promise<{ userId: string; loginUrl: string }> {
  const email = assertPortalEmail(portalEmail);
  const locale = portalLocale === "sl" ? "sl" : "en";
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found");

  const userId = await ensureAuthUserForClient({
    clientId,
    email,
    name: client.name,
  });

  await linkClientAuth(clientId, email, userId, locale);
  await syncProjectsLocale(clientId, locale);
  return {
    userId,
    loginUrl: await getClientLoginShareUrl(email, locale),
  };
}

export async function setClientPortalLocale(
  clientId: string,
  portalLocale: "en" | "sl"
): Promise<{ loginUrl: string }> {
  const locale = portalLocale === "sl" ? "sl" : "en";
  const clients = await getClients();
  const client = clients.find((c) => c.id === clientId);
  if (!client) throw new Error("Client not found");

  await saveClients(
    clients.map((c) =>
      c.id === clientId ? { ...c, portalLocale: locale } : c
    )
  );
  await syncProjectsLocale(clientId, locale);
  return {
    loginUrl: await getClientLoginShareUrl(client.portalEmail ?? client.email, locale),
  };
}

/** @deprecated Prefer getClientLoginShareUrl — no email is sent. */
export async function resendClientMagicLink(clientId: string): Promise<{
  loginUrl: string;
}> {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found");
  if (!client.portalEmail) throw new Error("Client has no portal email");

  const email = assertPortalEmail(client.portalEmail);
  if (!client.authUserId) {
    await inviteClientPortalAccount(clientId, email, client.portalLocale);
  }

  return {
    loginUrl: await getClientLoginShareUrl(email, client.portalLocale),
  };
}
