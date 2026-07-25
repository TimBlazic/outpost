import type { ProjectPhase, ProjectType } from "@/lib/data";
import { phaseTemplateForType } from "./templates";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Build phase+checklist rows for a new project from its product type. */
export function buildPhasesForProject(
  projectId: string,
  type: ProjectType
): ProjectPhase[] {
  const template = phaseTemplateForType(type);
  return template.map((phase, index) => {
    const phaseId = uid("ph");
    return {
      id: phaseId,
      projectId,
      key: phase.key,
      label: phase.label,
      sortOrder: index,
      status: index === 0 ? "active" : "upcoming",
      checklist: phase.checklist.map((item) => ({
        id: uid("ci"),
        phaseId,
        title: item.title,
        done: false,
        clientVisible: Boolean(item.clientVisible),
        waitingOnClient: Boolean(item.waitingOnClient),
      })),
    };
  });
}
