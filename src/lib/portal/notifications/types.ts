export type PortalNotificationType =
  | "message"
  | "ticket_comment"
  | "ticket_waiting"
  | "tickets_bulk";

export type PortalNotificationStatus =
  | "pending"
  | "sending"
  | "sent"
  | "skipped"
  | "failed";

export type MessagePayload = {
  messageIds: string[];
  excerpts: string[];
};

export type TicketCommentPayload = {
  ticketId: string;
  ticketTitle: string;
  commentId: string;
  excerpt: string;
};

export type TicketWaitingPayload = {
  ticketId: string;
  ticketTitle: string;
};

export type TicketsBulkPayload = {
  count: number;
  titles: string[];
  ticketIds: string[];
};

export type PortalNotificationPayload =
  | MessagePayload
  | TicketCommentPayload
  | TicketWaitingPayload
  | TicketsBulkPayload;

export type PortalNotificationEvent = {
  id: string;
  projectId: string;
  clientId: string;
  type: PortalNotificationType;
  payload: PortalNotificationPayload;
  notBefore: string;
  status: PortalNotificationStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 2.5 minutes — message debounce window. */
export const MESSAGE_DEBOUNCE_MS = 150_000;
export const MAX_SEND_ATTEMPTS = 3;
export const EXCERPT_MAX = 180;
