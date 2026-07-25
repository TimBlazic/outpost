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

import {
  taskStatuses,
  type Task,
  type TaskStatus,
  type Lead,
  type Project,
} from "@/lib/data";
import { setTaskStatus } from "@/lib/actions";
import { fmtDate, priorityColor, dueState } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";

function TaskCard({
  task,
  linkLabel,
  dragging,
}: {
  task: Task;
  linkLabel?: string;
  dragging?: boolean;
}) {
  const state = dueState(task.due);
  return (
    <Card
      className={cn(
        "gap-2 rounded-md p-3 shadow-xs",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <p className="text-sm font-medium leading-tight">{task.title}</p>
      {linkLabel && (
        <p className="truncate text-xs text-muted-foreground">{linkLabel}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <StatusPill
          label={task.priority}
          className={priorityColor[task.priority]}
        />
        <span
          className={cn(
            "text-xs",
            state === "overdue" && "font-medium text-rose-600",
            state === "today" && "font-medium text-amber-600",
            state !== "overdue" && state !== "today" && "text-muted-foreground"
          )}
        >
          {fmtDate(task.due)}
        </span>
      </div>
    </Card>
  );
}

function SortableTaskCard({
  task,
  linkLabel,
  onOpen,
}: {
  task: Task;
  linkLabel?: string;
  onOpen?: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

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
      onClick={() => onOpen?.(task.id)}
    >
      <TaskCard task={task} linkLabel={linkLabel} />
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  linkFor,
  onOpen,
}: {
  status: TaskStatus;
  tasks: Task[];
  linkFor: (t: Task) => string | undefined;
  onOpen?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{status}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted/40 p-2 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/25"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              linkLabel={linkFor(t)}
              onOpen={onOpen}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}

export function TasksKanban({
  tasks: initialTasks,
  leads,
  projects,
  onOpen,
}: {
  tasks: Task[];
  leads: Lead[];
  projects: Project[];
  onOpen?: (id: string) => void;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);

  const key = initialTasks.map((t) => `${t.id}:${t.status}`).join("|");
  useEffect(() => {
    setTasks(initialTasks);
  }, [key, initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function linkFor(t: Task) {
    if (t.leadId) {
      return leads.find((l) => l.id === t.leadId)?.company;
    }
    if (t.projectId) {
      return projects.find((p) => p.id === t.projectId)?.name;
    }
    return undefined;
  }

  const byColumn = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const s of taskStatuses) map.set(s, []);
    for (const t of tasks) map.get(t.status)?.push(t);
    return map;
  }, [tasks]);

  const activeTask = activeId
    ? (tasks.find((t) => t.id === activeId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    let target: TaskStatus | null = null;
    if ((taskStatuses as readonly string[]).includes(overId)) {
      target = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) target = overTask.status;
    }
    if (!target) return;

    const current = tasks.find((t) => t.id === taskId);
    if (!current || current.status === target) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: target! } : t))
    );
    startTransition(() => setTaskStatus(taskId, target!));
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
          {taskStatuses.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={byColumn.get(status) ?? []}
              linkFor={linkFor}
              onOpen={onOpen}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              linkLabel={linkFor(activeTask)}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
