import type { PortalNotificationType } from "./types";

export function notificationSubject(
  locale: "en" | "sl",
  input:
    | { type: "message"; projectName: string; count: number }
    | { type: "ticket_comment"; projectName: string; ticketTitle: string }
    | { type: "ticket_waiting"; projectName: string; ticketTitle: string }
    | { type: "tickets_bulk"; projectName: string; count: number }
): string {
  const project = input.projectName.trim() || "Project";
  if (locale === "sl") {
    if (input.type === "message") {
      return input.count <= 1
        ? `Novo sporočilo · ${project}`
        : `${input.count} nova sporočila · ${project}`;
    }
    if (input.type === "ticket_comment") {
      return `Komentar na ${input.ticketTitle} · ${project}`;
    }
    if (input.type === "ticket_waiting") {
      return `Potrebujemo tvoj input · ${input.ticketTitle}`;
    }
    return `${input.count} novih ticketov · ${project}`;
  }

  if (input.type === "message") {
    return input.count <= 1
      ? `New message · ${project}`
      : `${input.count} new messages · ${project}`;
  }
  if (input.type === "ticket_comment") {
    return `Comment on ${input.ticketTitle} · ${project}`;
  }
  if (input.type === "ticket_waiting") {
    return `We need your input · ${input.ticketTitle}`;
  }
  return `${input.count} new tickets · ${project}`;
}

export function notificationHeadline(
  locale: "en" | "sl",
  type: PortalNotificationType
): string {
  if (locale === "sl") {
    switch (type) {
      case "message":
        return "Novo sporočilo";
      case "ticket_comment":
        return "Nov komentar";
      case "ticket_waiting":
        return "Potrebujemo tvoj input";
      case "tickets_bulk":
        return "Novi ticketi";
    }
  }
  switch (type) {
    case "message":
      return "New message";
    case "ticket_comment":
      return "New comment";
    case "ticket_waiting":
      return "We need your input";
    case "tickets_bulk":
      return "New tickets";
  }
}

export function ctaLabel(locale: "en" | "sl") {
  return locale === "sl" ? "Odpri portal" : "Open in portal";
}

export function footerNote(locale: "en" | "sl") {
  return locale === "sl"
    ? "To sporočilo dobiš, ker imaš dostop do portala."
    : "You’re receiving this because you have portal access.";
}

export function needsInputLine(locale: "en" | "sl") {
  return locale === "sl"
    ? "Potrebujemo tvoj input na tem ticketu."
    : "We need your input on this ticket.";
}

export function moreMessagesLabel(locale: "en" | "sl", n: number) {
  return locale === "sl" ? `+${n} več` : `+${n} more`;
}

export function bulkTicketsLabel(locale: "en" | "sl", count: number) {
  return locale === "sl"
    ? `${count} novih ticketov`
    : `${count} new tickets`;
}
