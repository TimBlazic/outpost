import type {
  PhaseChecklistItem,
  PortalApproval,
  ProjectPhase,
} from "@/lib/data";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPhasesForProject,
  getApprovalsForProject,
  getProjectPhases,
  saveProjectPhases,
  getPortalApprovals,
  savePortalApprovals,
} from "@/lib/store";
import { portalGetProjectByToken } from "./repo";

export { portalGetProjectByToken };

export async function portalGetPhases(projectId: string) {
  if (!isSupabaseEnabled()) {
    return getPhasesForProject(projectId);
  }
  const supabase = createAdminClient();
  const { data: phases, error } = await supabase
    .from("project_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw new Error(error.message);

  const ids = (phases ?? []).map((p) => p.id as string);
  let items: PhaseChecklistItem[] = [];
  if (ids.length) {
    const { data: rows, error: itemsErr } = await supabase
      .from("phase_checklist_items")
      .select("*")
      .in("phase_id", ids);
    if (itemsErr) throw new Error(itemsErr.message);
    items = (rows ?? []).map((row) => ({
      id: row.id as string,
      phaseId: row.phase_id as string,
      title: row.title as string,
      done: Boolean(row.done),
      clientVisible: Boolean(row.client_visible),
      waitingOnClient: Boolean(row.waiting_on_client),
    }));
  }

  const byPhase = new Map<string, PhaseChecklistItem[]>();
  for (const item of items) {
    const list = byPhase.get(item.phaseId) ?? [];
    list.push(item);
    byPhase.set(item.phaseId, list);
  }

  return (phases ?? []).map(
    (row): ProjectPhase => ({
      id: row.id as string,
      projectId: row.project_id as string,
      key: row.key as string,
      label: row.label as string,
      sortOrder: Number(row.sort_order),
      status: row.status as ProjectPhase["status"],
      checklist: byPhase.get(row.id as string) ?? [],
    })
  );
}

export async function portalSavePhases(phases: ProjectPhase[]) {
  if (!isSupabaseEnabled()) {
    const all = await getProjectPhases();
    const ids = new Set(phases.map((p) => p.id));
    const others = all.filter((p) => !ids.has(p.id));
    // replace project's phases
    const projectId = phases[0]?.projectId;
    const kept = others.filter((p) => p.projectId !== projectId);
    await saveProjectPhases([...kept, ...phases]);
    return;
  }

  const supabase = createAdminClient();
  if (phases.length) {
    const { error } = await supabase.from("project_phases").upsert(
      phases.map((p) => ({
        id: p.id,
        project_id: p.projectId,
        key: p.key,
        label: p.label,
        sort_order: p.sortOrder,
        status: p.status,
      }))
    );
    if (error) throw new Error(error.message);

    const items = phases.flatMap((p) => p.checklist);
    if (items.length) {
      const { error: itemErr } = await supabase
        .from("phase_checklist_items")
        .upsert(
          items.map((i) => ({
            id: i.id,
            phase_id: i.phaseId,
            title: i.title,
            done: i.done,
            client_visible: i.clientVisible,
            waiting_on_client: i.waitingOnClient,
          }))
        );
      if (itemErr) throw new Error(itemErr.message);
    }
  }
}

export async function portalGetApprovals(projectId: string) {
  if (!isSupabaseEnabled()) {
    return getApprovalsForProject(projectId);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("portal_approvals")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): PortalApproval => ({
      id: row.id as string,
      projectId: row.project_id as string,
      kind: row.kind as PortalApproval["kind"],
      approvedAt: row.approved_at as string,
      approvedByName: (row.approved_by_name as string) ?? "",
      note: (row.note as string) ?? null,
    })
  );
}

export async function portalSaveApproval(approval: PortalApproval) {
  if (!isSupabaseEnabled()) {
    const all = await getPortalApprovals();
    await savePortalApprovals([...all, approval]);
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("portal_approvals").upsert({
    id: approval.id,
    project_id: approval.projectId,
    kind: approval.kind,
    approved_at: approval.approvedAt,
    approved_by_name: approval.approvedByName,
    note: approval.note,
  });
  if (error) throw new Error(error.message);
}
