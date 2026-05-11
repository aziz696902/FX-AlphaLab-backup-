"use client";

import { useEffect, useState } from "react";
import { X, Check, Minus, Zap, Crown, Star, Wrench } from "lucide-react";
import { useUpgradeModal, type Tier } from "@/hooks/use-upgrade-modal";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Feature {
  label: string;
  available: boolean;
}

interface TierConfig {
  id: Tier;
  name: string;
  price: number | null;
  badge?: string;
  subtitle: string;
  cta: string;
  Icon?: React.ElementType;
  features: Feature[];
  border: string;
  glow: string;
  badgeCls?: string;
  ctaCls: string;
  iconCls?: string;
  highlightRing: string;
}

const TIERS: TierConfig[] = [
  {
    id: "free",
    name: "Free",
    price: null,
    subtitle: "Get started with FX basics",
    cta: "Current Plan",
    border: "border-white/10",
    glow: "",
    ctaCls: "border border-white/20 text-white/40 cursor-default",
    highlightRing: "ring-1 ring-white/20",
    features: [
      { label: "Live price feed", available: true },
      { label: "1 currency pair", available: true },
      { label: "Candlestick charts", available: true },
      { label: "Daily timeframe", available: true },
      { label: "Multi-pair monitoring", available: false },
      { label: "H1 / H4 timeframes", available: false },
      { label: "Technical Agent", available: false },
      { label: "Macro Agent", available: false },
      { label: "AI Narrative", available: false },
      { label: "Deep Dive Reports", available: false },
      { label: "Sentiment Agent", available: false },
      { label: "Priority support", available: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    badge: "Most Popular",
    subtitle: "For serious FX traders",
    cta: "Upgrade to Pro",
    Icon: Zap,
    border: "border-blue-500",
    glow: "shadow-[0_0_60px_-10px_rgba(59,130,246,0.55)]",
    badgeCls: "bg-blue-600 text-white",
    ctaCls: "bg-blue-600 hover:bg-blue-500 text-white transition-colors",
    iconCls: "text-blue-400",
    highlightRing: "ring-2 ring-blue-400/70",
    features: [
      { label: "Everything in Free", available: true },
      { label: "10 currency pairs", available: true },
      { label: "H1 / H4 / D1 timeframes", available: true },
      { label: "Technical Agent", available: true },
      { label: "Macro Agent", available: true },
      { label: "AI Narrative", available: true },
      { label: "Multi-pair monitoring", available: true },
      { label: "Sentiment Agent", available: false },
      { label: "Deep Dive Reports", available: false },
      { label: "Real-time alerts", available: false },
      { label: "Custom watchlists", available: false },
      { label: "Priority support", available: false },
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 79,
    badge: "Best Value",
    subtitle: "Institutional-grade intelligence",
    cta: "Go Elite",
    Icon: Crown,
    border: "border-amber-500/60",
    glow: "shadow-[0_0_80px_-10px_rgba(245,158,11,0.5)]",
    badgeCls: "bg-gradient-to-r from-amber-600 to-amber-400 text-black",
    ctaCls:
      "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_28px_rgba(245,158,11,0.6)]",
    iconCls: "text-amber-400",
    highlightRing: "ring-2 ring-amber-400/70",
    features: [
      { label: "Everything in Pro", available: true },
      { label: "Unlimited currency pairs", available: true },
      { label: "All timeframes", available: true },
      { label: "All 4 AI agents", available: true },
      { label: "Sentiment Agent", available: true },
      { label: "Deep Dive Reports", available: true },
      { label: "Real-time alerts", available: true },
      { label: "Custom watchlists", available: true },
      { label: "API access", available: true },
      { label: "Priority support", available: true },
      { label: "Early feature access", available: true },
      { label: "Daily alpha brief email", available: true },
    ],
  },
];

const TIER_ORDER: Record<Tier, number> = { free: 0, pro: 1, elite: 2 };

export function UpgradeModal() {
  const { isOpen, highlightedTier, userTier, close, refreshTier } = useUpgradeModal();

  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [devLoading, setDevLoading] = useState(false);
  const [devSuccess, setDevSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPendingTier(null);
      setDevLoading(false);
      setDevSuccess(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  async function handleDevActivate(tier: Tier) {
    setDevLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/auth/users/me/tier`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error("Request failed");
      const updated = await res.json();
      const existing = JSON.parse(localStorage.getItem("user") ?? "{}");
      localStorage.setItem("user", JSON.stringify({ ...existing, ...updated }));
      refreshTier();
      setDevSuccess(true);
      setTimeout(() => close(), 1400);
    } catch {
      setDevLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={close}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#080a12] border border-white/[0.07] p-8 animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* close */}
        <button
          onClick={close}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Star className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-medium text-white/50 tracking-widest uppercase">
              FX-AlphaLab Plans
            </span>
            <Star className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            Unlock the full power of AI-driven FX analysis
          </h2>
          <p className="text-white/50 text-sm">
            Cancel anytime. No credit card required for Free.
          </p>
        </div>

        {/* columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((tier) => {
            const isHighlighted = tier.id === highlightedTier;
            const isPro = tier.id === "pro";
            const isElite = tier.id === "elite";
            const isCurrent = tier.id === userTier;
            const isBelow = TIER_ORDER[tier.id] < TIER_ORDER[userTier];
            const isPending = pendingTier === tier.id;

            return (
              <div
                key={tier.id}
                className={cn(
                  "relative flex flex-col rounded-xl border p-6 transition-all duration-300",
                  isElite
                    ? "bg-[linear-gradient(160deg,rgba(120,60,0,0.22)_0%,rgba(80,35,0,0.12)_40%,rgba(12,14,26,1)_100%)]"
                    : "bg-[#0c0e1a]",
                  tier.border,
                  tier.glow,
                  isHighlighted && tier.highlightRing,
                  !isHighlighted && tier.id !== "pro" && "opacity-80"
                )}
              >
                {/* tier badge */}
                {(isPro || isElite) && tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", tier.badgeCls)}>
                      {tier.badge}
                    </span>
                  </div>
                )}

                {/* tier header */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-1">
                    {tier.Icon && (
                      <tier.Icon className={cn("w-5 h-5", tier.iconCls)} />
                    )}
                    <span
                      className={cn(
                        "text-lg font-bold",
                        isPro ? "text-blue-300" : isElite ? "text-amber-300" : "text-white/70"
                      )}
                    >
                      {tier.name}
                    </span>
                  </div>
                  <p className={cn("text-xs", isElite ? "text-amber-200/50" : "text-white/40")}>
                    {tier.subtitle}
                  </p>

                  <div className="mt-4">
                    {tier.price === null ? (
                      <span className="text-3xl font-bold text-white/70">Free</span>
                    ) : isElite ? (
                      <div className="flex items-end gap-1">
                        <span className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                          ${tier.price}
                        </span>
                        <span className="text-amber-400/50 text-sm mb-1">/mo</span>
                      </div>
                    ) : (
                      <div className="flex items-end gap-1">
                        <span className="text-3xl font-bold text-white">${tier.price}</span>
                        <span className="text-white/40 text-sm mb-1">/mo</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* divider */}
                <div
                  className={cn(
                    "h-px w-full mb-5",
                    isPro
                      ? "bg-blue-500/30"
                      : isElite
                      ? "bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"
                      : "bg-white/[0.06]"
                  )}
                />

                {/* features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {tier.features.map((f) => (
                    <li key={f.label} className="flex items-center gap-2.5 text-sm">
                      {f.available ? (
                        <Check
                          className={cn(
                            "w-4 h-4 shrink-0",
                            isPro ? "text-blue-400" : isElite ? "text-amber-400" : "text-white/50"
                          )}
                        />
                      ) : (
                        <Minus className="w-4 h-4 shrink-0 text-white/20" />
                      )}
                      <span
                        className={cn(
                          f.available
                            ? isElite
                              ? "text-amber-100/85"
                              : "text-white/80"
                            : "text-white/20 line-through"
                        )}
                      >
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA area */}
                {isCurrent || isBelow ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg text-sm font-medium border border-white/20 text-white/30 cursor-default pointer-events-none"
                  >
                    {isCurrent ? "Current Plan" : "Included"}
                  </button>
                ) : isPending ? (
                  <div className="space-y-3">
                    {/* disabled "coming soon" button */}
                    <button
                      disabled
                      className="w-full py-2.5 rounded-lg text-sm font-medium bg-white/[0.04] border border-white/10 text-white/30 cursor-default"
                    >
                      Payment Coming Soon
                    </button>

                    {/* explanation */}
                    <div className={cn(
                      "rounded-lg p-3 text-xs leading-relaxed border",
                      isPro
                        ? "bg-blue-950/30 border-blue-500/20 text-blue-200/60"
                        : "bg-amber-950/30 border-amber-500/20 text-amber-200/60"
                    )}>
                      Stripe billing is under active development. The moment it goes live,
                      your plan activates instantly and you&apos;ll be notified by email.
                    </div>

                    {/* dev bypass — tree-shaken in production */}
                    {process.env.NODE_ENV === "development" && (
                      <button
                        onClick={() => handleDevActivate(tier.id)}
                        disabled={devLoading || devSuccess}
                        className={cn(
                          "w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all",
                          devSuccess
                            ? "bg-green-900/30 border-green-500/30 text-green-400"
                            : devLoading
                            ? "bg-amber-900/20 border-amber-500/20 text-amber-400/50 cursor-wait"
                            : "bg-amber-900/20 border-amber-500/30 text-amber-300 hover:bg-amber-900/40 hover:border-amber-400/40"
                        )}
                      >
                        {devSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            {tier.name} activated — enjoy!
                          </>
                        ) : devLoading ? (
                          "Activating..."
                        ) : (
                          <>
                            <Wrench className="w-3.5 h-3.5" />
                            Activate {tier.name} · Dev Mode
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setPendingTier(tier.id)}
                    className={cn("w-full py-2.5 rounded-lg text-sm font-medium", tier.ctaCls)}
                  >
                    {tier.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-white/25 text-xs mt-6">
          All prices in USD · Billed monthly · Secure payment via Stripe
        </p>
      </div>
    </div>
  );
}
