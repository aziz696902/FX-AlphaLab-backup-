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
  toActionLabel,
} from "@/lib/api";

const WATCHLIST_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"];

interface AgentPulseDef {
  name: string;
  driver: (sig: AgentSignalAPI | undefined) => string;
  impact: string;
}

const AGENT_PULSE_DEFS: AgentPulseDef[] = [
  {
    name: "Technical",
    driver: (s) => s?.tech_vol_regime ?? "—",
    impact: "entry (1d)",
  },
  {
    name: "Macro",
    driver: (s) => s?.macro_dominant_driver ?? "—",
    impact: "direction (5d)",
  },
  {
    name: "Geopolitical",
    driver: (s) =>
      s?.geo_base_zone_explanation?.dominant_driver ?? s?.geo_risk_regime ?? "—",
    impact: "volatility (2w)",
  },
  {
    name: "Sentiment",
    driver: (s) => {
      if (!s) return "—";
      if (s.composite_stress_flag) {
        const src = s.sentiment_stress_sources?.[0];
        return src ?? "stress flagged";
      }
      return "normal";
    },
    impact: "regime overlay",
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

  const { canAccess, open: openPaywall } = useUpgradeModal();
  const hasData = coordinatorSignals.size > 0;
  const watchlistTicks = useWatchlistTicks();

  // Pick a representative pair for Agent Pulse (first available, or EURUSD)
  const pulseSignal = agentSignals.get("EURUSD") ?? agentSignals.values().next().value;

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
                const cs = coordinatorSignals.get(pair);
                const action = toActionLabel(cs?.suggested_action ?? null);
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
                      hasData && action === "BUY" && "border-l-2 border-l-[var(--long)]",
                      hasData && action === "SELL" && "border-l-2 border-l-[var(--short)]",
                    )}
                  >
                    {/* Symbol + action badge */}
                    <td className="px-2 py-2">
                      <div className="font-semibold text-[11px] leading-tight">{pair}</div>
                      {hasData && cs && (
                        <Badge
                          className={cn(
                            "text-[8px] px-1 py-0 h-3 mt-0.5 font-medium",
                            action === "BUY" && "bg-[var(--buy)] text-white",
                            action === "SELL" && "bg-[var(--sell)] text-white",
                            action === "HOLD" && "bg-muted text-muted-foreground"
                          )}
                        >
                          {action}
                        </Badge>
                      )}
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
        <div className="border-t border-border p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Agent Pulse
          </h3>

          {canAccess("elite") ? (
            <div className="space-y-2.5">
              {AGENT_PULSE_DEFS.map((def) => {
                const agentSig = agentSignals.get("EURUSD") ?? pulseSignal;
                const driver = def.driver(agentSig);
                const isDataReady = hasData && agentSig !== undefined;
                const status = !isDataReady ? "WARN" : "OK";

                return (
                  <div key={def.name} className="bg-muted/50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-medium">{def.name}</span>
                      <span className="text-muted-foreground">·</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[9px] px-1 py-0 h-3.5 font-medium",
                          status === "OK" && "bg-[var(--long)]/15 text-[var(--long)]",
                          status === "WARN" && "bg-amber-500/15 text-amber-600"
                        )}
                      >
                        {status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <span>Driver:</span>
                      <span className="text-foreground font-medium truncate max-w-[100px]">{driver}</span>
                      <span className="mx-0.5">|</span>
                      <span>Impact:</span>
                      <span className="text-foreground font-medium">{def.impact}</span>
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
                    <span className="text-[11px] font-medium text-muted-foreground">{def.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/35 tracking-widest">— · —</span>
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
