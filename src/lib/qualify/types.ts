import type { Lead, LeadStatus } from "@/lib/data";

export type QualifyRating = "go" | "maybe" | "no-go";

export type QualifySiteResult = {
  title: string | null;
  description: string | null;
  /** Best-effort brand / company name from the site itself. */
  companyNameHint: string | null;
  excerpt: string;
  emails: string[];
  phones: string[];
  error?: string;
};

export type QualifyLighthouseResult = {
  status: "ok" | "skipped" | "fail";
  performance?: number;
  seo?: number;
  accessibility?: number;
  bestPractices?: number;
  error?: string;
};

export type QualifyCompanywallResult = {
  status: "ok" | "skipped" | "fail";
  url?: string;
  matchedName?: string;
  revenue?: string;
  profit?: string;
  year?: string;
  email?: string;
  phone?: string;
  address?: string;
  owner?: string;
  /** 0–100 match confidence when auto-searched. */
  confidence?: number;
  matchMethod?: string;
  candidates?: { name: string; url: string; score: number }[];
  error?: string;
};

export type QualifyResult = {
  website: string;
  site: QualifySiteResult;
  lighthouse: QualifyLighthouseResult;
  companywall: QualifyCompanywallResult;
  verdict: {
    rating: QualifyRating;
    reasons: string[];
    notesMarkdown: string;
  };
  draft: { subject: string; body: string };
  suggested: {
    company: string;
    contact: string;
    email: string;
    phone: string;
    country: string;
    category: Lead["category"];
    source: "Cold email";
    value: number;
    description: string;
    status: LeadStatus;
  };
  duplicateLeadId: string | null;
};
