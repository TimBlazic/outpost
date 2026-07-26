/** Structured payloads stored in Activity.detail (JSON). Legacy plain text still works. */

export type EmailActivityPayload = {
  kind: "email";
  to: string;
  subject: string;
  body: string;
  followUpOn?: string | null;
};

export type ParsedActivityDetail =
  | EmailActivityPayload
  | { kind: "text"; text: string };

export function encodeEmailActivityDetail(
  payload: Omit<EmailActivityPayload, "kind">
): string {
  const data: EmailActivityPayload = { kind: "email", ...payload };
  return JSON.stringify(data);
}

export function parseActivityDetail(
  detail: string | undefined | null
): ParsedActivityDetail | null {
  if (!detail?.trim()) return null;
  const raw = detail.trim();
  if (raw.startsWith("{")) {
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (data.kind === "email") {
        return {
          kind: "email",
          to: String(data.to ?? ""),
          subject: String(data.subject ?? ""),
          body: String(data.body ?? ""),
          followUpOn:
            data.followUpOn == null ? null : String(data.followUpOn),
        };
      }
    } catch {
      // fall through to plain text
    }
  }
  return { kind: "text", text: raw };
}

/** One-line preview for the timeline (never dump JSON). */
export function activityDetailPreview(detail: string | undefined): string | null {
  const parsed = parseActivityDetail(detail);
  if (!parsed) return null;
  if (parsed.kind === "email") {
    const bits = [
      parsed.to ? `To ${parsed.to}` : null,
      parsed.followUpOn ? `Follow-up ${parsed.followUpOn}` : null,
    ].filter(Boolean);
    return bits.join(" · ") || null;
  }
  const text = parsed.text.replace(/\s+/g, " ").trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}…`;
}
