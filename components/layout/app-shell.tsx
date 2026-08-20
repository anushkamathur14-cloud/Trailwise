"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Compass,
  Database,
  FlaskConical,
  GitFork,
  LayoutDashboard,
  Lightbulb,
  ListTree,
  Menu,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-provider";
import { Badge } from "@/components/ui/badge";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }>;
}> = [
  {
    label: "Understand",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/live", label: "Live activity", icon: Activity },
      { href: "/journeys", label: "Journeys", icon: GitFork },
      { href: "/funnels", label: "Funnels", icon: Compass },
      { href: "/users", label: "Users", icon: Users },
    ],
  },
  {
    label: "Act",
    items: [
      { href: "/signals", label: "Signals", icon: Lightbulb },
      { href: "/recommendations", label: "Recommendations", icon: Sparkles },
      { href: "/studio", label: "Experience Studio", icon: FlaskConical },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/events", label: "Event definitions", icon: ListTree },
      { href: "/sources", label: "Data sources", icon: Database },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { workspaceId, setWorkspaceId } = useWorkspace();

  return (
    <>
      <div className="px-4 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">Trailwise</div>
        <div className="mt-1 text-lg font-semibold">Product analytics</div>
      </div>
      <div className="px-3">
        <label className="px-1 text-[11px] uppercase tracking-wide text-white/40">Workspace</label>
        <select
          className="mt-1 h-9 w-full rounded-md border border-white/10 bg-sidebar-accent px-2 text-sm"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value as typeof workspaceId)}
        >
          <option value="web-demo">Aurelia Web</option>
          <option value="mobile-demo">Aurelia App</option>
        </select>
      </div>
      <nav className="mt-4 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-white/35">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white",
                      active && "bg-white/12 text-white",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 text-xs text-white/50">
        <Link href="/how-it-works" onClick={onNavigate} className="text-white/70 hover:text-white hover:underline">
          How it works
        </Link>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <SidebarNav />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <button type="button" className="absolute right-3 top-3 text-white/70" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-5" />
            </button>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-md border p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {workspace.name}
                <Badge variant="secondary">{workspace.platform === "web" ? "Web" : "App"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{workspace.productTagline}</div>
            </div>
          </div>
          <Link href="/studio" className="text-sm text-primary hover:underline">
            Open Experience Studio
          </Link>
        </header>
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
