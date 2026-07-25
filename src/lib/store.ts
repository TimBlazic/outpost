// ---------------------------------------------------------------------------
// File-based local store. Each collection is a JSON file under /data, seeded
// from mock data in data.ts on first access.
// When Supabase env is configured (and OUTPOST_USE_FILE_STORE is not set),
// reads/writes go through src/lib/supabase/db.ts instead.
// Server-only: only import from server components or server actions.
// ---------------------------------------------------------------------------

import { promises as fs } from "fs";
import path from "path";

import {
  leads as seedLeads,
  projects as seedProjects,
  tasks as seedTasks,
  notes as seedNotes,
  activities as seedActivities,
  attachments as seedAttachments,
  docs as seedDocs,
  clients as seedClients,
  ticketsSeed,
  ticketCommentsSeed,
  ticketCommentReactionsSeed,
  portalUpdates as seedPortalUpdates,
  portalComments as seedPortalComments,
  projectPhasesSeed,
  portalApprovalsSeed,
  defaultFirmSettings,
  normalizeClient,
  normalizeLead,
  normalizeProject,
  normalizeTask,
  normalizeTicket,
  type Lead,
  type Project,
  type Task,
  type Note,
  type Activity,
  type Attachment,
  type AttachmentParent,
  type Doc,
  type FileLink,
  type FirmSettings,
  type PortalUpdate,
  type PortalComment,
  type ProjectPhase,
  type PortalApproval,
  type Client,
  type Ticket,
  type TicketComment,
  type TicketCommentReaction,
} from "./data";
import { isSupabaseEnabled } from "./supabase/env";
import { buildPhasesForProject } from "./delivery/seed";

const DATA_DIR = path.join(process.cwd(), "data");

async function load<T>(name: string, seed: T): Promise<T> {
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    // One-time migrate legacy files.json → attachments.json
    if (name === "attachments") {
      try {
        const legacy = await fs.readFile(
          path.join(DATA_DIR, "files.json"),
          "utf8"
        );
        const links = JSON.parse(legacy) as FileLink[];
        const migrated: Attachment[] = links.map((f) => ({
          id: f.id,
          parentType: "lead" as const,
          parentId: f.leadId,
          label: f.label,
          kind: f.kind,
          url: f.url,
          storagePath: null,
          mime: null,
          size: null,
        }));
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(file, JSON.stringify(migrated, null, 2), "utf8");
        return migrated as T;
      } catch {
        // fall through to seed
      }
    }
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

async function save<T>(name: string, data: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DATA_DIR, `${name}.json`),
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

// ---- collections (file store) ---------------------------------------------

const fileStore = {
  getLeads: () => load<Lead[]>("leads", seedLeads),
  saveLeads: (d: Lead[]) => save("leads", d),
  getProjects: () => load<Project[]>("projects", seedProjects),
  saveProjects: (d: Project[]) => save("projects", d),
  getClients: () => load<Client[]>("clients", seedClients),
  saveClients: (d: Client[]) => save("clients", d),
  getTickets: () => load<Ticket[]>("tickets", ticketsSeed),
  saveTickets: (d: Ticket[]) => save("tickets", d),
  getTicketComments: () =>
    load<TicketComment[]>("ticket-comments", ticketCommentsSeed),
  saveTicketComments: (d: TicketComment[]) => save("ticket-comments", d),
  getTicketCommentReactions: () =>
    load<TicketCommentReaction[]>(
      "ticket-comment-reactions",
      ticketCommentReactionsSeed
    ),
  saveTicketCommentReactions: (d: TicketCommentReaction[]) =>
    save("ticket-comment-reactions", d),
  getTasks: () => load<Task[]>("tasks", seedTasks),
  saveTasks: (d: Task[]) => save("tasks", d),
  getNotes: () => load<Note[]>("notes", seedNotes),
  saveNotes: (d: Note[]) => save("notes", d),
  getActivities: () => load<Activity[]>("activities", seedActivities),
  saveActivities: (d: Activity[]) => save("activities", d),
  getAttachments: () => load<Attachment[]>("attachments", seedAttachments),
  saveAttachments: (d: Attachment[]) => save("attachments", d),
  getDocs: () => load<Doc[]>("docs", seedDocs),
  saveDocs: (d: Doc[]) => save("docs", d),
  getFirmSettings: () => load<FirmSettings>("settings", defaultFirmSettings),
  saveFirmSettings: (d: FirmSettings) => save("settings", d),
  getPortalUpdates: () =>
    load<PortalUpdate[]>("portal-updates", seedPortalUpdates),
  savePortalUpdates: (d: PortalUpdate[]) => save("portal-updates", d),
  getPortalComments: () =>
    load<PortalComment[]>("portal-comments", seedPortalComments),
  savePortalComments: (d: PortalComment[]) => save("portal-comments", d),
  getProjectPhases: () =>
    load<ProjectPhase[]>("project-phases", projectPhasesSeed),
  saveProjectPhases: (d: ProjectPhase[]) => save("project-phases", d),
  getPortalApprovals: () =>
    load<PortalApproval[]>("portal-approvals", portalApprovalsSeed),
  savePortalApprovals: (d: PortalApproval[]) => save("portal-approvals", d),
};

async function backend() {
  if (!isSupabaseEnabled()) return fileStore;
  // Lazy import so builds without Supabase still work.
  const db = await import("./supabase/db");
  return db;
}

export async function getLeads() {
  const rows = await (await backend()).getLeads();
  return rows.map(normalizeLead);
}
export async function saveLeads(d: Lead[]) {
  return (await backend()).saveLeads(d.map(normalizeLead));
}
export async function getProjects() {
  const rows = await (await backend()).getProjects();
  return rows.map(normalizeProject);
}
export async function saveProjects(d: Project[]) {
  return (await backend()).saveProjects(d.map(normalizeProject));
}
export async function getClients() {
  const rows = await (await backend()).getClients();
  return rows.map(normalizeClient);
}
export async function saveClients(d: Client[]) {
  return (await backend()).saveClients(d.map(normalizeClient));
}
export async function getTickets() {
  const rows = await (await backend()).getTickets();
  return rows.map(normalizeTicket);
}
export async function saveTickets(d: Ticket[]) {
  return (await backend()).saveTickets(d.map(normalizeTicket));
}
export async function getTicketComments() {
  return (await backend()).getTicketComments();
}
export async function saveTicketComments(d: TicketComment[]) {
  return (await backend()).saveTicketComments(d);
}
export async function getTicketCommentReactions() {
  return (await backend()).getTicketCommentReactions();
}
export async function saveTicketCommentReactions(d: TicketCommentReaction[]) {
  return (await backend()).saveTicketCommentReactions(d);
}
export async function getTasks() {
  const rows = await (await backend()).getTasks();
  return rows.map(normalizeTask);
}
export async function saveTasks(d: Task[]) {
  return (await backend()).saveTasks(d.map(normalizeTask));
}
export async function getNotes() {
  return (await backend()).getNotes();
}
export async function saveNotes(d: Note[]) {
  return (await backend()).saveNotes(d);
}
export async function getActivities() {
  return (await backend()).getActivities();
}
export async function saveActivities(d: Activity[]) {
  return (await backend()).saveActivities(d);
}
export async function getAttachments() {
  return (await backend()).getAttachments();
}
export async function saveAttachments(d: Attachment[]) {
  return (await backend()).saveAttachments(d);
}
export async function getDocs() {
  return (await backend()).getDocs();
}
export async function saveDocs(d: Doc[]) {
  return (await backend()).saveDocs(d);
}
export async function getFirmSettings() {
  return (await backend()).getFirmSettings();
}
export async function saveFirmSettings(d: FirmSettings) {
  return (await backend()).saveFirmSettings(d);
}
export async function getPortalUpdates() {
  return (await backend()).getPortalUpdates();
}
export async function savePortalUpdates(d: PortalUpdate[]) {
  return (await backend()).savePortalUpdates(d);
}
export async function getPortalComments() {
  return (await backend()).getPortalComments();
}
export async function savePortalComments(d: PortalComment[]) {
  return (await backend()).savePortalComments(d);
}
export async function getProjectPhases() {
  return (await backend()).getProjectPhases();
}
export async function saveProjectPhases(d: ProjectPhase[]) {
  return (await backend()).saveProjectPhases(d);
}
export async function getPortalApprovals() {
  return (await backend()).getPortalApprovals();
}
export async function savePortalApprovals(d: PortalApproval[]) {
  return (await backend()).savePortalApprovals(d);
}

export async function getPhasesForProject(projectId: string) {
  return (await getProjectPhases())
    .filter((p) => p.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getApprovalsForProject(projectId: string) {
  return (await getPortalApprovals()).filter((a) => a.projectId === projectId);
}

/** Seed delivery phases if this project has none yet. */
export async function ensureProjectPhases(project: Project) {
  const existing = await getPhasesForProject(project.id);
  if (existing.length) return existing;
  const all = await getProjectPhases();
  const built = buildPhasesForProject(project.id, project.type);
  await saveProjectPhases([...all, ...built]);
  return built;
}

export async function getProjectByPortalToken(token: string) {
  const projects = await getProjects();
  return (
    projects.find(
      (p) => p.portalEnabled && p.portalToken === token
    ) ?? null
  );
}

export async function getPortalUpdatesForProject(projectId: string) {
  return (await getPortalUpdates())
    .filter((u) => u.projectId === projectId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPortalCommentsForProject(projectId: string) {
  return (await getPortalComments()).filter((c) => c.projectId === projectId);
}

/** @deprecated Prefer getAttachments */
export async function getFileLinks(): Promise<FileLink[]> {
  const all = await getAttachments();
  return all
    .filter((a) => a.parentType === "lead" && a.url)
    .map((a) => ({
      id: a.id,
      leadId: a.parentId,
      label: a.label,
      kind: (a.kind === "file" ? "doc" : a.kind) as FileLink["kind"],
      url: a.url!,
    }));
}

/** @deprecated Prefer saveAttachments */
export async function saveFileLinks(links: FileLink[]) {
  const others = (await getAttachments()).filter((a) => a.parentType !== "lead");
  const leadAttachments: Attachment[] = links.map((f) => ({
    id: f.id,
    parentType: "lead" as const,
    parentId: f.leadId,
    label: f.label,
    kind: f.kind,
    url: f.url,
    storagePath: null,
    mime: null,
    size: null,
  }));
  await saveAttachments([...others, ...leadAttachments]);
}

// ---- lookups --------------------------------------------------------------

export async function getLeadById(id: string) {
  return (await getLeads()).find((l) => l.id === id);
}
export async function getProjectById(id: string) {
  return (await getProjects()).find((p) => p.id === id);
}
export async function getClientById(id: string) {
  return (await getClients()).find((c) => c.id === id);
}
export async function getTicketById(id: string) {
  return (await getTickets()).find((t) => t.id === id);
}
export async function getTicketsForProject(projectId: string) {
  return (await getTickets())
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export async function getCommentsForTicket(ticketId: string) {
  return (await getTicketComments())
    .filter((c) => c.ticketId === ticketId)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}
export async function getReactionsForTicketComments(commentIds: string[]) {
  if (!commentIds.length) return [] as TicketCommentReaction[];
  const set = new Set(commentIds);
  return (await getTicketCommentReactions()).filter((r) =>
    set.has(r.commentId)
  );
}
export async function getProjectsForClient(clientId: string) {
  return (await getProjects()).filter((p) => p.clientId === clientId);
}
export async function getDocById(id: string) {
  return (await getDocs()).find((d) => d.id === id);
}
export async function getNotesForLead(leadId: string) {
  return (await getNotes()).filter((n) => n.leadId === leadId);
}
export async function getActivitiesForLead(leadId: string) {
  return (await getActivities()).filter((a) => a.leadId === leadId);
}
export async function getFilesForLead(leadId: string): Promise<FileLink[]> {
  return (await getAttachments())
    .filter((a) => a.parentType === "lead" && a.parentId === leadId)
    .map((a) => ({
      id: a.id,
      leadId: a.parentId,
      label: a.label,
      kind: (a.kind === "file" ? "doc" : a.kind) as FileLink["kind"],
      url: a.url ?? a.storagePath ?? "",
    }));
}
export async function getAttachmentsFor(
  parentType: AttachmentParent,
  parentId: string
) {
  return (await getAttachments()).filter(
    (a) => a.parentType === parentType && a.parentId === parentId
  );
}
export async function getTasksForProject(projectId: string) {
  return (await getTasks()).filter((t) => t.projectId === projectId);
}

/** Sync denormalized note count on a lead (file store / write-through). */
export async function syncLeadNoteCount(leadId: string) {
  const notes = await getNotesForLead(leadId);
  const leads = await getLeads();
  await saveLeads(
    leads.map((l) => (l.id === leadId ? { ...l, notes: notes.length } : l))
  );
}
