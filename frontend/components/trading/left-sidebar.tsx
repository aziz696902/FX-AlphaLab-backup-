"use client";

import { Search, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { useWatchlistTicks } from "@/hooks/use-watchlist-ticks";
import {
  AgentSignalAPI,
  CoordinatorSignalAPI,
} from "@/lib/api";

const WATCHLIST_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"];

// ── label helpers (mirrors right-panel.tsx) ───────────────────────────────────

function toTechDirection(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v > 0.5) return "Bullish";
  if (v < -0.5) return "Bearish";
  if (v > 0.15) return "Sl. Bullish";
  if (v < -0.15) return "Sl. Bearish";
  return "Neutral";
}

function toVolRegime(v: string | null | undefined): string {
  if (!v) return "—";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function toMacroDir(v: string | null | undefined): string {
  if (!v) return "—";
  if (v === "up") return "Bullish";
  if (v === "down") return "Bearish";
  return v;
}

function toMacroDriver(v: string | null | undefined): string {
  if (!v) return "—";
  const map: Record<string, string> = {
    carry_signal_score: "Carry Trade",
    regime_context_score: "Regime Context",
    fundamental_mispricing_score: "Mispricing",
    macro_surprise_score: "Econ Surprise",
  };
  return map[v] ?? v;
}

function toGeoRegime(v: string | null | undefined): string {
  if (!v) return "—";
  if (v === "high") return "Elevated";
  if (v === "low") return "Low";
  return v;
}

function toBilateralRisk(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(0)}%`;
}

function toAttentionLevel(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v > 2.0) return "High Alert";
  if (v > 1.0) return "Elevated";
  if (v >= -1.0) return "Normal";
  if (v >= -2.0) return "Low";
  return "Suppressed";
}

// ── agent pulse definitions ───────────────────────────────────────────────────

interface AgentPulseDef {
  name: string;
  f1Label: string;
  f1: (sig: AgentSignalAPI | undefined) => string;
  f2Label: string;
  f2: (sig: AgentSignalAPI | undefined) => string;
}

const AGENT_PULSE_DEFS: AgentPulseDef[] = [
  {
    name: "Technical",
    f1Label: "Direction",
    f1: (s) => toTechDirection(s?.tech_direction),
    f2Label: "Volatility",
    f2: (s) => toVolRegime(s?.tech_vol_regime),
  },
  {
    name: "Macro",
    f1Label: "Direction",
    f1: (s) => toMacroDir(s?.macro_direction),
    f2Label: "Key Driver",
    f2: (s) => toMacroDriver(s?.macro_dominant_driver),
  },
  {
    name: "Geopolitical",
    f1Label: "Risk",
    f1: (s) => toGeoRegime(s?.geo_risk_regime),
    f2Label: "Bilateral",
    f2: (s) => toBilateralRisk(s?.geo_bilateral_risk),
  },
  {
    name: "Sentiment",
    f1Label: "Stress",
    f1: (s) => {
      if (!s) return "—";
      return s.composite_stress_flag ? "Flagged" : "None";
    },
    f2Label: "Attention",
    f2: (s) => toAttentionLevel(s?.gdelt_attention_zscore),
  },
];

interface LeftSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeInstrument: string;
  onInstrumentChange: (symbol: string) => void;
  width?: number;
  coordinatorSignals: Map<string, CoordinatorSignalAPI>;
  agentSignals: Map<string, AgentSignalAPI>;
}

export function LeftSidebar({
  collapsed,
  onToggle,
  activeInstrument,
  onInstrumentChange,
  width = 260,
  coordinatorSignals,
  agentSignals,
}: LeftSidebarProps) {
  const { canAccess, open: openPaywall } = useUpgradeModal();
  const watchlistTicks = useWatchlistTicks();

  const hasData = coordinatorSignals.size > 0;
  const pulseSignal = agentSignals.get(activeInstrument);

  if (collapsed) {
    return (
      <aside className="w-10 bg-card border-r border-border flex flex-col shrink-0 shadow-[var(--card-shadow)]">
        <button
          onClick={onToggle}
          className="p-2 hover:bg-accent transition-colors flex items-center justify-center"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="bg-card border-r border-border flex flex-col shrink-0 overflow-hidden shadow-[var(--card-shadow)]"
      style={{ width: `${width}px` }}
    >
      {/* Collapse Button */}
      <div className="p-2 border-b border-border flex justify-end">
        <button
          onClick={onToggle}
          className="p-1 hover:bg-accent rounded transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Watchlist Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Watchlist
            </h3>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              FX Pairs <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search symbols..."
              className="h-7 text-xs pl-7 bg-muted border-0"
            />
          </div>
        </div>

        {/* Watchlist Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-muted-foreground text-[9px] uppercase tracking-wider border-b border-border">
                <th className="text-left px-2 py-1.5 font-medium">Symbol</th>
                <th className="text-right px-2 py-1.5 font-medium">Bid</th>
                <th className="text-right px-2 py-1.5 font-medium">Ask</th>
                <th className="text-right px-2 py-1.5 font-medium">Spd</th>
                <th className="text-right px-2 py-1.5 font-medium">Chg%</th>
              </tr>
            </thead>
            <tbody>
              {WATCHLIST_PAIRS.map((pair) => {
                const tick = watchlistTicks.get(pair);
                const pct = tick?.pctChange ?? null;
                const isUp = pct !== null && pct >= 0;
                const fmt5 = (n: number) => n.toFixed(pair.includes("JPY") ? 3 : 5);

                return (
                  <tr
                    key={pair}
                    onClick={() => onInstrumentChange(pair)}
                    className={cn(
                      "hover:bg-accent cursor-pointer transition-colors border-b border-border/40 last:border-0",
                      activeInstrument === pair && "bg-accent",
                    )}
                  >
                    {/* Symbol */}
                    <td className="px-2 py-2">
                      <div className="font-semibold text-[11px] leading-tight">{pair}</div>
                    </td>
                    {/* Bid */}
                    <td className="px-2 py-2 text-right font-mono text-[10px]">
                      {tick ? fmt5(tick.bid) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    {/* Ask */}
                    <td className="px-2 py-2 text-right font-mono text-[10px] text-muted-foreground">
                      {tick ? fmt5(tick.ask) : <span className="opacity-40">—</span>}
                    </td>
                    {/* Spread */}
                    <td className="px-2 py-2 text-right font-mono text-[10px] text-muted-foreground">
                      {tick ? tick.spreadPips : <span className="opacity-40">—</span>}
                    </td>
                    {/* %Change */}
                    <td className="px-2 py-2 text-right">
                      {pct !== null ? (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold",
                          isUp ? "text-[var(--long)]" : "text-[var(--short)]"
                        )}>
                          {isUp
                            ? <TrendingUp className="w-2.5 h-2.5" />
                            : <TrendingDown className="w-2.5 h-2.5" />
                          }
                          {isUp ? "+" : ""}{pct.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Agent Pulse Section */}
        <div className="border-t border-border px-3 pt-2.5 pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Agent Pulse
          </h3>

          {canAccess("elite") ? (
            <div className="divide-y divide-border/50">
              {AGENT_PULSE_DEFS.map((def) => {
                const isDataReady = hasData && pulseSignal !== undefined;
                return (
                  <div key={def.name} className="flex items-center gap-2 py-2">
                    <span
                      className={cn(
                        "mt-0.5 h-1.5 w-1.5 rounded-full shrink-0",
                        isDataReady ? "bg-[var(--long)]" : "bg-amber-500"
                      )}
                    />
                    <span className="text-xs font-medium w-[78px] shrink-0">{def.name}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1 text-xs truncate">
                        <span className="font-medium text-foreground truncate">{def.f1(pulseSignal)}</span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="text-muted-foreground truncate">{def.f2(pulseSignal)}</span>
                      </div>
                      <div className="flex items-baseline gap-1 text-[10px] text-muted-foreground/60 truncate">
                        <span>{def.f1Label}</span>
                        <span>·</span>
                        <span>{def.f2Label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
              <div className="divide-y divide-border/40">
                {AGENT_PULSE_DEFS.map((def) => (
                  <div key={def.name} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">{def.name}</span>
                    <span className="text-[11px] font-mono text-muted-foreground/35 tracking-widest">— · —</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => openPaywall("elite")}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-amber-600 hover:text-amber-500 hover:bg-amber-500/10 transition-colors border-t border-amber-500/20"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.7-2h8.6l1-5.4-3.1 3-2.2-3.8-2.2 3.8-3.1-3L7.7 14z"/></svg>
                Elite · Unlock Agent Pulse
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
