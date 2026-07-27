"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MoodboardPin } from "@/lib/moodboard";
import { moodboardImageSrc } from "@/lib/moodboard";
import { cn } from "@/lib/utils";

function columnCountForWidth(width: number) {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

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
  const src = moodboardImageSrc(pin.src);
  if (failed) return null;

  return (
    <figure
      className="moodboard-pin mb-3 w-full"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <button
        type="button"
        aria-pressed={flipped}
        aria-label={
          flipped ? `Hide note: ${pin.title}` : `Show note: ${pin.title}`
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
              src={src}
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
              style={{ backgroundImage: `url(${src})` }}
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

/**
 * Flex-column masonry instead of CSS multi-column.
 * WKWebView (Tauri) mis-places `columns-*` into a staircase and paints
 * transformed pins over the sticky header.
 */
export function Moodboard({ pins }: { pins: MoodboardPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setColumnCount(columnCountForWidth(el.clientWidth));
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => {
    const cols: MoodboardPin[][] = Array.from(
      { length: columnCount },
      () => []
    );
    pins.forEach((pin, i) => {
      cols[i % columnCount]!.push(pin);
    });
    return cols;
  }, [pins, columnCount]);

  return (
    <div ref={containerRef} className="flex items-start gap-3">
      {columns.map((col, colIndex) => (
        <div key={colIndex} className="min-w-0 flex-1">
          {col.map((pin, i) => {
            const globalIndex = colIndex + i * columnCount;
            return (
              <MoodboardPinCard
                key={pin.id}
                pin={pin}
                priority={globalIndex < 6}
                delayMs={Math.min(globalIndex, 12) * 40}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
