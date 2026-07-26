const SITE_URL = "https://timblazic.dev";
const SITE_LABEL = "timblazic.dev";

/** Appended only on Resend sends — not on mailto / Open in mail. */
export const STUDIO_EMAIL_SIGNATURE_TEXT = [
  "Tim Blažič",
  SITE_LABEL,
  "Programiranje, Tim Blažič s.p.",
].join("\n");

export function appendStudioEmailSignature(body: string): {
  text: string;
  html: string;
} {
  const trimmed = body.trimEnd();
  const text = `${trimmed}\n\n${STUDIO_EMAIL_SIGNATURE_TEXT}`;
  const htmlBody = escapeHtml(trimmed).replace(/\n/g, "<br />\n");
  const html = [
    `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5;color:#111">`,
    `<div>${htmlBody}</div>`,
    `<div style="margin-top:1.25em">`,
    `Tim Blažič<br />`,
    `<a href="${SITE_URL}" style="color:#2563eb;text-decoration:underline">${SITE_LABEL}</a><br />`,
    `Programiranje, Tim Blažič s.p.`,
    `</div>`,
    `</div>`,
  ].join("");
  return { text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
