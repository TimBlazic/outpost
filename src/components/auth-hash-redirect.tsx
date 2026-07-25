"use client";

import { useEffect } from "react";

/**
 * Supabase puts OTP failures on the Site URL as a hash fragment
 * (`#error=access_denied&error_code=otp_expired&...`), which never reaches
 * the server. Route those to the client login page with a readable message.
 */
export function AuthHashRedirect() {
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw || !raw.includes("error=")) return;

    const params = new URLSearchParams(raw);
    const code = params.get("error_code") || params.get("error") || "auth";
    const description = (params.get("error_description") || "")
      .replace(/\+/g, " ")
      .trim();

    let message = description || "Sign-in link is invalid or has expired.";
    if (code === "otp_expired" || /expired|invalid/i.test(message)) {
      message =
        "This sign-in link is invalid or has expired. Request a new magic link.";
    }

    const next = new URL("/client-login", window.location.origin);
    next.searchParams.set("error", message);
    window.location.replace(next.toString());
  }, []);

  return null;
}
