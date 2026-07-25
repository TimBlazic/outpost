import type { QualifyResult } from "./types";

/** 0–100 “is this worth pursuing?” — higher = better redesign lead. */
export function computeFitScore(r: QualifyResult): number {
  let score =
    r.verdict.rating === "go" ? 82 : r.verdict.rating === "maybe" ? 55 : 22;

  if (r.lighthouse.status === "ok") {
    const vals = [
      r.lighthouse.performance,
      r.lighthouse.seo,
      r.lighthouse.accessibility,
      r.lighthouse.bestPractices,
    ].filter((n): n is number => typeof n === "number");
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      // Weaker site → stronger redesign opportunity
      if (avg < 45) score += 10;
      else if (avg < 65) score += 4;
      else if (avg > 85) score -= 12;
      else if (avg > 75) score -= 6;
    }
  } else {
    score -= 3;
  }

  if (r.identity.source === "ai" && r.identity.confidence >= 70) score += 2;

  if (r.companywall.status === "ok") {
    if (r.companywall.revenue || r.companywall.profit) score += 6;
    else score += 2;
    if ((r.companywall.confidence ?? 100) >= 80) score += 2;
    if (r.companywall.email || r.companywall.phone) score += 1;
  } else if (r.companywall.status === "fail") {
    score -= 4;
  }

  if (r.site.emails.length > 0 || r.companywall.email) score += 2;
  if (r.site.error) score -= 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function fitScoreLabel(score: number): string {
  if (score >= 75) return "Strong fit";
  if (score >= 50) return "Maybe";
  if (score >= 30) return "Weak";
  return "Skip";
}
