"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

import {
  archiveClient,
  archiveProject,
  restoreClient,
  restoreProject,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function ArchiveToggle({
  kind,
  id,
  archived,
}: {
  kind: "client" | "project";
  id: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (kind === "client") {
        if (archived) await restoreClient(id);
        else await archiveClient(id);
      } else {
        if (archived) await restoreProject(id);
        else await archiveProject(id);
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={toggle}
    >
      {archived ? (
        <>
          <ArchiveRestore className="size-3.5" />
          Restore
        </>
      ) : (
        <>
          <Archive className="size-3.5" />
          Archive
        </>
      )}
    </Button>
  );
}
