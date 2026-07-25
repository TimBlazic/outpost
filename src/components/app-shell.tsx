"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CheckSquare,
  FolderKanban,
  BookOpen,
  Settings,
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

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarNav({ user }: { user: Member }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-sm">
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="group min-w-0">
          <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
            Studio
          </p>
          <span className="app-display text-2xl italic leading-none tracking-tight transition-opacity group-hover:opacity-80">
            Outpost
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="size-4 opacity-70" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent/60">
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

  if (pathname === "/login" || pathname.startsWith("/portal")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <KeyboardShortcuts />
        <CommandPalette />
        <main className="flex-1 overflow-y-auto">{children}</main>
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
    <div className="app-reveal flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
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
