"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isLeadQualifyQueuedAction } from "@/lib/qualify/actions";
import { enqueueQualify } from "@/lib/qualify/queue";
import { useQualifyQueue } from "@/lib/qualify/use-qualify-queue";

export function QualifyLeadButton({
  leadId,
  website,
  company,
  onDone,
}: {
  leadId: string;
  website: string;
  company?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const queue = useQualifyQueue();
  const handledSeq = useRef(0);
  const refreshedForSeq = useRef(0);
  const wasQueuedRef = useRef(false);
  const canQualify =
    Boolean(website?.trim()) || Boolean(company?.trim());
  const [serverQueued, setServerQueued] = useState(false);
  const inQueue =
    serverQueued ||
    queue.pendingIds.includes(leadId);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const queued = await isLeadQualifyQueuedAction(leadId);
        if (alive) setServerQueued(queued);
      } catch {
        /* ignore */
      }
    };
    void tick();
    if (!inQueue && !canQualify) return;
    const id = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [leadId, inQueue, canQualify]);

  useEffect(() => {
    const done = queue.lastCompleted;
    if (!done || done.id !== leadId) return;
    if (done.seq <= handledSeq.current) return;
    handledSeq.current = done.seq;
    // Enqueue ack — wait for server job to finish via serverQueued poll.
  }, [queue.lastCompleted, leadId]);

  // Refresh once when this lead leaves the queue (not on every render).
  useEffect(() => {
    const queued = inQueue;
    const was = wasQueuedRef.current;
    wasQueuedRef.current = queued;
    if (!was || queued) return;
    if (handledSeq.current <= 0) return;
    if (refreshedForSeq.current >= handledSeq.current) return;
    refreshedForSeq.current = handledSeq.current;
    if (onDone) onDone();
    else router.refresh();
  }, [inQueue, onDone, router]);

  const label = !canQualify
    ? "Need company"
    : inQueue
      ? "Qualifying…"
      : "Qualify lead";

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!canQualify || inQueue}
      title={
        !canQualify
          ? "Add a company name (or website) — Qualify needs something to research"
          : inQueue
            ? "Qualify running…"
            : website?.trim()
              ? "Research site + Companywall and update this lead"
              : "Research company via Companywall (no website) and update this lead"
      }
      onClick={() => enqueueQualify(leadId, true)}
    >
      <Sparkles className="size-4" />
      {label}
    </Button>
  );
}
