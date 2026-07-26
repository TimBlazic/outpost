"use server";

import { sendStudioEmail, type SendStudioEmailInput } from "./resend";

export async function sendStudioEmailAction(input: SendStudioEmailInput) {
  return sendStudioEmail(input);
}
