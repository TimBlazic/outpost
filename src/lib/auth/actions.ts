"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getClientAuthCallbackUrl,
  getHostRole,
  getRequestHostname,
} from "@/lib/hosts";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function login(formData: FormData) {
  const next = safeNext(formData.get("next"));

  if (!isSupabaseEnabled()) {
    redirect(next);
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`
    );
  }

  redirect(next);
}

export async function requestClientMagicLink(
  email: string,
  nextPath: string = "/"
) {
  if (!isSupabaseEnabled()) return;

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail.includes("@")) {
    throw new Error("Valid email required");
  }

  const supabase = await createClient();
  const reqHeaders = await headers();
  const host = reqHeaders.get("host")?.trim() || "localhost:3000";
  const proto =
    reqHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const emailRedirectTo = getClientAuthCallbackUrl(
    `${proto}://${host}`,
    nextPath
  );
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo,
      shouldCreateUser: false,
    },
  });

  if (error) throw new Error(error.message);
}

export async function logout() {
  if (isSupabaseEnabled()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const reqHeaders = await headers();
  const role = getHostRole(getRequestHostname(reqHeaders.get("host")));
  redirect(role === "client" ? "/client-login" : "/login");
}
