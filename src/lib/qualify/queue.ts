"use client";

import {
  enqueueLeadQualifyAction,
  getQualifyJobCountsAction,
} from "./actions";

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
  /** Server pending + running */
  depth: number;
};

type Listener = (state: QualifyQueueState) => void;

const localPending = new Set<string>();
const listeners = new Set<Listener>();
let lastError: string | null = null;
let lastCompleted: QualifyQueueCompletion | null = null;
let completionSeq = 0;
let depth = 0;
let pollTimer: number | null = null;

function snapshot(): QualifyQueueState {
  return {
    activeId: null,
    pendingIds: [...localPending],
    lastError,
    lastCompleted,
    depth,
  };
}

function notify() {
  const state = snapshot();
  for (const l of listeners) l(state);
}

async function refreshDepth() {
  try {
    const counts = await getQualifyJobCountsAction();
    depth = (counts.pending ?? 0) + (counts.running ?? 0);
    if (depth === 0) localPending.clear();
    notify();
  } catch {
    /* ignore */
  }
}

function ensurePoll() {
  if (typeof window === "undefined") return;
  if (pollTimer != null) return;
  pollTimer = window.setInterval(() => {
    void refreshDepth();
    if (depth === 0 && localPending.size === 0 && pollTimer != null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }, 4000);
}

/** Enqueue lead on the server qualify job queue. */
export function enqueueQualify(leadId: string, force = false) {
  if (!leadId) return;
  localPending.add(leadId);
  lastError = null;
  notify();
  ensurePoll();
  void enqueueLeadQualifyAction(leadId, { force })
    .then((res) => {
      if (!res.enqueued && res.reason && res.reason !== "already_queued") {
        lastError = res.reason;
        localPending.delete(leadId);
      }
      completionSeq += 1;
      lastCompleted = { id: leadId, seq: completionSeq };
      void refreshDepth();
      notify();
    })
    .catch((e) => {
      lastError = e instanceof Error ? e.message : "Qualify enqueue failed";
      localPending.delete(leadId);
      notify();
    });
}

export function getQualifyQueueState(): QualifyQueueState {
  return snapshot();
}

export function subscribeQualifyQueue(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  void refreshDepth();
  ensurePoll();
  return () => {
    listeners.delete(listener);
  };
}
