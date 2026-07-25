import type { MoodboardPin } from "@/lib/moodboard";

export function Moodboard({ pins }: { pins: MoodboardPin[] }) {
  return (
    <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
      {pins.map((pin, i) => (
        <figure
          key={pin.id}
          className="moodboard-pin mb-3 break-inside-avoid"
          style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
        >
          <img
            src={pin.src}
            alt={pin.alt}
            loading={i < 6 ? "eager" : "lazy"}
            decoding="async"
            className="w-full rounded-2xl object-cover shadow-[0_1px_0_rgb(0_0_0_/6%)] ring-1 ring-border/40"
          />
        </figure>
      ))}
    </div>
  );
}
