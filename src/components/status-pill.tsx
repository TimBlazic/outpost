import { cn } from "@/lib/utils";

export function StatusPill({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
    >
      {label}
    </span>
  );
}
