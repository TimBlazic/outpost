"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Pencil,
  Sparkles,
} from "lucide-react";

import { QualifyScoreDonut } from "@/components/qualify-score-donut";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadCategories, leadStatuses, type LeadStatus } from "@/lib/data";
import {
  reviseQualifyDraftAction,
  runLeadQualifyAction,
  saveQualifiedLeadAction,
} from "@/lib/qualify/actions";
import { compileResearchMarkdown } from "@/lib/qualify/research-markdown";
import { computeFitScore } from "@/lib/qualify/score";
import type { QualifyResult } from "@/lib/qualify/types";
import { cn } from "@/lib/utils";

const STEPS = [
  "Site",
  "Lighthouse",
  "Companywall",
  "Verdict",
  "Draft",
] as const;

function mailtoHref(subject: string, body: string) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-center">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-base font-semibold tabular-nums">
        {typeof value === "number" ? value : "—"}
      </p>
    </div>
  );
}

export function LeadQualifyWizard({
  initialUrl = "",
  onClose,
}: {
  initialUrl?: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [websiteUrl, setWebsiteUrl] = useState(initialUrl);
  const [companywallUrl, setCompanywallUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "review">("idle");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QualifyResult | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");

  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] =
    useState<(typeof leadCategories)[number]>("Local business");
  const [status, setStatus] = useState<LeadStatus>("Researching");
  const [value, setValue] = useState(0);
  const [description, setDescription] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [cwRevenue, setCwRevenue] = useState("");
  const [cwProfit, setCwProfit] = useState("");
  const [cwYear, setCwYear] = useState("");
  const [cwUrl, setCwUrl] = useState("");

  const fitScore = useMemo(
    () => (result ? computeFitScore(result) : 0),
    [result]
  );

  function applyResult(r: QualifyResult) {
    setResult(r);
    setCompany(r.suggested.company);
    setWebsite(r.website);
    setContact(r.suggested.contact);
    setEmail(r.suggested.email);
    setPhone(r.suggested.phone);
    setCountry(r.suggested.country);
    setCategory(r.suggested.category);
    setStatus(r.suggested.status);
    setValue(r.suggested.value);
    setDescription(r.suggested.description);
    setDraftSubject(r.draft.subject);
    setDraftBody(r.draft.body);
    setCwRevenue(r.companywall.revenue ?? "");
    setCwProfit(r.companywall.profit ?? "");
    setCwYear(r.companywall.year ?? "");
    setCwUrl(r.companywall.url ?? "");
    setEditing(false);
    setPhase("review");
  }

  function descriptionWithFinance() {
    if (!result) return description;
    const companywall = {
      ...result.companywall,
      status:
        cwRevenue || cwProfit || cwUrl
          ? ("ok" as const)
          : result.companywall.status,
      revenue: cwRevenue || undefined,
      profit: cwProfit || undefined,
      year: cwYear || undefined,
      url: cwUrl || result.companywall.url,
    };
    return compileResearchMarkdown({
      website,
      site: result.site,
      lighthouse: result.lighthouse,
      companywall,
      verdict: result.verdict,
    });
  }

  function run() {
    setError(null);
    setPhase("running");
    startTransition(async () => {
      try {
        const r = await runLeadQualifyAction({
          websiteUrl,
          companywallUrl: companywallUrl.trim() || undefined,
        });
        applyResult(r);
      } catch (e) {
        setPhase("idle");
        setError(e instanceof Error ? e.message : "Qualify failed");
      }
    });
  }

  function reviseDraft() {
    if (!result) return;
    setError(null);
    startTransition(async () => {
      try {
        const draft = await reviseQualifyDraftAction({
          website,
          suggested: {
            ...result.suggested,
            company,
            contact,
            email,
            phone,
            country,
            category,
            value,
            description,
            status,
          },
          draft: { subject: draftSubject, body: draftBody },
          revisionNotes,
        });
        setDraftSubject(draft.subject);
        setDraftBody(draft.body);
        setRevisionNotes("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Revise failed");
      }
    });
  }

  function save(openMail: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const research = descriptionWithFinance();
        setDescription(research);
        const { leadId } = await saveQualifiedLeadAction({
          company,
          website,
          contact,
          email,
          phone,
          country,
          category,
          status,
          value,
          description: research,
          draftSubject,
          draftBody,
          saveDraftNote: true,
        });
        onClose?.();
        if (openMail) {
          window.location.href = mailtoHref(draftSubject, draftBody);
        }
        router.push(`/leads/${leadId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  const verdictTone = useMemo(() => {
    const r = result?.verdict.rating;
    if (r === "go")
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    if (r === "no-go")
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  }, [result?.verdict.rating]);

  if (phase === "running") {
    return (
      <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-5 px-6 py-10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin" />
          Running research…
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {STEPS.map((step) => (
            <li key={step} className="flex items-center gap-2">
              <Sparkles className="size-3.5 opacity-50" />
              {step}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Typically 30–45s. PageSpeed can take a bit longer.
        </p>
      </div>
    );
  }

  if (phase === "review" && result) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
          {/* Hero score */}
          <div className="mb-8 flex flex-col items-center gap-4 border-b border-border/60 pb-8 sm:flex-row sm:items-start sm:gap-8">
            <QualifyScoreDonut score={fitScore} />
            <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h2 className="app-display text-2xl italic tracking-tight sm:text-3xl">
                  {company || "Untitled company"}
                </h2>
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  {website}
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    verdictTone
                  )}
                >
                  {result.verdict.rating}
                </span>
                <span className="text-sm text-muted-foreground">
                  {status} · {category}
                  {value ? ` · ~€${value}` : ""}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.verdict.reasons.slice(0, 4).map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground/40" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              type="button"
              variant={editing ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="size-3.5" />
              {editing ? "Done editing" : "Edit"}
            </Button>
          </div>

          {result.duplicateLeadId ? (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                A lead with this website already exists.{" "}
                <Link
                  href={`/leads/${result.duplicateLeadId}`}
                  className="font-medium underline underline-offset-2"
                  onClick={() => onClose?.()}
                >
                  Open existing lead
                </Link>
              </p>
            </div>
          ) : null}

          {!editing ? (
            <div className="space-y-8">
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Contact" value={contact} />
                <Field label="Email" value={email} />
                <Field label="Phone" value={phone} />
                <Field label="Country" value={country} />
                <Field label="Category" value={category} />
                <Field
                  label="Est. value"
                  value={value ? `€${value}` : "—"}
                />
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="mb-3 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                    Lighthouse
                  </p>
                  {result.lighthouse.status === "ok" ? (
                    <div className="grid grid-cols-4 gap-2">
                      <ScorePill
                        label="Perf"
                        value={result.lighthouse.performance}
                      />
                      <ScorePill label="SEO" value={result.lighthouse.seo} />
                      <ScorePill
                        label="A11y"
                        value={result.lighthouse.accessibility}
                      />
                      <ScorePill
                        label="BP"
                        value={result.lighthouse.bestPractices}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {result.lighthouse.status}
                      {result.lighthouse.error
                        ? ` — ${result.lighthouse.error}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="mb-3 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                    Companywall
                  </p>
                  {result.companywall.status === "ok" ||
                  cwRevenue ||
                  cwProfit ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {result.companywall.matchedName ? (
                        <div className="sm:col-span-3">
                          <Field
                            label="Matched company"
                            value={`${result.companywall.matchedName}${
                              result.companywall.confidence != null
                                ? ` · ${result.companywall.confidence}/100`
                                : ""
                            }`}
                          />
                        </div>
                      ) : null}
                      <Field label="Revenue" value={cwRevenue || "—"} />
                      <Field label="Profit" value={cwProfit || "—"} />
                      <Field label="Year" value={cwYear || "—"} />
                      {result.companywall.email ? (
                        <Field label="Email" value={result.companywall.email} />
                      ) : null}
                      {result.companywall.phone ? (
                        <Field label="Phone" value={result.companywall.phone} />
                      ) : null}
                      {result.companywall.address ? (
                        <div className="sm:col-span-3">
                          <Field
                            label="Address"
                            value={result.companywall.address}
                          />
                        </div>
                      ) : null}
                      {cwUrl ? (
                        <div className="sm:col-span-3">
                          <a
                            href={cwUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          >
                            Open Companywall
                            <ExternalLink className="size-3.5" />
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {result.companywall.status}
                        {result.companywall.error
                          ? ` — ${result.companywall.error}`
                          : ""}
                        . Paste the correct Companywall URL below, or use Edit
                        for figures.
                      </p>
                      {result.companywall.candidates?.length ? (
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {result.companywall.candidates.map((c) => (
                            <li key={c.url}>
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline-offset-2 hover:underline"
                              >
                                {c.name}
                              </a>
                              <span className="text-muted-foreground/70">
                                {" "}
                                · {c.score}/100
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </div>
              </section>

              {result.verdict.notesMarkdown ? (
                <section className="rounded-xl border border-border/60 p-4">
                  <p className="mb-2 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                    Notes
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {result.verdict.notesMarkdown}
                  </p>
                </section>
              ) : null}

              <section className="rounded-xl border border-border/60 p-4">
                <p className="mb-2 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                  Cold email draft
                </p>
                <p className="text-sm font-semibold">{draftSubject}</p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                  {draftBody}
                </pre>
              </section>

              <details className="rounded-xl border border-border/60 p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Full research notes
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {description}
                </pre>
              </details>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="q-company">Company</Label>
                    <Input
                      id="q-company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="q-website">Website</Label>
                    <Input
                      id="q-website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-contact">Contact</Label>
                    <Input
                      id="q-contact"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-email">Email</Label>
                    <Input
                      id="q-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-phone">Phone</Label>
                    <Input
                      id="q-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-country">Country</Label>
                    <Input
                      id="q-country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-category">Category</Label>
                    <Select
                      id="q-category"
                      value={category}
                      onChange={(e) =>
                        setCategory(
                          e.target.value as (typeof leadCategories)[number]
                        )
                      }
                    >
                      {leadCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-status">Status</Label>
                    <Select
                      id="q-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as LeadStatus)}
                    >
                      {leadStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-value">Est. value (€)</Label>
                    <Input
                      id="q-value"
                      type="number"
                      value={value}
                      onChange={(e) => setValue(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="q-description">Research</Label>
                  <Textarea
                    id="q-description"
                    rows={10}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 p-4">
                  <p className="text-sm font-semibold">Cold email draft</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-subject">Subject</Label>
                    <Input
                      id="q-subject"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-body">Body</Label>
                    <Textarea
                      id="q-body"
                      rows={8}
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[12rem] flex-1 space-y-1.5">
                      <Label htmlFor="q-revise">Revise notes</Label>
                      <Input
                        id="q-revise"
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        placeholder="Shorter, more direct…"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending || !revisionNotes.trim()}
                      onClick={reviseDraft}
                    >
                      Revise email
                    </Button>
                  </div>
                </div>
              </div>

              <aside className="space-y-3">
                <div className="space-y-2 rounded-xl border border-border/70 p-4">
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    Companywall paste
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="cw-url">URL</Label>
                    <Input
                      id="cw-url"
                      value={cwUrl}
                      onChange={(e) => setCwUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cw-rev">Revenue</Label>
                    <Input
                      id="cw-rev"
                      value={cwRevenue}
                      onChange={(e) => setCwRevenue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cw-profit">Profit</Label>
                    <Input
                      id="cw-profit"
                      value={cwProfit}
                      onChange={(e) => setCwProfit(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cw-year">Year</Label>
                    <Input
                      id="cw-year"
                      value={cwYear}
                      onChange={(e) => setCwYear(e.target.value)}
                    />
                  </div>
                </div>
              </aside>
            </div>
          )}

          {error ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-border/70 bg-background/90 px-5 py-3 backdrop-blur sm:px-8">
          <Button type="button" disabled={pending} onClick={() => save(false)}>
            Save lead
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => save(true)}
          >
            Save + open mail
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setPhase("idle");
              setResult(null);
              setEditing(false);
              setError(null);
            }}
          >
            Discard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[16rem] flex-col justify-center px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Qualify a website</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Research, score fit, and draft a cold email — then save.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qualify-url">Website URL</Label>
          <Input
            id="qualify-url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.si"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && websiteUrl.trim()) run();
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qualify-cw">Companywall URL (optional)</Label>
          <Input
            id="qualify-cw"
            value={companywallUrl}
            onChange={(e) => setCompanywallUrl(e.target.value)}
            placeholder="https://www.companywall.si/podjetje/…"
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={pending || !websiteUrl.trim()}
          onClick={run}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Running…
            </>
          ) : (
            "Run research"
          )}
        </Button>
      </div>
    </div>
  );
}
