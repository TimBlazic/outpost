"use client";

import { cn } from "@/lib/utils";
import { fitScoreLabel } from "@/lib/qualify/score";

export function QualifyScoreDonut({
  score,
  className,
  size = 112,
  compact = false,
}: {
  score: number;
  className?: string;
  /** Outer diameter in px (default 112, use ~64 on lead detail). */
  size?: number;
  /** Hide “Fit score” caption — for inline header placement. */
  compact?: boolean;
}) {
  const stroke = size >= 100 ? 10 : size >= 70 ? 8 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c - (clamped / 100) * c;
  const tone =
    clamped >= 75
      ? "text-emerald-600 dark:text-emerald-400"
      : clamped >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";
  const track = "stroke-border";
  const ring =
    clamped >= 75
      ? "stroke-emerald-500"
      : clamped >= 50
        ? "stroke-amber-500"
        : "stroke-rose-500";

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className={track}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className={cn(ring, "transition-[stroke-dashoffset] duration-700")}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-semibold tabular-nums",
              size >= 100 ? "text-3xl" : size >= 70 ? "text-xl" : "text-base",
              tone
            )}
          >
            {clamped}
          </span>
        </div>
      </div>
      <p
        className={cn(
          "font-medium leading-none",
          size >= 100 ? "text-sm" : "text-[11px]",
          tone
        )}
      >
        {fitScoreLabel(clamped)}
      </p>
      {compact ? null : (
        <p className="text-[11px] text-muted-foreground">Fit score</p>
      )}
    </div>
  );
}
