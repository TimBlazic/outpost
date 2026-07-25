"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";

import type {
  Attachment,
  Member,
  PortalMessage,
  PortalMessageReaction,
  Project,
} from "@/lib/data";
import { UNREAD_POLL_MS } from "@/lib/portal/chat-sync-shared";
import {
  PortalChat,
  type ChatClientAuthor,
} from "@/components/portal-chat";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MessageThreadPreview = {
  project: Project;
  lastMessage: PortalMessage | null;
  unreadCount?: number;
};

function fmtSidebarTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function previewBody(m: PortalMessage) {
  if (m.deletedAt) return "Message unsent";
  return m.body;
}

export function MessagesWorkspace({
  threads,
  activeProjectId,
  activeMessages = [],
  activeReactions = [],
  activeFiles = [],
  activeProject,
  members = [],
  currentAuthorName,
  currentAuthorId,
  clientAuthors = {},
}: {
  threads: MessageThreadPreview[];
  activeProjectId?: string | null;
  activeMessages?: PortalMessage[];
  activeReactions?: PortalMessageReaction[];
  activeFiles?: Attachment[];
  activeProject?: Project | null;
  members?: Member[];
  currentAuthorName?: string;
  currentAuthorId?: string | null;
  /** projectId → client person for chat display */
  clientAuthors?: Record<string, ChatClientAuthor>;
}) {
  const [q, setQ] = useState("");
  const [liveThreads, setLiveThreads] = useState(threads);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      threads.map((t) => [t.project.id, t.unreadCount ?? 0])
    )
  );

  useEffect(() => {
    setLiveThreads(threads);
    setUnreadMap(
      Object.fromEntries(
        threads.map((t) => [t.project.id, t.unreadCount ?? 0])
      )
    );
  }, [threads]);

  // Live unread + last-message previews while Messages is open.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as {
          byProject?: Record<string, number>;
          lastByProject?: Record<string, PortalMessage | null>;
        };
        if (!alive) return;
        if (data.byProject) {
          setUnreadMap((prev) => {
            const next = { ...data.byProject };
            // Active thread is being marked read by chat sync — keep 0 locally.
            if (activeProjectId) next[activeProjectId] = 0;
            // Preserve keys we already knew about
            for (const id of Object.keys(prev)) {
              if (!(id in next)) next[id] = prev[id];
            }
            return next;
          });
        }
        if (data.lastByProject) {
          setLiveThreads((prev) =>
            prev.map((t) => ({
              ...t,
              lastMessage:
                data.lastByProject?.[t.project.id] ?? t.lastMessage,
              unreadCount:
                activeProjectId === t.project.id
                  ? 0
                  : (data.byProject?.[t.project.id] ?? t.unreadCount ?? 0),
            }))
          );
        }
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
  }, [activeProjectId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return liveThreads;
    return liveThreads.filter(
      (t) =>
        t.project.name.toLowerCase().includes(query) ||
        t.project.client.toLowerCase().includes(query)
    );
  }, [liveThreads, q]);

  const active =
    activeProject ??
    liveThreads.find((t) => t.project.id === activeProjectId)?.project ??
    null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside className="flex w-[17rem] shrink-0 flex-col border-r border-border/70 bg-muted/30 sm:w-[19rem]">
        <div className="flex h-12 shrink-0 items-center border-b border-border/70 px-3">
          <p className="truncate text-sm font-bold tracking-tight">Messages</p>
        </div>
        <div className="shrink-0 px-2.5 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a client"
              className="h-8 border-border/60 bg-background/80 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
          <p className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Clients
          </p>
          {filtered.length === 0 ? (
            <p className="px-2.5 py-4 text-xs text-muted-foreground">
              No clients yet. Enable a project portal to start.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map(({ project, lastMessage }) => {
                const selected = project.id === activeProjectId;
                const author = clientAuthors[project.id];
                const clientLabel =
                  author?.name || project.client || project.name;
                const unread = selected ? 0 : (unreadMap[project.id] ?? 0);
                const previewAuthor =
                  lastMessage?.authorKind === "client"
                    ? author?.name || lastMessage.authorName
                    : lastMessage?.authorName;
                return (
                  <li key={project.id}>
                    <Link
                      href={`/messages/${project.id}`}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <UserAvatar
                        name={clientLabel}
                        avatarUrl={author?.avatarUrl}
                        size="sm"
                        className="size-8 shrink-0 rounded-lg"
                        fallbackClassName={
                          selected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-sky-600/90 text-white"
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-[13px]",
                              unread > 0 ? "font-bold" : "font-semibold"
                            )}
                          >
                            {clientLabel}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {unread > 0 ? (
                              <span
                                className={cn(
                                  "min-w-4 rounded-full px-1 text-center text-[10px] font-semibold tabular-nums",
                                  selected
                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                    : "bg-primary text-primary-foreground"
                                )}
                              >
                                {unread > 99 ? "99+" : unread}
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "text-[10px] tabular-nums",
                                selected
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {fmtSidebarTime(lastMessage?.createdAt ?? null)}
                            </span>
                          </div>
                        </div>
                        <p
                          className={cn(
                            "truncate text-[11px]",
                            selected
                              ? "text-primary-foreground/70"
                              : unread > 0
                                ? "font-medium text-foreground/80"
                                : "text-muted-foreground"
                          )}
                        >
                          {lastMessage
                            ? `${previewAuthor}: ${previewBody(lastMessage)}`
                            : project.name || "No messages yet"}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-background">
        {active ? (
          <PortalChat
            projectId={active.id}
            messages={activeMessages}
            reactions={activeReactions}
            files={activeFiles}
            members={members}
            viewer="studio"
            currentAuthorName={currentAuthorName}
            currentAuthorId={currentAuthorId}
            clientAuthor={clientAuthors[active.id] ?? null}
            channelTitle={
              clientAuthors[active.id]?.name || active.client || active.name
            }
            channelSubtitle={`${active.name}${active.portalEnabled ? "" : " · portal off"}`}
            onMarkedRead={() =>
              setUnreadMap((prev) => ({ ...prev, [active.id]: 0 }))
            }
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <MessageSquare className="size-6" />
            </div>
            <div>
              <p className="text-base font-semibold">Pick a client</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Project chats live here — same thread your client sees in the
                portal. Select a client on the left to start.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
