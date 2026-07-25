import type { TicketStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

export const ticketStatusMeta: Record<
  TicketStatus,
  { color: string; label: string }
> = {
  Todo: { color: "#94a3b8", label: "Todo" },
  "In progress": { color: "#3b82f6", label: "In progress" },
  "Waiting on client": { color: "#f59e0b", label: "Waiting on client" },
  Done: { color: "#10b981", label: "Done" },
};

export function TicketStatusBadge({
  status,
  size = "sm",
}: {
  status: TicketStatus;
  size?: "sm" | "xs";
}) {
  const meta = ticketStatusMeta[status] ?? ticketStatusMeta.Todo;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-2 py-0.5 text-[10px]"
      )}
      style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

export function ticketShortId(id: string) {
  const raw = id.replace(/^tk[_-]?/i, "");
  return `TK-${raw.slice(0, 6).toUpperCase()}`;
}
