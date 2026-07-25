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
  };
}): string {
  const lines: string[] = [];

  lines.push(`## Site`);
  lines.push(`- URL: ${input.website}`);
  if (input.site.title) lines.push(`- Title: ${input.site.title}`);
  if (input.site.description) {
    lines.push(`- Meta: ${input.site.description}`);
  }
  if (input.site.emails.length) {
    lines.push(`- Emails: ${input.site.emails.join(", ")}`);
  }
  if (input.site.phones.length) {
    lines.push(`- Phones: ${input.site.phones.join(", ")}`);
  }
  if (input.site.error) lines.push(`- Fetch note: ${input.site.error}`);
  if (input.site.excerpt) {
    lines.push("");
    lines.push(input.site.excerpt);
  }

  lines.push("");
  lines.push(`## Company identity`);
  lines.push(`- Name: ${input.identity.companyName}`);
  if (input.identity.tradeName) {
    lines.push(`- Trade / brand: ${input.identity.tradeName}`);
  }
  lines.push(
    `- Source: ${input.identity.source} · confidence ${input.identity.confidence}/100`
  );
  if (input.identity.notes) {
    lines.push(`- Notes: ${input.identity.notes}`);
  }

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

  lines.push("");
  lines.push(`## Companywall`);
  if (input.companywall.status === "ok") {
    if (input.companywall.matchedName) {
      lines.push(`- Company: ${input.companywall.matchedName}`);
    }
    if (input.companywall.url) {
      lines.push(`- Source: ${input.companywall.url}`);
    }
    if (input.companywall.confidence != null) {
      lines.push(`- Match confidence: ${input.companywall.confidence}/100`);
    }
    if (input.companywall.year) {
      lines.push(`- Year: ${input.companywall.year}`);
    }
    if (input.companywall.revenue) {
      lines.push(`- Revenue: ${input.companywall.revenue}`);
    }
    if (input.companywall.profit) {
      lines.push(`- Profit: ${input.companywall.profit}`);
    }
    if (input.companywall.email) {
      lines.push(`- Email: ${input.companywall.email}`);
    }
    if (input.companywall.phone) {
      lines.push(`- Phone: ${input.companywall.phone}`);
    }
    if (input.companywall.address) {
      lines.push(`- Address: ${input.companywall.address}`);
    }
    if (input.companywall.owner) {
      lines.push(`- Owner: ${input.companywall.owner}`);
    }
  } else {
    lines.push(
      `- Status: ${input.companywall.status}${input.companywall.error ? ` (${input.companywall.error})` : ""}`
    );
    if (input.companywall.candidates?.length) {
      for (const c of input.companywall.candidates) {
        lines.push(`- Candidate: ${c.name} (${c.score}) — ${c.url}`);
      }
    }
  }

  lines.push("");
  lines.push(`## AI verdict: ${input.verdict.rating}`);
  for (const reason of input.verdict.reasons) {
    lines.push(`- ${reason}`);
  }
  if (input.verdict.notesMarkdown.trim()) {
    lines.push("");
    lines.push(input.verdict.notesMarkdown.trim());
  }

  return lines.join("\n").trim() + "\n";
}
