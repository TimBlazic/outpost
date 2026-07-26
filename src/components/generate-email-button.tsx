"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Mail, Sparkles, X } from "lucide-react";

import { generateLeadEmailAction } from "@/lib/ai/actions";
import {
  mailtoHref,
  type EmailApproach,
  type EmailIntent,
} from "@/lib/ai/email";
import { addNote } from "@/lib/actions";
import { sendStudioEmailAction } from "@/lib/email/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const intents: { id: EmailIntent; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "cold", label: "Cold outreach" },
  { id: "follow_up", label: "Follow-up" },
  { id: "custom", label: "Custom" },
];

const approachLabel: Record<EmailApproach, string> = {
  cold: "Cold outreach",
  follow_up: "Follow-up",
  check_in: "Check-in",
  custom: "Custom",
};

function EmailDrawer({
  open,
  onClose,
  to,
  onTo,
  subject,
  body,
  onSubject,
  onBody,
  approach,
  revisionNotes,
  onRevisionNotes,
  onRegenerate,
  onSave,
  onSend,
  onMailto,
  pending,
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
  approach: EmailApproach | null;
  revisionNotes: string;
  onRevisionNotes: (v: string) => void;
  onRegenerate: () => void;
  onSave: () => void;
  onSend: () => void;
  onMailto: () => void;
  pending: boolean;
  error: string | null;
}) {
  const [visible, setVisible] = useState(false);

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
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={cn(
          "absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 m-3 flex h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Email draft</p>
            <p className="text-xs text-muted-foreground">
              {approach
                ? `${approachLabel[approach]} · review, edit, then Send`
                : "Review, edit, then Send via Resend"}
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
            <Label htmlFor="ai-to" className="mb-1.5">
              To
            </Label>
            <Input
              id="ai-to"
              type="email"
              value={to}
              onChange={(e) => onTo(e.target.value)}
              disabled={pending}
              placeholder="client@company.com"
            />
          </div>
          <div>
            <Label htmlFor="ai-subject" className="mb-1.5">
              Subject
            </Label>
            <Input
              id="ai-subject"
              value={subject}
              onChange={(e) => onSubject(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <Label htmlFor="ai-body" className="mb-1.5">
              Body
            </Label>
            <Textarea
              id="ai-body"
              value={body}
              onChange={(e) => onBody(e.target.value)}
              disabled={pending}
              className="min-h-[220px] flex-1 resize-y font-normal"
            />
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <Label htmlFor="ai-revision" className="mb-1.5 text-xs">
              Regenerate with instructions{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="ai-revision"
              value={revisionNotes}
              onChange={(e) => onRevisionNotes(e.target.value)}
              disabled={pending}
              rows={2}
              placeholder="e.g. shorter, more specific about the hero, softer CTA…"
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
              disabled={pending}
              onClick={onRegenerate}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Regenerate
            </Button>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Discard
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !subject.trim() || !body.trim()}
            onClick={onSave}
          >
            Save note
          </Button>
          <div className="flex">
            <Button
              type="button"
              size="sm"
              className="rounded-r-none"
              disabled={pending || !to.trim() || !subject.trim() || !body.trim()}
              onClick={onSend}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Mail className="size-3.5" />
              )}
              Send
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-l-none border-l border-primary-foreground/20 px-2"
                  disabled={pending}
                  aria-label="More send options"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onMailto}>
                  Open in mail app
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function GenerateEmailButton({
  leadId,
  leadEmail,
}: {
  leadId: string;
  leadEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<EmailIntent>("auto");
  const [brief, setBrief] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [to, setTo] = useState(leadEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [approach, setApproach] = useState<EmailApproach | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");

  useEffect(() => {
    setTo(leadEmail);
  }, [leadEmail]);

  function runGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateLeadEmailAction({
          leadId,
          intent,
          brief,
        });
        setTo(leadEmail);
        setSubject(result.subject);
        setBody(result.body);
        setApproach(result.approach);
        setRevisionNotes("");
        setOpen(false);
        setDrawerOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
      }
    });
  }

  function regenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateLeadEmailAction({
          leadId,
          intent,
          brief,
          revisionNotes,
          previousDraft: { subject, body },
        });
        setSubject(result.subject);
        setBody(result.body);
        setApproach(result.approach);
        setRevisionNotes("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
      }
    });
  }

  function saveNote() {
    startTransition(async () => {
      try {
        await addNote(leadId, {
          title: subject.trim() || "Email draft",
          body: body.trim(),
          pinned: false,
        });
        setDrawerOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save note");
      }
    });
  }

  function sendEmail() {
    setError(null);
    startTransition(async () => {
      try {
        await sendStudioEmailAction({
          to,
          subject,
          body,
          leadId,
        });
        setDrawerOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
      }
    });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Sparkles className="size-3.5" />
            Generate email
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3 p-3">
          <div>
            <p className="text-sm font-medium">Generate email</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Auto reads research + prior emails, then picks cold / follow-up
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {intents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIntent(item.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  intent === item.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="ai-brief" className="mb-1.5 text-xs">
              Brief{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="ai-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="Angle, offer, or what to emphasize…"
              className="text-sm"
            />
          </div>

          {error && !drawerOpen ? (
            <p className="text-xs text-rose-600" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={runGenerate}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Generate draft
          </Button>
        </PopoverContent>
      </Popover>

      <EmailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        to={to}
        onTo={setTo}
        subject={subject}
        body={body}
        onSubject={setSubject}
        onBody={setBody}
        approach={approach}
        revisionNotes={revisionNotes}
        onRevisionNotes={setRevisionNotes}
        onRegenerate={regenerate}
        onSave={saveNote}
        onSend={sendEmail}
        onMailto={() => {
          window.location.href = mailtoHref(to, subject, body);
        }}
        pending={pending}
        error={drawerOpen ? error : null}
      />
    </>
  );
}
