import type { TicketPriority } from "@/lib/data";
import type { TicketAiDraft } from "@/lib/tickets/ai";

export type EditableTicketDraft = {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  tags: string[];
  checked: boolean;
  dirty: boolean;
};

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function fromIncoming(
  t: TicketAiDraft,
  newId: () => string
): EditableTicketDraft {
  return {
    id: newId(),
    title: t.title,
    description: t.description,
    priority: t.priority,
    tags: t.tags,
    checked: true,
    dirty: false,
  };
}

/** Merge AI suggestions into the editable review list. */
export function mergeTicketDrafts(opts: {
  current: EditableTicketDraft[];
  incoming: TicketAiDraft[];
  newId: () => string;
}): EditableTicketDraft[] {
  if (opts.current.length === 0) {
    return opts.incoming.map((t) => fromIncoming(t, opts.newId));
  }

  const base = opts.current.filter((d) => d.dirty || d.checked);
  const baseNorm = new Set(base.map((d) => norm(d.title)).filter(Boolean));
  const next = [...base];

  for (const t of opts.incoming) {
    const n = norm(t.title);
    if (!n || baseNorm.has(n)) continue;
    baseNorm.add(n);
    next.push(fromIncoming(t, opts.newId));
  }
  return next;
}

export function checklistTitlesFromPhases(
  phases: Array<{ checklist: Array<{ title: string }> }>
): string[] {
  return phases.flatMap((p) => p.checklist.map((c) => c.title));
}
