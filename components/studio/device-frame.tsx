"use client";

import type { ReactNode } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewportMode = "desktop" | "tablet" | "mobile";

const WIDTHS: Record<ViewportMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function DeviceToolbar({
  viewport,
  onChange,
  platformLabel,
}: {
  viewport: ViewportMode;
  onChange: (mode: ViewportMode) => void;
  platformLabel: string;
}) {
  const options: Array<{ id: ViewportMode; label: string; icon: typeof Monitor }> = [
    { id: "desktop", label: "Desktop", icon: Monitor },
    { id: "tablet", label: "Tablet", icon: Tablet },
    { id: "mobile", label: "Mobile", icon: Smartphone },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">
        Interactive {platformLabel} · switch viewport to see how engagement shifts by layout
      </p>
      <div className="flex gap-1">
        {options.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            size="sm"
            variant={viewport === id ? "default" : "outline"}
            onClick={() => onChange(id)}
            className="gap-1.5"
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function DeviceFrame({
  viewport,
  urlLabel,
  children,
}: {
  viewport: ViewportMode;
  urlLabel: string;
  children: ReactNode;
}) {
  const isPhone = viewport === "mobile";
  const width = WIDTHS[viewport];

  if (isPhone) {
    return (
      <div className="flex justify-center py-4">
        <div className="w-[390px] max-w-full rounded-[2.6rem] border-[10px] border-zinc-900 bg-zinc-900 p-1.5 shadow-2xl">
          <div className="relative overflow-hidden rounded-[2rem] bg-white">
            <div className="absolute left-1/2 top-2 z-20 h-5 w-28 -translate-x-1/2 rounded-full bg-zinc-900" />
            <div className="border-b border-zinc-100 bg-zinc-50 px-4 pb-2 pt-8 text-center text-[10px] text-zinc-500">
              {urlLabel}
            </div>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full" style={{ maxWidth: width }}>
      <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-3 py-2">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <div className="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] text-zinc-500 shadow-sm">
            {urlLabel}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
