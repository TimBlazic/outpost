import { Moodboard } from "@/components/moodboard";
import { MOODBOARD_PINS } from "@/lib/moodboard";

export default function MoodboardPage() {
  return (
    <div className="px-3 pb-6 sm:px-4 lg:px-5">
      <header className="mb-5 border-b border-border/60 px-1 pb-4 pt-4">
        <div className="max-w-lg">
          <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
            Personal
          </p>
          <h1 className="app-display mt-1 text-3xl italic leading-none tracking-tight sm:text-4xl">
            Moodboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Why you&apos;re building this. Tap a photo to flip.
          </p>
        </div>
      </header>
      <Moodboard pins={MOODBOARD_PINS} />
      <footer className="flex justify-center px-2 pt-14 pb-10 sm:pt-20 sm:pb-14">
        <p className="app-display text-center text-4xl italic leading-none tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Private victories
        </p>
      </footer>
    </div>
  );
}
