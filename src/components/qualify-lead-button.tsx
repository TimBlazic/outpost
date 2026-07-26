"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const inQueue =
    queue.activeId === leadId || queue.pendingIds.includes(leadId);

  useEffect(() => {
    const done = queue.lastCompleted;
    if (!done || done.id !== leadId) return;
    if (done.seq <= handledSeq.current) return;
    handledSeq.current = done.seq;
    // Prefer parent callback (drawer reload); otherwise soft refresh.
    if (onDone) onDone();
    else router.refresh();
  }, [queue.lastCompleted, leadId, onDone, router]);

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
      onClick={() => enqueueQualify(leadId)}
    >
      <Sparkles className="size-4" />
      {label}
    </Button>
  );
}
