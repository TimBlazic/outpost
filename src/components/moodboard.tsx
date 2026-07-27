"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MoodboardPin } from "@/lib/moodboard";
import { moodboardImageSrc } from "@/lib/moodboard";
import { cn } from "@/lib/utils";

const GAP_PX = 12;
const FALLBACK_HEIGHT = 260;

function columnCountForWidth(width: number) {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

function useIsTauriShell() {
  const [tauri, setTauri] = useState(false);
  useEffect(() => {
    setTauri(
      typeof window !== "undefined" &&
        ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    );
  }, []);
  return tauri;
}

function MoodboardPinCard({
  pin,
  priority,
  proxy,
  onHeight,
  className,
}: {
  pin: MoodboardPin;
  priority: boolean;
  proxy: boolean;
  onHeight?: (id: string, height: number) => void;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [src, setSrc] = useState(() => moodboardImageSrc(pin.src, { proxy }));
  const triedDirect = useRef(false);

  return (
    <figure className={cn("moodboard-pin mb-3 w-full", className)}>
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
              referrerPolicy="no-referrer"
              onLoad={(e) => {
                if (!onHeight) return;
                const h = e.currentTarget.getBoundingClientRect().height;
                if (h > 0) onHeight(pin.id, h + GAP_PX);
              }}
              onError={() => {
                // Proxy failed → fall back to direct CDN once (don't unmount).
                if (proxy && !triedDirect.current) {
                  triedDirect.current = true;
                  setSrc(pin.src);
                  return;
                }
                onHeight?.(pin.id, 0);
              }}
              className="block w-full rounded-2xl object-cover shadow-[0_1px_0_rgb(0_0_0_/6%)] ring-1 ring-border/40 transition-[filter] duration-300 group-hover:brightness-[0.97]"
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

/** Height-balanced flex columns — used in Tauri WKWebView where CSS columns break. */
function FlexMasonry({
  pins,
  proxy,
}: {
  pins: MoodboardPin[];
  proxy: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(2);
  const [heights, setHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setColumnCount(columnCountForWidth(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onHeight = (id: string, height: number) => {
    setHeights((prev) => {
      if (prev[id] === height) return prev;
      return { ...prev, [id]: height };
    });
  };

  const columns = useMemo(() => {
    const cols: MoodboardPin[][] = Array.from(
      { length: columnCount },
      () => []
    );
    const colHeights = Array.from({ length: columnCount }, () => 0);

    for (const pin of pins) {
      let shortest = 0;
      for (let i = 1; i < columnCount; i++) {
        if (colHeights[i]! < colHeights[shortest]!) shortest = i;
      }
      cols[shortest]!.push(pin);
      const h = heights[pin.id];
      if (h !== 0) {
        colHeights[shortest]! += h ?? FALLBACK_HEIGHT;
      }
    }
    return cols;
  }, [pins, columnCount, heights]);

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
                priority={globalIndex < 8}
                proxy={proxy}
                onHeight={onHeight}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** CSS multi-column — best look in Chromium / Safari browser. */
function CssColumnMasonry({
  pins,
  proxy,
}: {
  pins: MoodboardPin[];
  proxy: boolean;
}) {
  return (
    <div className="moodboard-columns columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
      {pins.map((pin, i) => (
        <MoodboardPinCard
          key={pin.id}
          pin={pin}
          priority={i < 8}
          proxy={proxy}
          className="break-inside-avoid"
        />
      ))}
    </div>
  );
}

export function Moodboard({ pins }: { pins: MoodboardPin[] }) {
  const tauri = useIsTauriShell();
  const proxy = tauri;
  if (tauri) return <FlexMasonry pins={pins} proxy={proxy} />;
  return <CssColumnMasonry pins={pins} proxy={proxy} />;
}
