import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: ComponentProps<"span"> & { variant?: "default" | "secondary" | "outline" | "success" | "danger" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        variant === "default" && "bg-primary/10 text-primary",
        variant === "secondary" && "bg-muted text-muted-foreground",
        variant === "outline" && "border border-border text-foreground",
        variant === "success" && "bg-emerald-50 text-emerald-700",
        variant === "danger" && "bg-rose-50 text-rose-700",
        variant === "warning" && "bg-amber-50 text-amber-800",
        className,
      )}
      {...props}
    />
  );
}
