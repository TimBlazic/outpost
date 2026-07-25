"use client";

import { useTransition } from "react";

import { snoozeFollowUp, setFollowUp } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function FollowUpRowActions({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startTransition(() => snoozeFollowUp(leadId, 3));
        }}
      >
        +3d
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startTransition(() => setFollowUp(leadId, null));
        }}
      >
        Clear
      </Button>
    </div>
  );
}
