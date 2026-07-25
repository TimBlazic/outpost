"use server";

import { revalidatePath } from "next/cache";

import type { PortalApproval, PortalApprovalKind, ProjectPhase } from "@/lib/data";
import {
  ensureProjectPhases,
  getApprovalsForProject,
  getPhasesForProject,
  getPortalApprovals,
  getProjectById,
  getProjectPhases,
  getProjects,
  savePortalApprovals,
  saveProjectPhases,
  saveProjects,
} from "@/lib/store";
import { assertPortalAccess } from "@/lib/portal/session";
import {
  portalGetProjectByToken,
  portalGetPhases,
  portalSavePhases,
  portalGetApprovals,
  portalSaveApproval,
} from "@/lib/portal/delivery-repo";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function revalidateProject(projectId: string, token?: string | null) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  if (token) revalidatePath(`/portal/${token}`);
}

export async function updateRunbook(
  projectId: string,
  input: {
    stagingUrl: string;
    figmaUrl: string;
    repoUrl: string;
    briefUrl: string;
    portalIntro: string;
  }
) {
  const projects = await getProjects();
  await saveProjects(
    projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            stagingUrl: input.stagingUrl.trim() || null,
            figmaUrl: input.figmaUrl.trim() || null,
            repoUrl: input.repoUrl.trim() || null,
            briefUrl: input.briefUrl.trim() || null,
            portalIntro: input.portalIntro.trim() || null,
          }
        : p
    )
  );
  const project = projects.find((p) => p.id === projectId);
  revalidateProject(projectId, project?.portalToken);
}

export async function toggleChecklistItem(
  projectId: string,
  itemId: string,
  done: boolean
) {
  const phases = await getProjectPhases();
  const next = phases.map((ph) =>
    ph.projectId !== projectId
      ? ph
      : {
          ...ph,
          checklist: ph.checklist.map((c) =>
            c.id === itemId ? { ...c, done } : c
          ),
        }
  );
  await saveProjectPhases(next);
  const project = await getProjectById(projectId);
  revalidateProject(projectId, project?.portalToken);
}

export async function advanceProjectPhase(projectId: string) {
  const phases = (await getPhasesForProject(projectId)).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  if (!phases.length) {
    const project = await getProjectById(projectId);
    if (!project) return;
    await ensureProjectPhases(project);
    return advanceProjectPhase(projectId);
  }

  const activeIdx = phases.findIndex((p) => p.status === "active");
  if (activeIdx < 0) return;

  const all = await getProjectPhases();
  const updated: ProjectPhase[] = phases.map((p, i) => {
    if (i < activeIdx) return { ...p, status: "done" as const };
    if (i === activeIdx) return { ...p, status: "done" as const };
    if (i === activeIdx + 1) return { ...p, status: "active" as const };
    return p;
  });

  const byId = new Map(updated.map((p) => [p.id, p]));
  await saveProjectPhases(
    all.map((p) => byId.get(p.id) ?? p)
  );
  const project = await getProjectById(projectId);
  revalidateProject(projectId, project?.portalToken);
}

export async function setActivePhase(projectId: string, phaseId: string) {
  const phases = await getPhasesForProject(projectId);
  const target = phases.find((p) => p.id === phaseId);
  if (!target) return;

  const all = await getProjectPhases();
  const nextStatuses = new Map<string, ProjectPhase["status"]>();
  for (const p of phases) {
    if (p.sortOrder < target.sortOrder) nextStatuses.set(p.id, "done");
    else if (p.id === phaseId) nextStatuses.set(p.id, "active");
    else nextStatuses.set(p.id, "upcoming");
  }

  await saveProjectPhases(
    all.map((p) =>
      nextStatuses.has(p.id)
        ? { ...p, status: nextStatuses.get(p.id)! }
        : p
    )
  );
  const project = await getProjectById(projectId);
  revalidateProject(projectId, project?.portalToken);
}

/** Client marks a waiting checklist item done from the portal. */
export async function clientCompleteChecklistItem(
  token: string,
  itemId: string
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");

  const phases = await portalGetPhases(project.id);
  const next = phases.map((ph) => ({
    ...ph,
    checklist: ph.checklist.map((c) =>
      c.id === itemId && c.clientVisible
        ? { ...c, done: true, waitingOnClient: false }
        : c
    ),
  }));
  await portalSavePhases(next);
  revalidateProject(project.id, token);
}

export async function clientSubmitApproval(
  token: string,
  kind: PortalApprovalKind,
  approvedByName: string,
  note?: string
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");

  const existing = await portalGetApprovals(project.id);
  if (existing.some((a) => a.kind === kind)) {
    throw new Error("Already approved");
  }

  const approval: PortalApproval = {
    id: uid("pa"),
    projectId: project.id,
    kind,
    approvedAt: new Date().toISOString(),
    approvedByName: approvedByName.trim() || "Client",
    note: note?.trim() || null,
  };
  await portalSaveApproval(approval);
  revalidateProject(project.id, token);
}

export async function getOrSeedPhases(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) return [];
  return ensureProjectPhases(project);
}

export async function listApprovals(projectId: string) {
  return getApprovalsForProject(projectId);
}

export async function saveStudioApprovalsSnapshot(
  projectId: string,
  items: PortalApproval[]
) {
  const all = await getPortalApprovals();
  const others = all.filter((a) => a.projectId !== projectId);
  await savePortalApprovals([...others, ...items]);
  revalidateProject(projectId);
}
