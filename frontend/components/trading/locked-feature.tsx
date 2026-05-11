"use client";

import { Lock } from "lucide-react";
import { type ReactNode } from "react";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { cn } from "@/lib/utils";

interface LockedFeatureProps {
  tier: "pro" | "elite";
  children: ReactNode;
  className?: string;
}

export function LockedFeature({ tier, children, className }: LockedFeatureProps) {
  const { open, canAccess } = useUpgradeModal();

  if (canAccess(tier)) return <div className={className}>{children}</div>;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => open(tier)}
      onKeyDown={(e) => e.key === "Enter" && open(tier)}
      className={cn("relative group cursor-pointer select-none outline-none", className)}
    >
      <div className="transition-opacity duration-150 group-hover:opacity-40 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm transition-all duration-150",
            "bg-black/60 text-white/60 group-hover:text-white group-hover:bg-black/80",
            tier === "pro" ? "group-hover:text-blue-300" : "group-hover:text-amber-300"
          )}
        >
          <Lock className="w-3 h-3" />
          {tier === "pro" ? "Pro" : "Elite"}
        </span>
      </div>
    </div>
  );
}
