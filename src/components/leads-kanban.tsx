"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { leadStatuses, type Lead, type LeadStatus } from "@/lib/data";
import { setLeadStatus } from "@/lib/actions";
import { eur, leadStatusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/status-pill";

/** Same statuses as the lead table / detail — one column each. */
export const kanbanColumns: LeadStatus[] = [...leadStatuses];

function LeadCard({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  return (
    <Card
      className={cn(
        "gap-2 rounded-md p-3 shadow-xs",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <p className="text-sm font-medium leading-tight">{lead.company}</p>
      <p className="text-xs text-muted-foreground">{lead.contact}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{eur(lead.value)}</span>
        <span className="text-xs text-muted-foreground">
          {lead.probability}%
        </span>
      </div>
      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="px-1.5 py-0 text-[10px]"
            >
              {t}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function SortableLeadCard({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen?: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { type: "lead", lead } });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className="cursor-grab touch-none active:cursor-grabbing"
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(lead.id)}
    >
      <LeadCard lead={lead} />
    </div>
  );
}

function KanbanColumn({
  status,
  leads,
  onOpen,
}: {
  status: LeadStatus;
  leads: Lead[];
  onOpen?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "column", status },
  });
  const total = leads.reduce((s, l) => s + l.value, 0);

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <StatusPill label={status} className={leadStatusColor[status]} />
          <span className="text-xs text-muted-foreground">{leads.length}</span>
        </div>
        <span className="text-xs text-muted-foreground">{eur(total)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted/40 p-2 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/25"
        )}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((l) => (
            <SortableLeadCard key={l.id} lead={l} onOpen={onOpen} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}

export function LeadsKanban({
  leads: initialLeads,
  onOpen,
}: {
  leads: Lead[];
  onOpen?: (id: string) => void;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);

  const leadKey = initialLeads.map((l) => `${l.id}:${l.status}`).join("|");
  useEffect(() => {
    setLeads(initialLeads);
  }, [leadKey, initialLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const byColumn = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    for (const col of kanbanColumns) map.set(col, []);
    for (const lead of leads) {
      map.get(lead.status)?.push(lead);
    }
    return map;
  }, [leads]);

  const activeLead = activeId
    ? (leads.find((l) => l.id === activeId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const overId = String(over.id);

    let targetStatus: LeadStatus | null = null;
    if ((leadStatuses as readonly string[]).includes(overId)) {
      targetStatus = overId as LeadStatus;
    } else {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) targetStatus = overLead.status;
    }

    if (!targetStatus) return;

    const current = leads.find((l) => l.id === leadId);
    if (!current || current.status === targetStatus) return;

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: targetStatus } : l))
    );
    startTransition(() => setLeadStatus(leadId, targetStatus));
  }

  return (
    <div className="h-full min-h-0">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full min-h-0 gap-4 overflow-x-auto overflow-y-hidden">
          {kanbanColumns.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={byColumn.get(status) ?? []}
              onOpen={onOpen}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeLead ? <LeadCard lead={activeLead} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
