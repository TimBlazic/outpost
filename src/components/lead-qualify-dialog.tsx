"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { LeadQualifyWizard } from "@/components/lead-qualify-wizard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LeadQualifyDialog({
  open: openProp,
  onOpenChange,
  initialUrl = "",
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialUrl?: string;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <>
      {openProp === undefined ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          Qualify URL
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "fixed inset-3 top-3 bottom-3 left-3 right-3 z-50 flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border bg-background p-0 shadow-2xl sm:inset-4 sm:top-4 sm:right-4 sm:bottom-4 sm:left-4",
            "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
          )}
        >
          <DialogTitle className="sr-only">Qualify URL</DialogTitle>
          <DialogDescription className="sr-only">
            Research a website and create a qualified lead
          </DialogDescription>
          <div className="flex min-h-0 flex-1 flex-col">
            <LeadQualifyWizard
              key={open ? initialUrl || "open" : "closed"}
              initialUrl={initialUrl}
              onClose={() => setOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Opens qualify dialog from ?qualify=1&url= on the leads page. */
export function LeadQualifyDialogFromSearch() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const wantOpen = searchParams.get("qualify") === "1";
  const url = searchParams.get("url") ?? "";
  const [open, setOpen] = useState(wantOpen);

  useEffect(() => {
    setOpen(wantOpen);
  }, [wantOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && wantOpen) {
      router.replace("/leads", { scroll: false });
    }
  }

  return (
    <LeadQualifyDialog
      open={open}
      onOpenChange={handleOpenChange}
      initialUrl={url}
    />
  );
}
