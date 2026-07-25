import { TasksWorkspace } from "@/components/tasks-workspace";
import { getTasks, getLeads, getProjects, getAttachments } from "@/lib/store";
import { getTeamMembers } from "@/lib/auth/session";
import { dueState } from "@/lib/format";
import type { Attachment } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string;
    leadId?: string;
    projectId?: string;
    task?: string;
  }>;
}) {
  const { new: isNew, leadId, projectId, task: taskId } = await searchParams;
  const [tasks, leads, projects, members, attachments] = await Promise.all([
    getTasks(),
    getLeads(),
    getProjects(),
    getTeamMembers(),
    getAttachments(),
  ]);
  const open = tasks.filter((t) => t.status !== "Done");
  const overdue = open.filter((t) => dueState(t.due) === "overdue").length;

  const taskFiles: Record<string, Attachment[]> = {};
  for (const file of attachments) {
    if (file.parentType !== "task") continue;
    (taskFiles[file.parentId] ??= []).push(file);
  }

  return (
    <TasksWorkspace
      tasks={tasks}
      leads={leads}
      projects={projects}
      members={members}
      taskFiles={taskFiles}
      openCount={open.length}
      overdueCount={overdue}
      defaultOpenCreate={isNew === "1"}
      defaultOpenTaskId={taskId}
      defaultLeadId={leadId}
      defaultProjectId={projectId}
    />
  );
}
