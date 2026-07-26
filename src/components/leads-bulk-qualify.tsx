"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import {
  bulkEnqueueSelectedLeadsAction,
  bulkEnqueueUnscoredLeadsAction,
  getQualifyJobCountsAction,
} from "@/lib/qualify/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LeadsBulkQualifyBar({
  selectedIds,
  onClearSelection,
}: {
  selectedIds: string[];
  onClearSelection: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const counts = await getQualifyJobCountsAction();
        if (alive) setDepth((counts.pending ?? 0) + (counts.running ?? 0));
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, depth > 0 ? 4000 : 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [depth]);

  function runUnscored() {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await bulkEnqueueUnscoredLeadsAction();
        setMessage(
          `Enqueued ${res.enqueued} lead${res.enqueued === 1 ? "" : "s"}` +
            (res.skipped ? ` · skipped ${res.skipped}` : "")
        );
        setConfirmOpen(false);
        const counts = await getQualifyJobCountsAction();
        setDepth((counts.pending ?? 0) + (counts.running ?? 0));
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Bulk qualify failed");
      }
    });
  }

  function runSelected() {
    if (!selectedIds.length) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await bulkEnqueueSelectedLeadsAction(selectedIds);
        setMessage(
          `Enqueued ${res.enqueued} selected` +
            (res.skipped ? ` · skipped ${res.skipped}` : "")
        );
        onClearSelection();
        const counts = await getQualifyJobCountsAction();
        setDepth((counts.pending ?? 0) + (counts.running ?? 0));
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Bulk qualify failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        <Sparkles className="size-3.5" />
        Qualify unscored
      </Button>

      {selectedIds.length > 0 ? (
        <>
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={pending}
            onClick={runSelected}
          >
            Qualify selected ({selectedIds.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={onClearSelection}
          >
            Clear selection
          </Button>
        </>
      ) : null}

      {depth > 0 ? (
        <span className="text-xs text-muted-foreground">
          Qualifying · {depth} queued
        </span>
      ) : null}

      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qualify unscored leads?</DialogTitle>
            <DialogDescription>
              Enqueues every lead with a website and no qualify score (max 200).
              Jobs run one at a time in the background.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={runUnscored}>
              Enqueue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
