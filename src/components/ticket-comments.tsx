"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Paperclip, SmilePlus } from "lucide-react";

import {
  memberById,
  type Attachment,
  type Member,
  type TicketComment,
  type TicketCommentReaction,
  type TicketParty,
} from "@/lib/data";
import {
  createTicketComment,
  deleteTicketComment,
  toggleTicketCommentReaction,
  uploadAttachment,
} from "@/lib/actions";
import {
  clientCreateTicketComment,
  clientToggleTicketCommentReaction,
  clientUploadPortalFile,
} from "@/lib/portal/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";

const REACTIONS = ["👍", "❤️", "👀", "🎉", "😄"] as const;

function relativeTime(iso: string) {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function renderBody(body: string) {
  const parts = body.split(/(@[\w][\w.-]*)/g);
  return parts.map((part, i) => {
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

function CommentAvatar({
  name,
  kind,
  authorId,
  members,
  size = "md",
  portal,
}: {
  name: string;
  kind: TicketParty;
  authorId?: string | null;
  members: Member[];
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
          fallbackClassName={
            portal
              ? "bg-[var(--portal-fg)] text-[var(--portal-bg)]"
              : undefined
          }
        />
      );
    }
    return (
      <UserAvatar
        name={name}
        size={size}
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
      fallbackClassName={
        portal
          ? "bg-[var(--portal-surface)] text-[var(--portal-fg)] ring-1 ring-[var(--portal-line)]"
          : "bg-muted text-foreground ring-1 ring-border"
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
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  mentions: MentionOption[];
  placeholder: string;
  portal?: boolean;
  autoFocus?: boolean;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const filtered = useMemo(() => {
    if (query == null) return [];
    const q = query.toLowerCase();
    return mentions
      .filter((m) => m.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentions, query]);

  function scanMention(text: string, caret: number) {
    const before = text.slice(0, caret);
    const match = before.match(/@([\w.-]*)$/);
    setQuery(match ? match[1] : null);
  }

  function insertMention(opt: MentionOption) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(/@([\w.-]*)$/, `${opt.insert} `);
    const next = replaced + after;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = replaced.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (query == null || !filtered.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filtered[cursor] ?? filtered[0]);
    } else if (e.key === "Escape") {
      setQuery(null);
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
        className={cn(
          "w-full resize-none rounded-lg px-3 py-2 text-sm outline-none",
          portal
            ? "border border-[var(--portal-line)] bg-[var(--portal-surface)] text-[var(--portal-fg)] placeholder:text-[var(--portal-muted)] focus:border-[var(--portal-fg)]/40"
            : "border border-border bg-card/50 text-foreground focus:ring-1 focus:ring-primary/40"
        )}
      />
      {filtered.length > 0 && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border shadow-lg",
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

function groupReactions(reactions: TicketCommentReaction[]) {
  const map = new Map<string, TicketCommentReaction[]>();
  for (const r of reactions) {
    const list = map.get(r.emoji) ?? [];
    list.push(r);
    map.set(r.emoji, list);
  }
  return [...map.entries()];
}

export function TicketComments({
  ticketId,
  comments,
  reactions,
  files,
  members = [],
  mentionExtras = [],
  canComment = true,
  canDelete = false,
  currentAuthorKind,
  currentAuthorName,
  variant = "studio",
  portalToken,
  labels,
  stickyFooter = false,
  above,
}: {
  ticketId: string;
  comments: TicketComment[];
  reactions: TicketCommentReaction[];
  files: Attachment[];
  members?: Member[];
  mentionExtras?: MentionOption[];
  canComment?: boolean;
  canDelete?: boolean;
  currentAuthorKind: TicketParty;
  currentAuthorName: string;
  variant?: "studio" | "portal";
  portalToken?: string;
  labels?: {
    comments?: string;
    write?: string;
    reply?: string;
    comment?: string;
    empty?: string;
    attach?: string;
  };
  /** Pin composer to bottom of drawer; scroll ticket body + thread above. */
  stickyFooter?: boolean;
  above?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const portal = variant === "portal";

  const mentions = useMemo<MentionOption[]>(() => {
    const base: MentionOption[] = [
      { label: "Studio", insert: "@Studio" },
      ...mentionExtras,
      ...members.map((m) => ({ label: m.name, insert: `@${m.name.replace(/\s+/g, "")}` })),
    ];
    const seen = new Set<string>();
    return base.filter((m) => {
      if (seen.has(m.insert)) return false;
      seen.add(m.insert);
      return true;
    });
  }, [members, mentionExtras]);

  const filesByComment = useMemo(() => {
    const map: Record<string, Attachment[]> = {};
    for (const f of files) {
      if (f.parentType !== "ticket_comment") continue;
      (map[f.parentId] ??= []).push(f);
    }
    return map;
  }, [files]);

  const reactionsByComment = useMemo(() => {
    const map: Record<string, TicketCommentReaction[]> = {};
    for (const r of reactions) {
      (map[r.commentId] ??= []).push(r);
    }
    return map;
  }, [reactions]);

  const topLevel = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );
  const repliesMap = useMemo(() => {
    const map = new Map<string, TicketComment[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  }, [comments]);

  async function uploadFiles(commentId: string, list: File[]) {
    for (const file of list) {
      const fd = new FormData();
      fd.set("parentType", "ticket_comment");
      fd.set("parentId", commentId);
      fd.set("label", file.name);
      fd.set("file", file);
      if (portal && portalToken) {
        fd.set("token", portalToken);
        await clientUploadPortalFile(fd);
      } else {
        await uploadAttachment(fd);
      }
    }
  }

  function submitComment(text: string, parentId: string | null, filesList: File[]) {
    if (!text.trim() && !filesList.length) return;
    startTransition(async () => {
      const content = text.trim() || (filesList.length ? "(attached files)" : "");
      let id: string;
      if (portal && portalToken) {
        id = await clientCreateTicketComment(portalToken, ticketId, {
          body: content,
          parentId,
        });
      } else {
        id = await createTicketComment(ticketId, {
          body: content,
          parentId,
        });
      }
      if (filesList.length) await uploadFiles(id, filesList);
      if (parentId) {
        setReplyingTo(null);
        setReplyBody("");
        setReplyFiles([]);
      } else {
        setBody("");
        setPendingFiles([]);
      }
      router.refresh();
    });
  }

  function onReact(commentId: string, emoji: string) {
    startTransition(async () => {
      if (portal && portalToken) {
        await clientToggleTicketCommentReaction(portalToken, commentId, emoji);
      } else {
        await toggleTicketCommentReaction(commentId, emoji);
      }
      setEmojiFor(null);
      router.refresh();
    });
  }

  const L = {
    comments: labels?.comments ?? "Comments",
    write: labels?.write ?? "Write a comment… Type @ to mention",
    reply: labels?.reply ?? "Reply",
    comment: labels?.comment ?? "Comment",
    empty: labels?.empty ?? "No comments yet — start the conversation.",
    attach: labels?.attach ?? "Attach",
  };

  function CommentBlock({
    comment,
    nested,
    threadId,
  }: {
    comment: TicketComment;
    nested?: boolean;
    /** Top-level comment id — replies stay flat under this thread. */
    threadId: string;
  }) {
    const resolvedMember =
      comment.authorKind === "studio"
        ? comment.authorId
          ? memberById(comment.authorId, members)
          : members.find((m) => m.name === comment.authorName)
        : null;
    const displayName =
      resolvedMember && resolvedMember.name !== "Unknown"
        ? resolvedMember.name
        : comment.authorName;
    const mine =
      comment.authorKind === currentAuthorKind &&
      (comment.authorId
        ? members.some(
            (m) => m.id === comment.authorId && m.name === currentAuthorName
          ) || comment.authorName === currentAuthorName
        : comment.authorName === currentAuthorName);
    const commentReactions = reactionsByComment[comment.id] ?? [];
    const commentFiles = filesByComment[comment.id] ?? [];
    const grouped = groupReactions(commentReactions);

    return (
      <div className={cn("flex gap-3 py-3", nested && (portal ? "ml-8" : "ml-10"))}>
        <CommentAvatar
          name={displayName}
          kind={comment.authorKind}
          authorId={comment.authorId}
          members={members}
          size={nested ? "sm" : "md"}
          portal={portal}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                portal ? "text-[var(--portal-fg)]" : "text-foreground"
              )}
            >
              {displayName}
            </span>
            <span
              className={cn(
                "text-[10px]",
                portal ? "text-[var(--portal-muted)]" : "text-muted-foreground"
              )}
            >
              {relativeTime(comment.createdAt)}
            </span>
            {comment.editedAt && (
              <span
                className={cn(
                  "text-[10px]",
                  portal ? "text-[var(--portal-muted)]" : "text-muted-foreground"
                )}
              >
                (edited)
              </span>
            )}
          </div>
          <p
            className={cn(
              "mt-1 whitespace-pre-wrap text-sm",
              portal
                ? "text-[var(--portal-fg)]/85"
                : "text-foreground/80"
            )}
          >
            {renderBody(comment.body)}
          </p>

          {commentFiles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {commentFiles.map((f) => (
                <li key={f.id}>
                  <a
                    href={f.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline",
                      portal
                        ? "text-[var(--portal-fg)]"
                        : "text-primary"
                    )}
                  >
                    <Paperclip className="size-3" />
                    {f.label}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {grouped.map(([emoji, list]) => {
              const reacted = list.some(
                (r) =>
                  r.authorKind === currentAuthorKind &&
                  r.authorName === currentAuthorName
              );
              return (
                <button
                  key={emoji}
                  type="button"
                  disabled={!canComment || pending}
                  onClick={() => onReact(comment.id, emoji)}
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
                      portal ? "text-[var(--portal-muted)]" : "text-muted-foreground"
                    }
                  >
                    {list.length}
                  </span>
                </button>
              );
            })}

            {canComment && (
              <>
                <div className="relative">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setEmojiFor(emojiFor === comment.id ? null : comment.id)
                    }
                    className={cn(
                      "rounded-md p-1 transition-colors",
                      portal
                        ? "text-[var(--portal-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    title="React"
                  >
                    <SmilePlus className="size-3.5" />
                  </button>
                  {emojiFor === comment.id && (
                    <div
                      className={cn(
                        "absolute left-0 top-full z-10 mt-1 flex gap-0.5 rounded-lg border p-1 shadow-md",
                        portal
                          ? "border-[var(--portal-line)] bg-[var(--portal-bg)]"
                          : "border-border bg-popover"
                      )}
                    >
                      {REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="rounded px-1.5 py-0.5 text-sm hover:bg-muted"
                          onClick={() => onReact(comment.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const mention = `@${comment.authorName.replace(/\s+/g, "")}`;
                    setReplyingTo(threadId);
                    setReplyBody(`${mention} `);
                    setReplyFiles([]);
                  }}
                  className={cn(
                    "text-[10px] transition-colors",
                    portal
                      ? "text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {L.reply}
                </button>
              </>
            )}

            {canDelete && mine && !portal && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteTicketComment(comment.id);
                    router.refresh();
                  })
                }
                className="text-[10px] text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const composer = canComment ? (
    <div className="flex gap-3">
      <CommentAvatar
        name={currentAuthorName}
        kind={currentAuthorKind}
        authorId={
          currentAuthorKind === "studio"
            ? members.find((m) => m.name === currentAuthorName)?.id
            : null
        }
        members={members}
        portal={portal}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <MentionComposer
          value={body}
          onChange={setBody}
          mentions={mentions}
          placeholder={L.write}
          portal={portal}
          rows={stickyFooter ? 2 : 3}
        />
        {pendingFiles.length > 0 && (
          <ul
            className={cn(
              "space-y-0.5 text-xs",
              portal ? "text-[var(--portal-muted)]" : "text-muted-foreground"
            )}
          >
            {pendingFiles.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                <Paperclip className="size-3" />
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-[10px] underline"
                  onClick={() =>
                    setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            <input
              ref={fileRef}
              type="file"
              multiple
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
                  ? "text-[var(--portal-muted)] hover:bg-[var(--portal-surface)] hover:text-[var(--portal-fg)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Paperclip className="size-3.5" />
              {L.attach}
            </button>
          </div>
          {portal ? (
            <Button
              size="sm"
              disabled={pending || (!body.trim() && !pendingFiles.length)}
              onClick={() => submitComment(body, null, pendingFiles)}
              className="bg-[var(--portal-fg)] text-[var(--portal-bg)] hover:opacity-90"
            >
              {L.comment}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={pending || (!body.trim() && !pendingFiles.length)}
              onClick={() => submitComment(body, null, pendingFiles)}
            >
              {L.comment}
            </Button>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const thread = (
    <div className="space-y-0">
      <h4
        className={cn(
          "mb-3 text-[11px] font-medium uppercase tracking-wider",
          portal ? "text-[var(--portal-muted)]" : "text-muted-foreground"
        )}
      >
        {L.comments}
        {comments.length > 0 && (
          <span
            className={cn(
              "ml-1.5 normal-case tracking-normal",
              portal ? "text-[var(--portal-fg)]" : "text-foreground"
            )}
          >
            {comments.length}
          </span>
        )}
      </h4>

      {topLevel.length === 0 ? (
        <p
          className={cn(
            "py-6 text-center text-xs",
            portal ? "text-[var(--portal-muted)]" : "text-muted-foreground"
          )}
        >
          {L.empty}
        </p>
      ) : (
        topLevel.map((comment) => (
          <div key={comment.id}>
            <CommentBlock comment={comment} threadId={comment.id} />
            {(repliesMap.get(comment.id) ?? []).map((reply) => (
              <CommentBlock
                key={reply.id}
                comment={reply}
                nested
                threadId={comment.id}
              />
            ))}
            {replyingTo === comment.id && canComment && (
              <div className={cn("flex gap-3 py-3", portal ? "ml-8" : "ml-10")}>
                <CommentAvatar
                  name={currentAuthorName}
                  kind={currentAuthorKind}
                  authorId={
                    currentAuthorKind === "studio"
                      ? members.find((m) => m.name === currentAuthorName)?.id
                      : null
                  }
                  members={members}
                  size="sm"
                  portal={portal}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <MentionComposer
                    value={replyBody}
                    onChange={setReplyBody}
                    mentions={mentions}
                    placeholder={L.write}
                    portal={portal}
                    autoFocus
                    rows={2}
                  />
                  {replyFiles.length > 0 && (
                    <ul
                      className={cn(
                        "space-y-0.5 text-xs",
                        portal
                          ? "text-[var(--portal-muted)]"
                          : "text-muted-foreground"
                      )}
                    >
                      {replyFiles.map((f, i) => (
                        <li key={`${f.name}-${i}`}>{f.name}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <input
                      ref={replyFileRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const list = Array.from(e.target.files ?? []);
                        if (list.length) setReplyFiles((p) => [...p, ...list]);
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
                      {L.attach}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyBody("");
                        setReplyFiles([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        pending || (!replyBody.trim() && !replyFiles.length)
                      }
                      onClick={() =>
                        submitComment(replyBody, comment.id, replyFiles)
                      }
                    >
                      {L.reply}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  if (stickyFooter) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {above}
          <div
            className={cn(
              "px-5 pb-4 pt-5",
              above &&
                (portal
                  ? "border-t border-[var(--portal-line)]"
                  : "border-t border-border/60")
            )}
          >
            {thread}
          </div>
        </div>
        {composer && (
          <div
            className={cn(
              "shrink-0 border-t px-5 py-3",
              portal
                ? "border-[var(--portal-line)] bg-[var(--portal-bg)]"
                : "border-border/80 bg-background"
            )}
          >
            {composer}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {above}
      <div
        className={cn(
          above
            ? portal
              ? "border-t border-[var(--portal-line)] px-5 pt-5 pb-6"
              : "border-t border-border/60 px-5 pt-5 pb-6"
            : undefined
        )}
      >
        {thread}
        {composer && (
          <div
            className={cn(
              "mt-4 border-t pt-4",
              portal ? "border-[var(--portal-line)]" : "border-border/50"
            )}
          >
            {composer}
          </div>
        )}
      </div>
    </div>
  );
}
