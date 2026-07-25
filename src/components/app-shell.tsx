"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CheckSquare,
  FolderKanban,
  MessageSquare,
  Receipt,
  BookOpen,
  Images,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Member } from "@/lib/data";
import { UNREAD_POLL_MS } from "@/lib/portal/chat-sync-shared";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth/actions";
import { CommandPalette } from "@/components/command-palette";
import { StudioThemeToggle } from "@/components/studio-theme-toggle";
import type { StudioTheme } from "@/lib/theme/studio";

const SIDEBAR_KEY = "outpost.sidebarCollapsed";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/moodboard", label: "Moodboard", icon: Images },
];

function SidebarNav({
  user,
  collapsed,
  onToggle,
  studioTheme,
}: {
  user: Member;
  collapsed: boolean;
  onToggle: () => void;
  studioTheme: StudioTheme;
}) {
  const pathname = usePathname();
  const [messagesUnread, setMessagesUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { total?: number };
        if (alive) setMessagesUnread(data.total ?? 0);
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, UNREAD_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pathname]);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-sm transition-[width] duration-200 ease-out",
        collapsed ? "w-[3.75rem]" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center",
          collapsed ? "justify-center px-1.5" : "justify-between gap-1 px-3"
        )}
      >
        {!collapsed ? (
          <Link href="/" className="group min-w-0 px-2">
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
              Studio
            </p>
            <span className="app-display text-2xl italic leading-none tracking-tight transition-opacity group-hover:opacity-80">
              Outpost
            </span>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Show sidebar" : "Hide sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>
      <nav
        className={cn(
          "flex flex-1 flex-col gap-0.5 py-2",
          collapsed ? "items-center px-1.5" : "px-3"
        )}
      >
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const unread = item.href === "/messages" ? messagesUnread : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={
                collapsed
                  ? unread > 0
                    ? `${item.label} (${unread})`
                    : item.label
                  : undefined
              }
              className={cn(
                "relative flex items-center rounded-md text-sm transition-colors",
                collapsed
                  ? "size-9 justify-center"
                  : "gap-3 px-3 py-2",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0 opacity-70" />
              {!collapsed ? (
                <>
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {unread > 0 ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                </>
              ) : unread > 0 ? (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "border-t border-sidebar-border",
          collapsed ? "flex flex-col items-center gap-1 p-1.5" : "p-3"
        )}
      >
        {collapsed ? (
          <>
            <StudioThemeToggle
              initialTheme={studioTheme}
              collapsed
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex size-9 items-center justify-center rounded-md hover:bg-sidebar-accent/60"
                  title={user.name}
                >
                  <UserAvatar member={user} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">Profile & settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <form action={logout} className="w-full">
                    <button type="submit" className="w-full text-left">
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent/60">
                  <UserAvatar member={user} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.role}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">Profile & settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <form action={logout} className="w-full">
                    <button type="submit" className="w-full text-left">
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <StudioThemeToggle initialTheme={studioTheme} />
          </div>
        )}
      </div>
    </aside>
  );
}

function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n") {
        e.preventDefault();
        router.push("/leads/new");
      } else if (e.key === "t") {
        e.preventDefault();
        router.push("/tasks?new=1");
      } else if (e.key === "p") {
        e.preventDefault();
        router.push("/projects/new");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}

export function AppShell({
  children,
  user,
  hideChrome = false,
  studioTheme = "light",
}: {
  children: React.ReactNode;
  user: Member;
  /** Client-account sessions (even if profile.role isn't Client yet). */
  hideChrome?: boolean;
  studioTheme?: StudioTheme;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (
    hideChrome ||
    pathname === "/login" ||
    pathname === "/client-login" ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/portal") ||
    user.role === "Client"
  ) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav
        user={user}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        studioTheme={studioTheme}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <KeyboardShortcuts />
        <CommandPalette />
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            pathname.startsWith("/messages") ||
              pathname === "/leads" ||
              pathname === "/tasks" ||
              pathname === "/settings"
              ? "overflow-hidden"
              : "overflow-y-auto"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="app-reveal flex shrink-0 flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
      <div className="min-w-0">
        <h1 className="app-display text-3xl italic leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
