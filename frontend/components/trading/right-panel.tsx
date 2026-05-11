"use client";

import Image from "next/image";
import { FileText, Link2, Maximize2, Sparkles, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { getReportPath } from "@/lib/report-paths";
import {
  AgentSignalAPI,
  CoordinatorReportAPI,
  CoordinatorSignalAPI,
  fetchNarrative,
  toActionLabel,
  toConfidenceLabel,
} from "@/lib/api";
import { toast } from "sonner";
import { useTrade } from "@/hooks/use-trade";
import { useLiveTick } from "@/hooks/use-live-tick";

// ── label helpers ────────────────────────────────────────────────────────────

function toTechnicalDirection(value: number | null): string {
  if (value == null) return "—";
  if (value > 0.5) return "Bullish";
  if (value < -0.5) return "Bearish";
  if (value > 0.15) return "Sl. Bullish";
  if (value < -0.15) return "Sl. Bearish";
  return "Neutral";
}

function toMacroDirection(value: string | null): string {
  if (!value) return "—";
  if (value === "up") return "Bullish";
  if (value === "down") return "Bearish";
  return value;
}

function toConfidenceUnit(value: number | null): string {
  if (value == null) return "—";
  const normalized = value > 1 ? value / 100 : value;
  return `${(normalized * 100).toFixed(0)}%`;
}

function toDirectionSource(raw: string): string {
  if (raw.startsWith("macro_")) return "Macro";
  if (raw === "tech_usdjpy") return "Technical";
  return "—";
}

function toHorizon(raw: string): string {
  if (raw === "1d") return "1 day";
  if (raw === "5d") return "5 days";
  return "—";
}

function toVolRegime(raw: string | null): string {
  if (!raw) return "—";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function toMacroDominantDriver(raw: string | null): string {
  if (!raw) return "—";
  const map: Record<string, string> = {
    carry_signal_score: "Carry Trade",
    regime_context_score: "Regime Context",
    fundamental_mispricing_score: "Fundamental Mispricing",
    macro_surprise_score: "Economic Surprise",
  };
  return map[raw] ?? raw;
}

function toGeoDriver(raw: string | null): string {
  if (!raw) return "—";
  const map: Record<string, string> = {
    log_count: "Event Count",
    goldstein: "Stability Score",
    conflict_frac: "Conflict Ratio",
    avg_tone: "News Tone",
    log_mentions: "Media Mentions",
  };
  return map[raw] ?? raw;
}

function toGeoRiskRegime(raw: string | null): string {
  if (!raw) return "—";
  if (raw === "high") return "Elevated";
  if (raw === "low") return "Low";
  return raw;
}

function toStressSources(sources: string[] | null): string {
  if (!sources || sources.length === 0) return "None";
  const labels: Record<string, string> = {
    gdelt_attention: "GDELT Attention",
    macro_attention: "Search Trends",
  };
  return sources.map((s) => labels[s] ?? s).join(", ");
}

function toTimeframeVotes(votes: Record<string, number> | null): string {
  if (!votes) return "—";
  const tfLabel: Record<string, string> = { D1: "Daily", H4: "4H", H1: "1H" };
  return Object.entries(votes)
    .map(([tf, v]) => `${tfLabel[tf] ?? tf}: ${v === 1 ? "Long" : "Short"}`)
    .join(" · ");
}

function toTierBadgeClass(tier: string | null): string {
  switch (tier) {
    case "High":   return "bg-emerald-500 text-white";
    case "Medium": return "bg-amber-500 text-white";
    case "Low":    return "bg-red-400 text-white";
    default:       return "bg-muted text-muted-foreground";
  }
}

function toTierTextClass(tier: string | null): string {
  switch (tier) {
    case "High":   return "text-emerald-500";
    case "Medium": return "text-amber-500";
    case "Low":    return "text-red-400";
    default:       return "text-muted-foreground";
  }
}

function toActionTextClass(action: string | null): string {
  if (action === "BUY")  return "text-[var(--buy)]";
  if (action === "SELL") return "text-[var(--sell)]";
  return "text-muted-foreground";
}

function toAttentionLevel(value: number | null): string {
  if (value == null) return "—";
  if (value > 2.0) return "High Alert";
  if (value > 1.0) return "Elevated";
  if (value >= -1.0) return "Normal";
  if (value >= -2.0) return "Low";
  return "Suppressed";
}

function toBilateralRisk(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function toSignedScore(value: number | null): string {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(3)}`;
}

// ── types ─────────────────────────────────────────────────────────────────────

interface PairCall {
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  conviction: number;
  confidenceTier: string | null;
  positionSize: number;
  sl: string;
  tp: string;
  source: string;
  horizon: string;
}

function buildPairCalls(
  coordinatorSignals: Map<string, CoordinatorSignalAPI> | undefined,
): PairCall[] {
  if (!coordinatorSignals || coordinatorSignals.size === 0) return [];
  return Array.from(coordinatorSignals.entries()).map(([symbol, cs]) => ({
    symbol,
    action: toActionLabel(cs.suggested_action) as "BUY" | "SELL" | "HOLD",
    conviction: Math.round((cs.conviction_score ?? 0) * 100),
    confidenceTier: cs.confidence_tier ? toConfidenceLabel(cs.confidence_tier) : null,
    positionSize: cs.position_size_pct ?? 0,
    sl: cs.sl_pct != null ? `${cs.sl_pct.toFixed(2)}%` : "—",
    tp: cs.tp_pct != null ? `${cs.tp_pct.toFixed(2)}%` : "—",
    source: toDirectionSource(cs.direction_source ?? ""),
    horizon: toHorizon(cs.direction_horizon ?? ""),
  }));
}

// ── order controls ────────────────────────────────────────────────────────────

interface OrderControlsProps {
  symbol: string;
}

function OrderControls({ symbol }: OrderControlsProps) {
  const liveTick = useLiveTick(symbol);
  const [orderType, setOrderType] = useState<"market" | "pending">("market");
  const [size, setSize] = useState("0.10");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [orderError, setOrderError] = useState<string | null>(null);

  const bidPrice = liveTick?.bid.toFixed(5) ?? "—";
  const askPrice = liveTick?.ask.toFixed(5) ?? "—";
  const spread = liveTick?.spreadPips.toFixed(1) ?? "—";

  const { openOrder, isPending } = useTrade();

  const place = async (side: "BUY" | "SELL") => {
    setOrderError(null);
    try {
      const result = await openOrder({
        pair: symbol,
        side,
        volume: parseFloat(size) || 0.01,
        sl: sl ? parseFloat(sl) : undefined,
        tp: tp ? parseFloat(tp) : undefined,
      });
      if (result.success) {
        toast.success(` ${side} filled @ ${result.fillPrice?.toFixed(5)} — ticket #${result.ticket}`);
      } else {
        setOrderError(result.errorMessage ?? "Order failed");
      }
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-1.5 border-t border-border p-2">
      <div className="flex gap-1.5">
        <Button disabled={isPending} onClick={() => place("BUY")} className="h-8 flex-1 bg-[var(--buy)] text-white hover:bg-[var(--buy)]/90" size="sm">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-normal leading-none">BUY</span>
            <span className="font-mono text-xs leading-none mt-0.5">{askPrice}</span>
          </div>
        </Button>
        <Button disabled={isPending} onClick={() => place("SELL")} className="h-8 flex-1 bg-[var(--sell)] text-white hover:bg-[var(--sell)]/90" size="sm">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-normal leading-none">SELL</span>
            <span className="font-mono text-xs leading-none mt-0.5">{bidPrice}</span>
          </div>
        </Button>
      </div>

      <div className="text-center text-[10px] text-muted-foreground">
        {symbol} spread: <span className="font-mono">{spread}</span> pips
      </div>

      <div className="flex gap-1.5">
        <Button
          variant={orderType === "market" ? "default" : "outline"}
          size="sm"
          className="h-6 flex-1 text-xs"
          onClick={() => setOrderType("market")}
        >
          Market
        </Button>
        <Button
          variant={orderType === "pending" ? "default" : "outline"}
          size="sm"
          className="h-6 flex-1 text-xs"
          onClick={() => setOrderType("pending")}
        >
          Pending
        </Button>
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Size (lots)</label>
          <Input value={size} onChange={(e) => setSize(e.target.value)} className="mt-0.5 h-6 text-xs font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Stop Loss</label>
            <Input
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder="Price"
              className="mt-0.5 h-6 text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Take Profit</label>
            <Input
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              placeholder="Price"
              className="mt-0.5 h-6 text-xs font-mono"
            />
          </div>
        </div>
      </div>

      <div>
        <Button className="h-7 w-full text-xs" disabled={isPending}>
          {isPending ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : "Place Order"}
        </Button>
        {orderError && <div className="mt-1 text-xs text-red-600">{orderError}</div>}
      </div>
    </div>
  );
}

// ── Locked placeholder ────────────────────────────────────────────────────────

function AgentOutputsLocked({ onUpgrade }: { onUpgrade: () => void }) {
  const AGENTS = ["Technical", "Macro", "Geopolitical", "Sentiment"];
  return (
    <div className="border-b border-border p-3">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Actual Agent Outputs
      </h3>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
        <div className="divide-y divide-border/50">
          {AGENTS.map((name) => (
            <div key={name} className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">{name}</span>
              <span className="text-[10px] font-mono text-muted-foreground/40 tracking-widest">— · —</span>
            </div>
          ))}
        </div>
        <button
          onClick={onUpgrade}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold text-amber-600 hover:text-amber-500 hover:bg-amber-500/10 transition-colors border-t border-amber-500/20"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.7-2h8.6l1-5.4-3.1 3-2.2-3.8-2.2 3.8-3.1-3L7.7 14z"/></svg>
          Elite · Unlock Agent Outputs
        </button>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface RightPanelProps {
  symbol: string;
  width?: number;
  report?: CoordinatorReportAPI | null;
  coordinatorSignals?: Map<string, CoordinatorSignalAPI>;
  agentSignals?: Map<string, AgentSignalAPI>;
  mt5Connected: boolean;
}

export function RightPanel({
  symbol,
  width = 340,
  report,
  coordinatorSignals,
  agentSignals,
  mt5Connected,
}: RightPanelProps) {
  const { canAccess, open: openPaywall } = useUpgradeModal();
  const [analysisRevealed, setAnalysisRevealed] = useState(false);
  const [activePairTab, setActivePairTab] = useState(symbol);
  const [reportOpen, setReportOpen] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const pairCalls = useMemo(() => buildPairCalls(coordinatorSignals), [coordinatorSignals]);
  const hasData = pairCalls.length > 0 || report != null;

  const activeSymbol = useMemo(() => {
    if (pairCalls.some((p) => p.symbol === symbol)) {
      return activePairTab === symbol || !pairCalls.some((p) => p.symbol === activePairTab)
        ? symbol
        : activePairTab;
    }
    return activePairTab;
  }, [activePairTab, symbol, pairCalls]);

  const activePair = pairCalls.find((p) => p.symbol === activeSymbol) ?? pairCalls[0];

  // Today's Call — real data only, no mock fallbacks
  const topPickSymbol = report?.top_pick ?? null;
  const topPickCs = topPickSymbol ? coordinatorSignals?.get(topPickSymbol) : undefined;
  const topPickConviction = topPickCs?.conviction_score != null
    ? Math.round(topPickCs.conviction_score * 100)
    : null;
  const topPickConfTier = topPickCs?.confidence_tier != null
    ? toConfidenceLabel(topPickCs.confidence_tier)
    : null;
  const topPickPosSz = topPickCs?.position_size_pct != null
    ? `${topPickCs.position_size_pct.toFixed(1)}%`
    : null;
  const topPickSlTp = topPickCs?.sl_pct != null && topPickCs?.tp_pct != null
    ? `${topPickCs.sl_pct.toFixed(2)}% / ${topPickCs.tp_pct.toFixed(2)}%`
    : null;
  const topPickAction = topPickCs?.suggested_action
    ? toActionLabel(topPickCs.suggested_action)
    : null;
  const narrativeContext = report?.narrative_context
    ? typeof report.narrative_context === "string"
      ? report.narrative_context
      : JSON.stringify(report.narrative_context)
    : null;

  useEffect(() => {
    if (!report?.date || !report?.narrative_context) return;
    setAiNarrative(null);
    setNarrativeLoading(true);
    fetchNarrative(report.narrative_context as Record<string, unknown>)
      .then((narrative) => { if (narrative) setAiNarrative(narrative); })
      .catch(() => {})
      .finally(() => setNarrativeLoading(false));
  }, [report?.date]);

  // Active pair agent signals — real only, no mock fallbacks
  const activeAs = agentSignals?.get(activePair?.symbol ?? symbol) ?? null;

  const reportHref = getReportPath(activePair?.symbol ?? symbol);

  return (
    <aside
      className="flex shrink-0 flex-col overflow-hidden border-l border-border bg-card shadow-[var(--card-shadow)]"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-12 items-center justify-center px-1">
            <Image src="/logo.png" alt="FX AlphaLab logo" width={44} height={28} className="h-auto w-full" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Alpha Signal</p>
            <h2 className="text-sm font-semibold">AI Recommendation</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <style>{`
          @keyframes rp-fade-up {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes rp-shimmer-bg {
            0%   { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes rp-content-reveal {
            from { opacity: 0; transform: scale(0.97) translateY(10px); filter: blur(4px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);    filter: blur(0);  }
          }
          @keyframes rp-deep-dive-glow {
            0%, 100% { box-shadow: 0 2px 8px rgba(31,74,168,0.25); }
            50%       { box-shadow: 0 4px 22px rgba(31,74,168,0.6), 0 0 0 2px rgba(31,74,168,0.25); }
          }
          @keyframes rp-deep-dive-shimmer-bg {
            0%   { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}</style>

        {/* Idle state */}
        {!analysisRevealed && (
          <div
            className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center"
            style={{ animation: 'rp-fade-up 0.4s ease-out both' }}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'radial-gradient(circle at 40% 35%, rgba(31,74,168,0.16), rgba(31,74,168,0.06))' }}
            >
              <Sparkles className="h-6 w-6" style={{ color: 'rgb(31,74,168)' }} />
            </div>
            <div style={{ animation: 'rp-fade-up 0.4s 0.12s ease-out both' }}>
              <p className="text-sm font-semibold text-foreground">AI Recommendations</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Analyze market conditions and generate trade signals across all pairs.
              </p>
            </div>
            <div className="w-full" style={{ animation: 'rp-fade-up 0.4s 0.22s ease-out both' }}>
              <Button
                size="sm"
                className="relative h-9 w-full overflow-hidden border border-primary/30 bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                onClick={() => canAccess("pro") ? setAnalysisRevealed(true) : openPaywall("pro")}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Run Analysis
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)',
                    backgroundSize: '200% 100%',
                    backgroundPosition: '-200% center',
                    animation: 'rp-shimmer-bg 5s ease-in-out infinite 1s',
                  }}
                />
              </Button>
            </div>
          </div>
        )}

        {/* Analysis content — Pro+ only */}
        {analysisRevealed && canAccess("pro") && (
        <div style={{ animation: 'rp-content-reveal 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>

        {/* Today's Call */}
        <div className="border-b border-border p-3">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today&apos;s Call
          </h3>

          {!hasData ? (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No signal data available.</p>
              <p className="mt-1 text-[10px] text-muted-foreground/60">
                Run the inference pipeline to generate today&apos;s signals.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/15 bg-[linear-gradient(180deg,rgba(31,74,168,0.12),rgba(31,74,168,0.03))] p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Top Pick</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xl font-semibold text-foreground">{topPickSymbol ?? "—"}</p>
                    {topPickAction && (
                      <Badge
                        className={cn(
                          "h-6 px-2.5 text-[10px] text-white",
                          topPickAction === "BUY" && "bg-[var(--buy)]",
                          topPickAction === "SELL" && "bg-[var(--sell)]",
                          topPickAction === "HOLD" && "bg-[var(--flat)]"
                        )}
                      >
                        {topPickAction}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Conviction</p>
                  <p className={cn("mt-1 text-2xl font-semibold", toActionTextClass(topPickAction))}>
                    {topPickConviction != null ? `${topPickConviction}%` : "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border border-border/60 bg-background/75 px-2 py-2">
                  <p className="text-[10px] text-muted-foreground">Conf Tier</p>
                  <div className="mt-1">
                    {topPickConfTier ? (
                      <Badge className={cn("h-5 px-1.5 text-[10px]", toTierBadgeClass(topPickConfTier))}>
                        {topPickConfTier}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/75 px-2 py-2">
                  <p className="text-[10px] text-muted-foreground">Pos Size</p>
                  <p className="mt-1 font-mono">{topPickPosSz ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/75 px-2 py-2">
                  <p className="text-[10px] text-muted-foreground">SL / TP</p>
                  <p className="mt-1 font-mono">{topPickSlTp ?? "—"}</p>
                </div>
              </div>

              {(narrativeContext || narrativeLoading) && (
                <div className="mt-4 rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Context</p>
                  {narrativeLoading ? (
                    <p className="mt-2 text-xs text-muted-foreground animate-pulse">Generating summary…</p>
                  ) : (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {aiNarrative ?? narrativeContext}
                    </p>
                  )}
                </div>
              )}

              <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="relative mt-3 h-9 w-full overflow-hidden border-0 text-xs font-semibold text-white"
                    style={{
                      background: 'linear-gradient(105deg, rgb(24,62,148), rgb(31,74,168) 50%, rgb(48,96,196))',
                      animation: 'rp-deep-dive-glow 2.6s ease-in-out infinite',
                    }}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Open Deep Dive Report
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{
                        backgroundImage: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)',
                        backgroundSize: '200% 100%',
                        backgroundPosition: '-200% center',
                        animation: 'rp-deep-dive-shimmer-bg 4s ease-in-out infinite 2s',
                      }}
                    />
                  </Button>
                </DialogTrigger>
                <DialogContent
                  showCloseButton={false}
                  className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-none grid-rows-none flex-col gap-0 overflow-hidden rounded-xl border border-border bg-[#e8eaef] p-0 shadow-2xl sm:!max-w-[1500px]"
                >
                  <DialogHeader className="shrink-0 border-b border-border bg-card px-5 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-12 shrink-0 items-center justify-center px-1">
                          <Image src="/logo.png" alt="FX AlphaLab logo" width={44} height={28} className="h-auto w-full" />
                        </div>
                        <div className="min-w-0">
                          <DialogTitle className="text-base">Deep Dive Report</DialogTitle>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <a
                          href={reportHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 text-[11px] font-semibold text-primary transition-colors hover:border-primary/45 hover:bg-primary/15"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          Full view
                        </a>
                        <DialogClose className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <X className="h-4 w-4" />
                          <span className="sr-only">Close</span>
                        </DialogClose>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="min-h-0 flex-1 overflow-hidden bg-[#dfe3ea] p-3">
                    <iframe
                      src={reportHref}
                      title={`${activePair?.symbol ?? symbol} deep dive report`}
                      className="block h-full w-full rounded-lg border border-border bg-[#eee9df] shadow-sm"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Recommendation Details */}
        <div className="border-b border-border p-3">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recommendation Details
          </h3>

          {pairCalls.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground">No pair signals available.</p>
            </div>
          ) : (
            <Tabs value={activePair.symbol} onValueChange={setActivePairTab}>
              <TabsList className="h-7 w-full bg-muted p-0.5">
                {pairCalls.map((pair) => (
                  <TabsTrigger
                    key={pair.symbol}
                    value={pair.symbol}
                    className="h-6 flex-1 text-[10px] data-[state=active]:bg-card"
                  >
                    {pair.symbol}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suggested Action</span>
                  <Badge
                    className={cn(
                      "h-5 px-1.5 text-[10px]",
                      activePair.action === "BUY" && "bg-[var(--buy)] text-white",
                      activePair.action === "SELL" && "bg-[var(--sell)] text-white",
                      activePair.action === "HOLD" && "bg-[var(--flat)] text-white"
                    )}
                  >
                    {activePair.action}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conviction</span>
                  <span className={cn("font-mono", toActionTextClass(activePair.action))}>
                    {activePair.conviction}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Confidence</span>
                  {activePair.confidenceTier ? (
                    <Badge className={cn("h-5 px-1.5 text-[10px]", toTierBadgeClass(activePair.confidenceTier))}>
                      {activePair.confidenceTier}
                    </Badge>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position Size</span>
                  <span className="font-mono">{activePair.positionSize}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SL / TP</span>
                  <span className="font-mono">
                    <span className="text-[var(--short)]">{activePair.sl}</span> /{" "}
                    <span className="text-[var(--long)]">{activePair.tp}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span>{activePair.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horizon</span>
                  <span>{activePair.horizon}</span>
                </div>
              </div>
            </Tabs>
          )}
        </div>

        {/* Agent Outputs — Elite only */}
        {canAccess("elite") ? (
          <div className="border-b border-border p-3">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actual Agent Outputs
            </h3>

            {!activeAs ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-4 text-center">
                <p className="text-xs text-muted-foreground">
                  No agent data for {activePair?.symbol ?? symbol}.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                {/* Technical */}
                <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Technical</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-muted-foreground">Direction</div>
                    <div className="font-medium text-foreground">
                      {toTechnicalDirection(activeAs.tech_direction ?? null)}
                    </div>
                    <div className="text-muted-foreground">Confidence</div>
                    <div className="font-mono text-foreground">
                      {toConfidenceUnit(activeAs.tech_confidence ?? null)}
                    </div>
                    <div className="text-muted-foreground">Timeframe Votes</div>
                    <div className="font-medium text-foreground">
                      {toTimeframeVotes(activeAs.tech_timeframe_votes)}
                    </div>
                    <div className="text-muted-foreground">Volatility</div>
                    <div className="font-medium text-foreground">
                      {toVolRegime(activeAs.tech_vol_regime)}
                    </div>
                  </div>
                </div>

                {/* Macro */}
                <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Macro</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-muted-foreground">Direction</div>
                    <div className="font-medium text-foreground">
                      {toMacroDirection(activeAs.macro_direction ?? null)}
                    </div>
                    <div className="text-muted-foreground">Confidence</div>
                    <div className="font-mono text-foreground">
                      {toConfidenceUnit(activeAs.macro_confidence ?? null)}
                    </div>
                    <div className="text-muted-foreground">Key Driver</div>
                    <div className="font-medium text-foreground">
                      {toMacroDominantDriver(activeAs.macro_dominant_driver)}
                    </div>
                    <div className="text-muted-foreground">Surprise</div>
                    <div className="font-mono text-foreground">
                      {toSignedScore(activeAs.macro_surprise_score ?? null)}
                    </div>
                    <div className="text-muted-foreground">Bias</div>
                    <div className="font-mono text-foreground">
                      {toSignedScore(activeAs.macro_bias_score ?? null)}
                    </div>
                  </div>
                </div>

                {/* Geo */}
                <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Geopolitical</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-muted-foreground">Risk Regime</div>
                    <div className="font-medium text-foreground">
                      {toGeoRiskRegime(activeAs.geo_risk_regime)}
                    </div>
                    <div className="text-muted-foreground">Bilateral Risk</div>
                    <div className="font-mono text-foreground">
                      {toBilateralRisk(activeAs.geo_bilateral_risk ?? null)}
                    </div>
                    <div className="text-muted-foreground">Base Driver</div>
                    <div className="font-medium text-foreground">
                      {toGeoDriver(activeAs.geo_base_zone_explanation?.dominant_driver ?? null)}
                    </div>
                    <div className="text-muted-foreground">Quote Driver</div>
                    <div className="font-medium text-foreground">
                      {toGeoDriver(activeAs.geo_quote_zone_explanation?.dominant_driver ?? null)}
                    </div>
                  </div>
                </div>

                {/* Sentiment */}
                <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sentiment</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                    {(activePair?.symbol ?? symbol) === "USDJPY" && (
                      <>
                        <div className="text-muted-foreground">USDJPY Vol Signal</div>
                        <div className="font-medium text-foreground">
                          {activeAs.usdjpy_stocktwits_vol_signal != null ? "Active" : "Inactive"}
                        </div>
                      </>
                    )}
                    <div className="text-muted-foreground">Stress Flag</div>
                    <div className="font-medium text-foreground">
                      {activeAs.composite_stress_flag != null
                        ? (activeAs.composite_stress_flag ? "Yes" : "No")
                        : "—"}
                    </div>
                    <div className="text-muted-foreground">Stress Sources</div>
                    <div className="font-medium text-foreground">
                      {toStressSources(activeAs.sentiment_stress_sources)}
                    </div>
                    <div className="text-muted-foreground">GDELT Attention</div>
                    <div className="font-mono text-foreground">
                      {toAttentionLevel(activeAs.gdelt_attention_zscore ?? null)}
                    </div>
                    <div className="text-muted-foreground">Search Trends</div>
                    <div className="font-mono text-foreground">
                      {toAttentionLevel(activeAs.macro_attention_zscore ?? null)}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        ) : (
          <AgentOutputsLocked onUpgrade={() => openPaywall("elite")} />
        )}
        </div>
        )}
      </div>

      {mt5Connected ? (
        <OrderControls symbol={symbol} />
      ) : (
        <div className="relative border-t border-border">
          <div className="pointer-events-none select-none blur-[2px] opacity-40 p-3 space-y-3">
            <div className="flex gap-2">
              <div className="h-9 flex-1 rounded-md bg-[var(--buy)] flex flex-col items-center justify-center">
                <span className="text-[10px] text-white font-normal">BUY</span>
                <span className="font-mono text-xs text-white">—</span>
              </div>
              <div className="h-9 flex-1 rounded-md bg-[var(--sell)] flex flex-col items-center justify-center">
                <span className="text-[10px] text-white font-normal">SELL</span>
                <span className="font-mono text-xs text-white">—</span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-7 flex-1 rounded-md border border-border bg-muted" />
              <div className="h-7 flex-1 rounded-md border border-border bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-7 rounded-md border border-border bg-muted" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-7 rounded-md border border-border bg-muted" />
                <div className="h-7 rounded-md border border-border bg-muted" />
              </div>
            </div>
            <div className="h-8 rounded-md border border-border bg-muted" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground text-center px-4">
              <a href="/profile" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Link MT5
              </a>{" "}
              to place trades
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
