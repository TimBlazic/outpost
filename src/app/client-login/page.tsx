import Link from "next/link";
import { redirect } from "next/navigation";

import { requestClientMagicLink } from "@/lib/auth/actions";
import {
  normalizePortalLocale,
  portalT,
} from "@/lib/portal/i18n";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNext(next: string | undefined) {
  if (!next) return "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    sent?: string;
    email?: string;
    lang?: string;
  }>;
}) {
  const { next, error, sent, email, lang } = await searchParams;
  const enabled = isSupabaseEnabled();
  const nextPath = safeNext(next);
  const sentMessage = sent === "1";
  const defaultEmail = (email ?? "").trim().toLowerCase();
  const locale = normalizePortalLocale(lang);
  const t = portalT(locale);
  const errorMessage =
    error === "auth"
      ? locale === "sl"
        ? "Prijava povezava ni veljavna ali je potekla. Zahtevaj novo spodaj."
        : "This sign-in link is invalid or has expired. Request a new one below."
      : error;

  async function sendMagicLink(formData: FormData) {
    "use server";

    const submittedEmail = String(formData.get("email") ?? "");
    const requestedNext = safeNext(String(formData.get("next") ?? "/"));
    const requestedLang = normalizePortalLocale(
      String(formData.get("lang") ?? "en")
    );

    try {
      await requestClientMagicLink(submittedEmail);
      const params = new URLSearchParams({
        sent: "1",
        next: requestedNext,
        lang: requestedLang,
      });
      if (submittedEmail.trim()) {
        params.set("email", submittedEmail.trim().toLowerCase());
      }
      redirect(`/client-login?${params.toString()}`);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Failed to send link";
      const params = new URLSearchParams({
        error: message,
        next: requestedNext,
        lang: requestedLang,
      });
      if (submittedEmail.trim()) {
        params.set("email", submittedEmail.trim().toLowerCase());
      }
      redirect(`/client-login?${params.toString()}`);
    }
  }

  return (
    <div
      className="portal-skin flex min-h-screen items-center justify-center px-6 py-12"
      data-theme="light"
    >
      <div className="portal-reveal w-full max-w-md space-y-8">
        <div>
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--portal-muted)]">
            {t.loginEyebrow}
          </p>
          <h1 className="portal-display mt-3 text-5xl italic leading-none">
            {t.loginTitle}
          </h1>
          <p className="mt-4 text-[var(--portal-muted)]">{t.loginHint}</p>
        </div>

        {!enabled ? (
          <div className="space-y-4">
            <p className="rounded-md border border-[var(--portal-line)] px-3 py-2 text-sm text-[var(--portal-muted)]">
              Local development mode - auth is off.
            </p>
            <Button asChild className="h-11 w-full">
              <Link href={nextPath}>Continue</Link>
            </Button>
          </div>
        ) : (
          <form action={sendMagicLink} className="space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <input type="hidden" name="lang" value={locale} />
            {errorMessage && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            {sentMessage && !errorMessage && (
              <p className="rounded-md border border-emerald-600/20 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800">
                {t.loginSent}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t.loginEmail}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={defaultEmail}
                className="h-11 bg-[var(--portal-surface)]"
              />
            </div>
            <Button type="submit" className="h-11 w-full">
              {t.loginSend}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
