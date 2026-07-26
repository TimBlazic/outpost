import { after } from "next/server";

import { flushPortalNotifications } from "./flush";

/** Run flush after the current request finishes (cron is the safety net). */
export function schedulePortalNotificationFlush(): void {
  try {
    after(async () => {
      try {
        await flushPortalNotifications();
      } catch (err) {
        console.error("[portal-notifications] after flush failed", err);
      }
    });
  } catch {
    void flushPortalNotifications().catch((err) => {
      console.error("[portal-notifications] flush failed", err);
    });
  }
}
