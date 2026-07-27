import { Moodboard } from "@/components/moodboard";
import { MOODBOARD_PINS } from "@/lib/moodboard";

export default function MoodboardPage() {
  return (
    <div className="px-3 pb-6 sm:px-4 lg:px-5">
      <header className="sticky top-0 z-30 -mx-3 mb-5 isolate border-b border-border/60 bg-background/95 px-3 pt-4 pb-4 backdrop-blur-md sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
        <div className="max-w-lg px-1">
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
