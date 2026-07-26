"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { Paperclip, Send, X } from "lucide-react";

import {
  memberById,
  type Attachment,
  type Member,
  type PortalMessage,
  type PortalMessageReaction,
} from "@/lib/data";
import { uploadAttachment } from "@/lib/actions";
import {
  clientUploadPortalFile,
  sessionClientUploadPortalFile,
} from "@/lib/portal/actions";
import {
  editClientPortalMessage,
  editStudioPortalMessage,
  postClientPortalMessage,
  postStudioPortalMessage,
  sessionEditClientPortalMessage,
  sessionPostClientPortalMessage,
  sessionToggleClientPortalMessageReaction,
  sessionUnsendClientPortalMessage,
  toggleClientPortalMessageReaction,
  toggleStudioPortalMessageReaction,
  unsendClientPortalMessage,
  unsendStudioPortalMessage,
} from "@/lib/portal/message-actions";
import {
  chatRevision,
  type ChatSyncPayload,
} from "@/lib/portal/chat-sync-shared";
import {
  normalizePortalLocale,
  portalT,
  type PortalLocale,
} from "@/lib/portal/i18n";
import {
  mentionHandle,
  mentionQueryAt,
  replaceMentionQuery,
  splitMentions,
} from "@/lib/mentions";
import { ImageThumb } from "@/components/image-lightbox";
import { Button } from "@/components/ui/button";
import { ReactionPicker } from "@/components/reaction-picker";
import { UserAvatar } from "@/components/user-avatar";
import { usePortalChatRealtime } from "@/lib/realtime/portal-chat";
import { usePortalPresenceSubscribe } from "@/lib/realtime/portal-presence";
import { cn } from "@/lib/utils";

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isImageAttachment(f: Attachment) {
  if (f.mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg|avif|heic)$/i.test(f.label || "");
}

function renderBody(body: string) {
  return splitMentions(body).map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={i}
          className="rounded bg-primary/10 px-1 font-medium text-primary"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function groupReactions(reactions: PortalMessageReaction[]) {
  const map = new Map<string, PortalMessageReaction[]>();
  for (const r of reactions) {
    const list = map.get(r.emoji) ?? [];
    list.push(r);
    map.set(r.emoji, list);
  }
  return [...map.entries()];
}

export type ChatClientAuthor = {
  name: string;
  avatarUrl?: string | null;
  id?: string | null;
};

function MessageAvatar({
  name,
  kind,
  authorId,
  members,
  clientAuthor,
  size = "md",
  portal,
}: {
  name: string;
  kind: "studio" | "client";
  authorId?: string | null;
  members: Member[];
  clientAuthor?: ChatClientAuthor | null;
  size?: "sm" | "md";
  portal?: boolean;
}) {
  if (kind === "studio") {
    const member = authorId
      ? memberById(authorId, members)
      : members.find((m) => m.name === name);
    if (member && member.name !== "Unknown") {
      return (
        <UserAvatar
          member={member}
          size={size}
          className={size === "md" ? "size-9 rounded-lg" : "rounded-lg"}
          fallbackClassName={
            portal
              ? "bg-[var(--portal-fg)] text-[var(--portal-bg)]"
              : "bg-foreground text-background"
          }
        />
      );
    }
    return (
      <UserAvatar
        name={name}
        size={size}
        className={size === "md" ? "size-9 rounded-lg" : "rounded-lg"}
        fallbackClassName={
          portal
            ? "bg-[var(--portal-fg)] text-[var(--portal-bg)]"
            : "bg-foreground text-background"
        }
      />
    );
  }

  const member =
    (authorId ? memberById(authorId, members) : null) ||
    (clientAuthor?.id ? memberById(clientAuthor.id, members) : null);
  const resolved =
    member && member.name !== "Unknown"
      ? member
      : null;

  return (
    <UserAvatar
      member={resolved}
      name={resolved?.name ?? clientAuthor?.name ?? name}
      avatarUrl={resolved?.avatarUrl ?? clientAuthor?.avatarUrl ?? null}
      size={size}
      className={size === "md" ? "size-9 rounded-lg" : "rounded-lg"}
      fallbackClassName={
        portal
          ? "bg-[var(--portal-surface)] text-[var(--portal-fg)] ring-1 ring-[var(--portal-line)]"
          : "bg-sky-600/90 text-white"
      }
    />
  );
}

type MentionOption = { label: string; insert: string };

function MentionComposer({
  value,
  onChange,
  mentions,
  placeholder,
  portal,
  autoFocus,
  rows = 2,
  onSubmit,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  mentions: MentionOption[];
  placeholder: string;
  portal?: boolean;
  autoFocus?: boolean;
  rows?: number;
  onSubmit?: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? localRef;
  const [query, setQuery] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }, [autoFocus, ref]);

  const filtered = useMemo(() => {
    if (query == null) return [];
    const q = query.toLowerCase();
    return mentions
      .filter((m) => m.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentions, query]);

  function scanMention(text: string, caret: number) {
    setQuery(mentionQueryAt(text, caret));
  }

  function insertMention(opt: MentionOption) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const { next, caret: pos } = replaceMentionQuery(value, caret, opt.insert);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (query != null && filtered.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filtered[cursor] ?? filtered[0]);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  useEffect(() => {
    setCursor(0);
  }, [query]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          scanMention(e.target.value, e.target.selectionStart ?? 0);
        }}
        onClick={(e) =>
          scanMention(value, (e.target as HTMLTextAreaElement).selectionStart)
        }
        onKeyUp={(e) =>
          scanMention(value, (e.target as HTMLTextAreaElement).selectionStart)
        }
        onKeyDown={onKeyDown}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
        }}
        className={cn(
          "max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3.5 pt-3 text-[15px] outline-none placeholder:opacity-50",
          portal
            ? "text-[var(--portal-fg)] placeholder:text-[var(--portal-muted)]"
            : "text-foreground placeholder:text-muted-foreground"
        )}
      />
      {filtered.length > 0 && (
        <div
          className={cn(
            "absolute right-0 left-0 top-full z-20 mt-1 overflow-hidden rounded-lg border shadow-lg",
            portal
              ? "border-[var(--portal-line)] bg-[var(--portal-bg)]"
              : "border-border bg-popover"
          )}
        >
          {filtered.map((opt, i) => (
            <button
              key={opt.insert}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(opt);
              }}
              className={cn(
                "flex w-full px-3 py-2 text-left text-sm",
                i === cursor
                  ? portal
                    ? "bg-[var(--portal-surface)]"
                    : "bg-muted"
                  : "hover:bg-muted/60"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg|avif|heic)$/i.test(file.name);
}

function AttachmentList({
  files,
  portal,
}: {
  files: Attachment[];
  portal?: boolean;
}) {
  if (!files.length) return null;
  const images = files.filter(isImageAttachment);
  const others = files.filter((f) => !isImageAttachment(f));

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((f) =>
            f.url ? (
              <ImageThumb
                key={f.id}
                src={f.url}
                alt={f.label}
                name={f.label}
                portal={portal}
                className={cn(
                  "ring-1",
                  portal ? "ring-[var(--portal-line)]" : "ring-border/60"
                )}
                imgClassName="max-h-56 max-w-[16rem] object-contain"
              />
            ) : null
          )}
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-1">
          {others.map((f) => (
            <li key={f.id}>
              <a
                href={f.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline",
                  portal ? "text-[var(--portal-fg)]" : "text-primary"
                )}
              >
                <Paperclip className="size-3" />
                {f.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Local pending attachments — image thumbnails + file chips above composer. */
function PendingFilesPreview({
  files,
  onRemove,
  portal,
}: {
  files: File[];
  onRemove: (index: number) => void;
  portal?: boolean;
}) {
  const previews = useMemo(
    () =>
      files.map((file, index) => ({
        index,
        file,
        isImage: isImageFile(file),
        url: isImageFile(file) ? URL.createObjectURL(file) : null,
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      for (const p of previews) {
        if (p.url) URL.revokeObjectURL(p.url);
      }
    };
  }, [previews]);

  if (!files.length) return null;

  const images = previews.filter((p) => p.isImage);
  const others = previews.filter((p) => !p.isImage);

  return (
    <div className="space-y-2 px-3 pt-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((p) => (
            <div
              key={`${p.file.name}-${p.index}-${p.file.size}`}
              className="group relative"
            >
              {p.url ? (
                <ImageThumb
                  src={p.url}
                  alt={p.file.name}
                  name={p.file.name}
                  portal={portal}
                  className={cn(
                    "ring-1",
                    portal ? "ring-[var(--portal-line)]" : "ring-border/70"
                  )}
                  imgClassName="h-24 w-auto max-w-[11rem] object-cover"
                />
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(p.index)}
                className={cn(
                  "absolute top-1 right-1 z-10 flex size-6 items-center justify-center rounded-full shadow-sm transition-opacity",
                  portal
                    ? "bg-[var(--portal-bg)]/90 text-[var(--portal-fg)]"
                    : "bg-background/90 text-foreground",
                  "opacity-90 hover:opacity-100"
                )}
                aria-label={`Remove ${p.file.name}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {others.map((p) => (
            <li
              key={`${p.file.name}-${p.index}-${p.file.size}`}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                portal
                  ? "bg-[var(--portal-bg)] text-[var(--portal-muted)] ring-1 ring-[var(--portal-line)]"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Paperclip className="size-3 shrink-0" />
              <span className="truncate">{p.file.name}</span>
              <button
                type="button"
                onClick={() => onRemove(p.index)}
                className="shrink-0 opacity-70 hover:opacity-100"
                aria-label={`Remove ${p.file.name}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type DayRow = { kind: "day"; key: string; label: string };
type MsgRow = { kind: "msg"; message: PortalMessage; showHeader: boolean };

function buildDayRows(messages: PortalMessage[]): (DayRow | MsgRow)[] {
  const rows: (DayRow | MsgRow)[] = [];
  let lastDay = "";
  let lastAuthor = "";
  let lastTs = 0;

  for (const m of messages) {
    const dk = dayKey(m.createdAt);
    if (dk !== lastDay) {
      rows.push({ kind: "day", key: dk, label: fmtDayLabel(m.createdAt) });
      lastDay = dk;
      lastAuthor = "";
    }
    const ts = new Date(m.createdAt).getTime();
    const sameAuthor = `${m.authorKind}:${m.authorId ?? m.authorName}` === lastAuthor;
    const closeInTime = ts - lastTs < 5 * 60 * 1000;
    const showHeader = !(sameAuthor && closeInTime && !m.deletedAt);
    rows.push({ kind: "msg", message: m, showHeader });
    lastAuthor = `${m.authorKind}:${m.authorId ?? m.authorName}`;
    lastTs = ts;
  }
  return rows;
}

export function PortalChat({
  projectId,
  messages: initialMessages,
  reactions: initialReactions = [],
  files: initialFiles = [],
  members = [],
  viewer,
  portalToken,
  locale = "en",
  currentAuthorName,
  currentAuthorId,
  clientAuthor,
  className,
  compact,
  channelTitle,
  channelSubtitle,
  hideChannelHeader,
  onMarkedRead,
}: {
  projectId: string;
  messages: PortalMessage[];
  reactions?: PortalMessageReaction[];
  files?: Attachment[];
  members?: Member[];
  viewer: "studio" | "portal" | "session";
  portalToken?: string;
  locale?: PortalLocale;
  currentAuthorName?: string;
  currentAuthorId?: string | null;
  /** Person name + avatar for the project's client (overrides company labels). */
  clientAuthor?: ChatClientAuthor | null;
  className?: string;
  compact?: boolean;
  channelTitle?: string;
  channelSubtitle?: string;
  /** Hide the built-in channel header (e.g. when wrapped in a dock). */
  hideChannelHeader?: boolean;
  /** Fired when this open thread is marked read (sync). */
  onMarkedRead?: () => void;
}) {
  const t = portalT(normalizePortalLocale(locale));
  const [messages, setMessages] = useState(initialMessages);
  const [reactions, setReactions] = useState(initialReactions);
  const [files, setFiles] = useState(initialFiles);
  const [clientOnlinePoll, setClientOnline] = useState(false);
  const { clientOnline: clientOnlinePresence } = usePortalPresenceSubscribe(
    viewer === "studio" ? projectId : undefined
  );
  const clientOnline = clientOnlinePresence || clientOnlinePoll;
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const revisionRef = useRef(
    chatRevision(initialMessages, initialReactions, initialFiles)
  );
  const portal = viewer === "portal" || viewer === "session";
  const session = viewer === "session";

  const authorKind = portal ? "client" : "studio";
  const authorName =
    currentAuthorName ||
    clientAuthor?.name ||
    (portal ? "Client" : members[0]?.name || "Studio");
  const authorId = portal
    ? (currentAuthorId ?? clientAuthor?.id ?? null)
    : (currentAuthorId ?? null);

  const mentions = useMemo<MentionOption[]>(() => {
    const base: MentionOption[] = [
      { label: "Studio", insert: "@Studio" },
      ...members
        .filter((m) => m.role !== "Client")
        .map((m) => ({
          label: m.name,
          insert: mentionHandle(m.name),
        })),
    ];
    const seen = new Set<string>();
    return base.filter((m) => {
      if (seen.has(m.insert)) return false;
      seen.add(m.insert);
      return true;
    });
  }, [members]);

  const topLevel = useMemo(
    () => messages.filter((m) => !m.parentId),
    [messages]
  );
  const repliesMap = useMemo(() => {
    const map = new Map<string, PortalMessage[]>();
    for (const m of messages) {
      if (!m.parentId) continue;
      const list = map.get(m.parentId) ?? [];
      list.push(m);
      map.set(m.parentId, list);
    }
    return map;
  }, [messages]);

  const filesByMessage = useMemo(() => {
    const map: Record<string, Attachment[]> = {};
    for (const f of files) {
      if (f.parentType !== "portal_message") continue;
      (map[f.parentId] ??= []).push(f);
    }
    return map;
  }, [files]);

  const reactionsByMessage = useMemo(() => {
    const map: Record<string, PortalMessageReaction[]> = {};
    for (const r of reactions) {
      (map[r.messageId] ??= []).push(r);
    }
    return map;
  }, [reactions]);

  const rows = useMemo(() => buildDayRows(topLevel), [topLevel]);

  useEffect(() => {
    setMessages(initialMessages);
    setReactions(initialReactions);
    setFiles(initialFiles);
    revisionRef.current = chatRevision(
      initialMessages,
      initialReactions,
      initialFiles
    );
  }, [initialMessages, initialReactions, initialFiles]);

  const syncChat = async () => {
    if (portal && !session && !portalToken) return;
    const params = new URLSearchParams({
      revision: revisionRef.current,
    });
    if (session) {
      params.set("projectId", projectId);
    } else if (portal) {
      params.set("token", portalToken!);
    } else {
      params.set("projectId", projectId);
    }
    const url = portal
      ? `/api/portal/chat/sync?${params}`
      : `/api/chat/sync?${params}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 304) return;
    if (!res.ok) return;
    const data = (await res.json()) as ChatSyncPayload & {
      unchanged?: boolean;
    };
    if (!portal && typeof data.clientOnline === "boolean") {
      setClientOnline(data.clientOnline);
    }
    if (data.unreadCount === 0 || data.unchanged) {
      onMarkedRead?.();
    }
    if (data.unchanged) return;
    revisionRef.current = data.revision;
    setMessages(data.messages);
    setReactions(data.reactions);
    setFiles(data.files);
  };

  // Realtime → sync (JWT must be on the socket via ensureRealtimeAuth)
  const handleRealtimeChange = useCallback(() => {
    void syncChat();
  }, [projectId, portal, session, portalToken]); // eslint-disable-line react-hooks/exhaustive-deps

  usePortalChatRealtime(projectId, handleRealtimeChange);

  // One initial fetch + re-sync when the tab becomes visible again. No polling.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive || document.visibilityState !== "visible") return;
      try {
        await syncChat();
      } catch {
        /* ignore transient sync errors */
      }
    };
    void tick();
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on mount/viewer
  }, [projectId, portal, session, portalToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, reactions.length]);

  async function uploadFiles(messageId: string, list: File[]) {
    for (const file of list) {
      const fd = new FormData();
      fd.set("parentType", "portal_message");
      fd.set("parentId", messageId);
      fd.set("label", file.name);
      fd.set("file", file);
      if (session) {
        fd.set("projectId", projectId);
        await sessionClientUploadPortalFile(fd);
      } else if (portal && portalToken) {
        fd.set("token", portalToken);
        await clientUploadPortalFile(fd);
      } else {
        await uploadAttachment(fd);
      }
    }
  }

  function isMine(m: PortalMessage) {
    if (m.authorKind !== authorKind) return false;
    if (portal) return true;
    if (m.authorId && authorId) return m.authorId === authorId;
    return m.authorName === authorName;
  }

  function submit(text: string, parentId: string | null, filesList: File[]) {
    if (!text.trim() && !filesList.length) return;
    setError(null);
    startTransition(async () => {
      try {
        const content =
          text.trim() || (filesList.length ? "(attached files)" : "");
        let id: string;
        if (session) {
          id = await sessionPostClientPortalMessage(
            projectId,
            content,
            parentId
          );
        } else if (portal) {
          if (!portalToken) throw new Error("Missing portal token");
          id = await postClientPortalMessage(portalToken, content, parentId);
        } else {
          id = await postStudioPortalMessage(projectId, content, parentId);
        }
        if (filesList.length) await uploadFiles(id, filesList);
        if (parentId) {
          setReplyingTo(null);
          setReplyBody("");
          setReplyFiles([]);
        } else {
          setBody("");
          setPendingFiles([]);
          inputRef.current?.focus();
        }
        await syncChat();
      } catch (e) {
        setError(e instanceof Error ? e.message : t.failed);
      }
    });
  }

  function onReact(messageId: string, emoji: string) {
    startTransition(async () => {
      try {
        if (session) {
          await sessionToggleClientPortalMessageReaction(
            projectId,
            messageId,
            emoji
          );
        } else if (portal && portalToken) {
          await toggleClientPortalMessageReaction(portalToken, messageId, emoji);
        } else {
          await toggleStudioPortalMessageReaction(messageId, emoji);
        }
        setEmojiFor(null);
        await syncChat();
      } catch (e) {
        setError(e instanceof Error ? e.message : t.failed);
      }
    });
  }

  function saveEdit(messageId: string) {
    const text = editBody.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        if (session) {
          await sessionEditClientPortalMessage(projectId, messageId, text);
        } else if (portal && portalToken) {
          await editClientPortalMessage(portalToken, messageId, text);
        } else {
          await editStudioPortalMessage(messageId, text);
        }
        setEditingId(null);
        setEditBody("");
        await syncChat();
      } catch (e) {
        setError(e instanceof Error ? e.message : t.failed);
      }
    });
  }

  function unsend(messageId: string) {
    startTransition(async () => {
      try {
        if (session) {
          await sessionUnsendClientPortalMessage(projectId, messageId);
        } else if (portal && portalToken) {
          await unsendClientPortalMessage(portalToken, messageId);
        } else {
          await unsendStudioPortalMessage(messageId);
        }
        await syncChat();
      } catch (e) {
        setError(e instanceof Error ? e.message : t.failed);
      }
    });
  }

  function MessageBlock({
    message,
    showHeader,
    nested,
    threadId,
  }: {
    message: PortalMessage;
    showHeader: boolean;
    nested?: boolean;
    threadId: string;
  }) {
    const resolvedMember =
      message.authorKind === "studio"
        ? message.authorId
          ? memberById(message.authorId, members)
          : members.find((m) => m.name === message.authorName)
        : message.authorId
          ? memberById(message.authorId, members)
          : clientAuthor?.id
            ? memberById(clientAuthor.id, members)
            : null;
    const displayName =
      resolvedMember && resolvedMember.name !== "Unknown"
        ? resolvedMember.name
        : message.authorKind === "client"
          ? clientAuthor?.name || message.authorName || "Client"
          : message.authorName || t.studio;
    const mine = isMine(message);
    const messageReactions = reactionsByMessage[message.id] ?? [];
    const messageFiles = filesByMessage[message.id] ?? [];
    const grouped = groupReactions(messageReactions);
    const unsent = Boolean(message.deletedAt);

    return (
      <div
        className={cn(
          "group flex gap-3 rounded-md px-2 py-0.5",
          portal
            ? "hover:bg-[var(--portal-surface)]"
            : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]",
          nested && (portal ? "ml-8" : "ml-10"),
          showHeader ? "mt-2 pt-1" : "mt-0"
        )}
      >
        <div className="w-9 shrink-0">
          {showHeader ? (
            <MessageAvatar
              name={displayName}
              kind={message.authorKind}
              authorId={message.authorId}
              members={members}
              clientAuthor={clientAuthor}
              size={nested ? "sm" : "md"}
              portal={portal}
            />
          ) : (
            <span
              className={cn(
                "invisible block pt-1 text-right text-[10px] tabular-nums group-hover:visible",
                portal ? "text-[var(--portal-muted)]" : "text-muted-foreground"
              )}
            >
              {fmtClock(message.createdAt)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          {showHeader ? (
            <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2">
              <span
                className={cn(
                  "text-sm font-bold",
                  portal ? "text-[var(--portal-fg)]" : "text-foreground"
                )}
              >
                {displayName}
              </span>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  portal
                    ? "text-[var(--portal-muted)]"
                    : "text-muted-foreground"
                )}
              >
                {fmtClock(message.createdAt)}
              </span>
              {message.editedAt && !unsent ? (
                <span
                  className={cn(
                    "text-[10px]",
                    portal
                      ? "text-[var(--portal-muted)]"
                      : "text-muted-foreground"
                  )}
                >
                  (edited)
                </span>
              ) : null}
            </div>
          ) : null}

          {unsent ? (
            <p
              className={cn(
                "text-[15px] italic leading-snug",
                portal
                  ? "text-[var(--portal-muted)]"
                  : "text-muted-foreground"
              )}
            >
              This message was unsent
            </p>
          ) : editingId === message.id ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={2}
                className={cn(
                  "w-full resize-none rounded-lg px-3 py-2 text-sm outline-none",
                  portal
                    ? "border border-[var(--portal-line)] bg-[var(--portal-surface)] text-[var(--portal-fg)]"
                    : "border border-border bg-card/50"
                )}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setEditBody("");
                  }}
                  className={
                    portal
                      ? "text-[var(--portal-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
                      : undefined
                  }
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={pending || !editBody.trim()}
                  onClick={() => saveEdit(message.id)}
                  className={
                    portal
                      ? "bg-[var(--portal-accent)] text-[var(--portal-bg)] hover:bg-[var(--portal-accent)] hover:text-[var(--portal-bg)] hover:opacity-90"
                      : undefined
                  }
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p
              className={cn(
                "whitespace-pre-wrap break-words text-[15px] leading-snug",
                portal ? "text-[var(--portal-fg)]" : "text-foreground"
              )}
            >
              {renderBody(message.body)}
            </p>
          )}

          {!unsent && <AttachmentList files={messageFiles} portal={portal} />}

          {!unsent && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {grouped.map(([emoji, list]) => {
                const reacted = list.some(
                  (r) =>
                    r.authorKind === authorKind && r.authorName === authorName
                );
                return (
                  <button
                    key={emoji}
                    type="button"
                    disabled={pending}
                    onClick={() => onReact(message.id, emoji)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                      portal
                        ? reacted
                          ? "bg-[var(--portal-fg)]/10 ring-1 ring-[var(--portal-fg)]/30"
                          : "bg-[var(--portal-surface)] ring-1 ring-[var(--portal-line)]"
                        : reacted
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "bg-muted/60 ring-1 ring-border/60"
                    )}
                    title={list.map((r) => r.authorName).join(", ")}
                  >
                    <span>{emoji}</span>
                    <span
                      className={
                        portal
                          ? "text-[var(--portal-muted)]"
                          : "text-muted-foreground"
                      }
                    >
                      {list.length}
                    </span>
                  </button>
                );
              })}

              <ReactionPicker
                open={emojiFor === message.id}
                onOpenChange={(open) =>
                  setEmojiFor(open ? message.id : null)
                }
                onPick={(emoji) => onReact(message.id, emoji)}
                disabled={pending}
                portal={portal}
              />

              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setReplyingTo(threadId);
                  setReplyBody(`${mentionHandle(displayName)} `);
                  setReplyFiles([]);
                }}
                className={cn(
                  "text-[10px] transition-colors",
                  portal
                    ? "text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Reply
              </button>

              {mine && (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setEditingId(message.id);
                      setEditBody(message.body);
                    }}
                    className={cn(
                      "text-[10px] transition-colors",
                      portal
                        ? "text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => unsend(message.id)}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    Unsend
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        portal ? "bg-[var(--portal-bg)]" : "bg-background",
        className
      )}
    >
      {!hideChannelHeader && (channelTitle || channelSubtitle || !portal) && (
        <header
          className={cn(
            "flex shrink-0 items-center gap-3 border-b px-4 py-3",
            portal ? "border-[var(--portal-line)]" : "border-border/80"
          )}
        >
          <div className="min-w-0 flex-1">
            {channelTitle ? (
              <h2
                className={cn(
                  "truncate text-[15px] font-bold tracking-tight",
                  portal ? "text-[var(--portal-fg)]" : "text-foreground"
                )}
              >
                {channelTitle}
              </h2>
            ) : null}
            {channelSubtitle ? (
              <p
                className={cn(
                  "truncate text-xs",
                  portal
                    ? "text-[var(--portal-muted)]"
                    : "text-muted-foreground"
                )}
              >
                {channelSubtitle}
              </p>
            ) : null}
          </div>
          {!portal ? (
            <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-2 rounded-full",
                  clientOnline ? "bg-emerald-500" : "bg-muted-foreground/35"
                )}
              />
              {clientOnline ? "Client online" : "Client offline"}
            </div>
          ) : null}
        </header>
      )}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          compact && !hideChannelHeader ? "max-h-[32rem]" : ""
        )}
      >
        {topLevel.length === 0 ? (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-6 text-center">
            <p
              className={cn(
                "text-lg font-semibold",
                portal ? "text-[var(--portal-fg)]" : "text-foreground"
              )}
            >
              {channelTitle || "Messages"}
            </p>
            <p
              className={cn(
                "mt-2 max-w-sm text-sm",
                portal
                  ? "text-[var(--portal-muted)]"
                  : "text-muted-foreground"
              )}
            >
              {t.chatEmpty}
            </p>
          </div>
        ) : (
          <div className="px-2 py-3 pb-6 sm:px-4">
            {rows.map((row) => {
              if (row.kind === "day") {
                return (
                  <div
                    key={`day-${row.key}`}
                    className="relative my-4 flex items-center justify-center"
                  >
                    <div
                      className={cn(
                        "absolute inset-x-0 top-1/2 h-px",
                        portal ? "bg-[var(--portal-line)]" : "bg-border"
                      )}
                    />
                    <span
                      className={cn(
                        "relative rounded-full border px-3 py-0.5 text-[11px] font-semibold",
                        portal
                          ? "border-[var(--portal-line)] bg-[var(--portal-bg)] text-[var(--portal-muted)]"
                          : "border-border bg-background text-muted-foreground"
                      )}
                    >
                      {row.label}
                    </span>
                  </div>
                );
              }

              const m = row.message;
              const replies = repliesMap.get(m.id) ?? [];

              return (
                <div key={m.id}>
                  <MessageBlock
                    message={m}
                    showHeader={row.showHeader}
                    threadId={m.id}
                  />
                  {replies.map((reply) => (
                    <MessageBlock
                      key={reply.id}
                      message={reply}
                      showHeader
                      nested
                      threadId={m.id}
                    />
                  ))}
                  {replyingTo === m.id && (
                    <div
                      className={cn(
                        "mt-1 flex gap-3 px-2 py-2",
                        portal ? "ml-8" : "ml-10"
                      )}
                    >
                      <MessageAvatar
                        name={authorName}
                        kind={authorKind}
                        authorId={authorId}
                        members={members}
                        clientAuthor={clientAuthor}
                        size="sm"
                        portal={portal}
                      />
                      <div
                        className={cn(
                          "min-w-0 flex-1 overflow-hidden rounded-xl border",
                          portal
                            ? "border-[var(--portal-line)] bg-[var(--portal-surface)]"
                            : "border-border bg-card"
                        )}
                      >
                        <PendingFilesPreview
                          files={replyFiles}
                          portal={portal}
                          onRemove={(index) =>
                            setReplyFiles((prev) =>
                              prev.filter((_, j) => j !== index)
                            )
                          }
                        />
                        <MentionComposer
                          value={replyBody}
                          onChange={setReplyBody}
                          mentions={mentions}
                          placeholder="Write a reply… Type @ to mention"
                          portal={portal}
                          autoFocus
                          onSubmit={() =>
                            submit(replyBody, m.id, replyFiles)
                          }
                        />
                        <div className="flex items-center justify-end gap-2 px-2 pb-2">
                          <input
                            ref={replyFileRef}
                            type="file"
                            multiple
                            accept="image/*,*/*"
                            className="hidden"
                            onChange={(e) => {
                              const list = Array.from(e.target.files ?? []);
                              if (list.length)
                                setReplyFiles((p) => [...p, ...list]);
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => replyFileRef.current?.click()}
                            className={cn(
                              "mr-auto inline-flex items-center gap-1 text-xs",
                              portal
                                ? "text-[var(--portal-muted)]"
                                : "text-muted-foreground"
                            )}
                          >
                            <Paperclip className="size-3.5" />
                            Attach
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyBody("");
                              setReplyFiles([]);
                            }}
                            className={
                              portal
                                ? "text-[var(--portal-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
                                : undefined
                            }
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={
                              pending ||
                              (!replyBody.trim() && !replyFiles.length)
                            }
                            onClick={() =>
                              submit(replyBody, m.id, replyFiles)
                            }
                            className={
                              portal
                                ? "bg-[var(--portal-accent)] text-[var(--portal-bg)] hover:bg-[var(--portal-accent)] hover:text-[var(--portal-bg)] hover:opacity-90"
                                : undefined
                            }
                          >
                            Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 pt-1 pb-3 sm:px-4 sm:pb-4">
        {error ? (
          <p className="mb-2 px-1 text-sm text-rose-500" role="alert">
            {error}
          </p>
        ) : null}
        <div
          className={cn(
            "overflow-hidden rounded-xl border shadow-sm focus-within:ring-1",
            portal
              ? "border-[var(--portal-line)] bg-[var(--portal-surface)] focus-within:ring-[var(--portal-accent)]/40"
              : "border-border bg-card focus-within:ring-ring/40"
          )}
        >
          <PendingFilesPreview
            files={pendingFiles}
            portal={portal}
            onRemove={(index) =>
              setPendingFiles((prev) => prev.filter((_, j) => j !== index))
            }
          />
          <MentionComposer
            value={body}
            onChange={setBody}
            mentions={mentions}
            placeholder={`Message ${channelTitle || "client"}`}
            portal={portal}
            inputRef={inputRef}
            onSubmit={() => submit(body, null, pendingFiles)}
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,*/*"
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  if (list.length) setPendingFiles((p) => [...p, ...list]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                  portal
                    ? "text-[var(--portal-muted)] hover:bg-[var(--portal-bg)] hover:text-[var(--portal-fg)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Paperclip className="size-3.5" />
                Attach
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={pending || (!body.trim() && !pendingFiles.length)}
              onClick={() => submit(body, null, pendingFiles)}
              className={cn(
                "h-8 gap-1.5 px-3",
                portal &&
                  "bg-[var(--portal-accent)] text-[var(--portal-bg)] hover:bg-[var(--portal-accent)] hover:text-[var(--portal-bg)] hover:opacity-90"
              )}
            >
              <Send className="size-3.5" />
              {t.chatSend}
            </Button>
          </div>
        </div>
        <p
          className={cn(
            "mt-1.5 px-1 text-[11px]",
            portal ? "text-[var(--portal-muted)]" : "text-muted-foreground"
          )}
        >
          Enter to send · Shift+Enter for new line · Attach images or files
        </p>
      </div>
    </div>
  );
}
