export type PortalLocale = "en" | "sl";

export function normalizePortalLocale(
  value: string | null | undefined
): PortalLocale {
  return value === "sl" ? "sl" : "en";
}

const en = {
  projectPortal: "Project portal",
  enterPin: "Enter your PIN",
  pinHint: "Shared access for tickets, files, and project status.",
  continue: "Continue",
  lock: "Lock",
  phase: "Phase",
  status: "Status",
  overview: "Overview",
  tickets: "Tickets",
  files: "Files",
  whereWeAre: "Where we are",
  noDescription:
    "No project description yet — tickets and files below will keep you in the loop.",
  openStaging: "Open staging",
  openTickets: "Open tickets",
  nothingWaiting: "Nothing waiting right now.",
  board: "Board",
  list: "List",
  newTicket: "New ticket",
  whatsNeeded: "What’s needed?",
  detailsMarkdown: "Details (markdown ok)",
  create: "Create",
  cancel: "Cancel",
  noTickets: "No tickets yet.",
  ticketViewOff: "Ticket viewing is turned off for this project.",
  noDueDate: "No due date",
  due: "due",
  opened: "Opened",
  by: "by",
  noTicketDescription: "No description.",
  comments: "Comments",
  writeComment: "Write a comment… Type @ to mention",
  reply: "Reply",
  comment: "Comment",
  noComments: "No comments yet — start the conversation.",
  attach: "Attach",
  upload: "Upload",
  open: "Open",
  unavailable: "Unavailable",
  noFiles: "No files shared yet.",
  quietPlace: "A quiet place to follow the work.",
  failed: "Failed",
  uploadFailed: "Upload failed",
  assigneeStudio: "Studio",
  assigneeClient: "Client",
  statuses: {
    Todo: "Todo",
    "In progress": "In progress",
    "Waiting on client": "Waiting on client",
    Done: "Done",
  } as Record<string, string>,
};

const sl: typeof en = {
  projectPortal: "Portal projekta",
  enterPin: "Vnesi PIN",
  pinHint: "Skupni dostop do ticketov, datotek in statusa projekta.",
  continue: "Nadaljuj",
  lock: "Zakleni",
  phase: "Faza",
  status: "Status",
  overview: "Pregled",
  tickets: "Tickety",
  files: "Datoteke",
  whereWeAre: "Kje smo",
  noDescription:
    "Opis projekta še ni vpisan — tickety in datoteke spodaj te bodo držali v zanki.",
  openStaging: "Odpri staging",
  openTickets: "Odprti ticketi",
  nothingWaiting: "Trenutno nič ne čaka nate.",
  board: "Tabla",
  list: "Seznam",
  newTicket: "Nov ticket",
  whatsNeeded: "Kaj potrebuješ?",
  detailsMarkdown: "Podrobnosti (markdown je OK)",
  create: "Ustvari",
  cancel: "Prekliči",
  noTickets: "Še ni ticketov.",
  ticketViewOff: "Ogled ticketov je za ta projekt izklopljen.",
  noDueDate: "Brez roka",
  due: "rok",
  opened: "Odprto",
  by: "od",
  noTicketDescription: "Ni opisa.",
  comments: "Komentarji",
  writeComment: "Napiši komentar… Tipkaj @ za omenitev",
  reply: "Odgovori",
  comment: "Komentiraj",
  noComments: "Še ni komentarjev — začni pogovor.",
  attach: "Priloži",
  upload: "Naloži",
  open: "Odpri",
  unavailable: "Ni na voljo",
  noFiles: "Še ni deljenih datotek.",
  quietPlace: "Miren prostor za spremljanje dela.",
  failed: "Napaka",
  uploadFailed: "Nalaganje ni uspelo",
  assigneeStudio: "Studio",
  assigneeClient: "Klient",
  statuses: {
    Todo: "Za narediti",
    "In progress": "V teku",
    "Waiting on client": "Čaka na klienta",
    Done: "Končano",
  },
};

const dict = { en, sl } as const;

export type PortalCopy = typeof en;

export function portalT(locale: PortalLocale): PortalCopy {
  return dict[locale] ?? dict.en;
}

export function portalStatusLabel(
  locale: PortalLocale,
  status: string
): string {
  return portalT(locale).statuses[status] ?? status;
}
