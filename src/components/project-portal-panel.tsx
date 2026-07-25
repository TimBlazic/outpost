"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, ExternalLink } from "lucide-react";

import type { PortalComment, PortalUpdate, Project, Task } from "@/lib/data";
import {
  disableProjectPortal,
  enableProjectPortal,
  rotatePortalToken,
  setPortalPin,
  setTaskClientFlags,
} from "@/lib/portal/actions";
import { portalUrlForToken } from "@/lib/portal/url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function ProjectPortalPanel({
  project,
  tasks,
}: {
  project: Project;
  tasks: Task[];
  updates?: PortalUpdate[];
  comments?: PortalComment[];
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [pin, setPin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portalUrl = useMemo(
    () => portalUrlForToken(project.portalToken),
    [project.portalToken]
  );

  function copyLink() {
    if (!portalUrl) return;
    void navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">Client access</h3>
          <span className="text-xs text-muted-foreground">
            {project.portalEnabled ? "On" : "Off"}
          </span>
        </div>

        {!project.portalEnabled ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share a link and PIN so the client can see progress and approve
              work.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="mb-1.5 text-xs">PIN</Label>
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Min. 4 chars"
                  className="h-9 w-40"
                />
              </div>
              <Button
                size="sm"
                disabled={pending || pin.trim().length < 4}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await enableProjectPortal(project.id, pin);
                      setPin("");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Failed");
                    }
                  });
                }}
              >
                Enable
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={portalUrl}
                className="h-9 min-w-0 flex-1 font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="size-3.5" />
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={portalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="mb-1.5 text-xs">Reset PIN</Label>
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="h-9 w-36"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || pin.trim().length < 4}
                onClick={() =>
                  startTransition(async () => {
                    await setPortalPin(project.id, pin);
                    setPin("");
                  })
                }
              >
                Save PIN
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await rotatePortalToken(project.id);
                  })
                }
              >
                Rotate link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(() => disableProjectPortal(project.id))
                }
              >
                Disable
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Client-visible tasks</h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <ul className="divide-y">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5"
              >
                <span className="min-w-0 flex-1 text-sm">{t.title}</span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={t.clientVisible}
                    onCheckedChange={(v) =>
                      startTransition(() =>
                        setTaskClientFlags(t.id, {
                          clientVisible: Boolean(v),
                        })
                      )
                    }
                  />
                  Visible
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={t.waitingOnClient}
                    disabled={!t.clientVisible}
                    onCheckedChange={(v) =>
                      startTransition(() =>
                        setTaskClientFlags(t.id, {
                          waitingOnClient: Boolean(v),
                          clientVisible: true,
                        })
                      )
                    }
                  />
                  Waiting
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
