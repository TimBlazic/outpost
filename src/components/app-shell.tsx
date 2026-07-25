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
  Receipt,
  BookOpen,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Member } from "@/lib/data";
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

const SIDEBAR_KEY = "outpost.sidebarCollapsed";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarNav({
  user,
  collapsed,
  onToggle,
}: {
  user: Member;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
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
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors",
                collapsed
                  ? "size-9 justify-center"
                  : "gap-3 px-3 py-2",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0 opacity-70" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "border-t border-sidebar-border",
          collapsed ? "p-1.5" : "p-3"
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center rounded-md text-left hover:bg-sidebar-accent/60",
                collapsed
                  ? "size-9 justify-center p-0"
                  : "gap-3 px-2 py-1.5"
              )}
              title={collapsed ? user.name : undefined}
            >
              <UserAvatar member={user} />
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.role}
                  </p>
                </div>
              ) : null}
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
}: {
  children: React.ReactNode;
  user: Member;
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

  if (pathname === "/login" || pathname.startsWith("/portal")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav
        user={user}
        collapsed={collapsed}
        onToggle={toggleSidebar}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <KeyboardShortcuts />
        <CommandPalette />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
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
