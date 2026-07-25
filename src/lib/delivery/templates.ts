import type { ProjectType } from "@/lib/data";

export type PhaseTemplate = {
  key: string;
  label: string;
  checklist: Array<{
    title: string;
    clientVisible?: boolean;
    waitingOnClient?: boolean;
  }>;
};

const websitePhases: PhaseTemplate[] = [
  {
    key: "discovery",
    label: "Discovery",
    checklist: [
      { title: "Kickoff call done" },
      { title: "Brief / goals captured" },
      { title: "Sitemap / IA agreed", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "design",
    label: "Design",
    checklist: [
      { title: "Wireframes ready" },
      { title: "Visual design in Figma" },
      { title: "Client design approval", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "build",
    label: "Build",
    checklist: [
      { title: "Staging environment live" },
      { title: "Core pages / flows built" },
      { title: "Content inserted", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "review",
    label: "Review",
    checklist: [
      { title: "Internal QA" },
      { title: "Client staging review", clientVisible: true, waitingOnClient: true },
      { title: "Bugs fixed" },
    ],
  },
  {
    key: "launch",
    label: "Launch",
    checklist: [
      { title: "DNS / hosting ready" },
      { title: "Go-live" },
      { title: "Smoke test on production" },
    ],
  },
  {
    key: "handoff",
    label: "Handoff",
    checklist: [
      { title: "Training / docs delivered", clientVisible: true },
      { title: "Credentials handed over" },
      { title: "Warranty / support window set" },
    ],
  },
];

const webAppPhases: PhaseTemplate[] = [
  {
    key: "discovery",
    label: "Discovery",
    checklist: [
      { title: "Problem & users defined" },
      { title: "MVP scope locked", clientVisible: true, waitingOnClient: true },
      { title: "Tech approach chosen" },
    ],
  },
  {
    key: "design",
    label: "Design",
    checklist: [
      { title: "User flows mapped" },
      { title: "UI kit / screens in Figma" },
      { title: "Client design approval", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "build",
    label: "Build",
    checklist: [
      { title: "Auth & core data model" },
      { title: "Key features on staging" },
      { title: "Client feedback round", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "review",
    label: "Review",
    checklist: [
      { title: "QA pass" },
      { title: "Staging sign-off", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "launch",
    label: "Launch",
    checklist: [
      { title: "Production deploy" },
      { title: "Monitoring / analytics" },
    ],
  },
  {
    key: "handoff",
    label: "Handoff",
    checklist: [
      { title: "Admin docs / training", clientVisible: true },
      { title: "Support plan confirmed" },
    ],
  },
];

const mobilePhases: PhaseTemplate[] = [
  {
    key: "discovery",
    label: "Discovery",
    checklist: [
      { title: "Platform targets (iOS/Android) confirmed" },
      { title: "MVP feature list approved", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "design",
    label: "Design",
    checklist: [
      { title: "App flows & navigation" },
      { title: "High-fidelity screens" },
      { title: "Client design approval", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "mvp",
    label: "MVP",
    checklist: [
      { title: "Core screens built" },
      { title: "TestFlight / internal build" },
      { title: "Client MVP review", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "iterate",
    label: "Iterate",
    checklist: [
      { title: "Feedback prioritized" },
      { title: "Iteration shipped to staging" },
      { title: "Client sign-off to launch", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "launch",
    label: "Launch",
    checklist: [
      { title: "Store assets ready", clientVisible: true, waitingOnClient: true },
      { title: "Store submission" },
      { title: "Live in stores" },
    ],
  },
  {
    key: "handoff",
    label: "Handoff",
    checklist: [
      { title: "Handoff docs" },
      { title: "Maintenance plan" },
    ],
  },
];

const lightPhases: PhaseTemplate[] = [
  {
    key: "discovery",
    label: "Discovery",
    checklist: [
      { title: "Scope confirmed", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "delivery",
    label: "Delivery",
    checklist: [
      { title: "Work in progress on staging" },
      { title: "Client checkpoint", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "review",
    label: "Review",
    checklist: [
      { title: "Final review", clientVisible: true, waitingOnClient: true },
    ],
  },
  {
    key: "handoff",
    label: "Handoff",
    checklist: [{ title: "Deliverables handed over", clientVisible: true }],
  },
];

export function phaseTemplateForType(type: ProjectType): PhaseTemplate[] {
  switch (type) {
    case "Mobile app":
      return mobilePhases;
    case "Web app":
      return webAppPhases;
    case "AI agent":
    case "Consulting":
      return lightPhases;
    case "Website redesign":
    case "New website":
    case "Maintenance":
    default:
      return websitePhases;
  }
}

export function approvalKindsForPhase(phaseKey: string): Array<"design" | "staging" | "launch"> {
  if (phaseKey === "design") return ["design"];
  if (phaseKey === "review" || phaseKey === "iterate" || phaseKey === "mvp") {
    return ["staging"];
  }
  if (phaseKey === "launch") return ["launch"];
  return [];
}
