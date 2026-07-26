import type { Lead } from "@/lib/data";

/** Hard ceiling so AI cannot stick agency-sized deal values. */
export function clampSloveniaDealValue(
  value: number,
  category: Lead["category"]
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const localish = [
    "Local business",
    "Restaurant",
    "Healthcare",
    "Real estate",
  ].includes(category);
  // Local / simple verticals stay in the common SI brochure band.
  const max = localish ? 2200 : 3500;
  const min = 500;
  return Math.round(Math.min(max, Math.max(min, value)));
}
