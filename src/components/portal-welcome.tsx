"use client";

import { useEffect, useState } from "react";

import {
  normalizePortalLocale,
  portalT,
  type PortalLocale,
} from "@/lib/portal/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function storageKey(token: string) {
  return `outpost.portalWelcome.${token}`;
}

export function PortalWelcome({
  token,
  intro,
  locale = "en",
  onGoMessages,
  className,
}: {
  token: string;
  intro?: string | null;
  locale?: PortalLocale;
  onGoMessages: () => void;
  className?: string;
}) {
  const t = portalT(normalizePortalLocale(locale));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(storageKey(token)) !== "1");
    } catch {
      setVisible(true);
    }
  }, [token]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey(token), "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--portal-line)] bg-[var(--portal-surface)] px-5 py-4 sm:px-6 sm:py-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="portal-display text-xl italic sm:text-2xl">
            {t.welcomeTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--portal-muted)]">
            {intro?.trim() || t.welcomeHint}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-[var(--portal-accent)] text-[var(--portal-bg)] hover:bg-[var(--portal-accent)] hover:text-[var(--portal-bg)] hover:opacity-90"
            onClick={() => {
              onGoMessages();
              dismiss();
            }}
          >
            {t.goMessages}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[var(--portal-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
            onClick={dismiss}
          >
            {t.welcomeContinue}
          </Button>
        </div>
      </div>
    </div>
  );
}
