"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { TableRow } from "@/components/ui/table";

export function ClickableRow({
  href,
  onSelect,
  children,
  className,
}: {
  href?: string;
  /** Prefer over navigation — e.g. open a side drawer. */
  onSelect?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function activate() {
    if (onSelect) {
      onSelect();
      return;
    }
    if (href) router.push(href);
  }

  return (
    <TableRow
      role="link"
      tabIndex={0}
      className={cn("cursor-pointer", className)}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
    >
      {children}
    </TableRow>
  );
}
