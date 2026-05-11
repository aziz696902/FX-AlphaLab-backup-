"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  CandlestickData,
  Time,
  CandlestickSeries,
} from "lightweight-charts";
import { LiveTick, LiveStatus } from "@/lib/api";
import { useLiveCandles } from "@/hooks/use-live-candles";
import { cn } from "@/lib/utils";
import { useOhlcv } from "@/hooks/use-ohlcv";

interface TooltipData {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  rsi: string | null;
  macd: string | null;
  bbPercent: string | null;
  ema200: boolean | null;
  atrRank: string | null;
}

interface CandlestickChartProps {
  symbol: string;
  onTick?: (tick: LiveTick) => void;
}

type Timeframe = "M1" | "M15" | "H1" | "H4" | "D1";

const TF_DAYS: Record<Timeframe, number> = {
  M1: 1,
  M15: 7,
  H1: 30,
  H4: 90,
  D1: 365,
};

const TIMEFRAMES: Timeframe[] = ["M1", "M15", "H1", "H4", "D1"];

export function CandlestickChart({ symbol, onTick }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const initialLoadComplete = useRef(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>("H1");
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
  const [liveTick, setLiveTick] = useState<LiveTick | null>(null);

  const { bars, loading: ohlcvLoading } = useOhlcv(symbol, activeTimeframe, TF_DAYS[activeTimeframe]);

  // ── Chart init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    let resizeObserver: ResizeObserver | null = null;
    let deferredObserver: ResizeObserver | null = null;
    let handleResize: (() => void) | null = null;

    const initializeChart = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth <= 0 || clientHeight <= 0) return false;

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: "#FFFFFF" },
          textColor: "#6B7280",
        },
        grid: {
          vertLines: { color: "#F0F2F5" },
          horzLines: { color: "#F0F2F5" },
        },
        width: clientWidth,
        height: clientHeight,
        crosshair: {
          vertLine: { color: "#1F4AA8", width: 1, style: 2 },
          horzLine: { color: "#1F4AA8", width: 1, style: 2 },
        },
        rightPriceScale: { borderColor: "#E3E6EA" },
        timeScale: {
          borderColor: "#E3E6EA",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;

      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#0D9488",
        downColor: "#DC2626",
        borderUpColor: "#0D9488",
        borderDownColor: "#DC2626",
        wickUpColor: "#0D9488",
        wickDownColor: "#DC2626",
      });

      seriesRef.current = candlestickSeries;

      chart.subscribeCrosshairMove((param) => {
        if (!param.point || !param.time) {
          setTooltip(null);
          return;
        }

        const candleData = param.seriesData.get(candlestickSeries) as CandlestickData;
        if (candleData) {
          const date = new Date((param.time as number) * 1000);
          setTooltip({
            time: date.toLocaleString(),
            open: candleData.open.toFixed(5),
            high: candleData.high.toFixed(5),
            low: candleData.low.toFixed(5),
            close: candleData.close.toFixed(5),
            rsi: null,
            macd: null,
            bbPercent: null,
            ema200: null,
            atrRank: null,
          });
          setTooltipPosition({ x: param.point.x, y: param.point.y });
        }
      });

      handleResize = () => {
        if (chartRef.current) {
          const { clientWidth: width, clientHeight: height } = container;
          if (width > 0 && height > 0) {
            chartRef.current.applyOptions({ width, height });
          }
        }
      };

      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
      window.addEventListener("resize", handleResize);
      setTimeout(handleResize, 0);
      return true;
    };

    if (!initializeChart()) {
      deferredObserver = new ResizeObserver(() => {
        if (initializeChart() && deferredObserver) {
          deferredObserver.disconnect();
          deferredObserver = null;
        }
      });
      deferredObserver.observe(container);
    }

    return () => {
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      resizeObserver?.disconnect();
      deferredObserver?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol]);

  // ── Feed real OHLCV data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || bars.length === 0) return;

    const chartData: CandlestickData[] = bars.map((b) => ({
      time: Math.floor(new Date(b.timestamp_utc).getTime() / 1000) as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

    seriesRef.current.setData(chartData);
    chartRef.current?.timeScale().fitContent();
    initialLoadComplete.current = true;
  }, [bars]);

  useEffect(() => {
    initialLoadComplete.current = false;
  }, [symbol, activeTimeframe]);

  useLiveCandles(symbol, activeTimeframe, {
    onCandle: (bar) => {
      if (initialLoadComplete.current) {
        seriesRef.current?.update({ ...bar, time: bar.time as Time });
      }
    },
    onTick: (tick) => {
      setLiveTick(tick);
      onTick?.(tick);
    },
    onStatus: setLiveStatus,
  });

  return (
    <div className="flex-1 bg-card rounded-md border border-border overflow-hidden flex flex-col h-full min-h-[260px]">
      {/* Chart toolbar */}
      <div className="h-10 bg-muted/50 border-b border-border flex items-center px-3 gap-1 shrink-0">
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                activeTimeframe === tf
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tf}
            </button>
          ))}
          {ohlcvLoading && (
            <span className="text-[10px] text-muted-foreground ml-2">Loading…</span>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {liveTick && (
            <div className="font-mono text-xs">
              <span className="text-[var(--buy)]">{liveTick.ask.toFixed(5)}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-[var(--sell)]">{liveTick.bid.toFixed(5)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full",
                liveStatus === "connected" ? "bg-green-500" :
                liveStatus === "connecting" ? "bg-gray-400" :
                liveStatus === "reconnecting" ? "bg-yellow-400 animate-pulse" :
                "bg-red-500"
              )}
            />
            <span className="text-[10px] text-muted-foreground">
              {liveStatus === "connected" ? "Live" :
               liveStatus === "connecting" ? "Connecting" :
               liveStatus === "reconnecting" ? "Reconnecting" :
               "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 relative overflow-hidden min-h-[200px]">
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 bg-card border border-border rounded shadow-lg p-2 pointer-events-none text-xs"
            style={{
              left: Math.min(tooltipPosition.x + 10, (chartContainerRef.current?.clientWidth || 0) - 180),
              top: Math.max(tooltipPosition.y - 100, 10),
            }}
          >
            <div className="font-medium mb-1">{tooltip.time}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <span className="text-muted-foreground">Open:</span>
              <span className="font-mono text-right">{tooltip.open}</span>
              <span className="text-muted-foreground">High:</span>
              <span className="font-mono text-right text-[var(--long)]">{tooltip.high}</span>
              <span className="text-muted-foreground">Low:</span>
              <span className="font-mono text-right text-[var(--short)]">{tooltip.low}</span>
              <span className="text-muted-foreground">Close:</span>
              <span className="font-mono text-right">{tooltip.close}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
