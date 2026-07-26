"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Plus, Sparkles, Trash2 } from "lucide-react";

import type { Quote, QuoteLineItem } from "@/lib/data";
import { computeQuoteTotals } from "@/lib/data";
import {
  createQuote,
  generateQuoteDraftAction,
  updateQuote,
  type QuoteInput,
} from "@/lib/quotes/actions";
import { eur } from "@/lib/format";
import {
  LeadSearchPicker,
  type LeadSearchPickerValue,
} from "@/components/lead-search-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EditorLine = { description: string; amount: string };

function emptyLine(): EditorLine {
  return { description: "", amount: "" };
}

function parseAmount(value: string) {
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function toLines(items: QuoteLineItem[]): EditorLine[] {
  if (!items.length) return [emptyLine()];
  return items.map((i) => ({
    description: i.description,
    amount: i.amount ? String(i.amount) : "",
  }));
}

function toInput(lines: EditorLine[]): QuoteLineItem[] {
  return lines
    .map((l) => ({
      description: l.description.trim(),
      amount: parseAmount(l.amount),
    }))
    .filter((l) => l.description);
}

export function QuoteEditor({
  mode,
  quote,
  initialLead,
  initial,
}: {
  mode: "create" | "edit";
  quote?: Quote;
  initialLead?: LeadSearchPickerValue | null;
  initial?: {
    clientName?: string;
    clientCompany?: string;
    clientEmail?: string;
    discoveryNotes?: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selectedLead, setSelectedLead] = useState<LeadSearchPickerValue | null>(
    initialLead ?? null
  );
  const [locale, setLocale] = useState<"sl" | "en">(quote?.locale ?? "sl");
  const [clientName, setClientName] = useState(
    quote?.clientName ?? initial?.clientName ?? ""
  );
  const [clientCompany, setClientCompany] = useState(
    quote?.clientCompany ?? initial?.clientCompany ?? ""
  );
  const [clientEmail, setClientEmail] = useState(
    quote?.clientEmail ?? initial?.clientEmail ?? ""
  );
  const [dump, setDump] = useState(
    quote?.discoveryNotes ?? initial?.discoveryNotes ?? ""
  );
  const [scope, setScope] = useState(quote?.scope ?? "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? "");
  const [projectDuration, setProjectDuration] = useState(
    quote?.projectDuration ?? ""
  );
  const [lines, setLines] = useState<EditorLine[]>(
    toLines(quote?.lineItems ?? [])
  );

  const totals = computeQuoteTotals(toInput(lines));
  const hasGenerated = Boolean(scope.trim() || toInput(lines).length);

  const backHref =
    mode === "edit" && quote ? `/quotes/${quote.id}` : "/quotes";
  const title = mode === "edit" ? "Edit quote" : "New quote";

  function onLeadChange(lead: LeadSearchPickerValue | null) {
    setSelectedLead(lead);
    if (!lead) return;
    setClientName(lead.contact || "");
    setClientCompany(lead.company || "");
    setClientEmail(lead.email || "");
  }

  function buildInput(): QuoteInput {
    return {
      leadId: selectedLead?.id ?? null,
      locale,
      clientName,
      clientCompany,
      clientEmail,
      intro: "",
      scope,
      notes,
      discoveryNotes: dump,
      projectDuration,
      lineItems: toInput(lines),
      validUntil: validUntil || null,
    };
  }

  function onGenerate() {
    setError(null);
    if (!selectedLead && !dump.trim()) {
      setError("Pick a lead and/or add a brief first.");
      return;
    }
    startTransition(async () => {
      try {
        const existing = toInput(lines);
        const draft = await generateQuoteDraftAction({
          leadId: selectedLead?.id ?? null,
          discoveryNotes: dump,
          locale,
          lineHints: existing.length ? existing : undefined,
        });
        setScope(draft.scope);
        setNotes(draft.notes);
        setLines(toLines(draft.lineItems));
        if (draft.validUntil) setValidUntil(draft.validUntil);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generate failed");
      }
    });
  }

  function onSave() {
    setError(null);
    if (!hasGenerated) {
      setError("Generate the quote first.");
      return;
    }
    startTransition(async () => {
      try {
        const input = buildInput();
        let id = quote?.id;
        if (mode === "create" || !id) {
          id = await createQuote(input);
        } else {
          await updateQuote(id, input);
        }
        router.push(`/quotes/${id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <form
      className="space-y-6 p-4 lg:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search a lead, dump extra notes, generate — then review on the detail
            page before marking sent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onGenerate}
          >
            <Sparkles className="size-4" />
            {pending ? "Generating…" : "Generate"}
          </Button>
          <Button type="submit" disabled={pending || !hasGenerated}>
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Create quote"
                : "Save draft"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-1.5">Search lead</Label>
                <LeadSearchPicker
                  value={selectedLead}
                  onChange={onLeadChange}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="company" className="mb-1.5">
                    Company
                  </Label>
                  <Input
                    id="company"
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="contact" className="mb-1.5">
                    Contact
                  </Label>
                  <Input
                    id="contact"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="mb-1.5">
                    Email
                  </Label>
                  <Input
                    id="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5">Language</Label>
                <div className="flex gap-2">
                  {(["sl", "en"] as const).map((l) => (
                    <Button
                      key={l}
                      type="button"
                      size="sm"
                      variant={locale === l ? "default" : "outline"}
                      onClick={() => setLocale(l)}
                    >
                      {l === "sl" ? "Slovenian" : "English"}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brief</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="dump" className="mb-1.5">
                Extra notes{" "}
                <span className="font-normal text-muted-foreground">
                  (WhatsApp, call, scope outside CRM)
                </span>
              </Label>
              <Textarea
                id="dump"
                rows={7}
                value={dump}
                onChange={(e) => setDump(e.target.value)}
                placeholder="Dump anything that isn’t already on the lead…"
              />
            </CardContent>
          </Card>

          {hasGenerated ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Line items</CardTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                >
                  <Plus className="size-4" /> Add row
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="hidden grid-cols-[1fr_7rem_2.5rem] gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                  <span>Description</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_2.5rem]"
                  >
                    <Input
                      placeholder="e.g. Osnovni SEO"
                      value={line.description}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, idx) =>
                            idx === i
                              ? { ...l, description: e.target.value }
                              : l
                          )
                        )
                      }
                    />
                    <Input
                      className="text-right"
                      placeholder="0"
                      value={line.amount}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, idx) =>
                            idx === i ? { ...l, amount: e.target.value } : l
                          )
                        )
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setLines((prev) =>
                          prev.length === 1
                            ? [emptyLine()]
                            : prev.filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {hasGenerated ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generated copy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="scope" className="mb-1.5">
                    Scope
                  </Label>
                  <Textarea
                    id="scope"
                    rows={5}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="notes" className="mb-1.5">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">
                  {eur(totals.total)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Items</span>
                <span>{toInput(lines).length}</span>
              </div>
              <div>
                <Label htmlFor="valid" className="mb-1.5 text-muted-foreground">
                  Valid until
                </Label>
                <Input
                  id="valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
              <div>
                <Label
                  htmlFor="duration"
                  className="mb-1.5 text-muted-foreground"
                >
                  Project duration{" "}
                  <span className="font-normal">(your estimate)</span>
                </Label>
                <Input
                  id="duration"
                  value={projectDuration}
                  onChange={(e) => setProjectDuration(e.target.value)}
                  placeholder="e.g. 3–4 tedne"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional — only appears on the quote if filled.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {hasGenerated
                  ? "Ready to create — you’ll review PDF on the next page."
                  : "Generate to fill line items and copy."}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </form>
  );
}
