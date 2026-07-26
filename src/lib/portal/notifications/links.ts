import { getClientPortalOrigin } from "@/lib/hosts";

import type {
  PortalNotificationPayload,
  PortalNotificationType,
} from "./types";

export function nextPathForNotification(
  type: PortalNotificationType,
  projectId: string,
  payload: PortalNotificationPayload
): string {
  if (type === "message") {
    return `/projects/${projectId}?tab=messages`;
  }
  if (type === "tickets_bulk") {
    return `/projects/${projectId}`;
  }
  const ticketId =
    "ticketId" in payload ? String(payload.ticketId ?? "") : "";
  return ticketId
    ? `/projects/${projectId}?ticket=${encodeURIComponent(ticketId)}`
    : `/projects/${projectId}`;
}

/** Direct project URL — middleware preserves next on auth redirect. */
export function buildPortalNotificationCtaUrl(input: {
  nextPath: string;
  requestOrigin?: string;
}): string {
  const origin = getClientPortalOrigin(input.requestOrigin);
  const path = input.nextPath.startsWith("/")
    ? input.nextPath
    : `/${input.nextPath}`;
  return `${origin}${path}`;
}
