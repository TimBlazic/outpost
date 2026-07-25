"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, LogOut, Upload } from "lucide-react";

import type {
  Attachment,
  Member,
  Project,
  Ticket,
  TicketComment,
  TicketCommentReaction,
} from "@/lib/data";
import {
  clientUploadPortalFile,
  lockPortal,
  unlockPortal,
} from "@/lib/portal/actions";
import {
  normalizePortalLocale,
  portalStatusLabel,
  portalT,
  type PortalLocale,
} from "@/lib/portal/i18n";
import type { PortalTheme } from "@/lib/portal/theme";
import { PortalThemeToggle } from "@/components/portal-theme-toggle";
import { PortalTickets } from "@/components/portal-tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PortalPinGate({
  token,
  theme,
  locale = "en",
}: {
  token: string;
  theme: PortalTheme;
  locale?: PortalLocale;
}) {
  const t = portalT(locale);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await unlockPortal(token, pin);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.failed);
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="portal-reveal w-full max-w-md space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.18em] uppercase text-[var(--portal-muted)]">
              {t.projectPortal}
            </p>
            <h1 className="portal-display mt-3 text-4xl italic leading-tight">
              {t.enterPin}
            </h1>
            <p className="mt-3 text-[var(--portal-muted)]">{t.pinHint}</p>
          </div>
          <PortalThemeToggle initialTheme={theme} />
        </div>
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="h-12 border-[var(--portal-line)] bg-[var(--portal-surface)] text-[var(--portal-fg)] placeholder:text-[var(--portal-muted)]"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button
          className="h-11 w-full bg-[var(--portal-accent)] text-[var(--portal-bg)] hover:bg-white"
          disabled={pending || pin.trim().length < 4}
          onClick={submit}
        >
          {t.continue}
        </Button>
      </div>
    </div>
  );
}

type Tab = "overview" | "tickets" | "files";

export function PortalClientView({
  token,
  project,
  tickets,
  files,
  ticketComments = {},
  ticketReactions = {},
  ticketCommentFiles = {},
  members = [],
  theme,
}: {
  token: string;
  project: Project;
  tickets: Ticket[];
  files: Attachment[];
  ticketComments?: Record<string, TicketComment[]>;
  ticketReactions?: Record<string, TicketCommentReaction[]>;
  ticketCommentFiles?: Record<string, Attachment[]>;
  members?: Member[];
  theme: PortalTheme;
}) {
  const locale = normalizePortalLocale(project.portalLocale);
  const t = portalT(locale);
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  const openTickets = useMemo(
    () => tickets.filter((tk) => tk.status !== "Done"),
    [tickets]
  );

  function uploadFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("token", token);
        fd.set("parentType", "project");
        fd.set("parentId", project.id);
        fd.set("file", file);
        fd.set("label", file.name);
        await clientUploadPortalFile(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.uploadFailed);
      }
    });
  }

  const nav: { id: Tab; label: string }[] = [
    { id: "overview", label: t.overview },
    { id: "tickets", label: t.tickets },
    { id: "files", label: t.files },
  ];

  return (
    <div className="min-h-screen px-6 py-10 sm:px-10 lg:px-16">
      <header className="portal-reveal mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 border-b border-[var(--portal-line)] pb-10">
        <div>
          <p className="text-xs tracking-[0.22em] uppercase text-[var(--portal-muted)]">
            {project.client}
          </p>
          <h1 className="portal-display mt-3 max-w-2xl text-4xl leading-[1.1] sm:text-5xl">
            {project.name}
          </h1>
          <p className="mt-4 max-w-xl text-[var(--portal-muted)]">
            {project.portalIntro || project.description || t.quietPlace}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <PortalThemeToggle initialTheme={theme} />
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--portal-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
              onClick={() => startTransition(() => lockPortal(token))}
            >
              <LogOut className="size-3.5" />
              {t.lock}
            </Button>
          </div>
          <div className="text-right text-sm text-[var(--portal-muted)]">
            <div>
              {t.phase} ·{" "}
              <span className="text-[var(--portal-fg)]">{project.phase}</span>
            </div>
            <div className="mt-1">
              {t.status} ·{" "}
              <span className="text-[var(--portal-fg)]">{project.status}</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="portal-reveal-2 mx-auto mt-8 flex max-w-6xl gap-6 text-sm">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              if (item.id !== "tickets") setOpenTicketId(null);
            }}
            className={cn(
              "pb-2 transition-colors",
              tab === item.id
                ? "border-b border-[var(--portal-accent)] text-[var(--portal-fg)]"
                : "text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
            )}
          >
            {item.label}
            {item.id === "tickets" ? ` (${openTickets.length})` : ""}
          </button>
        ))}
      </nav>

      <main className="portal-reveal-3 mx-auto mt-10 max-w-6xl">
        {error && <p className="mb-6 text-sm text-rose-400">{error}</p>}

        {tab === "overview" && (
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-4">
              <h2 className="portal-display text-2xl italic">{t.whereWeAre}</h2>
              <p className="max-w-prose leading-relaxed text-[var(--portal-muted)]">
                {project.description || t.noDescription}
              </p>
              {project.stagingUrl && (
                <a
                  href={project.stagingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[var(--portal-fg)] underline decoration-[var(--portal-line)] underline-offset-4 hover:decoration-[var(--portal-accent)]"
                >
                  {t.openStaging}
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </section>
            <section className="space-y-4 border-t border-[var(--portal-line)] pt-6 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
              <h3 className="text-xs tracking-[0.18em] uppercase text-[var(--portal-muted)]">
                {t.openTickets}
              </h3>
              {openTickets.length === 0 ? (
                <p className="text-sm text-[var(--portal-muted)]">
                  {t.nothingWaiting}
                </p>
              ) : (
                <ul className="space-y-3">
                  {openTickets.slice(0, 5).map((tk) => (
                    <li key={tk.id}>
                      <button
                        type="button"
                        className="text-left hover:text-[var(--portal-accent)]"
                        onClick={() => {
                          setOpenTicketId(tk.id);
                          setTab("tickets");
                        }}
                      >
                        <div className="text-sm">{tk.title}</div>
                        <div className="mt-0.5 text-xs text-[var(--portal-muted)]">
                          {portalStatusLabel(locale, tk.status)}
                          {tk.dueAt ? ` · ${t.due} ${fmtDate(tk.dueAt)}` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === "tickets" && (
          <PortalTickets
            token={token}
            project={project}
            tickets={tickets}
            ticketComments={ticketComments}
            ticketReactions={ticketReactions}
            ticketCommentFiles={ticketCommentFiles}
            members={members}
            locale={locale}
            initialSelectedId={openTicketId}
          />
        )}

        {tab === "files" && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="portal-display text-2xl italic">{t.files}</h2>
              {project.clientCanUploadFiles && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[var(--portal-accent)] px-3 py-2 text-sm text-[var(--portal-bg)] hover:bg-white">
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
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <div className="text-sm">{f.label}</div>
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
                      className="inline-flex items-center gap-1.5 text-sm text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
                    >
                      {t.open}
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--portal-muted)]">
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
          </div>
        )}
      </main>
    </div>
  );
}
