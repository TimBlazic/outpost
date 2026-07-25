import { cn } from "@/lib/utils";

/** Shared shell for list tables — same border, radius, and surface everywhere. */
export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card/80",
        className
      )}
    >
      {children}
    </div>
  );
}
