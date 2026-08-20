"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Compass,
  Database,
  FlaskConical,
  GitFork,
  LayoutDashboard,
  Lightbulb,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-provider";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/live", label: "Live activity", icon: Activity },
  { href: "/journeys", label: "Journeys", icon: GitFork },
  { href: "/funnels", label: "Funnels", icon: Compass },
  { href: "/users", label: "Users", icon: Users },
  { href: "/signals", label: "Signals", icon: Lightbulb },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/studio", label: "Experience Studio", icon: FlaskConical },
  { href: "/sources", label: "Data sources", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { workspaceId, setWorkspaceId, workspace } = useWorkspace();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
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
            <option value="web-demo">Web Demo · Forge</option>
            <option value="mobile-demo">Mobile App Demo · Aurelia</option>
          </select>
        </div>
        <nav className="mt-4 flex-1 space-y-0.5 px-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
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
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-white/50">
          Demo product: <span className="text-white/80">{workspace.productName}</span>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-6 backdrop-blur">
          <div>
            <div className="text-sm font-medium">{workspace.name}</div>
            <div className="text-xs text-muted-foreground">{workspace.productTagline}</div>
          </div>
          <Link href="/studio" className="text-sm text-primary hover:underline">
            Open Tester Mode
          </Link>
        </header>
        <main className="px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
