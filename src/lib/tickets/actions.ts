"use server";

import { revalidatePath } from "next/cache";

import {
  getCurrentProfile,
  requireStudioSession,
} from "@/lib/auth/session";
import { phaseTemplateForType } from "@/lib/delivery/templates";
import type { Ticket, TicketPriority } from "@/lib/data";
import {
  getClientById,
  getProjectById,
  getTickets,
  saveTickets,
} from "@/lib/store";
import { enqueueTicketsBulk } from "@/lib/portal/notifications/enqueue";
import { schedulePortalNotificationFlush } from "@/lib/portal/notifications/schedule";
import { generateTicketDrafts, type TicketAiDraft } from "@/lib/tickets/ai";
import { checklistTitlesFromPhases } from "@/lib/tickets/draft-merge";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

async function resolveTicketLocale(
  project: Awaited<ReturnType<typeof getProjectById>>
): Promise<"en" | "sl"> {
  if (!project) return "en";
  if (project.clientId) {
    const client = await getClientById(project.clientId);
    if (client?.portalLocale === "sl" || client?.portalLocale === "en") {
      return client.portalLocale;
    }
  }
  return project.portalLocale === "sl" ? "sl" : "en";
}

export async function generateProjectTicketsAction(
  projectId: string,
  opts?: { instruction?: string | null; draftTitles?: string[] }
): Promise<TicketAiDraft[]> {
  await requireStudioSession();
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  const tickets = (await getTickets()).filter((t) => t.projectId === projectId);
  const phaseHints = checklistTitlesFromPhases(
    phaseTemplateForType(project.type)
  );
  const existingTitles = [
    ...tickets.map((t) => t.title),
    ...(opts?.draftTitles ?? []),
  ];
  const locale = await resolveTicketLocale(project);

  return generateTicketDrafts({
    project: {
      name: project.name,
      type: project.type,
      description: project.description ?? "",
      phase: project.phase,
      status: project.status,
      client: project.client,
    },
    existingTitles,
    instruction: opts?.instruction,
    phaseHints,
    locale,
  });
}

export async function createTicketsBulkAction(
  projectId: string,
  drafts: Array<{
    title: string;
    description: string;
    priority?: TicketPriority;
    tags?: string[];
  }>
): Promise<string[]> {
  await requireStudioSession();
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  const author = await getCurrentProfile();
  const cleaned = drafts
    .map((d) => ({
      title: d.title.trim(),
      description: (d.description ?? "").trim(),
      priority: d.priority ?? ("Medium" as TicketPriority),
      tags: (d.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 5),
    }))
    .filter((d) => d.title.length > 0);
  if (!cleaned.length) throw new Error("No tickets to create");

  const existing = await getTickets();
  const now = new Date().toISOString();
  const created: Ticket[] = cleaned.map((d) => ({
    id: uid("tk"),
    projectId,
    title: d.title,
    description: d.description,
    status: "Todo",
    priority: d.priority,
    tags: d.tags,
    createdAt: now,
    dueAt: null,
    assigneeKind: "studio",
    assigneeId: null,
    createdByKind: "studio",
    createdByName: author.name,
  }));

  await saveTickets([...created, ...existing]);

  if (project.clientId) {
    await enqueueTicketsBulk({
      projectId,
      clientId: project.clientId,
      count: created.length,
      titles: created.map((t) => t.title).slice(0, 5),
      ticketIds: created.map((t) => t.id),
    });
    schedulePortalNotificationFlush();
  }

  revalidatePath(`/projects/${projectId}`);
  return created.map((t) => t.id);
}
