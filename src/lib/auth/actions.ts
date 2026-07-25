"use server";

import { redirect } from "next/navigation";

import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
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

export async function logout() {
  if (isSupabaseEnabled()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
