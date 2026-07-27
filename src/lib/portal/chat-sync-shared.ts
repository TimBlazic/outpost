import type {
  Attachment,
  PortalMessage,
  PortalMessageReaction,
} from "@/lib/data";

/** Safe for client components — no next/headers / store imports. */

export const CLIENT_ONLINE_MS = 45_000;
export const CHAT_POLL_MS = 2_000;
/** How often unread badges / thread list refresh while a page is open. */
/** Studio sidebar badge — keep light so navigations stay snappy. */
export const UNREAD_POLL_MS = 15_000;

export type ChatSyncPayload = {
  revision: string;
  messages: PortalMessage[];
  reactions: PortalMessageReaction[];
  files: Attachment[];
  /** Studio-only: whether the client portal tab looks online. */
  clientOnline?: boolean;
  /** Unread for the current viewer (0 while the thread is open & marked read). */
  unreadCount?: number;
};

export type ChatViewer = "studio" | "client";

export function isClientOnline(lastSeenAt: string | null | undefined) {
  if (!lastSeenAt) return false;
  const ts = Date.parse(lastSeenAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < CLIENT_ONLINE_MS;
}

/** Count messages from the other party after the viewer's last-read cursor. */
export function countUnreadMessages(
  messages: PortalMessage[],
  viewer: ChatViewer,
  lastReadAt: string | null | undefined
) {
  const other = viewer === "studio" ? "client" : "studio";
  const since = lastReadAt ? Date.parse(lastReadAt) : 0;
  let n = 0;
  for (const m of messages) {
    if (m.deletedAt) continue;
    if (m.authorKind !== other) continue;
    const ts = Date.parse(m.createdAt);
    if (!Number.isFinite(ts)) continue;
    if (!lastReadAt || ts > since) n += 1;
  }
  return n;
}

export function chatRevision(
  messages: PortalMessage[],
  reactions: PortalMessageReaction[],
  files: Attachment[]
) {
  const msgPart = messages
    .map(
      (m) =>
        `${m.id}:${m.editedAt ?? ""}:${m.deletedAt ?? ""}:${m.body}:${m.parentId ?? ""}`
    )
    .join("|");
  const reactPart = reactions.map((r) => `${r.id}:${r.emoji}`).join("|");
  const filePart = files.map((f) => `${f.id}:${f.url ?? ""}`).join("|");
  return `${messages.length}:${reactions.length}:${files.length}:${msgPart.length}:${reactPart.length}:${filePart.length}:${hashLite(msgPart + reactPart + filePart)}`;
}

function hashLite(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
