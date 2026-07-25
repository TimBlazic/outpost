import { Moodboard } from "@/components/moodboard";
import { MOODBOARD_PINS } from "@/lib/moodboard";

export default function MoodboardPage() {
  return (
    <div className="px-3 pb-6 sm:px-4 lg:px-5">
      <header className="sticky top-0 z-10 -mx-3 mb-5 border-b border-border/60 bg-background/95 px-3 pt-4 pb-4 backdrop-blur-md sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
        <div className="max-w-lg px-1">
          <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
            Personal
          </p>
          <h1 className="app-display mt-1 text-3xl italic leading-none tracking-tight sm:text-4xl">
            Moodboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Why you&apos;re building this.
          </p>
        </div>
      </header>
      <Moodboard pins={MOODBOARD_PINS} />
    </div>
  );
}
