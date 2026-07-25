"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Copy, ExternalLink } from "lucide-react";

import type { PortalComment, PortalUpdate, Project, Task } from "@/lib/data";
import { setTaskClientFlags } from "@/lib/portal/actions";
import { portalUrlForToken } from "@/lib/portal/url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export function ProjectPortalPanel({
  project,
  tasks,
  clientPortalStatus,
  clientPortalEmail,
}: {
  project: Project;
  tasks: Task[];
  updates?: PortalUpdate[];
  comments?: PortalComment[];
  compact?: boolean;
  clientPortalStatus?: "no-account" | "invited" | "active" | null;
  clientPortalEmail?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

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
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Client sign-in now uses magic-link accounts (no project PIN).
          </p>
          <p className="text-sm text-muted-foreground">
            Client account status:{" "}
            <span className="font-medium text-foreground">
              {clientPortalStatus === "active"
                ? "Active"
                : clientPortalStatus === "invited"
                  ? "Invited"
                  : clientPortalStatus === "no-account"
                    ? "No account"
                    : "Unknown"}
            </span>
            {clientPortalEmail ? ` · ${clientPortalEmail}` : ""}
          </p>
          {project.clientId ? (
            <p className="text-sm text-muted-foreground">
              Manage account status on the{" "}
              <Link
                href={`/clients/${project.clientId}`}
                className="font-medium text-foreground hover:underline"
              >
                client profile
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-amber-600">
              Link this project to a client to manage account access.
            </p>
          )}
          {project.portalEnabled && portalUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Legacy link support (temporary)
              </p>
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
            </div>
          ) : null}
        </div>
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
                    disabled={pending}
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
                    disabled={pending || !t.clientVisible}
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
