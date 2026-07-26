"use client";

import { useState } from "react";

import type { MoodboardPin } from "@/lib/moodboard";
import { cn } from "@/lib/utils";

function MoodboardPinCard({
  pin,
  priority,
  delayMs,
}: {
  pin: MoodboardPin;
  priority: boolean;
  delayMs: number;
}) {
  const [failed, setFailed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  if (failed) return null;

  return (
    <figure
      className="moodboard-pin mb-3 break-inside-avoid"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <button
        type="button"
        aria-pressed={flipped}
        aria-label={
          flipped
            ? `Hide note: ${pin.title}`
            : `Show note: ${pin.title}`
        }
        onClick={() => setFlipped((v) => !v)}
        className="moodboard-flip group relative block w-full cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span
          className={cn(
            "moodboard-flip-inner relative block w-full",
            flipped && "is-flipped"
          )}
        >
          <span className="moodboard-flip-face moodboard-flip-front block w-full">
            <img
              src={pin.src}
              alt={pin.alt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              onError={() => setFailed(true)}
              className="w-full rounded-2xl object-cover shadow-[0_1px_0_rgb(0_0_0_/6%)] ring-1 ring-border/40 transition-[filter] duration-300 group-hover:brightness-[0.97]"
            />
          </span>
          <span
            className="moodboard-flip-face moodboard-flip-back absolute inset-0 flex flex-col justify-end overflow-hidden rounded-2xl p-3.5 sm:p-4"
            aria-hidden={!flipped}
          >
            <span
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${pin.src})` }}
            />
            <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/88 via-black/55 to-black/25" />
            <span className="relative z-10">
              <span className="app-display block text-[1.05rem] leading-tight tracking-tight text-white italic sm:text-lg">
                {pin.title}
              </span>
              <span className="mt-1.5 block text-[12px] leading-snug text-white/80 sm:text-[13px]">
                {pin.description}
              </span>
            </span>
          </span>
        </span>
      </button>
    </figure>
  );
}

export function Moodboard({ pins }: { pins: MoodboardPin[] }) {
  return (
    <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
      {pins.map((pin, i) => (
        <MoodboardPinCard
          key={pin.id}
          pin={pin}
          priority={i < 6}
          delayMs={Math.min(i, 12) * 40}
        />
      ))}
    </div>
  );
}
