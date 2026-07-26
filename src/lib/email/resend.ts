import { revalidatePath } from "next/cache";
import { Resend } from "resend";

import { encodeEmailActivityDetail } from "@/lib/activity-detail";
import { getCurrentUserId, requireStudioSession } from "@/lib/auth/session";
import type { Activity } from "@/lib/data";
import {
  getActivities,
  getFirmSettings,
  getLeads,
  saveActivities,
  saveLeads,
} from "@/lib/store";
import { appendStudioEmailSignature } from "./signature";

/** Default days until next follow-up after a studio send. */
const FOLLOW_UP_DAYS = 3;

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

function followUpDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type StudioEmailAttachment = {
  filename: string;
  /** Raw bytes or base64 string (Resend accepts both). */
  content: Buffer | Uint8Array | string;
  contentType?: string;
};

export type SendStudioEmailInput = {
  to: string;
  subject: string;
  body: string;
  /** When set, logs activity + sets next follow-up on the lead. */
  leadId?: string | null;
  /** Override follow-up offset; default 3 days. Null = don't change follow-up. */
  followUpInDays?: number | null;
  attachments?: StudioEmailAttachment[];
};

export async function sendStudioEmail(
  input: SendStudioEmailInput
): Promise<{ id: string; followUpOn: string | null }> {
  await requireStudioSession();

  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!isEmail(to)) {
    throw new Error("Enter a valid recipient email");
  }
  if (!subject) {
    throw new Error("Subject is required");
  }
  if (!body) {
    throw new Error("Body is required");
  }

  const settings = await getFirmSettings();
  const fromName = settings.outboundFromName.trim() || "Tim";
  const fromEmail = settings.outboundFromEmail.trim() || "tim@timblazic.dev";
  if (!isEmail(fromEmail)) {
    throw new Error("Fix outbound From email in Settings → Email");
  }

  const from = `${fromName} <${fromEmail}>`;
  // Resend doesn't land in Gmail/Mail "Sent" — BCC yourself so a copy shows in Inbox.
  const bcc =
    fromEmail.toLowerCase() !== to.toLowerCase() ? [fromEmail] : undefined;

  const signed = appendStudioEmailSignature(body);

  const attachments = (input.attachments ?? []).map((a) => ({
    filename: a.filename,
    content:
      typeof a.content === "string"
        ? a.content
        : Buffer.from(a.content).toString("base64"),
    contentType: a.contentType,
  }));

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    ...(bcc ? { bcc } : {}),
    replyTo: fromEmail,
    subject,
    text: signed.text,
    html: signed.html,
    ...(attachments.length ? { attachments } : {}),
  });

  if (error) {
    throw new Error(error.message || "Resend failed");
  }
  if (!data?.id) {
    throw new Error("Resend did not return a message id");
  }

  let followUpOn: string | null = null;

  if (input.leadId) {
    const me = await getCurrentUserId();
    const now = new Date().toISOString().slice(0, 10);
    const days =
      input.followUpInDays === undefined
        ? FOLLOW_UP_DAYS
        : input.followUpInDays;
    followUpOn = typeof days === "number" ? followUpDate(days) : null;

    if (followUpOn) {
      const leads = await getLeads();
      await saveLeads(
        leads.map((l) =>
          l.id === input.leadId
            ? {
                ...l,
                lastContact: now,
                firstContact: l.firstContact ?? now,
                nextFollowUp: followUpOn,
              }
            : l
        )
      );
    }

    const activities = await getActivities();
    const activity: Activity = {
      id: `a_${Math.random().toString(36).slice(2, 9)}`,
      leadId: input.leadId,
      type: "email",
      title: `Email sent: ${subject}`,
      detail: encodeEmailActivityDetail({
        to,
        subject,
        body: signed.text,
        followUpOn,
      }),
      date: now,
      userId: me,
    };
    await saveActivities([activity, ...activities]);
    revalidatePath("/leads");
    revalidatePath(`/leads/${input.leadId}`);
    revalidatePath("/");
  }

  return { id: data.id, followUpOn };
}
