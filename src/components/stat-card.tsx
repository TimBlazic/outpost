import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent
        className={cn("flex items-start", Icon && "justify-between gap-3")}
      >
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
            {label}
          </p>
          <p className="app-display mt-1 text-3xl italic tracking-tight">
            {value}
          </p>
          {sub ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
