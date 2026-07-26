import {
  bulkTicketsLabel,
  ctaLabel,
  footerNote,
  moreMessagesLabel,
  needsInputLine,
  notificationHeadline,
  notificationSubject,
} from "./copy";
import type {
  MessagePayload,
  PortalNotificationPayload,
  PortalNotificationType,
  TicketCommentPayload,
  TicketsBulkPayload,
  TicketWaitingPayload,
} from "./types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isMessagePayload(p: PortalNotificationPayload): p is MessagePayload {
  return Array.isArray((p as MessagePayload).messageIds);
}

function isCommentPayload(
  p: PortalNotificationPayload
): p is TicketCommentPayload {
  return typeof (p as TicketCommentPayload).commentId === "string";
}

function isWaitingPayload(
  p: PortalNotificationPayload
): p is TicketWaitingPayload {
  return (
    typeof (p as TicketWaitingPayload).ticketId === "string" &&
    !("commentId" in p) &&
    !("count" in p)
  );
}

function isBulkPayload(p: PortalNotificationPayload): p is TicketsBulkPayload {
  return typeof (p as TicketsBulkPayload).count === "number";
}

function subjectFor(
  locale: "en" | "sl",
  projectName: string,
  type: PortalNotificationType,
  payload: PortalNotificationPayload
) {
  if (type === "message" && isMessagePayload(payload)) {
    return notificationSubject(locale, {
      type: "message",
      projectName,
      count: payload.messageIds.length,
    });
  }
  if (type === "ticket_comment" && isCommentPayload(payload)) {
    return notificationSubject(locale, {
      type: "ticket_comment",
      projectName,
      ticketTitle: payload.ticketTitle,
    });
  }
  if (type === "ticket_waiting" && isWaitingPayload(payload)) {
    return notificationSubject(locale, {
      type: "ticket_waiting",
      projectName,
      ticketTitle: payload.ticketTitle,
    });
  }
  if (type === "tickets_bulk" && isBulkPayload(payload)) {
    return notificationSubject(locale, {
      type: "tickets_bulk",
      projectName,
      count: payload.count,
    });
  }
  return notificationSubject(locale, {
    type: "message",
    projectName,
    count: 1,
  });
}

function previewCardHtml(
  locale: "en" | "sl",
  type: PortalNotificationType,
  payload: PortalNotificationPayload
) {
  if (type === "message" && isMessagePayload(payload)) {
    const shown = payload.excerpts.slice(0, 3);
    const extra = Math.max(0, payload.excerpts.length - shown.length);
    const rows = shown
      .map(
        (ex) =>
          `<p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#1c1917;">${escapeHtml(ex)}</p>`
      )
      .join("");
    const more =
      extra > 0
        ? `<p style="margin:0;font-size:13px;color:#78716c;">${escapeHtml(moreMessagesLabel(locale, extra))}</p>`
        : "";
    return rows + more;
  }

  if (type === "ticket_comment" && isCommentPayload(payload)) {
    return `
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;">${escapeHtml(payload.ticketTitle)}</p>
      <p style="margin:0;font-size:15px;line-height:1.5;color:#1c1917;">${escapeHtml(payload.excerpt)}</p>
    `;
  }

  if (type === "ticket_waiting" && isWaitingPayload(payload)) {
    return `
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;">${escapeHtml(payload.ticketTitle)}</p>
      <p style="margin:0;font-size:15px;line-height:1.5;color:#1c1917;">${escapeHtml(needsInputLine(locale))}</p>
    `;
  }

  if (type === "tickets_bulk" && isBulkPayload(payload)) {
    const titles = payload.titles
      .slice(0, 5)
      .map(
        (t) =>
          `<li style="margin:0 0 6px;font-size:15px;line-height:1.4;color:#1c1917;">${escapeHtml(t)}</li>`
      )
      .join("");
    return `
      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1c1917;">${escapeHtml(bulkTicketsLabel(locale, payload.count))}</p>
      <ul style="margin:0;padding-left:18px;">${titles}</ul>
    `;
  }

  return "";
}

function previewText(
  locale: "en" | "sl",
  type: PortalNotificationType,
  payload: PortalNotificationPayload
) {
  if (type === "message" && isMessagePayload(payload)) {
    const shown = payload.excerpts.slice(0, 3);
    const extra = Math.max(0, payload.excerpts.length - shown.length);
    return (
      shown.join("\n\n") +
      (extra > 0 ? `\n\n${moreMessagesLabel(locale, extra)}` : "")
    );
  }
  if (type === "ticket_comment" && isCommentPayload(payload)) {
    return `${payload.ticketTitle}\n${payload.excerpt}`;
  }
  if (type === "ticket_waiting" && isWaitingPayload(payload)) {
    return `${payload.ticketTitle}\n${needsInputLine(locale)}`;
  }
  if (type === "tickets_bulk" && isBulkPayload(payload)) {
    return (
      `${bulkTicketsLabel(locale, payload.count)}\n` +
      payload.titles
        .slice(0, 5)
        .map((t) => `• ${t}`)
        .join("\n")
    );
  }
  return "";
}

export function renderPortalNotificationEmail(input: {
  locale: "en" | "sl";
  projectName: string;
  type: PortalNotificationType;
  payload: PortalNotificationPayload;
  ctaUrl: string;
}): { subject: string; html: string; text: string } {
  const { locale, projectName, type, payload, ctaUrl } = input;
  const subject = subjectFor(locale, projectName, type, payload);
  const headline = notificationHeadline(locale, type);
  const card = previewCardHtml(locale, type, payload);
  const cta = ctaLabel(locale);
  const foot = footerNote(locale);

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a8a29e;">Outpost</p>
          <p style="margin:8px 0 0;font-size:13px;color:#78716c;">${escapeHtml(projectName)}</p>
          <h1 style="margin:16px 0 0;font-size:26px;line-height:1.2;font-weight:600;color:#1c1917;">${escapeHtml(headline)}</h1>
        </td></tr>
        <tr><td style="padding:20px 28px;">
          <div style="border:1px solid #e7e5e4;border-radius:10px;background:#fafaf9;padding:18px 18px 10px;">
            ${card}
          </div>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;" align="left">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1c1917;color:#fafaf9;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:8px;">${escapeHtml(cta)}</a>
        </td></tr>
        <tr><td style="padding:0 28px 24px;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#a8a29e;">${escapeHtml(foot)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    headline,
    projectName,
    "",
    previewText(locale, type, payload),
    "",
    `${cta}: ${ctaUrl}`,
    "",
    foot,
  ].join("\n");

  return { subject, html, text };
}
