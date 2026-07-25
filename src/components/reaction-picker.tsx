"use client";

import { useEffect, useRef } from "react";
import { SmilePlus } from "lucide-react";

import { cn } from "@/lib/utils";

export const REACTION_EMOJIS = ["👍", "❤️", "👀", "🎉", "😄"] as const;

export function ReactionPicker({
  open,
  onOpenChange,
  onPick,
  disabled,
  portal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (emoji: string) => void;
  disabled?: boolean;
  portal?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onOpenChange(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "rounded-md p-1 transition-colors",
          portal
            ? "text-[var(--portal-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        title="React"
      >
        <SmilePlus className="size-3.5" />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute left-0 top-full z-10 mt-1 flex gap-0.5 rounded-lg border p-1 shadow-md",
            portal
              ? "border-[var(--portal-line)] bg-[var(--portal-bg)]"
              : "border-border bg-popover"
          )}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded px-1.5 py-0.5 text-sm hover:bg-muted"
              onClick={() => onPick(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
