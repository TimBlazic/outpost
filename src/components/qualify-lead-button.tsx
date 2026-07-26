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
  onDone,
}: {
  leadId: string;
  website: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const queue = useQualifyQueue();
  const handledSeq = useRef(0);
  const hasSite = Boolean(website?.trim());
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
    if (!inQueue && !hasSite) return;
    const id = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [leadId, inQueue, hasSite]);

  useEffect(() => {
    const done = queue.lastCompleted;
    if (!done || done.id !== leadId) return;
    if (done.seq <= handledSeq.current) return;
    handledSeq.current = done.seq;
    // Enqueue ack — wait for server job to finish via serverQueued poll.
  }, [queue.lastCompleted, leadId]);

  useEffect(() => {
    if (!serverQueued && handledSeq.current > 0) {
      if (onDone) onDone();
      else router.refresh();
    }
  }, [serverQueued, onDone, router]);

  const label = !hasSite
    ? "No website"
    : inQueue
      ? "Qualifying…"
      : "Qualify lead";

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!hasSite || inQueue}
      title={
        !hasSite
          ? "Add a website on the lead (Edit) — Qualify needs a URL"
          : inQueue
            ? "Qualify running…"
            : "Research site + Companywall and update this lead"
      }
      onClick={() => enqueueQualify(leadId, true)}
    >
      <Sparkles className="size-4" />
      {label}
    </Button>
  );
}
