"use client";

import { qualifyExistingLeadAction } from "./actions";

export type QualifyQueueCompletion = {
  id: string;
  /** Monotonic — consumers should handle each seq at most once. */
  seq: number;
};

export type QualifyQueueState = {
  activeId: string | null;
  pendingIds: string[];
  lastError: string | null;
  lastCompleted: QualifyQueueCompletion | null;
};

type Listener = (state: QualifyQueueState) => void;

const pending: string[] = [];
const listeners = new Set<Listener>();
let activeId: string | null = null;
let pumping = false;
let lastError: string | null = null;
let lastCompleted: QualifyQueueCompletion | null = null;
let completionSeq = 0;

function snapshot(): QualifyQueueState {
  return {
    activeId,
    pendingIds: [...pending],
    lastError,
    lastCompleted,
  };
}

function notify() {
  const state = snapshot();
  for (const l of listeners) l(state);
}

async function pump() {
  if (pumping) return;
  pumping = true;
  while (pending.length > 0) {
    activeId = pending.shift()!;
    lastError = null;
    notify();
    try {
      await qualifyExistingLeadAction(activeId);
      completionSeq += 1;
      lastCompleted = { id: activeId, seq: completionSeq };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Qualify failed";
      completionSeq += 1;
      lastCompleted = { id: activeId, seq: completionSeq };
    }
    activeId = null;
    notify();
  }
  pumping = false;
}

/** Enqueue lead for background qualify (deduped, sequential). */
export function enqueueQualify(leadId: string) {
  if (!leadId) return;
  if (activeId === leadId || pending.includes(leadId)) {
    notify();
    return;
  }
  pending.push(leadId);
  notify();
  void pump();
}

export function getQualifyQueueState(): QualifyQueueState {
  return snapshot();
}

export function subscribeQualifyQueue(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}
