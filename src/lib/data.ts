// ---------------------------------------------------------------------------
// Seed / mock data for Outpost.
// ---------------------------------------------------------------------------

export type Member = {
  id: string;
  name: string;
  initials: string;
  role: "Admin" | "Member" | "Client";
  avatarUrl: string | null;
};

export const members: Member[] = [
  { id: "u1", name: "Tim", initials: "TI", role: "Admin", avatarUrl: null },
  { id: "u2", name: "Luka", initials: "LU", role: "Member", avatarUrl: null },
];

export function initialsFromName(name: string) {
  const cleaned = name.replace(/[^A-Za-zÀ-ž\s]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function normalizeMember(m: Member): Member {
  return {
    ...m,
    initials: m.initials || initialsFromName(m.name),
    avatarUrl: m.avatarUrl ?? null,
    role: m.role === "Admin" ? "Admin" : m.role === "Client" ? "Client" : "Member",
  };
}

export function memberById(id: string, list: Member[] = members): Member {
  return (
    list.find((m) => m.id === id) ?? {
      id,
      name: "Unknown",
      initials: "?",
      role: "Member",
      avatarUrl: null,
    }
  );
}

// ---- Leads ----------------------------------------------------------------

export const leadStatuses = [
  "New",
  "Researching",
  "Ready to contact",
  "Contacted",
  "Follow-up needed",
  "Replied",
  "Meeting booked",
  "Proposal sent",
  "Negotiating",
  "Won",
  "Lost",
  "Not suitable",
] as const;

export type LeadStatus = (typeof leadStatuses)[number];

// The funnel stages used on the dashboard.
export const funnelStages = [
  "Lead",
  "Contacted",
  "Replied",
  "Meeting",
  "Proposal",
  "Won",
] as const;

export const leadSources = [
  "Upwork",
  "Cold email",
  "Referral",
  "LinkedIn",
  "Website",
  "Inbound",
] as const;

export const leadCategories = [
  "SaaS",
  "E-commerce",
  "Agency",
  "Restaurant",
  "Real estate",
  "Healthcare",
  "Fintech",
  "Local business",
] as const;

export type Lead = {
  id: string;
  company: string;
  website: string;
  contact: string;
  email: string;
  phone: string;
  country: string;
  category: (typeof leadCategories)[number];
  source: (typeof leadSources)[number];
  ownerId: string;
  status: LeadStatus;
  value: number; // estimated value €
  probability: number; // %
  firstContact: string | null;
  lastContact: string | null;
  nextFollowUp: string | null;
  tags: string[];
  notes: number; // count
  createdBy: string;
  /** Freeform research / pitch text (markdown). */
  description: string;
  /** 0–100 fit score from Qualify; null if never qualified. */
  qualifyScore: number | null;
  /** AI verdict rating from Qualify. */
  qualifyRating: "go" | "maybe" | "no-go" | null;
};

export function normalizeLead(l: Lead): Lead {
  const rating = l.qualifyRating;
  return {
    ...l,
    description: l.description ?? "",
    qualifyScore:
      typeof l.qualifyScore === "number" && Number.isFinite(l.qualifyScore)
        ? Math.max(0, Math.min(100, Math.round(l.qualifyScore)))
        : null,
    qualifyRating:
      rating === "go" || rating === "maybe" || rating === "no-go"
        ? rating
        : null,
  };
}

export const leads: Lead[] = [
  {
    id: "l1",
    company: "Nordic Coffee Co.",
    website: "nordiccoffee.dk",
    contact: "Mette Sørensen",
    email: "mette@nordiccoffee.dk",
    phone: "+45 31 22 55 11",
    country: "Denmark",
    category: "E-commerce",
    source: "Cold email",
    ownerId: "u1",
    status: "Negotiating",
    value: 8500,
    probability: 70,
    firstContact: "2026-05-12",
    lastContact: "2026-06-11",
    nextFollowUp: "2026-06-17",
    tags: ["redesign", "hot"],
    notes: 4,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u1",
  },
  {
    id: "l2",
    company: "Brightpath Clinic",
    website: "brightpathclinic.com",
    contact: "Dr. James Hale",
    email: "jhale@brightpath.com",
    phone: "+1 415 555 0192",
    country: "USA",
    category: "Healthcare",
    source: "Referral",
    ownerId: "u2",
    status: "Proposal sent",
    value: 12000,
    probability: 55,
    firstContact: "2026-05-20",
    lastContact: "2026-06-09",
    nextFollowUp: "2026-06-16",
    tags: ["web app"],
    notes: 6,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u2",
  },
  {
    id: "l3",
    company: "Vela Studio",
    website: "velastudio.io",
    contact: "Ana Kovač",
    email: "ana@velastudio.io",
    phone: "+386 41 222 333",
    country: "Slovenia",
    category: "Agency",
    source: "LinkedIn",
    ownerId: "u1",
    status: "Meeting booked",
    value: 6000,
    probability: 50,
    firstContact: "2026-06-01",
    lastContact: "2026-06-12",
    nextFollowUp: "2026-06-18",
    tags: ["redesign", "figma"],
    notes: 2,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u1",
  },
  {
    id: "l4",
    company: "Quantale Fintech",
    website: "quantale.com",
    contact: "Sven Berg",
    email: "sven@quantale.com",
    phone: "+46 70 123 45 67",
    country: "Sweden",
    category: "Fintech",
    source: "Inbound",
    ownerId: "u2",
    status: "Replied",
    value: 18000,
    probability: 40,
    firstContact: "2026-06-03",
    lastContact: "2026-06-13",
    nextFollowUp: "2026-06-19",
    tags: ["ai agent", "enterprise"],
    notes: 3,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u2",
  },
  {
    id: "l5",
    company: "Mercado Verde",
    website: "mercadoverde.es",
    contact: "Carlos Ruiz",
    email: "carlos@mercadoverde.es",
    phone: "+34 600 112 233",
    country: "Spain",
    category: "E-commerce",
    source: "Upwork",
    ownerId: "u1",
    status: "Contacted",
    value: 4500,
    probability: 25,
    firstContact: "2026-06-08",
    lastContact: "2026-06-10",
    nextFollowUp: "2026-06-15",
    tags: ["shopify"],
    notes: 1,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u1",
  },
  {
    id: "l6",
    company: "Harborview Realty",
    website: "harborviewrealty.com",
    contact: "Diane Foster",
    email: "diane@harborview.com",
    phone: "+1 617 555 7788",
    country: "USA",
    category: "Real estate",
    source: "Cold email",
    ownerId: "u2",
    status: "Follow-up needed",
    value: 7000,
    probability: 30,
    firstContact: "2026-05-28",
    lastContact: "2026-06-04",
    nextFollowUp: "2026-06-14",
    tags: ["new website"],
    notes: 2,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u2",
  },
  {
    id: "l7",
    company: "Trattoria Bella",
    website: "trattoriabella.it",
    contact: "Marco Rossi",
    email: "marco@trattoriabella.it",
    phone: "+39 333 444 5566",
    country: "Italy",
    category: "Restaurant",
    source: "Website",
    ownerId: "u1",
    status: "Ready to contact",
    value: 3000,
    probability: 15,
    firstContact: null,
    lastContact: null,
    nextFollowUp: "2026-06-16",
    tags: ["small"],
    notes: 1,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u1",
  },
  {
    id: "l8",
    company: "Pulse Analytics",
    website: "pulseanalytics.io",
    contact: "Nora Lind",
    email: "nora@pulseanalytics.io",
    phone: "+47 91 234 567",
    country: "Norway",
    category: "SaaS",
    source: "Referral",
    ownerId: "u2",
    status: "Won",
    value: 15000,
    probability: 100,
    firstContact: "2026-04-10",
    lastContact: "2026-05-22",
    nextFollowUp: null,
    tags: ["web app", "won"],
    notes: 8,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u2",
  },
  {
    id: "l9",
    company: "Greenfield Organics",
    website: "greenfield.co",
    contact: "Tom Baker",
    email: "tom@greenfield.co",
    phone: "+44 7700 900123",
    country: "UK",
    category: "E-commerce",
    source: "Cold email",
    ownerId: "u1",
    status: "Researching",
    value: 5500,
    probability: 10,
    firstContact: null,
    lastContact: null,
    nextFollowUp: "2026-06-20",
    tags: [],
    notes: 0,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u1",
  },
  {
    id: "l10",
    company: "Atlas Logistics",
    website: "atlaslog.de",
    contact: "Klaus Weber",
    email: "klaus@atlaslog.de",
    phone: "+49 151 23456789",
    country: "Germany",
    category: "Local business",
    source: "LinkedIn",
    ownerId: "u2",
    status: "Lost",
    value: 9000,
    probability: 0,
    firstContact: "2026-04-22",
    lastContact: "2026-05-15",
    nextFollowUp: null,
    tags: ["budget"],
    notes: 3,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u2",
  },
  {
    id: "l11",
    company: "Sunrise Dental",
    website: "sunrisedental.com",
    contact: "Emily Park",
    email: "emily@sunrisedental.com",
    phone: "+1 213 555 0148",
    country: "USA",
    category: "Healthcare",
    source: "Upwork",
    ownerId: "u1",
    status: "New",
    value: 4000,
    probability: 10,
    firstContact: null,
    lastContact: null,
    nextFollowUp: null,
    tags: [],
    notes: 0,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u1",
  },
  {
    id: "l12",
    company: "Loop Apparel",
    website: "loopapparel.com",
    contact: "Sara Jensen",
    email: "sara@loopapparel.com",
    phone: "+45 28 99 77 11",
    country: "Denmark",
    category: "E-commerce",
    source: "Inbound",
    ownerId: "u2",
    status: "New",
    value: 6500,
    probability: 15,
    firstContact: null,
    lastContact: null,
    nextFollowUp: "2026-06-21",
    tags: ["shopify", "redesign"],
    notes: 0,
    description: "",
    qualifyScore: null,
    qualifyRating: null,
    createdBy: "u2",
  },
];

export function leadById(id: string) {
  return leads.find((l) => l.id === id);
}

// ---- Activity timeline (per lead) -----------------------------------------

export type ActivityType =
  | "status"
  | "email"
  | "reply"
  | "meeting"
  | "proposal"
  | "note"
  | "call";

export type Activity = {
  id: string;
  leadId: string;
  type: ActivityType;
  title: string;
  detail?: string;
  date: string;
  userId: string;
};

export const activities: Activity[] = [
  {
    id: "a1",
    leadId: "l1",
    type: "status",
    title: "Status changed to Negotiating",
    date: "2026-06-11",
    userId: "u1",
  },
  {
    id: "a2",
    leadId: "l1",
    type: "proposal",
    title: "Proposal sent",
    detail: "Full e-commerce redesign — €8,500 fixed scope.",
    date: "2026-06-05",
    userId: "u1",
  },
  {
    id: "a3",
    leadId: "l1",
    type: "meeting",
    title: "Discovery call",
    detail: "30 min Zoom. Discussed migration from WooCommerce.",
    date: "2026-05-29",
    userId: "u1",
  },
  {
    id: "a4",
    leadId: "l1",
    type: "reply",
    title: "Mette replied",
    detail: "Interested, wants to see examples of past work.",
    date: "2026-05-18",
    userId: "u1",
  },
  {
    id: "a5",
    leadId: "l1",
    type: "email",
    title: "First outreach email sent",
    date: "2026-05-12",
    userId: "u1",
  },
];

export function activitiesForLead(leadId: string) {
  return activities.filter((a) => a.leadId === leadId);
}

// ---- Notes ----------------------------------------------------------------

export type Note = {
  id: string;
  leadId: string;
  title: string;
  body: string;
  pinned: boolean;
  date: string;
  userId: string;
};

export const notes: Note[] = [
  {
    id: "n1",
    leadId: "l1",
    title: "Redesign idea",
    body: "Hero needs a stronger value prop. Current site buries the subscription offer below the fold. Propose sticky add-to-cart + faster PDP.",
    pinned: true,
    date: "2026-05-29",
    userId: "u1",
  },
  {
    id: "n2",
    leadId: "l1",
    title: "Scope notes",
    body: "~6 templates, Klaviyo integration, blog migration. Estimated 3-4 weeks.",
    pinned: false,
    date: "2026-06-02",
    userId: "u1",
  },
];

export function notesForLead(leadId: string) {
  return notes.filter((n) => n.leadId === leadId);
}

// ---- Files & links --------------------------------------------------------

export const attachmentKinds = [
  "website",
  "figma",
  "proposal",
  "doc",
  "screenshot",
  "drive",
  "file",
] as const;
export type AttachmentKind = (typeof attachmentKinds)[number];
export type AttachmentParent =
  | "lead"
  | "project"
  | "doc"
  | "portal_update"
  | "ticket"
  | "ticket_comment"
  | "task"
  | "portal_message";

// ---- Clients --------------------------------------------------------------

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  country: string;
  notes: string;
  leadId?: string;
  createdAt: string;
  /** ISO timestamp when archived; null/undefined = active. */
  archivedAt: string | null;
  /** Billing address for invoices (free text / comma-separated). */
  billingAddress: string;
  taxNumber: string;
  vatId: string;
  registrationNumber: string;
  paymentTermsDays: number | null;
  authUserId: string | null;
  portalEmail: string | null;
  onboardingCompletedAt: string | null;
  /** Portal + onboarding UI language for this client account. */
  portalLocale: "en" | "sl";
  billingKind: "person" | "company" | null;
  firstName: string;
  lastName: string;
};

export function normalizeClient(c: Client): Client {
  return {
    ...c,
    archivedAt: c.archivedAt ?? null,
    billingAddress: c.billingAddress ?? "",
    taxNumber: c.taxNumber ?? "",
    vatId: c.vatId ?? "",
    registrationNumber: c.registrationNumber ?? "",
    paymentTermsDays: c.paymentTermsDays ?? null,
    authUserId: c.authUserId ?? null,
    portalEmail: c.portalEmail ?? null,
    onboardingCompletedAt: c.onboardingCompletedAt ?? null,
    portalLocale: c.portalLocale === "sl" ? "sl" : "en",
    billingKind: c.billingKind ?? null,
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
  };
}

export function isArchived(entity: { archivedAt?: string | null }) {
  return Boolean(entity.archivedAt);
}

function clientSeed(
  c: Omit<
    Client,
    | "archivedAt"
    | "billingAddress"
    | "taxNumber"
    | "vatId"
    | "registrationNumber"
    | "paymentTermsDays"
    | "authUserId"
    | "portalEmail"
    | "onboardingCompletedAt"
    | "portalLocale"
    | "billingKind"
    | "firstName"
    | "lastName"
  > &
    Partial<
      Pick<
        Client,
        | "archivedAt"
        | "billingAddress"
        | "taxNumber"
        | "vatId"
        | "registrationNumber"
        | "paymentTermsDays"
        | "authUserId"
        | "portalEmail"
        | "onboardingCompletedAt"
        | "portalLocale"
        | "billingKind"
        | "firstName"
        | "lastName"
      >
    >
): Client {
  return normalizeClient({ archivedAt: null, ...c } as Client);
}

export const clients: Client[] = [
  clientSeed({
    id: "c1",
    name: "Pulse Analytics",
    email: "hello@pulse.example",
    phone: "",
    company: "Pulse Analytics",
    website: "pulse.example",
    country: "SI",
    notes: "",
    leadId: "l8",
    createdAt: "2026-05-20T10:00:00.000Z",
  }),
  clientSeed({
    id: "c2",
    name: "Aurora Spa",
    email: "team@aurora.example",
    phone: "",
    company: "Aurora Spa",
    website: "",
    country: "SI",
    notes: "",
    createdAt: "2026-03-01T10:00:00.000Z",
  }),
  clientSeed({
    id: "c3",
    name: "Finchley",
    email: "ops@finchley.example",
    phone: "",
    company: "Finchley",
    website: "",
    country: "UK",
    notes: "",
    createdAt: "2026-03-28T10:00:00.000Z",
  }),
  clientSeed({
    id: "c4",
    name: "Vortex Media",
    email: "hi@vortex.example",
    phone: "",
    company: "Vortex Media",
    website: "",
    country: "DE",
    notes: "",
    createdAt: "2026-04-28T10:00:00.000Z",
  }),
  clientSeed({
    id: "c5",
    name: "Casa Nova",
    email: "info@casanova.example",
    phone: "",
    company: "Casa Nova",
    website: "",
    country: "IT",
    notes: "",
    createdAt: "2026-06-01T10:00:00.000Z",
  }),
  clientSeed({
    id: "c6",
    name: "Lumen Co.",
    email: "hello@lumen.example",
    phone: "",
    company: "Lumen Co.",
    website: "",
    country: "SI",
    notes: "",
    createdAt: "2026-01-20T10:00:00.000Z",
  }),
  clientSeed({
    id: "c7",
    name: "Bright Bistro",
    email: "hello@bright.example",
    phone: "",
    company: "Bright Bistro",
    website: "",
    country: "SI",
    notes: "",
    createdAt: "2026-01-10T10:00:00.000Z",
  }),
];

// ---- Tickets (project workspace) ------------------------------------------

export const ticketStatuses = [
  "Todo",
  "In progress",
  "Waiting on client",
  "Done",
] as const;
export type TicketStatus = (typeof ticketStatuses)[number];

export type TicketParty = "studio" | "client";

export const ticketPriorities = ["Low", "Medium", "High"] as const;
export type TicketPriority = (typeof ticketPriorities)[number];

export type Ticket = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  tags: string[];
  createdAt: string;
  dueAt: string | null;
  assigneeKind: TicketParty;
  assigneeId: string | null;
  createdByKind: TicketParty;
  createdByName: string;
};

export const ticketsSeed: Ticket[] = [
  {
    id: "tk1",
    projectId: "p1",
    title: "Review staging homepage copy",
    description:
      "Please check the hero and pricing copy on staging.\n\n- Tone OK?\n- Any missing CTAs?",
    status: "Waiting on client",
    priority: "Medium",
    tags: ["copy", "client"],
    createdAt: "2026-07-10T09:00:00.000Z",
    dueAt: "2026-07-18",
    assigneeKind: "client",
    assigneeId: null,
    createdByKind: "studio",
    createdByName: "Tim",
  },
  {
    id: "tk2",
    projectId: "p1",
    title: "Wire auth redirect after signup",
    description: "Users land on blank page after email confirm.",
    status: "In progress",
    priority: "High",
    tags: ["auth", "bug"],
    createdAt: "2026-07-12T11:00:00.000Z",
    dueAt: "2026-07-22",
    assigneeKind: "studio",
    assigneeId: "u2",
    createdByKind: "studio",
    createdByName: "Tim",
  },
];

// ---- Ticket comments (Linear-style threads) --------------------------------

export type TicketComment = {
  id: string;
  ticketId: string;
  parentId: string | null;
  body: string;
  authorKind: TicketParty;
  authorName: string;
  authorId: string | null;
  createdAt: string;
  editedAt: string | null;
};

export type TicketCommentReaction = {
  id: string;
  commentId: string;
  emoji: string;
  authorKind: TicketParty;
  authorName: string;
  createdAt: string;
};

export const ticketCommentsSeed: TicketComment[] = [
  {
    id: "tc1",
    ticketId: "tk1",
    parentId: null,
    body: "Hey @Client — staging hero is ready for your eyes. Anything off?",
    authorKind: "studio",
    authorName: "Tim",
    authorId: "u1",
    createdAt: "2026-07-11T10:00:00.000Z",
    editedAt: null,
  },
  {
    id: "tc2",
    ticketId: "tk1",
    parentId: "tc1",
    body: "Looks good — can we soften the CTA a bit?",
    authorKind: "client",
    authorName: "Pulse Analytics",
    authorId: null,
    createdAt: "2026-07-11T14:20:00.000Z",
    editedAt: null,
  },
];

export const ticketCommentReactionsSeed: TicketCommentReaction[] = [
  {
    id: "tcr1",
    commentId: "tc2",
    emoji: "👍",
    authorKind: "studio",
    authorName: "Tim",
    createdAt: "2026-07-11T15:00:00.000Z",
  },
];

export const deliveryPhaseOptions = [
  "Discovery",
  "Design",
  "Build",
  "Review",
  "Launch",
  "Handoff",
  "Maintenance",
] as const;
export type DeliveryPhase = (typeof deliveryPhaseOptions)[number];

export type Attachment = {
  id: string;
  parentType: AttachmentParent;
  parentId: string;
  label: string;
  kind: AttachmentKind;
  url: string | null;
  storagePath?: string | null;
  mime?: string | null;
  size?: number | null;
};

/** @deprecated Use Attachment — kept for gradual migration in UI */
export type FileLink = {
  id: string;
  leadId: string;
  label: string;
  kind: Exclude<AttachmentKind, "file">;
  url: string;
};

export const attachments: Attachment[] = [
  {
    id: "f1",
    parentType: "lead",
    parentId: "l1",
    label: "Current website",
    kind: "website",
    url: "nordiccoffee.dk",
  },
  {
    id: "f2",
    parentType: "lead",
    parentId: "l1",
    label: "Redesign — Figma",
    kind: "figma",
    url: "figma.com/file/abc",
  },
  {
    id: "f3",
    parentType: "lead",
    parentId: "l1",
    label: "Proposal v1.pdf",
    kind: "proposal",
    url: "drive.google.com/...",
  },
  {
    id: "f4",
    parentType: "lead",
    parentId: "l1",
    label: "Homepage screenshot",
    kind: "screenshot",
    url: "drive.google.com/...",
  },
];

/** Seed alias used by the file store */
export const fileLinks: FileLink[] = attachments
  .filter((a) => a.parentType === "lead" && a.url)
  .map((a) => ({
    id: a.id,
    leadId: a.parentId,
    label: a.label,
    kind: a.kind === "file" ? "doc" : a.kind,
    url: a.url!,
  }));

export function filesForLead(leadId: string) {
  return attachments.filter(
    (a) => a.parentType === "lead" && a.parentId === leadId
  );
}

export function attachmentsFor(
  parentType: AttachmentParent,
  parentId: string
) {
  return attachments.filter(
    (a) => a.parentType === parentType && a.parentId === parentId
  );
}

// ---- Tasks / follow-ups ---------------------------------------------------

export const taskPriorities = ["Low", "Medium", "High"] as const;
export type TaskPriority = (typeof taskPriorities)[number];
export const taskStatuses = ["Todo", "In progress", "Done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export type Task = {
  id: string;
  title: string;
  description: string;
  leadId?: string;
  projectId?: string;
  assignedTo: string;
  due: string;
  priority: TaskPriority;
  status: TaskStatus;
  reminder: boolean;
  /** Shown on the client portal when true. */
  clientVisible: boolean;
  /** Highlighted as “waiting on you” for the client. */
  waitingOnClient: boolean;
};

function t(
  task: Omit<Task, "description" | "clientVisible" | "waitingOnClient"> &
    Partial<Pick<Task, "description" | "clientVisible" | "waitingOnClient">>
): Task {
  return {
    description: "",
    clientVisible: false,
    waitingOnClient: false,
    ...task,
  };
}

export const tasks: Task[] = [
  t({ id: "t1", title: "Send second follow-up", leadId: "l6", assignedTo: "u2", due: "2026-06-14", priority: "High", status: "Todo", reminder: true }),
  t({ id: "t2", title: "Prepare hero redesign mockup", leadId: "l1", assignedTo: "u1", due: "2026-06-16", priority: "High", status: "In progress", reminder: true }),
  t({ id: "t3", title: "Check reply on Upwork", leadId: "l5", assignedTo: "u1", due: "2026-06-15", priority: "Medium", status: "Todo", reminder: false }),
  t({ id: "t4", title: "Prepare proposal", leadId: "l2", assignedTo: "u2", due: "2026-06-16", priority: "High", status: "Todo", reminder: true }),
  t({ id: "t5", title: "Call next week", leadId: "l3", assignedTo: "u1", due: "2026-06-18", priority: "Low", status: "Todo", reminder: false }),
  t({ id: "t6", title: "Research competitors", leadId: "l9", assignedTo: "u1", due: "2026-06-20", priority: "Low", status: "Todo", reminder: false }),
  t({ id: "t7", title: "Qualify inbound lead", leadId: "l4", assignedTo: "u2", due: "2026-06-13", priority: "Medium", status: "Done", reminder: false }),
  t({ id: "t8", title: "Send onboarding docs", projectId: "p1", assignedTo: "u2", due: "2026-06-12", priority: "Medium", status: "Done", reminder: false }),
  t({
    id: "t9",
    title: "Kickoff meeting — Pulse",
    projectId: "p1",
    assignedTo: "u2",
    due: "2026-06-19",
    priority: "Medium",
    status: "Todo",
    reminder: true,
    clientVisible: true,
  }),
];

export type PortalAuthorKind = "studio" | "client";

export type PortalUpdate = {
  id: string;
  projectId: string;
  body: string;
  authorKind: PortalAuthorKind;
  authorName: string;
  createdAt: string;
};

export type PortalComment = {
  id: string;
  projectId: string;
  targetType: "update" | "task";
  targetId: string;
  body: string;
  authorKind: PortalAuthorKind;
  authorName: string;
  createdAt: string;
};

/** One thread per project — studio ↔ client portal chat. */
export type PortalMessage = {
  id: string;
  projectId: string;
  parentId: string | null;
  body: string;
  authorKind: PortalAuthorKind;
  authorId: string | null;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
  /** Soft unsend — row kept, body hidden in UI. */
  deletedAt: string | null;
  attachmentId: string | null;
};

export type PortalMessageReaction = {
  id: string;
  messageId: string;
  emoji: string;
  authorKind: PortalAuthorKind;
  authorName: string;
  createdAt: string;
};

export function normalizePortalMessage(m: PortalMessage): PortalMessage {
  return {
    ...m,
    parentId: m.parentId ?? null,
    body: m.body ?? "",
    authorName: m.authorName ?? "",
    authorId: m.authorId ?? null,
    attachmentId: m.attachmentId ?? null,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
    createdAt: m.createdAt || new Date().toISOString(),
  };
}

export const portalUpdates: PortalUpdate[] = [];
export const portalComments: PortalComment[] = [];

// ---- Projects -------------------------------------------------------------

export const projectTypes = [
  "Website redesign",
  "New website",
  "Mobile app",
  "Web app",
  "AI agent",
  "Maintenance",
  "Consulting",
] as const;
export type ProjectType = (typeof projectTypes)[number];

export const projectStatuses = [
  "Discovery",
  "Proposal accepted",
  "In progress",
  "Client review",
  "Completed",
  "On hold",
  "Cancelled",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

// A single installment in a project's payment schedule.
export type Payment = {
  id: string;
  label: string; // "Deposit", "Midway", "Final", …
  percent: number; // share of the project value, e.g. 20
  dueOn: string | null;
  paid: boolean;
  paidOn: string | null;
  /** Linked invoice created via Invoice this (null until created). */
  invoiceId: string | null;
};

/** Default installments for a new project (no invoice rows yet). */
export function defaultPaymentSchedule(value: number): Array<
  Omit<Payment, "id">
> {
  if (value > 500) {
    return [
      {
        label: "Deposit",
        percent: 30,
        dueOn: null,
        paid: false,
        paidOn: null,
        invoiceId: null,
      },
      {
        label: "Midway",
        percent: 30,
        dueOn: null,
        paid: false,
        paidOn: null,
        invoiceId: null,
      },
      {
        label: "Final",
        percent: 40,
        dueOn: null,
        paid: false,
        paidOn: null,
        invoiceId: null,
      },
    ];
  }
  return [
    {
      label: "Full payment",
      percent: 100,
      dueOn: null,
      paid: false,
      paidOn: null,
      invoiceId: null,
    },
  ];
}

export type Project = {
  id: string;
  name: string;
  /** Denormalized client display name (kept in sync with Client). */
  client: string;
  clientId: string | null;
  description: string;
  phase: string;
  type: ProjectType;
  value: number;
  status: ProjectStatus;
  start: string;
  estimatedEnd: string;
  actualEnd: string | null;
  ownerId: string;
  cost: number;
  payments: Payment[];
  source: (typeof leadSources)[number];
  leadId?: string;
  portalEnabled: boolean;
  portalToken: string | null;
  portalPinHash: string | null;
  stagingUrl: string | null;
  portalIntro: string | null;
  figmaUrl: string | null;
  repoUrl: string | null;
  briefUrl: string | null;
  clientCanViewTickets: boolean;
  clientCanCreateTickets: boolean;
  clientCanUploadFiles: boolean;
  clientCanComment: boolean;
  /** Client portal UI language. */
  portalLocale: "en" | "sl";
  /** ISO timestamp when archived; null/undefined = active. */
  archivedAt: string | null;
  /** Last portal heartbeat from the client (studio-only presence). */
  portalClientLastSeenAt: string | null;
  /** Studio last opened this project's chat. */
  portalStudioLastReadAt: string | null;
  /** Client last opened this project's chat. */
  portalClientLastReadAt: string | null;
};

export type PhaseStatus = "upcoming" | "active" | "done";

export type PhaseChecklistItem = {
  id: string;
  phaseId: string;
  title: string;
  done: boolean;
  clientVisible: boolean;
  waitingOnClient: boolean;
};

export type ProjectPhase = {
  id: string;
  projectId: string;
  key: string;
  label: string;
  sortOrder: number;
  status: PhaseStatus;
  checklist: PhaseChecklistItem[];
};

export type PortalApprovalKind = "design" | "staging" | "launch";

export type PortalApproval = {
  id: string;
  projectId: string;
  kind: PortalApprovalKind;
  approvedAt: string;
  approvedByName: string;
  note: string | null;
};

export const projectPhasesSeed: ProjectPhase[] = [];
export const portalApprovalsSeed: PortalApproval[] = [];

export function normalizeProject(p: Project): Project {
  return {
    ...p,
    clientId: p.clientId ?? null,
    description: p.description ?? "",
    phase: p.phase ?? "Discovery",
    portalEnabled: p.portalEnabled ?? false,
    portalToken: p.portalToken ?? null,
    portalPinHash: p.portalPinHash ?? null,
    stagingUrl: p.stagingUrl ?? null,
    portalIntro: p.portalIntro ?? null,
    figmaUrl: p.figmaUrl ?? null,
    repoUrl: p.repoUrl ?? null,
    briefUrl: p.briefUrl ?? null,
    clientCanViewTickets: p.clientCanViewTickets ?? true,
    clientCanCreateTickets: p.clientCanCreateTickets ?? true,
    clientCanUploadFiles: p.clientCanUploadFiles ?? true,
    clientCanComment: p.clientCanComment ?? true,
    portalLocale: p.portalLocale === "sl" ? "sl" : "en",
    archivedAt: p.archivedAt ?? null,
    portalClientLastSeenAt: p.portalClientLastSeenAt ?? null,
    portalStudioLastReadAt: p.portalStudioLastReadAt ?? null,
    portalClientLastReadAt: p.portalClientLastReadAt ?? null,
  };
}

export function normalizeTicket(t: Ticket): Ticket {
  const priority = ticketPriorities.includes(t.priority as TicketPriority)
    ? (t.priority as TicketPriority)
    : "Medium";
  return {
    ...t,
    description: t.description ?? "",
    priority,
    tags: Array.isArray(t.tags)
      ? t.tags.map((x) => String(x).trim()).filter(Boolean)
      : [],
    dueAt: t.dueAt ?? null,
    assigneeId: t.assigneeId ?? null,
    createdByName: t.createdByName ?? "",
  };
}

export function projectProgress(phases: ProjectPhase[]) {
  if (!phases.length) return 0;
  const done = phases.filter((p) => p.status === "done").length;
  const active = phases.find((p) => p.status === "active");
  let partial = 0;
  if (active?.checklist.length) {
    const checked = active.checklist.filter((c) => c.done).length;
    partial = checked / active.checklist.length;
  }
  return Math.round(((done + partial) / phases.length) * 100);
}

export function normalizeTask(t: Task): Task {
  return {
    ...t,
    description: t.description ?? "",
    clientVisible: t.clientVisible ?? false,
    waitingOnClient: t.waitingOnClient ?? false,
  };
}

const portalDefaults = {
  description: "",
  phase: "Discovery" as string,
  portalEnabled: false,
  portalToken: null,
  portalPinHash: null,
  stagingUrl: null,
  portalIntro: null,
  figmaUrl: null,
  repoUrl: null,
  briefUrl: null,
  clientCanViewTickets: true,
  clientCanCreateTickets: true,
  clientCanUploadFiles: true,
  clientCanComment: true,
  portalLocale: "en" as const,
  archivedAt: null,
  portalClientLastSeenAt: null,
  portalStudioLastReadAt: null,
  portalClientLastReadAt: null,
} as const;

export const projects: Project[] = [
  {
    id: "p1", name: "Pulse Analytics — Web app", client: "Pulse Analytics", clientId: "c1", type: "Web app", value: 15000, status: "In progress", start: "2026-05-25", estimatedEnd: "2026-07-15", actualEnd: null, ownerId: "u2", cost: 1200, source: "Referral", leadId: "l8",
    ...portalDefaults,
    phase: "Build",
    description: "Analytics web app — dashboards, billing, and client reporting.",
    stagingUrl: "https://pulse-staging.example.com",
    portalIntro: "Here’s where we’re at — staging is live for review.",
    payments: [
      { id: "p1-1", label: "Deposit", percent: 20, dueOn: "2026-05-25", paid: true, paidOn: "2026-05-24", invoiceId: null },
      { id: "p1-2", label: "Midway", percent: 50, dueOn: "2026-06-20", paid: false, paidOn: null, invoiceId: null },
      { id: "p1-3", label: "Final", percent: 30, dueOn: "2026-07-15", paid: false, paidOn: null, invoiceId: null },
    ],
  },
  {
    id: "p2", name: "Aurora Spa — Redesign", client: "Aurora Spa", clientId: "c2", type: "Website redesign", value: 6800, status: "Completed", start: "2026-03-10", estimatedEnd: "2026-04-12", actualEnd: "2026-04-09", ownerId: "u1", cost: 400, source: "Upwork",
    ...portalDefaults,
    phase: "Handoff",
    payments: [
      { id: "p2-1", label: "Deposit", percent: 50, dueOn: "2026-03-10", paid: true, paidOn: "2026-03-09", invoiceId: null },
      { id: "p2-2", label: "Final", percent: 50, dueOn: "2026-04-12", paid: true, paidOn: "2026-04-10", invoiceId: null },
    ],
  },
  {
    id: "p3", name: "Finchley App", client: "Finchley", clientId: "c3", type: "Mobile app", value: 22000, status: "In progress", start: "2026-04-01", estimatedEnd: "2026-08-01", actualEnd: null, ownerId: "u1", cost: 3000, source: "Referral",
    ...portalDefaults,
    phase: "Build",
    payments: [
      { id: "p3-1", label: "Deposit", percent: 30, dueOn: "2026-04-01", paid: true, paidOn: "2026-03-30", invoiceId: null },
      { id: "p3-2", label: "Milestone 1", percent: 40, dueOn: "2026-06-01", paid: false, paidOn: null, invoiceId: null },
      { id: "p3-3", label: "Final", percent: 30, dueOn: "2026-08-01", paid: false, paidOn: null, invoiceId: null },
    ],
  },
  {
    id: "p4", name: "Vortex AI Assistant", client: "Vortex Media", clientId: "c4", type: "AI agent", value: 11000, status: "Client review", start: "2026-05-02", estimatedEnd: "2026-06-20", actualEnd: null, ownerId: "u2", cost: 800, source: "Inbound",
    ...portalDefaults,
    phase: "Review",
    payments: [
      { id: "p4-1", label: "Deposit", percent: 50, dueOn: "2026-05-02", paid: true, paidOn: "2026-05-01", invoiceId: null },
      { id: "p4-2", label: "Final", percent: 50, dueOn: "2026-06-20", paid: false, paidOn: null, invoiceId: null },
    ],
  },
  {
    id: "p5", name: "Casa Nova — New site", client: "Casa Nova", clientId: "c5", type: "New website", value: 4200, status: "Discovery", start: "2026-06-05", estimatedEnd: "2026-07-05", actualEnd: null, ownerId: "u1", cost: 0, source: "Website",
    ...portalDefaults,
    phase: "Discovery",
    payments: [],
  },
  {
    id: "p6", name: "Lumen Maintenance", client: "Lumen Co.", clientId: "c6", type: "Maintenance", value: 2400, status: "On hold", start: "2026-02-01", estimatedEnd: "2026-12-31", actualEnd: null, ownerId: "u2", cost: 100, source: "Referral",
    ...portalDefaults,
    phase: "Maintenance",
    payments: [
      { id: "p6-1", label: "Annual fee", percent: 100, dueOn: "2026-02-01", paid: true, paidOn: "2026-02-01", invoiceId: null },
    ],
  },
  {
    id: "p7", name: "Bright Bistro — Redesign", client: "Bright Bistro", clientId: "c7", type: "Website redesign", value: 5200, status: "Completed", start: "2026-01-15", estimatedEnd: "2026-02-20", actualEnd: "2026-02-25", ownerId: "u1", cost: 300, source: "Cold email",
    ...portalDefaults,
    phase: "Handoff",
    payments: [
      { id: "p7-1", label: "Deposit", percent: 50, dueOn: "2026-01-15", paid: true, paidOn: "2026-01-14", invoiceId: null },
      { id: "p7-2", label: "Final", percent: 50, dueOn: "2026-02-20", paid: true, paidOn: "2026-02-26", invoiceId: null },
    ],
  },
];

// ---- Payment helpers ------------------------------------------------------

export function paymentAmount(value: number, percent: number) {
  return Math.round((value * percent) / 100);
}

export function paidAmount(p: Project) {
  return p.payments
    .filter((pay) => pay.paid)
    .reduce((s, pay) => s + paymentAmount(p.value, pay.percent), 0);
}

export function scheduledPercent(p: Project) {
  return p.payments.reduce((s, pay) => s + pay.percent, 0);
}

export function isFullyPaid(p: Project) {
  return p.payments.length > 0 && p.payments.every((pay) => pay.paid);
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type MonthlyRevenuePoint = {
  month: string;
  revenue: number;
};

/** Build dashboard chart series from paid project installments (`paidOn`). */
export function monthlyRevenueFromPayments(
  projects: Project[],
  year: number
): MonthlyRevenuePoint[] {
  const totals = Array.from({ length: 12 }, () => 0);
  for (const project of projects) {
    for (const pay of project.payments) {
      if (!pay.paid || !pay.paidOn) continue;
      const d = new Date(`${pay.paidOn}T00:00:00`);
      if (!Number.isFinite(d.getTime()) || d.getFullYear() !== year) continue;
      totals[d.getMonth()] += paymentAmount(project.value, pay.percent);
    }
  }

  const now = new Date();
  let lastMonth =
    year < now.getFullYear()
      ? 11
      : year > now.getFullYear()
        ? -1
        : now.getMonth();
  for (let i = 0; i < 12; i++) {
    if (totals[i] > 0) lastMonth = Math.max(lastMonth, i);
  }
  if (lastMonth < 0) {
    return MONTH_LABELS.slice(0, 1).map((month) => ({ month, revenue: 0 }));
  }

  return MONTH_LABELS.slice(0, lastMonth + 1).map((month, i) => ({
    month,
    revenue: totals[i],
  }));
}

// ---- Docs / playbook ------------------------------------------------------

export const docCategories = [
  "Sales Process",
  "Lead Qualification",
  "Outreach Templates",
  "Follow-up Templates",
  "Pricing",
  "Proposal Process",
  "Discovery Questions",
  "Project Delivery",
] as const;

export type DocCategory = (typeof docCategories)[number];

export type Doc = {
  id: string;
  title: string;
  category: DocCategory;
  excerpt: string;
  authorId: string;
  lastEdited: string;
  tags: string[];
  favorite: boolean;
  body?: string; // persisted body for created/edited docs (seeds use docContent)
};

export const docs: Doc[] = [
  { id: "d1", title: "Cold email — first touch", category: "Outreach Templates", excerpt: "Subject lines and the 3-line opener we use for cold outreach.", authorId: "u1", lastEdited: "2026-06-01", tags: ["email", "cold"], favorite: true },
  { id: "d2", title: "Lead qualification checklist", category: "Lead Qualification", excerpt: "Budget, authority, need, timeline — when to mark Not suitable.", authorId: "u2", lastEdited: "2026-05-20", tags: ["qualify"], favorite: true },
  { id: "d3", title: "Pricing tiers 2026", category: "Pricing", excerpt: "Redesign, new site, web app and AI agent price bands.", authorId: "u1", lastEdited: "2026-06-10", tags: ["pricing"], favorite: false },
  { id: "d4", title: "Discovery call questions", category: "Discovery Questions", excerpt: "15 questions to scope a redesign or app build properly.", authorId: "u1", lastEdited: "2026-04-30", tags: ["discovery"], favorite: false },
  { id: "d5", title: "Follow-up sequence", category: "Follow-up Templates", excerpt: "4-step follow-up cadence across 14 days.", authorId: "u2", lastEdited: "2026-05-28", tags: ["follow-up"], favorite: true },
  { id: "d6", title: "Website redesign checklist", category: "Project Delivery", excerpt: "Everything from kickoff to launch for a redesign project.", authorId: "u1", lastEdited: "2026-06-08", tags: ["delivery", "redesign"], favorite: false },
  { id: "d7", title: "Proposal structure", category: "Proposal Process", excerpt: "How we structure a winning proposal — problem, scope, price, timeline.", authorId: "u2", lastEdited: "2026-05-15", tags: ["proposal"], favorite: false },
  { id: "d8", title: "Sales process overview", category: "Sales Process", excerpt: "The full pipeline from lead to won, stage by stage.", authorId: "u1", lastEdited: "2026-06-12", tags: ["process"], favorite: false },
];

export function docById(id: string) {
  return docs.find((d) => d.id === id);
}

// Full bodies for the doc detail view. Lightweight markdown:
// "## " headings, "- " bullets, "1. " numbered, blank line = paragraph break.
export const docContent: Record<string, string> = {
  d1: `## When to use
For first-touch cold outreach to a company we've researched and qualified. Keep it short — three lines, one ask.

## Subject lines
- Quick idea for {{company}}
- {{company}} — homepage thought
- Loved your work on {{product}}

## The 3-line opener
1. One specific, genuine observation about their site or product.
2. One sentence on the result we could help them get.
3. A low-friction ask — "Worth a quick 15-min call?"

## Notes
Never send before researching. No attachments on the first email. Follow the [[follow-up-sequence]] if there's no reply.`,
  d2: `## Qualify on BANT
- **Budget** — can they afford a €4k+ project?
- **Authority** — are we talking to the decision maker?
- **Need** — is there a real problem we solve?
- **Timeline** — do they want to start within ~3 months?

## Mark "Not suitable" when
- Budget is clearly under €2k.
- They want equity / "exposure" instead of payment.
- The scope is pure maintenance with no upside.

## Score
Two or more strong BANT signals → move to Ready to contact.`,
  d3: `## Price bands (2026)
- **Website redesign** — €4,000–8,000
- **New website** — €3,000–6,000
- **Web app** — €12,000–25,000
- **Mobile app** — €18,000–30,000
- **AI agent** — €8,000–15,000
- **Maintenance** — €200–500 / month

## Rules
- Always quote a range first, fixed price after discovery.
- Add 15% buffer for unknowns.
- 50% upfront, 50% on delivery for projects over €5k.`,
  d4: `## Discovery call — 15 questions
1. What does success look like 6 months after launch?
2. Who are your top 3 competitors?
3. What's working on the current site? What isn't?
4. Who are the primary users?
5. What's the single most important action a visitor should take?
6. Do you have brand guidelines / assets?
7. What's your timeline and is it flexible?
8. What's the budget range?
9. Who signs off on the design?
10. What tools do you use (CMS, CRM, analytics)?
11. Any integrations required?
12. Who maintains the site after launch?
13. What content is ready vs. needs to be created?
14. Any legal / accessibility requirements?
15. What would make this project a 10/10 for you?`,
  d5: `## 4-step cadence (14 days)
1. **Day 0** — first outreach (see [[cold-email-first-touch]]).
2. **Day 3** — short bump: "Floating this back to the top of your inbox."
3. **Day 7** — add value: share a relevant example or quick idea.
4. **Day 14** — break-up email: "Should I close the file for now?"

## Notes
Stop the sequence the moment they reply. Move the lead to Replied and log the activity.`,
  d6: `## Website redesign checklist
### Kickoff
- Signed proposal + 50% deposit received
- Access to hosting, domain, analytics
- Brand assets collected

### Design
- Sitemap agreed
- Wireframes approved
- Hi-fi design approved in Figma

### Build
- Components built
- Responsive QA (mobile, tablet, desktop)
- Performance pass (Lighthouse > 90)

### Launch
- Content migrated
- Redirects in place
- Analytics + forms tested
- Client sign-off + final invoice`,
  d7: `## Proposal structure
1. **Problem** — restate their problem in their words.
2. **Approach** — how we'll solve it, in plain language.
3. **Scope** — what's included (and explicitly what's not).
4. **Timeline** — phases with rough dates.
5. **Price** — fixed price + payment terms.
6. **Next step** — one clear call to action.

## Notes
Keep it under 3 pages. Send as a link, not a PDF, so we can see opens.`,
  d8: `## The pipeline
Lead → Contacted → Replied → Meeting → Proposal → Won / Lost

## Stage by stage
- **New / Researching** — gathering info, not yet contacted.
- **Ready to contact** — qualified, awaiting first touch.
- **Contacted** — outreach sent, awaiting reply.
- **Replied / Meeting booked** — active conversation.
- **Proposal sent / Negotiating** — deal on the table.
- **Won** — convert to a project.
- **Lost / Not suitable** — log the reason for future learning.

## Owner rules
Whoever sends the first email owns the lead until it's Won or Lost.`,
};

// ---- Firm settings (goals / dashboard) ------------------------------------

export type FirmSettings = {
  firmName: string;
  revenueGoal: number;
  goalYear: number;
  avgProjectValue: number;
  monthlyRevenue: MonthlyRevenuePoint[];
  /** Issuer / s.p. billing for invoices */
  /** Legal / trade name on the invoice (header + payment info). */
  billingCompanyName: string;
  billingAddress: string;
  billingEmail: string;
  billingPhone: string;
  taxNumber: string;
  vatId: string;
  vatStatus: string;
  registrationNumber: string;
  iban: string;
  bic: string;
  bankName: string;
  issuePlace: string;
  /** Storage path or /api/files/... URL for signature PNG */
  signaturePath: string | null;
  invoicePrefix: string;
  /** year (string) → next sequence number */
  invoiceNextSequenceByYear: Record<string, number>;
  /** year (string) → next quote sequence number */
  quoteNextSequenceByYear: Record<string, number>;
  defaultCurrency: "EUR" | "USD" | "GBP";
  defaultPaymentTermsDays: number;
  /** Editable system prompt for AI lead emails. Empty → app default. */
  aiEmailSystemPrompt: string;
  /** Resend From display name */
  outboundFromName: string;
  /** Resend From email (must be on a verified domain) */
  outboundFromEmail: string;
};

export const defaultFirmSettings: FirmSettings = {
  firmName: "Studio",
  revenueGoal: 20000,
  goalYear: 2026,
  avgProjectValue: 6000,
  monthlyRevenue: [
    { month: "Jan", revenue: 5200 },
    { month: "Feb", revenue: 0 },
    { month: "Mar", revenue: 0 },
    { month: "Apr", revenue: 6800 },
    { month: "May", revenue: 0 },
    { month: "Jun", revenue: 4500 },
  ],
  billingCompanyName: "",
  billingAddress: "",
  billingEmail: "",
  billingPhone: "",
  taxNumber: "",
  vatId: "",
  vatStatus: "",
  registrationNumber: "",
  iban: "",
  bic: "",
  bankName: "",
  issuePlace: "",
  signaturePath: null,
  invoicePrefix: "",
  invoiceNextSequenceByYear: {},
  quoteNextSequenceByYear: {},
  defaultCurrency: "EUR",
  defaultPaymentTermsDays: 14,
  aiEmailSystemPrompt: "",
  outboundFromName: "Tim",
  outboundFromEmail: "tim@timblazic.dev",
};

export function normalizeFirmSettings(s: FirmSettings): FirmSettings {
  return {
    ...defaultFirmSettings,
    ...s,
    signaturePath: s.signaturePath ?? null,
    invoiceNextSequenceByYear: s.invoiceNextSequenceByYear ?? {},
    quoteNextSequenceByYear: s.quoteNextSequenceByYear ?? {},
    defaultCurrency: s.defaultCurrency ?? "EUR",
    defaultPaymentTermsDays: s.defaultPaymentTermsDays ?? 14,
    aiEmailSystemPrompt: s.aiEmailSystemPrompt ?? "",
    outboundFromName:
      s.outboundFromName?.trim() || defaultFirmSettings.outboundFromName,
    outboundFromEmail:
      s.outboundFromEmail?.trim() || defaultFirmSettings.outboundFromEmail,
  };
}

// ---- Invoices -------------------------------------------------------------

export const invoiceStatuses = ["draft", "issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export type InvoiceLineItem = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
};

export type InvoiceClientSnapshot = {
  name: string;
  email: string;
  companyName: string;
  address: string;
  vatId: string;
  taxNumber: string;
  registrationNumber: string;
};

export type Invoice = {
  id: string;
  clientId: string | null;
  /** Optional link to a delivery project (same client). */
  projectId: string | null;
  /** Optional link to a project payment installment. */
  paymentId: string | null;
  clientSnapshot: InvoiceClientSnapshot;
  invoiceNumber: string | null;
  year: number | null;
  sequence: number | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  /** Set when status becomes paid — drives dashboard collected revenue. */
  paidAt: string | null;
  currency: "EUR" | "USD" | "GBP";
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function computeInvoiceTotals(lineItems: InvoiceLineItem[]) {
  let subtotal = 0;
  let taxTotal = 0;
  for (const l of lineItems) {
    const lt = l.qty * l.unitPrice;
    subtotal += lt;
    taxTotal += (lt * (l.taxRate || 0)) / 100;
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    total: Math.round((subtotal + taxTotal) * 100) / 100,
  };
}

export function snapshotFromClient(client: Client): InvoiceClientSnapshot {
  return {
    // Invoices bill the company only — contact name stays off the PDF.
    name: "",
    email: client.email,
    companyName: client.company || "",
    address: client.billingAddress || "",
    vatId: client.vatId || "",
    taxNumber: client.taxNumber || "",
    registrationNumber: client.registrationNumber || "",
  };
}

export function normalizeInvoice(inv: Invoice): Invoice {
  const lineItems = (inv.lineItems ?? []).map((l) => ({
    description: l.description ?? "",
    qty: Number(l.qty) || 0,
    unit: l.unit ?? "",
    unitPrice: Number(l.unitPrice) || 0,
    taxRate: Number(l.taxRate) || 0,
  }));
  const totals = computeInvoiceTotals(lineItems);
  return {
    ...inv,
    clientSnapshot: {
      name: inv.clientSnapshot?.name ?? "",
      email: inv.clientSnapshot?.email ?? "",
      companyName: inv.clientSnapshot?.companyName ?? "",
      address: inv.clientSnapshot?.address ?? "",
      vatId: inv.clientSnapshot?.vatId ?? "",
      taxNumber: inv.clientSnapshot?.taxNumber ?? "",
      registrationNumber: inv.clientSnapshot?.registrationNumber ?? "",
    },
    lineItems,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    notes: inv.notes ?? "",
    invoiceNumber: inv.invoiceNumber ?? null,
    year: inv.year ?? null,
    sequence: inv.sequence ?? null,
    projectId: inv.projectId ?? null,
    paymentId: inv.paymentId ?? null,
    paidAt: inv.paidAt ?? null,
    createdBy: inv.createdBy ?? null,
  };
}

/** Date used for dashboard revenue (paid date, else issue date). */
export function invoiceRevenueDate(inv: Invoice): string | null {
  if (inv.status !== "paid") return null;
  return inv.paidAt || inv.issueDate || null;
}

/** Year-based number: 2026 → 26-0001 */
export function formatInvoiceNumber(year: number, sequence: number) {
  const yy = String(year).slice(-2);
  const nnnn = String(sequence).padStart(4, "0");
  return `${yy}-${nnnn}`;
}

// ---- Quotes (ponudbe) -----------------------------------------------------

export const quoteStatuses = ["draft", "sent", "accepted", "declined"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export type QuoteLineItem = {
  description: string;
  amount: number;
};

export type Quote = {
  id: string;
  leadId: string | null;
  status: QuoteStatus;
  locale: "sl" | "en";
  number: string | null;
  year: number | null;
  sequence: number | null;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  intro: string;
  scope: string;
  notes: string;
  discoveryNotes: string;
  /** Free-text estimate, e.g. "3–4 tedne". Empty = omit from quote. */
  projectDuration: string;
  lineItems: QuoteLineItem[];
  currency: "EUR";
  subtotal: number;
  total: number;
  validUntil: string | null;
  sentAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function computeQuoteTotals(items: QuoteLineItem[]) {
  const subtotal = items.reduce((s, i) => {
    const n = Number(i.amount);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  const rounded = Math.round(subtotal * 100) / 100;
  return { subtotal: rounded, total: rounded };
}

export function normalizeQuote(q: Quote): Quote {
  const lineItems = (q.lineItems ?? []).map((l) => ({
    description: (l.description ?? "").trim(),
    amount: Number.isFinite(Number(l.amount)) ? Number(l.amount) : 0,
  }));
  const totals = computeQuoteTotals(lineItems);
  const locale = q.locale === "en" ? "en" : "sl";
  const status = (quoteStatuses as readonly string[]).includes(q.status)
    ? q.status
    : "draft";
  return {
    ...q,
    status,
    locale,
    leadId: q.leadId ?? null,
    number: q.number ?? null,
    year: q.year ?? null,
    sequence: q.sequence ?? null,
    clientName: q.clientName ?? "",
    clientCompany: q.clientCompany ?? "",
    clientEmail: q.clientEmail ?? "",
    intro: q.intro ?? "",
    scope: q.scope ?? "",
    notes: q.notes ?? "",
    discoveryNotes: q.discoveryNotes ?? "",
    projectDuration: (q.projectDuration ?? "").trim(),
    lineItems,
    currency: "EUR",
    subtotal: totals.subtotal,
    total: totals.total,
    validUntil: q.validUntil ?? null,
    sentAt: q.sentAt ?? null,
    createdBy: q.createdBy ?? null,
  };
}

/** Quote number: 2026 / seq 1 → P-26-0001 */
export function formatQuoteNumber(year: number, sequence: number) {
  const yy = String(year).slice(-2);
  const nnnn = String(sequence).padStart(4, "0");
  return `P-${yy}-${nnnn}`;
}

/** @deprecated Use firm settings */
export const revenueGoal2026 = defaultFirmSettings.revenueGoal;
/** @deprecated Use firm settings */
export const monthlyRevenue = defaultFirmSettings.monthlyRevenue;

export const monthlyPipeline = [
  { month: "Jan", revenue: 4000, pipeline: 12000 },
  { month: "Feb", revenue: 0, pipeline: 18000 },
  { month: "Mar", revenue: 5200, pipeline: 22000 },
  { month: "Apr", revenue: 6800, pipeline: 26000 },
  { month: "May", revenue: 0, pipeline: 31000 },
  { month: "Jun", revenue: 4500, pipeline: 38000 },
];
