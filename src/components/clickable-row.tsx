"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { TableRow } from "@/components/ui/table";

export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <TableRow
      role="link"
      tabIndex={0}
      className={cn("cursor-pointer", className)}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </TableRow>
  );
}
