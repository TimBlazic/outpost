"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Sparkles } from "lucide-react";

import {
  bulkDeleteLeads,
  bulkSetLeadStatus,
} from "@/lib/actions";
import { leadStatuses, type LeadStatus } from "@/lib/data";
import {
  bulkEnqueueSelectedLeadsAction,
  bulkEnqueueUnscoredLeadsAction,
  bulkRepriceSelectedLeadsAction,
  getQualifyJobCountsAction,
} from "@/lib/qualify/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";

export function LeadsBulkQualifyBar({
  selectedIds,
  onClearSelection,
}: {
  selectedIds: string[];
  onClearSelection: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [depth, setDepth] = useState(0);
  const [statusValue, setStatusValue] = useState("");

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

  function runReprice() {
    if (!selectedIds.length) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await bulkRepriceSelectedLeadsAction(selectedIds);
        setMessage(
          `Repriced ${res.updated}` +
            (res.skipped ? ` · skipped ${res.skipped}` : "") +
            (res.failed ? ` · failed ${res.failed}` : "")
        );
        onClearSelection();
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Bulk reprice failed");
      }
    });
  }

  function applyStatus(status: LeadStatus) {
    if (!selectedIds.length) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await bulkSetLeadStatus(selectedIds, status);
        setMessage(
          `Updated ${res.updated} → ${status}` +
            (res.updated < selectedIds.length
              ? ` · ${selectedIds.length - res.updated} already set`
              : "")
        );
        setStatusValue("");
        onClearSelection();
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Status update failed");
      }
    });
  }

  function runDelete() {
    if (!selectedIds.length) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await bulkDeleteLeads(selectedIds);
        setMessage(`Deleted ${res.deleted} lead${res.deleted === 1 ? "" : "s"}`);
        onClearSelection();
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Delete failed");
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
            variant="outline"
            className="h-8"
            disabled={pending}
            onClick={runReprice}
            title="AI reprice deal value only (Settings pricing guidance)"
          >
            <Banknote className="size-3.5" />
            Reprice ({selectedIds.length})
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={pending}
            onClick={() => applyStatus("Not suitable")}
          >
            Not suitable
          </Button>

          <Select
            className="h-8 w-42"
            value={statusValue}
            disabled={pending}
            aria-label="Set status for selected leads"
            onChange={(e) => {
              const next = e.target.value as LeadStatus | "";
              setStatusValue(next);
              if (next) applyStatus(next);
            }}
          >
            <option value="">Set status…</option>
            {leadStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <ConfirmDelete
            title={`Delete ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"}?`}
            description="Permanently removes the selected leads and their notes, activities, and attachments. Prefer Not suitable for bad fits so Hunt won’t resurface them."
            confirmLabel="Delete"
            pendingLabel="Deleting…"
            pending={pending}
            onConfirm={runDelete}
            trigger={
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={pending}
              >
                Delete
              </Button>
            }
          />

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
              Enqueues every unscored lead with a company name or website (max
              200). Jobs run one at a time in the background.
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
