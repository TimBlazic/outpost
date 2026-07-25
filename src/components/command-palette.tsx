"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  CheckSquare,
  FileText,
  FolderKanban,
  Images,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Receipt,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { searchAll } from "@/lib/actions";
import { cn } from "@/lib/utils";

type Hit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

type SearchResults = {
  leads: Hit[];
  clients: Hit[];
  projects: Hit[];
  docs: Hit[];
  tasks: Hit[];
};

type PaletteItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  icon: LucideIcon;
  section: string;
};

const emptyResults: SearchResults = {
  leads: [],
  clients: [],
  projects: [],
  docs: [],
  tasks: [],
};

const STATIC_ACTIONS: PaletteItem[] = [
  {
    id: "new-lead",
    title: "New lead",
    subtitle: "Create a lead",
    href: "/leads/new",
    icon: Plus,
    section: "Create",
  },
  {
    id: "new-client",
    title: "New client",
    subtitle: "Create a client",
    href: "/clients/new",
    icon: Plus,
    section: "Create",
  },
  {
    id: "new-task",
    title: "New task",
    subtitle: "Create a task",
    href: "/tasks?new=1",
    icon: Plus,
    section: "Create",
  },
  {
    id: "new-invoice",
    title: "New invoice",
    subtitle: "Create an invoice",
    href: "/invoices/new",
    icon: Plus,
    section: "Create",
  },
  {
    id: "new-project",
    title: "New project",
    subtitle: "Create a project",
    href: "/projects/new",
    icon: Plus,
    section: "Create",
  },
  {
    id: "new-doc",
    title: "New doc",
    subtitle: "Create a document",
    href: "/docs/new",
    icon: Plus,
    section: "Create",
  },
  {
    id: "go-dashboard",
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    section: "Go to",
  },
  {
    id: "go-leads",
    title: "Leads",
    href: "/leads",
    icon: Users,
    section: "Go to",
  },
  {
    id: "go-clients",
    title: "Clients",
    href: "/clients",
    icon: Building2,
    section: "Go to",
  },
  {
    id: "go-tasks",
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    section: "Go to",
  },
  {
    id: "go-projects",
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
    section: "Go to",
  },
  {
    id: "go-messages",
    title: "Messages",
    href: "/messages",
    icon: MessageSquare,
    section: "Go to",
  },
  {
    id: "go-invoices",
    title: "Invoices",
    href: "/invoices",
    icon: Receipt,
    section: "Go to",
  },
  {
    id: "go-docs",
    title: "Docs",
    href: "/docs",
    icon: BookOpen,
    section: "Go to",
  },
  {
    id: "go-moodboard",
    title: "Moodboard",
    href: "/moodboard",
    icon: Images,
    section: "Go to",
  },
  {
    id: "go-settings",
    title: "Settings",
    href: "/settings",
    icon: Settings,
    section: "Go to",
  },
];

function matchesQuery(item: PaletteItem, q: string) {
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) ||
    (item.subtitle?.toLowerCase().includes(q) ?? false) ||
    item.section.toLowerCase().includes(q)
  );
}

function hitsToItems(
  hits: Hit[],
  section: string,
  icon: LucideIcon
): PaletteItem[] {
  return hits.map((h) => ({
    id: `${section}-${h.id}`,
    title: h.title,
    subtitle: h.subtitle,
    href: h.href,
    icon,
    section,
  }));
}

export function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(0);

  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    const actions = STATIC_ACTIONS.filter((a) => matchesQuery(a, q));
    if (!q) return actions;

    return [
      ...actions,
      ...hitsToItems(results.leads, "Leads", Users),
      ...hitsToItems(results.clients, "Clients", Building2),
      ...hitsToItems(results.projects, "Projects", FolderKanban),
      ...hitsToItems(results.tasks, "Tasks", CheckSquare),
      ...hitsToItems(results.docs, "Docs", FileText),
    ];
  }, [q, results]);

  const sections = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, PaletteItem[]>();
    for (const item of items) {
      if (!map.has(item.section)) {
        map.set(item.section, []);
        order.push(item.section);
      }
      map.get(item.section)!.push(item);
    }
    return order.map((section) => ({
      section,
      items: map.get(section)!,
    }));
  }, [items]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setQuery("");
      setResults(emptyResults);
      setActive(0);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(focusId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const qTrim = query.trim();
    if (!qTrim) {
      setResults(emptyResults);
      setActive(0);
      return;
    }
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const next = await searchAll(qTrim);
        setResults(next);
        setActive(0);
      });
    }, 120);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-palette-index="${active}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open, items.length]);

  function close() {
    setOpen(false);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) go(item.href);
    }
  }

  const indexedSections = useMemo(() => {
    let index = 0;
    return sections.map(({ section, items: sectionItems }) => ({
      section,
      items: sectionItems.map((item) => ({
        item,
        index: index++,
      })),
    }));
  }, [sections]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div
        className={cn(
          "absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          "relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all duration-200",
          visible
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0"
        )}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            aria-label="Command search"
          />
          <kbd className="hidden rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            esc
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[min(60vh,28rem)] overflow-y-auto py-2"
        >
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {pending ? "Searching…" : `No matches for “${query.trim()}”`}
            </p>
          ) : (
            indexedSections.map(({ section, items: sectionItems }) => (
              <div key={section} className="mb-1">
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {section}
                </p>
                <ul>
                  {sectionItems.map(({ item, index }) => {
                    const Icon = item.icon;
                    const selected = index === active;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-palette-index={index}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(item.href)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            selected
                              ? "bg-muted text-foreground"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70",
                              selected
                                ? "bg-background text-foreground"
                                : "bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {item.title}
                            </span>
                            {item.subtitle ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ navigate · ↵ open</span>
          <span className="hidden sm:inline">⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
