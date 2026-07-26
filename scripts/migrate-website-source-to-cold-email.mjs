#!/usr/bin/env node
/**
 * Flip mislabeled lead sources: Website → Cold email.
 *
 * Keeps real inbound form leads (tag `from-website`, description with
 * "Website inquiry", or created_by = website). Everything else with
 * source Website becomes Cold email (Hunt / manual mistakes).
 *
 * Usage:
 *   node scripts/migrate-website-source-to-cold-email.mjs
 *   node scripts/migrate-website-source-to-cold-email.mjs --dry-run
 *   node scripts/migrate-website-source-to-cold-email.mjs --all
 *     (--all also flips true inbound Website leads)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DRY = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");

function loadEnvLocal() {
  const path = resolve(ROOT, ".env.local");
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error("Missing .env.local");
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function isRealWebsiteInbound(lead) {
  const tags = Array.isArray(lead.tags) ? lead.tags : [];
  if (tags.includes("from-website")) return true;
  if (lead.created_by === "website") return true;
  const desc = String(lead.description ?? "");
  if (desc.includes("Website inquiry")) return true;
  return false;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await supabase
    .from("leads")
    .select("id, company, source, tags, description, created_by")
    .eq("source", "Website");
  if (error) throw error;

  const targets = (rows ?? []).filter(
    (lead) => ALL || !isRealWebsiteInbound(lead)
  );
  const kept = (rows ?? []).length - targets.length;

  console.log(
    `${DRY ? "[dry-run] " : ""}Website leads: ${rows?.length ?? 0}` +
      ` · migrate → Cold email: ${targets.length}` +
      (ALL ? " (--all)" : ` · keep as Website: ${kept}`)
  );

  for (const lead of targets) {
    console.log(`  ${lead.id}  ${lead.company || "(no company)"}`);
  }

  if (DRY || !targets.length) return;

  const ids = targets.map((l) => l.id);
  const { error: updErr } = await supabase
    .from("leads")
    .update({ source: "Cold email" })
    .in("id", ids);
  if (updErr) throw updErr;

  console.log(`Updated ${ids.length} lead(s) to Cold email.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
