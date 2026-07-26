"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2, X } from "lucide-react";

import { ticketPriorities, type TicketPriority } from "@/lib/data";
import {
  createTicketsBulkAction,
  generateProjectTicketsAction,
} from "@/lib/tickets/actions";
import {
  mergeTicketDrafts,
  type EditableTicketDraft,
} from "@/lib/tickets/draft-merge";
import { priorityClass } from "@/components/ticket-priority";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function newDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `d_${Math.random().toString(36).slice(2, 10)}`;
}

export function GenerateTicketsDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<EditableTicketDraft[]>([]);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const selectedCount = useMemo(
    () => drafts.filter((d) => d.checked && d.title.trim()).length,
    [drafts]
  );

  useEffect(() => {
    if (!open) {
      setDrafts([]);
      setInstruction("");
      setError(null);
      setLoadedOnce(false);
      setCreating(false);
      return;
    }

    let alive = true;
    setError(null);
    startTransition(async () => {
      try {
        const incoming = await generateProjectTicketsAction(projectId);
        if (!alive) return;
        setDrafts(
          mergeTicketDrafts({
            current: [],
            incoming,
            newId: newDraftId,
          })
        );
        setLoadedOnce(true);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to generate tickets");
        setLoadedOnce(true);
      }
    });

    return () => {
      alive = false;
    };
  }, [open, projectId]);

  function updateDraft(
    id: string,
    patch: Partial<
      Pick<
        EditableTicketDraft,
        "title" | "description" | "checked" | "priority" | "tags"
      >
    >
  ) {
    setDrafts((rows) =>
      rows.map((d) => {
        if (d.id !== id) return d;
        const dirty =
          d.dirty ||
          ("title" in patch && patch.title !== d.title) ||
          ("description" in patch && patch.description !== d.description) ||
          ("priority" in patch && patch.priority !== d.priority) ||
          ("tags" in patch &&
            JSON.stringify(patch.tags) !== JSON.stringify(d.tags));
        return { ...d, ...patch, dirty };
      })
    );
  }

  function setAllChecked(checked: boolean) {
    setDrafts((rows) => rows.map((d) => ({ ...d, checked })));
  }

  function removeDraft(id: string) {
    setDrafts((rows) => rows.filter((d) => d.id !== id));
  }

  function refine() {
    const text = instruction.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const draftTitles = drafts.map((d) => d.title.trim()).filter(Boolean);
        const incoming = await generateProjectTicketsAction(projectId, {
          instruction: text,
          draftTitles,
        });
        setDrafts((current) =>
          mergeTicketDrafts({ current, incoming, newId: newDraftId })
        );
        setInstruction("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update drafts");
      }
    });
  }

  function createSelected() {
    const payload = drafts
      .filter((d) => d.checked && d.title.trim())
      .map((d) => ({
        title: d.title.trim(),
        description: d.description.trim(),
        priority: d.priority,
        tags: d.tags,
      }));
    if (!payload.length || creating) return;
    setCreating(true);
    setError(null);
    startTransition(async () => {
      try {
        await createTicketsBulkAction(projectId, payload);
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create tickets");
        setCreating(false);
      }
    });
  }

  const busy = pending || creating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "fixed inset-3 top-3 bottom-3 left-3 right-3 z-50 flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border bg-background p-0 shadow-2xl sm:inset-4 sm:top-4 sm:right-4 sm:bottom-4 sm:left-4",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
        )}
      >
        <DialogTitle className="sr-only">Generate tickets</DialogTitle>
        <DialogDescription className="sr-only">
          Review AI ticket drafts and create the ones you want
        </DialogDescription>

        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              <Sparkles className="size-3" />
              AI
            </p>
            <h2 className="app-display mt-1 text-3xl italic tracking-tight sm:text-4xl">
              Generate tickets
            </h2>
            {projectName ? (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {projectName}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
          {!loadedOnce || (pending && drafts.length === 0) ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Drafting tickets…</p>
            </div>
          ) : error && drafts.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
              <p className="max-w-md text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {drafts.length} suggested · {selectedCount} selected
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || drafts.length === 0}
                    onClick={() => setAllChecked(true)}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || drafts.length === 0}
                    onClick={() => setAllChecked(false)}
                  >
                    Deselect all
                  </Button>
                </div>
              </div>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <ul className="space-y-2.5">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className={cn(
                      "group relative rounded-xl border bg-background p-3.5 transition-colors sm:p-4",
                      d.checked
                        ? "border-border shadow-xs"
                        : "border-border/50 opacity-60"
                    )}
                  >
                    <div className="flex gap-3">
                      <Checkbox
                        checked={d.checked}
                        disabled={busy}
                        onCheckedChange={(v) =>
                          updateDraft(d.id, { checked: Boolean(v) })
                        }
                        className="mt-1"
                        aria-label={`Select ${d.title || "ticket"}`}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          value={d.title}
                          disabled={busy}
                          onChange={(e) =>
                            updateDraft(d.id, { title: e.target.value })
                          }
                          placeholder="Ticket title"
                          className="w-full bg-transparent text-[15px] font-semibold leading-snug outline-none placeholder:text-muted-foreground/60"
                        />
                        <textarea
                          value={d.description}
                          disabled={busy}
                          onChange={(e) =>
                            updateDraft(d.id, { description: e.target.value })
                          }
                          placeholder="Short description…"
                          rows={2}
                          className="w-full resize-none bg-transparent text-sm leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/50"
                        />
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Select
                            aria-label="Priority"
                            value={d.priority}
                            disabled={busy}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                priority: e.target.value as TicketPriority,
                              })
                            }
                            className={cn(
                              "h-6 w-auto min-w-[4.75rem] rounded-full border-transparent px-2 py-0 pr-6 text-[10px] font-medium shadow-none",
                              priorityClass[d.priority]
                            )}
                          >
                            {ticketPriorities.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </Select>
                          <input
                            value={d.tags.join(", ")}
                            disabled={busy}
                            onChange={(e) =>
                              updateDraft(d.id, {
                                tags: e.target.value
                                  .split(",")
                                  .map((t) => t.trim())
                                  .filter(Boolean)
                                  .slice(0, 5),
                              })
                            }
                            placeholder="+ tags"
                            className="min-w-[6rem] flex-1 bg-transparent text-[11px] text-muted-foreground outline-none placeholder:text-muted-foreground/45"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        disabled={busy}
                        onClick={() => removeDraft(d.id)}
                        aria-label="Remove draft"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-border/70 bg-background/90 px-5 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row">
            <Input
              value={instruction}
              disabled={busy || drafts.length === 0}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  refine();
                }
              }}
              placeholder="Add more, break something down…"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !instruction.trim() || drafts.length === 0}
              onClick={refine}
            >
              {pending && drafts.length > 0 ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Update
            </Button>
          </div>
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={creating}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || selectedCount === 0}
              onClick={createSelected}
            >
              {creating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Create {selectedCount} ticket{selectedCount === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
