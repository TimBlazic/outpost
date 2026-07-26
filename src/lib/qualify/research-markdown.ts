import type {
  QualifyCompanywallResult,
  QualifyIdentityResult,
  QualifyLighthouseResult,
  QualifySiteResult,
  QualifyRating,
} from "./types";

export function compileResearchMarkdown(input: {
  website: string;
  site: QualifySiteResult;
  identity: QualifyIdentityResult;
  lighthouse: QualifyLighthouseResult;
  companywall: QualifyCompanywallResult;
  verdict: {
    rating: QualifyRating;
    reasons: string[];
    notesMarkdown: string;
    businessSummary: string;
    offerIdeas: string[];
  };
}): string {
  const lines: string[] = [];

  // 1) AI verdict first
  lines.push(`## AI verdict: ${input.verdict.rating}`);
  for (const reason of input.verdict.reasons) {
    lines.push(`- ${reason}`);
  }
  if (input.verdict.notesMarkdown.trim()) {
    lines.push("");
    lines.push(input.verdict.notesMarkdown.trim());
  }

  // 2) What the company does
  lines.push("");
  lines.push(`## What they do`);
  if (input.verdict.businessSummary.trim()) {
    lines.push(input.verdict.businessSummary.trim());
  } else if (input.site.description) {
    lines.push(input.site.description);
  } else {
    lines.push(
      input.website.trim()
        ? "_No clear business summary from the site._"
        : "_No website — summary inferred from company / Companywall._"
    );
  }
  lines.push("");
  lines.push(`- Company: ${input.identity.companyName}`);
  if (input.identity.tradeName) {
    lines.push(`- Brand: ${input.identity.tradeName}`);
  }
  if (input.site.title) lines.push(`- Site title: ${input.site.title}`);
  lines.push(
    input.website.trim()
      ? `- URL: ${input.website}`
      : "- URL: _(no website)_"
  );
  if (input.site.emails.length) {
    lines.push(`- Emails: ${input.site.emails.join(", ")}`);
  }
  if (input.site.phones.length) {
    lines.push(`- Phones: ${input.site.phones.join(", ")}`);
  }
  if (input.companywall.status === "ok") {
    if (input.companywall.matchedName) {
      lines.push(`- Companywall: ${input.companywall.matchedName}`);
    }
    if (input.companywall.revenue) {
      lines.push(`- Revenue: ${input.companywall.revenue}`);
    }
    if (input.companywall.profit) {
      lines.push(`- Profit: ${input.companywall.profit}`);
    }
    if (input.companywall.year) {
      lines.push(`- Year: ${input.companywall.year}`);
    }
  }

  // 3) Lighthouse
  lines.push("");
  lines.push(`## Lighthouse (mobile)`);
  if (input.lighthouse.status === "ok") {
    lines.push(
      `- Performance: ${input.lighthouse.performance ?? "—"} · SEO: ${input.lighthouse.seo ?? "—"} · A11y: ${input.lighthouse.accessibility ?? "—"} · Best practices: ${input.lighthouse.bestPractices ?? "—"}`
    );
  } else {
    lines.push(
      `- Status: ${input.lighthouse.status}${input.lighthouse.error ? ` (${input.lighthouse.error})` : ""}`
    );
  }

  // 4) What I can offer
  lines.push("");
  lines.push(`## What I can offer`);
  if (input.verdict.offerIdeas.length) {
    for (const idea of input.verdict.offerIdeas) {
      lines.push(`- ${idea}`);
    }
  } else {
    lines.push("- Website redesign / new marketing site");
    lines.push("- Custom admin panel");
    lines.push("- Newsletter / email setup");
  }

  return lines.join("\n").trim() + "\n";
}
