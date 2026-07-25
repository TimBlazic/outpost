"use client";

import { useTransition } from "react";
import { PhoneCall, Send, CalendarClock, CheckCheck } from "lucide-react";

import { quickTouch, snoozeFollowUp, setFollowUp } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function LeadQuickActions({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            quickTouch(leadId, {
              type: "call",
              title: "Call logged",
              followUpInDays: 3,
              status: "Contacted",
            })
          )
        }
      >
        <PhoneCall className="size-3.5" />
        Log call
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            quickTouch(leadId, {
              type: "email",
              title: "Email sent",
              followUpInDays: 3,
              status: "Contacted",
            })
          )
        }
      >
        <Send className="size-3.5" />
        Email sent
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => snoozeFollowUp(leadId, 3))
        }
      >
        <CalendarClock className="size-3.5" />
        Follow up in 3 days
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => setFollowUp(leadId, null))
        }
      >
        <CheckCheck className="size-3.5" />
        Clear follow-up
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-muted-foreground"
        onClick={() =>
          startTransition(() => setFollowUp(leadId, new Date().toISOString().slice(0, 10)))
        }
      >
        Due today
      </Button>
    </div>
  );
}
