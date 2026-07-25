"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type PortalStatus = "no-account" | "invited" | "active";
type PortalLocale = "en" | "sl";

function getPortalStatus(input: {
  authUserId: string | null;
  onboardingCompletedAt: string | null;
}): PortalStatus {
  if (!input.authUserId) return "no-account";
  if (!input.onboardingCompletedAt) return "invited";
  return "active";
}

const STATUS_META: Record<
  PortalStatus,
  {
    label: string;
    tone: string;
    helper: string;
  }
> = {
  "no-account": {
    label: "No account",
    tone: "bg-muted text-muted-foreground",
    helper: "No portal account is linked yet.",
  },
  invited: {
    label: "Invited",
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    helper: "Account ready — share the login URL. Client signs in when ready.",
  },
  active: {
    label: "Active",
    tone:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    helper: "Client has completed onboarding.",
  },
};

export function ClientPortalAccountPanel({
  authUserId,
  portalEmail,
  onboardingCompletedAt,
  portalLocale: initialLocale,
  fallbackEmail,
  loginUrl,
  ensurePortalAccount,
  setPortalLocale,
}: {
  authUserId: string | null;
  portalEmail: string | null;
  onboardingCompletedAt: string | null;
  portalLocale: PortalLocale;
  fallbackEmail: string | null;
  loginUrl: string;
  ensurePortalAccount: (
    portalEmail: string,
    portalLocale: PortalLocale
  ) => Promise<{ loginUrl: string }>;
  setPortalLocale: (
    portalLocale: PortalLocale
  ) => Promise<{ loginUrl: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState(portalEmail ?? fallbackEmail ?? "");
  const [locale, setLocale] = useState<PortalLocale>(
    initialLocale === "sl" ? "sl" : "en"
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState(loginUrl);
  const [copied, setCopied] = useState(false);

  const status = getPortalStatus({ authUserId, onboardingCompletedAt });
  const hasLinkedAuthWithoutEmail = Boolean(authUserId) && !portalEmail?.trim();
  const hasEmail = email.trim().length > 0;
  const showShareUrl = status !== "no-account" || Boolean(shareUrl);

  function withFeedback(
    work: () => Promise<{ loginUrl?: string } | void>,
    success: string
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await work();
        if (result && "loginUrl" in result && result.loginUrl) {
          setShareUrl(result.loginUrl);
        }
        setNotice(success);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  async function copyLoginUrl() {
    const url = shareUrl || loginUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy URL. Select and copy it manually.");
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="size-3.5" />
          Portal
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              STATUS_META[status].tone
            )}
          >
            {STATUS_META[status].label}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Portal account</SheetTitle>
          <SheetDescription>{STATUS_META[status].helper}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                STATUS_META[status].tone
              )}
            >
              {STATUS_META[status].label}
            </span>
          </div>

          {portalEmail ? (
            <p className="text-sm text-muted-foreground">
              Portal email:{" "}
              <span className="font-medium text-foreground">{portalEmail}</span>
            </p>
          ) : hasLinkedAuthWithoutEmail ? (
            <p className="text-sm text-amber-600">
              Account is linked, but portal email is missing. Set an email below.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label>Portal language</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={locale === "sl" ? "default" : "outline"}
                disabled={pending}
                onClick={() => {
                  setLocale("sl");
                  if (status !== "no-account") {
                    withFeedback(
                      () => setPortalLocale("sl"),
                      "Portal language set to Slovenian."
                    );
                  }
                }}
              >
                Slovenščina
              </Button>
              <Button
                type="button"
                size="sm"
                variant={locale === "en" ? "default" : "outline"}
                disabled={pending}
                onClick={() => {
                  setLocale("en");
                  if (status !== "no-account") {
                    withFeedback(
                      () => setPortalLocale("en"),
                      "Portal language set to English."
                    );
                  }
                }}
              >
                English
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Used for onboarding and the client portal UI.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="portal-email-input">Portal email</Label>
            <div className="flex flex-col gap-2">
              <Input
                id="portal-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="portal@client.com"
              />
              <Button
                size="sm"
                disabled={pending || !hasEmail}
                onClick={() =>
                  withFeedback(
                    () => ensurePortalAccount(email.trim(), locale),
                    status === "no-account"
                      ? "Portal account created. Copy the login URL and send it to the client."
                      : "Portal account updated. Copy the login URL below."
                  )
                }
              >
                {status === "no-account" ? "Create account" : "Update account"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              No magic link is emailed from here. Share the login URL — they
              request a fresh sign-in link when they open it.
            </p>
          </div>

          {showShareUrl && (shareUrl || loginUrl) ? (
            <div className="space-y-2 rounded-md border bg-muted/40 px-3 py-3">
              <Label htmlFor="portal-login-url">Client login URL</Label>
              <Input
                id="portal-login-url"
                readOnly
                value={shareUrl || loginUrl}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyLoginUrl()}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" /> Copy URL
                  </>
                )}
              </Button>
            </div>
          ) : null}

          {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
