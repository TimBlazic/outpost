"use client";

import { useEffect, useState } from "react";

import {
  getQualifyQueueState,
  subscribeQualifyQueue,
  type QualifyQueueState,
} from "./queue";

export function useQualifyQueue(): QualifyQueueState {
  const [state, setState] = useState<QualifyQueueState>(getQualifyQueueState);
  useEffect(() => subscribeQualifyQueue(setState), []);
  return state;
}
