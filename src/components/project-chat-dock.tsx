"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, MessageSquare, Minus } from "lucide-react";

import type {
  Attachment,
  Member,
  PortalMessage,
  PortalMessageReaction,
  Project,
} from "@/lib/data";
import { countUnreadMessages, UNREAD_POLL_MS } from "@/lib/portal/chat-sync-shared";
import {
  PortalChat,
  type ChatClientAuthor,
} from "@/components/portal-chat";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function storageKey(projectId: string) {
  return `outpost.projectChat.${projectId}`;
}

type DockState = "closed" | "open";

export function ProjectChatDock({
  project,
  messages,
  messageReactions = [],
  messageFiles = [],
  members,
  currentUserName,
  currentUserId,
  clientAuthor,
}: {
  project: Project;
  messages: PortalMessage[];
  messageReactions?: PortalMessageReaction[];
  messageFiles?: Attachment[];
  members: Member[];
  currentUserName?: string;
  currentUserId?: string | null;
  clientAuthor?: ChatClientAuthor | null;
}) {
  const title =
    clientAuthor?.name || project.client || project.name || "Messages";
  const subtitle = project.name;

  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<DockState>("closed");
  const [unread, setUnread] = useState(() =>
    countUnreadMessages(messages, "studio", project.portalStudioLastReadAt)
  );

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(storageKey(project.id));
      if (raw === "open") setState("open");
    } catch {
      /* ignore */
    }
  }, [project.id]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(storageKey(project.id), state);
    } catch {
      /* ignore */
    }
  }, [mounted, project.id, state]);

  // Live unread while the dock is collapsed (open chat marks read via sync).
  useEffect(() => {
    if (state === "open") return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as {
          byProject?: Record<string, number>;
        };
        const n = data.byProject?.[project.id] ?? 0;
        if (alive) setUnread(n);
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, UNREAD_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state, project.id]);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-5 sm:right-5">
      {state === "open" ? (
        <div
          className={cn(
            "pointer-events-auto flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl",
            "animate-in fade-in slide-in-from-bottom-3 duration-200"
          )}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-border/80 px-3 py-2.5">
            <UserAvatar
              name={title}
              avatarUrl={clientAuthor?.avatarUrl}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {subtitle}
                {project.portalEnabled ? "" : " · portal off"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              asChild
            >
              <Link
                href={`/messages/${project.id}`}
                title="Open in Messages"
                aria-label="Open in Messages"
              >
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setState("closed")}
              aria-label="Minimize chat"
            >
              <Minus className="size-3.5" />
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <PortalChat
              projectId={project.id}
              messages={messages}
              reactions={messageReactions}
              files={messageFiles}
              members={members}
              viewer="studio"
              compact
              hideChannelHeader
              currentAuthorName={currentUserName}
              currentAuthorId={currentUserId}
              clientAuthor={clientAuthor}
              channelTitle={title}
              className="min-h-0"
              onMarkedRead={() => setUnread(0)}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setState("open")}
          className={cn(
            "pointer-events-auto group flex items-center gap-2.5 rounded-full border border-border bg-background py-2 pl-2 pr-4 shadow-lg transition",
            "hover:border-foreground/20 hover:shadow-xl"
          )}
        >
          <span className="relative">
            <UserAvatar
              name={title}
              avatarUrl={clientAuthor?.avatarUrl}
              size="md"
              className="size-9"
            />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : (
              <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-background bg-muted text-muted-foreground">
                <MessageSquare className="size-2.5" />
              </span>
            )}
          </span>
          <span className="text-left">
            <span className="block max-w-40 truncate text-sm font-semibold leading-tight">
              {title}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {unread > 0
                ? `${unread} unread`
                : project.portalEnabled
                  ? "Message client"
                  : "Messages"}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
