"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Upload } from "lucide-react";

import type {
  Attachment,
  Invoice,
  Member,
  PortalMessage,
  PortalMessageReaction,
  Project,
  Ticket,
  TicketComment,
  TicketCommentReaction,
} from "@/lib/data";
import {
  clientUploadPortalFile,
  sessionClientUploadPortalFile,
} from "@/lib/portal/actions";
import {
  normalizePortalLocale,
  portalT,
  type PortalLocale,
} from "@/lib/portal/i18n";
import {
  countUnreadMessages,
  UNREAD_POLL_MS,
} from "@/lib/portal/chat-sync-shared";
import type { PortalTheme } from "@/lib/portal/theme";
import { usePortalPresenceTrack } from "@/lib/realtime/portal-presence";
import { PortalChat } from "@/components/portal-chat";
import { PortalThemeToggle } from "@/components/portal-theme-toggle";
import { PortalTickets } from "@/components/portal-tickets";
import { PortalUnpaidInvoices } from "@/components/portal-unpaid-invoices";
import { PortalWelcome } from "@/components/portal-welcome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "overview" | "messages";

export function PortalClientView({
  token,
  project,
  tickets,
  files,
  messages = [],
  messageReactions = [],
  messageFiles = [],
  ticketComments = {},
  ticketReactions = {},
  ticketCommentFiles = {},
  members = [],
  theme,
  viewer = "token",
  locale: localeProp,
  clientAuthor,
  unpaidInvoices = [],
}: {
  token?: string;
  project: Project;
  tickets: Ticket[];
  files: Attachment[];
  messages?: PortalMessage[];
  messageReactions?: PortalMessageReaction[];
  messageFiles?: Attachment[];
  ticketComments?: Record<string, TicketComment[]>;
  ticketReactions?: Record<string, TicketCommentReaction[]>;
  ticketCommentFiles?: Record<string, Attachment[]>;
  members?: Member[];
  theme: PortalTheme;
  viewer?: "token" | "session";
  /** Prefer client-account locale; falls back to project.portalLocale. */
  locale?: PortalLocale;
  clientAuthor?: {
    name: string;
    avatarUrl?: string | null;
    id?: string | null;
  } | null;
  unpaidInvoices?: Pick<
    Invoice,
    "id" | "invoiceNumber" | "total" | "currency" | "issueDate"
  >[];
}) {
  const locale = normalizePortalLocale(localeProp ?? project.portalLocale);
  const t = portalT(locale);
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [messagesUnread, setMessagesUnread] = useState(() =>
    countUnreadMessages(
      messages,
      "client",
      project.portalClientLastReadAt
    )
  );

  const openTickets = useMemo(
    () => tickets.filter((tk) => tk.status !== "Done"),
    [tickets]
  );

  // Presence: track client online via Supabase Realtime presence channel.
  const { tracking: presenceTracking } = usePortalPresenceTrack(project.id);

  useEffect(() => {
    if (tab === "messages") return;
    if (!token && viewer !== "session") return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const param =
          viewer === "session"
            ? `projectId=${encodeURIComponent(project.id)}`
            : `token=${encodeURIComponent(token!)}`;
        const res = await fetch(`/api/portal/chat/unread?${param}`, {
          cache: "no-store",
        });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { total?: number };
        if (alive) setMessagesUnread(data.total ?? 0);
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
  }, [tab, token, viewer, project.id]);

  // Fallback presence: keep updating portal_client_last_seen_at for chat-sync
  // endpoint compatibility. Only runs interval when Realtime tracking is inactive;
  // fires one heartbeat on mount regardless.
  useEffect(() => {
    if (!token && viewer !== "session") return;
    let alive = true;
    const beat = async () => {
      if (!alive || document.visibilityState !== "visible") return;
      try {
        const payload =
          viewer === "session"
            ? { projectId: project.id }
            : { token };
        await fetch("/api/portal/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
      } catch {
        /* ignore */
      }
    };
    void beat();
    if (presenceTracking) return;
    const id = window.setInterval(beat, 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [token, viewer, project.id, presenceTracking]);

  function uploadFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("parentType", "project");
        fd.set("parentId", project.id);
        fd.set("file", file);
        fd.set("label", file.name);
        if (viewer === "session") {
          fd.set("projectId", project.id);
          await sessionClientUploadPortalFile(fd);
        } else {
          if (token) fd.set("token", token);
          await clientUploadPortalFile(fd);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.uploadFailed);
      }
    });
  }

  const nav: { id: Tab; label: string }[] = [
    { id: "overview", label: t.overview },
    { id: "messages", label: t.messages },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col px-5 pt-5 pb-4 sm:px-8 sm:pt-6 lg:px-12">
      <header className="portal-reveal mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-start justify-between gap-4 border-b border-[var(--portal-line)] pb-4">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--portal-muted)]">
            {project.client}
          </p>
          <h1 className="portal-display mt-1.5 max-w-2xl truncate text-2xl leading-tight sm:text-3xl">
            {project.name}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <PortalThemeToggle initialTheme={theme} />
          </div>
        </div>
      </header>

      <nav className="portal-reveal-2 mx-auto mt-4 flex w-full max-w-6xl shrink-0 gap-5 text-sm">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "shrink-0 pb-2 transition-colors",
              tab === item.id
                ? "border-b border-[var(--portal-accent)] text-[var(--portal-fg)]"
                : "text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
            )}
          >
            <span>{item.label}</span>
            {item.id === "overview" && openTickets.length > 0 ? (
              <span className="text-[var(--portal-muted)]">
                {" "}
                · {openTickets.length}
              </span>
            ) : null}
            {item.id === "messages" && messagesUnread > 0 && tab !== "messages" ? (
              <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--portal-accent)] px-1.5 text-[10px] font-semibold text-[var(--portal-bg)] tabular-nums">
                {messagesUnread > 99 ? "99+" : messagesUnread}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <main
        className={cn(
          "portal-reveal-3 mx-auto mt-4 flex w-full max-w-6xl min-h-0 flex-1 flex-col",
          tab === "messages" ? "overflow-hidden" : "overflow-y-auto"
        )}
      >
        {error && <p className="mb-4 shrink-0 text-sm text-rose-400">{error}</p>}

        {tab === "overview" && (
          <div className="space-y-10 pb-8">
            <PortalUnpaidInvoices
              invoices={unpaidInvoices}
              locale={locale}
            />
            <PortalWelcome
              token={token || project.id}
              intro={project.portalIntro}
              locale={locale}
              onGoMessages={() => setTab("messages")}
            />

            {/* Status + project snapshot */}
            <section className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--portal-line)] bg-[var(--portal-surface)] px-4 py-3">
                <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--portal-muted)]">
                  {t.phase}
                </p>
                <p className="mt-1.5 text-sm font-medium text-[var(--portal-fg)]">
                  {project.phase || "—"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--portal-line)] bg-[var(--portal-surface)] px-4 py-3">
                <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--portal-muted)]">
                  {t.status}
                </p>
                <p className="mt-1.5 text-sm font-medium text-[var(--portal-fg)]">
                  {project.status || "—"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--portal-line)] bg-[var(--portal-surface)] px-4 py-3">
                <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--portal-muted)]">
                  {t.openTickets}
                </p>
                <p className="mt-1.5 text-sm font-medium text-[var(--portal-fg)]">
                  {project.clientCanViewTickets
                    ? openTickets.length === 0
                      ? t.nothingWaiting
                      : `${openTickets.length}`
                    : "—"}
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="portal-display text-2xl italic">
                  {t.whereWeAre}
                </h2>
                {project.stagingUrl ? (
                  <a
                    href={project.stagingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--portal-fg)] underline decoration-[var(--portal-line)] underline-offset-4 hover:decoration-[var(--portal-accent)]"
                  >
                    {t.openStaging}
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-[var(--portal-muted)]">
                {project.description ||
                  project.portalIntro ||
                  t.noDescription}
              </p>
            </section>

            {project.clientCanViewTickets ? (
              <section id="portal-tickets" className="scroll-mt-4">
                <PortalTickets
                  token={token || project.id}
                  project={project}
                  tickets={tickets}
                  ticketComments={ticketComments}
                  ticketReactions={ticketReactions}
                  ticketCommentFiles={ticketCommentFiles}
                  members={members}
                  locale={locale}
                  viewer={viewer === "session" ? "session" : "token"}
                />
              </section>
            ) : null}

            <section id="portal-files" className="scroll-mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="portal-display text-2xl italic">{t.files}</h2>
                {project.clientCanUploadFiles && (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[var(--portal-accent)] px-3 py-2 text-sm text-[var(--portal-bg)] transition-opacity hover:opacity-90">
                    <Upload className="size-3.5" />
                    {t.upload}
                    <input
                      type="file"
                      className="hidden"
                      disabled={pending}
                      onChange={(e) => {
                        uploadFile(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <ul className="divide-y divide-[var(--portal-line)] border-y border-[var(--portal-line)]">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">{f.label}</div>
                      <div className="mt-0.5 text-xs text-[var(--portal-muted)]">
                        {f.kind}
                        {f.size != null
                          ? ` · ${Math.round(f.size / 1024)} KB`
                          : ""}
                      </div>
                    </div>
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 text-sm text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
                      >
                        {t.open}
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-[var(--portal-muted)]">
                        {t.unavailable}
                      </span>
                    )}
                  </li>
                ))}
                {files.length === 0 && (
                  <li className="py-8 text-sm text-[var(--portal-muted)]">
                    {t.noFiles}
                  </li>
                )}
              </ul>
            </section>
          </div>
        )}

        {tab === "messages" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--portal-line)]">
            <PortalChat
              projectId={project.id}
              messages={messages}
              reactions={messageReactions}
              files={messageFiles}
              members={members}
              viewer={viewer === "session" ? "session" : "portal"}
              portalToken={token}
              locale={locale}
              currentAuthorName={clientAuthor?.name || project.client || "Client"}
              currentAuthorId={clientAuthor?.id ?? null}
              clientAuthor={clientAuthor}
              channelTitle={clientAuthor?.name || project.client || project.name}
              channelSubtitle={t.messages}
              onMarkedRead={() => setMessagesUnread(0)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
