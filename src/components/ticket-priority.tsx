import { ticketPriorities, type TicketPriority } from "@/lib/data";
import { cn } from "@/lib/utils";

const priorityClass: Record<TicketPriority, string> = {
  Low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  High: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function TicketPriorityPill({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        priorityClass[priority] ?? priorityClass.Medium,
        className
      )}
    >
      {priority}
    </span>
  );
}

export function TicketTags({
  tags,
  className,
}: {
  tags: string[];
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export { ticketPriorities, priorityClass };
