"use client";

import { useEffect, useState } from "react";
import { X, Check, Minus, Zap, Crown, Wrench, Mail, MessageSquare } from "lucide-react";
import { useUpgradeModal, type Tier } from "@/hooks/use-upgrade-modal";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TIER_ORDER: Record<Tier, number> = { free: 0, pro: 1, elite: 2 };

type Feature = { label: string; sub?: string; available: boolean };

const FREE_FEATURES: Feature[] = [
  { label: "Live bid/ask price feeds", available: true },
  { label: "4 FX pair watchlist", available: true },
  { label: "Candlestick charts — all timeframes", available: true },
  { label: "Spread & daily % change", available: true },
  { label: "AI signal recommendations", available: false },
  { label: "Chat companion", available: false },
  { label: "Agent pulse monitoring", available: false },
  { label: "Report generation & daily briefings", available: false },
];

const PRO_FEATURES: Feature[] = [
  { label: "Everything in Free", available: true },
  {
    label: "AI Signal Recommendations",
    sub: "Conviction %, SL/TP levels, market regime, top-pick pair",
    available: true,
  },
  {
    label: "Alpha Analyst",
    sub: "Contextual AI aware of alpha signals, bank positioning & live narrative",
    available: true,
  },
  {
    label: "Agent Pulse",
    sub: "Live readout: Technical · Macro · Geopolitical · Sentiment",
    available: true,
  },
  { label: "Deep Dive Report generation", available: false },
  { label: "Daily Alpha Brief email", available: false },
];

const ELITE_FEATURES: Feature[] = [
  { label: "Everything in Pro", available: true },
  {
    label: "Deep Dive Reports",
    sub: "On-demand: per-agent explainability, bank commentary, risk themes",
    available: true,
  },
  {
    label: "Daily Alpha Brief",
    sub: "Morning email: market state · agent breakdown · bank positioning · macro & geo risks",
    available: true,
  },
];

// ── Dev-bypass / pending block ────────────────────────────────────────────────

function PendingBlock({
  tier,
  devLoading,
  devSuccess,
  onDevActivate,
}: {
  tier: Tier;
  devLoading: boolean;
  devSuccess: boolean;
  onDevActivate: () => void;
}) {
  const isPro = tier === "pro";
  return (
    <div className="space-y-2">
      <button
        disabled
        className="w-full py-2.5 rounded-lg text-sm bg-white/[0.03] border border-white/10 text-white/25 cursor-default"
      >
        Payment Coming Soon
      </button>
      <div
        className={cn(
          "rounded-lg p-3 text-xs leading-relaxed border",
          isPro
            ? "bg-blue-950/30 border-blue-500/20 text-blue-200/50"
            : "bg-amber-950/20 border-amber-500/20 text-amber-200/50"
        )}
      >
        Stripe billing is in active development. You&apos;ll be notified by email
        the moment it goes live — your plan will activate instantly.
      </div>
      {process.env.NODE_ENV === "development" && (
        <button
          onClick={onDevActivate}
          disabled={devLoading || devSuccess}
          className={cn(
            "w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all",
            devSuccess
              ? "bg-green-900/30 border-green-500/30 text-green-400"
              : devLoading
              ? "opacity-50 cursor-wait border-amber-500/20 text-amber-400/50"
              : "bg-amber-900/20 border-amber-500/30 text-amber-300 hover:bg-amber-900/40 hover:border-amber-400/40"
          )}
        >
          {devSuccess ? (
            <>
              <Check className="w-3.5 h-3.5" /> Activated — enjoy!
            </>
          ) : devLoading ? (
            "Activating…"
          ) : (
            <>
              <Wrench className="w-3.5 h-3.5" /> Dev: Activate{" "}
              {tier === "pro" ? "Pro" : "Elite"}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function UpgradeModal() {
  const { isOpen, highlightedTier, userTier, close, refreshTier } =
    useUpgradeModal();

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

  const isCurrent = (t: Tier) => t === userTier;
  const isBelow = (t: Tier) => TIER_ORDER[t] < TIER_ORDER[userTier];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in-0 duration-200"
      onClick={close}
    >
      <style>{`
        @keyframes um-shimmer {
          0%   { transform: translateX(-150%) }
          100% { transform: translateX(150%) }
        }
        .um-dot-grid {
          background-image: radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 22px 22px;
        }
      `}</style>

      <div
        className="relative w-full max-w-6xl rounded-2xl border border-white/[0.06] animate-in zoom-in-95 fade-in-0 duration-200"
        style={{ background: "#060810" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* dot grid texture */}
        <div className="pointer-events-none absolute inset-0 um-dot-grid" />
        {/* top atmosphere */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-blue-950/25 to-transparent" />

        {/* close */}
        <button
          onClick={close}
          className="absolute top-4 right-4 z-20 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative z-10 p-6 pb-5">
          {/* ── Header ── */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono tracking-[0.2em] uppercase text-white/35">
                FX-AlphaLab · Intelligence Tiers
              </span>
            </div>
            <h2 className="text-[1.6rem] font-bold text-white tracking-tight mb-2">
              Choose your intelligence tier
            </h2>
            <p className="text-sm text-white/35 max-w-sm mx-auto">
              Raw market data to institutional-grade daily briefings.
              Start free, upgrade when you&apos;re ready.
            </p>
          </div>

          {/* ── Cards ── */}
          <div className="grid grid-cols-3 gap-5">
            {/* ── FREE ── */}
            <div
              className={cn(
                "relative flex flex-col rounded-xl border p-5",
                "bg-white/[0.02] border-white/[0.08]",
                isCurrent("free") && "ring-1 ring-white/20",
                highlightedTier === "free" && "ring-2 ring-white/25"
              )}
            >
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold tracking-[0.15em] uppercase text-white/45">
                    Free
                  </span>
                  {isCurrent("free") && (
                    <span className="text-xs font-mono uppercase tracking-wider text-white/25 border border-white/10 rounded px-1.5 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold font-mono text-white/55">$0</span>
                </div>
                <p className="text-xs text-white/25 mt-1">No credit card required</p>
              </div>

              <div className="h-px bg-white/[0.06] mb-4" />

              <ul className="space-y-2 flex-1 mb-4">
                {FREE_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    {f.available ? (
                      <Check className="w-4 h-4 text-white/35 shrink-0 mt-0.5" />
                    ) : (
                      <Minus className="w-4 h-4 text-white/12 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={cn(
                        "text-sm",
                        f.available ? "text-white/55" : "text-white/18 line-through"
                      )}
                    >
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrent("free") ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg text-sm text-white/25 border border-white/10 cursor-default"
                >
                  Current Plan
                </button>
              ) : isBelow("free") ? null : null}
            </div>

            {/* ── PRO ── */}
            <div
              className={cn(
                "relative flex flex-col rounded-xl border p-5",
                "bg-[#060d1f]",
                highlightedTier === "pro"
                  ? "border-blue-400/55 shadow-[0_0_60px_-8px_rgba(59,130,246,0.5)]"
                  : "border-blue-500/28",
                isCurrent("pro") && "ring-2 ring-blue-400/45"
              )}
            >
              {/* top accent stripe */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-700 via-blue-400 to-blue-700" />

              {/* badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-600 text-white">
                  Most Popular
                </span>
              </div>

              <div className="mb-4 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold tracking-[0.15em] uppercase text-blue-300">
                    Pro
                  </span>
                  {isCurrent("pro") && (
                    <span className="text-xs font-mono uppercase tracking-wider text-blue-400/55 border border-blue-500/30 rounded px-1.5 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold font-mono text-white">$29</span>
                  <span className="text-blue-400/40 text-base">/mo</span>
                </div>
                <p className="text-xs text-blue-300/35 mt-1">For serious FX traders</p>
              </div>

              <div className="h-px bg-blue-500/18 mb-4" />

              <ul className="space-y-2 flex-1 mb-4">
                {PRO_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    {f.available ? (
                      <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    ) : (
                      <Minus className="w-4 h-4 text-white/12 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span
                        className={cn(
                          "text-sm",
                          f.available ? "text-white/80" : "text-white/18 line-through"
                        )}
                      >
                        {f.label}
                      </span>
                      {f.sub && f.available && (
                        <p className="text-xs text-blue-300/45 mt-0.5 leading-snug">
                          {f.sub}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Chat companion preview */}
              <div className="rounded-lg bg-blue-950/35 border border-blue-500/14 p-3 mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <MessageSquare className="w-3 h-3 text-blue-400/50" />
                  <span className="text-[13px] font-mono tracking-wider uppercase text-blue-400/40">
                    Alpha Analyst · Preview
                  </span>
                </div>
                <p className="text-xs text-blue-200/45 leading-relaxed italic">
                  &ldquo;EURUSD showing bullish divergence on H4. ECB tone confirms
                  EUR strength — coordinator signals BUY at 72% conviction.
                  Key risk: US CPI Thursday 13:30 UTC.&rdquo;
                </p>
              </div>

              {/* CTA */}
              {isCurrent("pro") ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg text-sm text-white/25 border border-white/10 cursor-default"
                >
                  Current Plan
                </button>
              ) : isBelow("pro") ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg text-sm text-white/25 border border-white/10 cursor-default"
                >
                  Included
                </button>
              ) : pendingTier === "pro" ? (
                <PendingBlock
                  tier="pro"
                  devLoading={devLoading}
                  devSuccess={devSuccess}
                  onDevActivate={() => handleDevActivate("pro")}
                />
              ) : (
                <button
                  onClick={() => setPendingTier("pro")}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>

            {/* ── ELITE ── */}
            <div
              className={cn(
                "relative flex flex-col rounded-xl border p-5",
                "bg-[linear-gradient(160deg,rgba(100,50,0,0.22)_0%,rgba(60,25,0,0.12)_40%,#060810_100%)]",
                highlightedTier === "elite"
                  ? "border-amber-400/48 shadow-[0_0_80px_-10px_rgba(245,158,11,0.42)]"
                  : "border-amber-500/22",
                isCurrent("elite") && "ring-2 ring-amber-400/45"
              )}
            >
              {/* shimmer stripe */}
              <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-700 via-amber-300 to-amber-700" />
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/55 to-transparent"
                  style={{ animation: "um-shimmer 3.5s ease-in-out infinite" }}
                />
              </div>

              {/* badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-gradient-to-r from-amber-600 to-amber-400 text-black">
                  Best Value
                </span>
              </div>

              <div className="mb-4 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold tracking-[0.15em] uppercase text-amber-300">
                    Elite
                  </span>
                  {isCurrent("elite") && (
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400/55 border border-amber-500/30 rounded px-1.5 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold font-mono bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                    $79
                  </span>
                  <span className="text-amber-400/38 text-base">/mo</span>
                </div>
                <p className="text-xs text-amber-300/35 mt-1">
                  Institutional-grade intelligence
                </p>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-amber-500/28 to-transparent mb-4" />

              <ul className="space-y-2 flex-1 mb-4">
                {ELITE_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    {f.available ? (
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Minus className="w-4 h-4 text-white/12 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span
                        className={cn(
                          "text-sm",
                          f.available ? "text-amber-100/80" : "text-white/18 line-through"
                        )}
                      >
                        {f.label}
                      </span>
                      {f.sub && f.available && (
                        <p className="text-xs text-amber-300/45 mt-0.5 leading-snug">
                          {f.sub}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Daily brief preview */}
              <div className="rounded-lg bg-amber-950/18 border border-amber-500/14 p-3 mb-4">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Mail className="w-3 h-3 text-amber-400/55" />
                  <span className="text-[13px] font-mono tracking-wider uppercase text-amber-400/40">
                    Daily Alpha Brief · 07:00 UTC
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-300/70 font-semibold tracking-wider">
                      EURUSD
                    </span>
                    <span className="text-xs font-mono text-emerald-400/65">
                      BUY · 68%
                    </span>
                  </div>
                  <div className="flex gap-0.5 items-center">
                    <span className="text-[13px] text-amber-400/40 font-mono mr-1">Tech</span>
                    <div className="flex gap-0.5 flex-1">
                      {[1,1,1,1,0].map((on, i) => (
                        <div key={i} className={cn("h-1 flex-1 rounded-sm", on ? "bg-amber-500/55" : "bg-amber-500/12")} />
                      ))}
                    </div>
                    <span className="text-[13px] text-amber-400/40 font-mono ml-2 mr-1">Macro</span>
                    <div className="flex gap-0.5 flex-1">
                      {[1,1,1,0,0].map((on, i) => (
                        <div key={i} className={cn("h-1 flex-1 rounded-sm", on ? "bg-amber-500/55" : "bg-amber-500/12")} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-amber-200/38 leading-relaxed italic">
                    &ldquo;ECB officials signal further tightening — EUR positioning
                    shifts bullish across institutional desks. Deutsche Bank raises
                    EURUSD target to 1.12...&rdquo;
                  </p>
                </div>
              </div>

              {/* CTA */}
              {isCurrent("elite") ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg text-sm text-white/25 border border-white/10 cursor-default"
                >
                  Current Plan
                </button>
              ) : isBelow("elite") ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg text-sm text-white/25 border border-white/10 cursor-default"
                >
                  Included
                </button>
              ) : pendingTier === "elite" ? (
                <PendingBlock
                  tier="elite"
                  devLoading={devLoading}
                  devSuccess={devSuccess}
                  onDevActivate={() => handleDevActivate("elite")}
                />
              ) : (
                <button
                  onClick={() => setPendingTier("elite")}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_28px_rgba(245,158,11,0.5)]"
                >
                  Go Elite
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-white/18 text-xs mt-5 font-mono tracking-[0.15em]">
            ALL PRICES USD · BILLED MONTHLY · SECURE PAYMENT VIA STRIPE
          </p>
        </div>
      </div>
    </div>
  );
}
