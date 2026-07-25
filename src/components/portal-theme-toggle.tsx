"use client";

import { useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";

import { setPortalTheme } from "@/lib/portal/actions";
import type { PortalTheme } from "@/lib/portal/theme";
import { cn } from "@/lib/utils";

export function PortalThemeToggle({
  initialTheme,
}: {
  initialTheme: PortalTheme;
}) {
  const [theme, setTheme] = useState<PortalTheme>(initialTheme);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: PortalTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.querySelector(".portal-skin");
    root?.setAttribute("data-theme", next);
    startTransition(async () => {
      await setPortalTheme(next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-[var(--portal-line)] text-[var(--portal-muted)] transition-colors hover:border-[var(--portal-fg)]/30 hover:text-[var(--portal-fg)]"
      )}
    >
      {theme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
