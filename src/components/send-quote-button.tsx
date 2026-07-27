"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Mail, Sparkles, X } from "lucide-react";

import {
  generateQuoteEmailAction,
  sendQuoteEmailAction,
} from "@/lib/quotes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function QuoteEmailDrawer({
  open,
  onClose,
  to,
  onTo,
  subject,
  body,
  onSubject,
  onBody,
  pdfName,
  revisionNotes,
  onRevisionNotes,
  onRegenerate,
  onSend,
  pending,
  generating,
  error,
}: {
  open: boolean;
  onClose: () => void;
  to: string;
  onTo: (v: string) => void;
  subject: string;
  body: string;
  onSubject: (v: string) => void;
  onBody: (v: string) => void;
  pdfName: string;
  revisionNotes: string;
  onRevisionNotes: (v: string) => void;
  onRegenerate: () => void;
  onSend: () => void;
  pending: boolean;
  generating: boolean;
  error: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const busy = pending || generating;

  // Portal to body — SidePanel uses transform, which traps position:fixed.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 m-3 flex h-[calc(100dvh-1.5rem)] max-h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Send quote</p>
            <p className="text-xs text-muted-foreground">
              Preview, then Send via Resend · PDF attached
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div>
            <Label htmlFor="quote-to" className="mb-1.5">
              To
            </Label>
            <Input
              id="quote-to"
              type="email"
              value={to}
              onChange={(e) => onTo(e.target.value)}
              disabled={busy}
              placeholder="client@company.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Changing this only affects this send — lead email stays as is.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{pdfName}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              PDF attachment
            </span>
          </div>

          {generating && !subject.trim() ? (
            <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Generating email…
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="quote-subject" className="mb-1.5">
                  Subject
                </Label>
                <Input
                  id="quote-subject"
                  value={subject}
                  onChange={(e) => onSubject(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <Label htmlFor="quote-body" className="mb-1.5">
                  Body
                </Label>
                <Textarea
                  id="quote-body"
                  value={body}
                  onChange={(e) => onBody(e.target.value)}
                  disabled={busy}
                  className="min-h-[220px] flex-1 resize-y font-normal"
                />
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                <Label htmlFor="quote-revision" className="mb-1.5 text-xs">
                  Regenerate with instructions{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="quote-revision"
                  value={revisionNotes}
                  onChange={(e) => onRevisionNotes(e.target.value)}
                  disabled={busy}
                  rows={2}
                  placeholder="e.g. shorter, warmer, mention SEO…"
                  className="mb-2 text-sm"
                />
                {error ? (
                  <p className="mb-2 text-xs text-rose-600" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={onRegenerate}
                >
                  {generating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Regenerate
                </Button>
              </div>
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              busy || !to.trim() || !subject.trim() || !body.trim()
            }
            onClick={onSend}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Mail className="size-3.5" />
            )}
            Send
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export function SendQuoteButton({
  quoteId,
  quoteNumber,
  defaultTo,
  onSent,
}: {
  quoteId: string;
  quoteNumber: string | null;
  /** Prefill from linked lead (or quote client email). Not written back to lead. */
  defaultTo: string;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [sending, startSend] = useTransition();

  useEffect(() => {
    setTo(defaultTo);
  }, [defaultTo]);

  const pdfName = `${quoteNumber || "ponudba"}.pdf`;

  function openAndGenerate() {
    setError(null);
    setSubject("");
    setBody("");
    setRevisionNotes("");
    setTo(defaultTo);
    setDrawerOpen(true);
    startGenerate(async () => {
      try {
        const draft = await generateQuoteEmailAction({ quoteId });
        setSubject(draft.subject);
        setBody(draft.body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate email");
      }
    });
  }

  function regenerate() {
    setError(null);
    startGenerate(async () => {
      try {
        const draft = await generateQuoteEmailAction({
          quoteId,
          revisionNotes,
          previousDraft:
            subject.trim() || body.trim()
              ? { subject, body }
              : null,
        });
        setSubject(draft.subject);
        setBody(draft.body);
        setRevisionNotes("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Regenerate failed");
      }
    });
  }

  function send() {
    setError(null);
    startSend(async () => {
      try {
        await sendQuoteEmailAction({
          quoteId,
          to,
          subject,
          body,
        });
        setDrawerOpen(false);
        router.refresh();
        onSent?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
      }
    });
  }

  return (
    <>
      <Button type="button" size="sm" onClick={openAndGenerate}>
        <Mail className="size-3.5" />
        Send quote
      </Button>
      <QuoteEmailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        to={to}
        onTo={setTo}
        subject={subject}
        body={body}
        onSubject={setSubject}
        onBody={setBody}
        pdfName={pdfName}
        revisionNotes={revisionNotes}
        onRevisionNotes={setRevisionNotes}
        onRegenerate={regenerate}
        onSend={send}
        pending={sending}
        generating={generating}
        error={error}
      />
    </>
  );
}
