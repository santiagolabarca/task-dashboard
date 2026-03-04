import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeProps = {
  children: ReactNode;
  variant?: "default" | "done" | "warning";
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variant === "done" && "bg-emerald-100 text-emerald-700",
        variant === "warning" && "bg-amber-100 text-amber-800",
        variant === "default" && "bg-slate-200 text-slate-700"
      )}
    >
      {children}
    </span>
  );
}
