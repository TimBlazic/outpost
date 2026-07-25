import Link from "next/link";

import { cn } from "@/lib/utils";

export function ArchiveTabs({
  basePath,
  view,
  activeCount,
  archivedCount,
}: {
  basePath: "/clients" | "/projects";
  view: "active" | "archived";
  activeCount: number;
  archivedCount: number;
}) {
  const tabs = [
    {
      key: "active" as const,
      label: "Active",
      href: basePath,
      count: activeCount,
    },
    {
      key: "archived" as const,
      label: "Archived",
      href: `${basePath}?view=archived`,
      count: archivedCount,
    },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-border/70">
      {tabs.map((tab) => {
        const selected = view === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              selected
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {tab.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
