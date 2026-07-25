"use client";

import { useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";

import { setStudioTheme } from "@/lib/theme/actions";
import type { StudioTheme } from "@/lib/theme/studio";
import { cn } from "@/lib/utils";

export function StudioThemeToggle({
  initialTheme,
  collapsed,
}: {
  initialTheme: StudioTheme;
  collapsed?: boolean;
}) {
  const [theme, setTheme] = useState<StudioTheme>(initialTheme);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: StudioTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    startTransition(async () => {
      await setStudioTheme(next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground",
        collapsed ? "size-9" : "size-8"
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
