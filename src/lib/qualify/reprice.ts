import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";

import { addActivity } from "@/lib/actions";
import { DEFAULT_AI_QUALIFY_PRICING_PROMPT } from "@/lib/ai/default-qualify-pricing";
import type { Lead } from "@/lib/data";
import { getFirmSettings, getLeadById, getLeads, saveLeads } from "@/lib/store";

import { clampSloveniaDealValue } from "./value";

function modelId() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
}

function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in model response");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function canReprice(lead: Lead) {
  return Boolean(lead.company?.trim() || lead.description?.trim());
}

export async function estimateLeadDealValue(input: {
  lead: Lead;
  pricingGuidance: string;
}): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing. Add it to .env.local for reprice."
    );
  }

  const guidance =
    input.pricingGuidance.trim() || DEFAULT_AI_QUALIFY_PRICING_PROMPT;
  const description = (input.lead.description ?? "").trim().slice(0, 3500);

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: modelId(),
    max_tokens: 200,
    system: `You estimate a realistic deal value (EUR) for a Slovenia solo studio website / related job.
Return ONLY valid JSON: { "value": number }.
Use the studio pricing guidance strictly. Default to the SIMPLE/LOW band unless the notes clearly prove mid or complex work.
NOT US/EU agency rates. If unsure, pick the LOWER number. value must be > 0.

Studio pricing guidance:
${guidance}`,
    messages: [
      {
        role: "user",
        content: [
          `Company: ${input.lead.company || "(unknown)"}`,
          `Category: ${input.lead.category}`,
          `Website: ${input.lead.website?.trim() || "(none)"}`,
          "Do NOT anchor on any previous CRM price — re-estimate from scratch.",
          description
            ? `Research / notes:\n${description}`
            : "Research / notes: (none) — assume a simple local marketing site unless category implies otherwise.",
        ].join("\n"),
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const data = parseJsonObject(text);
  const raw = Number(data.value);
  return clampSloveniaDealValue(
    Number.isFinite(raw) ? raw : 0,
    input.lead.category
  );
}

export async function bulkRepriceLeads(ids: string[]): Promise<{
  updated: number;
  skipped: number;
  failed: number;
}> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return { updated: 0, skipped: 0, failed: 0 };

  const settings = await getFirmSettings();
  const pricingGuidance = settings.aiQualifyPricingPrompt;

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of unique) {
    const lead = await getLeadById(id);
    if (!lead || !canReprice(lead)) {
      skipped += 1;
      continue;
    }

    try {
      const nextValue = await estimateLeadDealValue({
        lead,
        pricingGuidance,
      });
      if (nextValue <= 0) {
        failed += 1;
        continue;
      }

      const prev = lead.value;
      if (prev === nextValue) {
        updated += 1;
        continue;
      }

      const leads = await getLeads();
      await saveLeads(
        leads.map((l) => (l.id === id ? { ...l, value: nextValue } : l))
      );
      await addActivity(id, {
        type: "note",
        title: "AI reprice",
        detail: `${prev || 0} → ${nextValue} EUR`,
      });
      updated += 1;
    } catch (err) {
      console.error("[reprice] failed", id, err);
      failed += 1;
    }
  }

  revalidatePath("/leads");
  revalidatePath("/");
  return { updated, skipped, failed };
}
