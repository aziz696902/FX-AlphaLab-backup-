"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Tier = "free" | "pro" | "elite";

const TIER_ORDER: Record<Tier, number> = { free: 0, pro: 1, elite: 2 };

function readTierFromStorage(): Tier {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "free";
    const user = JSON.parse(raw) as { tier?: string };
    const t = user.tier;
    if (t === "pro" || t === "elite") return t;
  } catch { /* ignore */ }
  return "free";
}

interface UpgradeModalContextValue {
  isOpen: boolean;
  highlightedTier: Tier;
  userTier: Tier;
  canAccess: (required: Tier) => boolean;
  open: (tier?: Tier) => void;
  close: () => void;
  refreshTier: () => void;
}

const Ctx = createContext<UpgradeModalContextValue | null>(null);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedTier, setHighlightedTier] = useState<Tier>("pro");
  const [userTier, setUserTier] = useState<Tier>("free");

  useEffect(() => {
    setUserTier(readTierFromStorage());
    const onStorage = () => setUserTier(readTierFromStorage());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function canAccess(required: Tier): boolean {
    return TIER_ORDER[userTier] >= TIER_ORDER[required];
  }

  function open(tier: Tier = "pro") {
    if (canAccess(tier)) return;
    setHighlightedTier(tier);
    setIsOpen(true);
  }

  function refreshTier() {
    setUserTier(readTierFromStorage());
  }

  return (
    <Ctx.Provider value={{ isOpen, highlightedTier, userTier, canAccess, open, close: () => setIsOpen(false), refreshTier }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUpgradeModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUpgradeModal must be used within UpgradeModalProvider");
  return ctx;
}
