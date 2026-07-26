import { Resend } from "resend";

import { getFirmSettings } from "@/lib/store";

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is missing. Add it to .env.local to send email."
    );
  }
  return new Resend(key);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Client notification send — firm From, no studio signature, no BCC. */
export async function sendPortalNotificationEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  const to = input.to.trim().toLowerCase();
  const subject = input.subject.trim();
  if (!isEmail(to)) throw new Error("Invalid recipient email");
  if (!subject) throw new Error("Subject is required");
  if (!input.html.trim() && !input.text.trim()) {
    throw new Error("Body is required");
  }

  const settings = await getFirmSettings();
  const fromName = settings.outboundFromName.trim() || "Tim";
  const fromEmail = settings.outboundFromEmail.trim() || "tim@timblazic.dev";
  if (!isEmail(fromEmail)) {
    throw new Error("Fix outbound From email in Settings → Email");
  }

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    replyTo: fromEmail,
    subject,
    html: input.html,
    text: input.text,
  });

  if (error) throw new Error(error.message || "Resend failed");
  if (!data?.id) throw new Error("Resend did not return a message id");
  return { id: data.id };
}
