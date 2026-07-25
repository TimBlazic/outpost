"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";

export const DEFAULT_PAGE_SIZE = 20;

export const stickyTableHeaderClass =
  "sticky top-0 z-10 bg-card [&_tr]:border-b [&_tr]:bg-muted/60";

export function useClientPagination<T>(
  items: T[],
  pageSize = DEFAULT_PAGE_SIZE,
  /** Change this (e.g. filter query) to jump back to page 0. */
  resetKey?: string | number
) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  // Clamp when the filtered/sorted set shrinks under the current page.
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [items.length, pageSize]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  const pageRows = useMemo(() => {
    const start = safePage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const from = items.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(items.length, (safePage + 1) * pageSize);

  return {
    pageRows,
    page: safePage,
    setPage,
    pageCount,
    from,
    to,
    total: items.length,
  };
}

export function PaginatedDataTable({
  children,
  total,
  from,
  to,
  page,
  pageCount,
  onPageChange,
  emptyLabel = "No results",
}: {
  children: React.ReactNode;
  total: number;
  from: number;
  to: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  emptyLabel?: string;
}) {
  return (
    <DataTable className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">
          {total === 0 ? emptyLabel : `${from}–${to} of ${total}`}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 0}
            onClick={() => onPageChange(Math.max(0, page - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
            {page + 1} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </DataTable>
  );
}
