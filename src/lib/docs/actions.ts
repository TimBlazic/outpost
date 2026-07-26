"use server";

import { requireStudioSession } from "@/lib/auth/session";
import type { DocCategory } from "@/lib/data";
import { generateDocDraft, type DocAiDraft } from "@/lib/docs/ai";

export async function generateDocDraftAction(input: {
  notes: string;
  category: DocCategory;
  title?: string | null;
  existingBody?: string | null;
}): Promise<DocAiDraft> {
  await requireStudioSession();
  return generateDocDraft(input);
}
