"use client";

import { useState } from "react";

import type { MoodboardPin } from "@/lib/moodboard";

function MoodboardPinImage({
  pin,
  priority,
  delayMs,
}: {
  pin: MoodboardPin;
  priority: boolean;
  delayMs: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure
      className="moodboard-pin mb-3 break-inside-avoid"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <img
        src={pin.src}
        alt={pin.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className="w-full rounded-2xl object-cover shadow-[0_1px_0_rgb(0_0_0_/6%)] ring-1 ring-border/40"
      />
    </figure>
  );
}

export function Moodboard({ pins }: { pins: MoodboardPin[] }) {
  return (
    <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
      {pins.map((pin, i) => (
        <MoodboardPinImage
          key={pin.id}
          pin={pin}
          priority={i < 6}
          delayMs={Math.min(i, 12) * 40}
        />
      ))}
    </div>
  );
}
