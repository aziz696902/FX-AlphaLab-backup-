"use client";

import { useEffect, useMemo, useRef } from "react";
import { createChart, type ISeriesApi, type CandlestickData, type UTCTimestamp } from "lightweight-charts";
import Panel from "@/components/atoms/Panel";
import SectionHeader from "@/components/atoms/SectionHeader";
import ConfluenceLevels from "@/components/molecules/ConfluenceLevels";
import LiquidityHeatmap from "@/components/molecules/LiquidityHeatmap";
import { useAgentStore } from "@/store/agentStore";
import TraceLink from "@/components/molecules/TraceLink";

export default function ConfluenceChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const { priceSeries, technicalSignal, impactTimeline, reasoningLog, agentStates } = useAgentStore();

  const chartData = useMemo<CandlestickData[]>(() => {
    return priceSeries.map((bar) => ({
      time: bar.time as UTCTimestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close
    }));
  }, [priceSeries]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      height: 360,
      layout: {
        background: { color: "#0b0d12" },
        textColor: "#cbd5f5",
        fontFamily: "var(--font-plex-mono)"
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" }
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)"
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)"
      }
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#fb7185",
      wickUpColor: "#34d399",
      wickDownColor: "#fda4af",
      borderVisible: false
    });

    candleSeries.setData(chartData);

    const smaSeries = chart.addLineSeries({
      color: "#38bdf8",
      lineWidth: 2
    });

    const smaData = chartData.map((bar, index) => {
      const window = chartData.slice(Math.max(0, index - 4), index + 1);
      const avg = window.reduce((sum, item) => sum + item.close, 0) / window.length;
      return { time: bar.time, value: avg };
    });

    smaSeries.setData(smaData);

    technicalSignal.confluence_levels.forEach((level) => {
      candleSeries.createPriceLine({
        price: level.level,
        color: level.strength === "major" ? "#22c55e" : "#94a3b8",
        lineWidth: level.strength === "major" ? 2 : 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.alignment
      });
    });

    const markers = impactTimeline.map((event) => ({
      time: event.timestamp_utc as UTCTimestamp,
      position: "aboveBar" as const,
      color: event.impact === "high" ? "#f97316" : "#facc15",
      shape: "circle" as const,
      text: event.title
    }));

    candleSeries.setMarkers(markers);

    seriesRef.current = candleSeries;

    return () => {
      chart.remove();
    };
  }, [chartData, impactTimeline, technicalSignal.confluence_levels]);

  useEffect(() => {
    if (!rsiRef.current) {
      return;
    }

    const rsiChart = createChart(rsiRef.current, {
      height: 140,
      layout: {
        background: { color: "#0b0d12" },
        textColor: "#cbd5f5",
        fontFamily: "var(--font-plex-mono)"
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" }
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        visible: true
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        visible: false
      }
    });

    const rsiSeries = rsiChart.addLineSeries({
      color: "#22d3ee",
      lineWidth: 2
    });

    const rsiData = chartData.map((bar, index) => {
      const start = Math.max(0, index - 13);
      const slice = chartData.slice(start, index + 1);
      let gains = 0;
      let losses = 0;
      for (let i = 1; i < slice.length; i += 1) {
        const diff = slice[i].close - slice[i - 1].close;
        if (diff >= 0) {
          gains += diff;
        } else {
          losses += Math.abs(diff);
        }
      }
      const avgGain = gains / Math.max(slice.length - 1, 1);
      const avgLoss = losses / Math.max(slice.length - 1, 1);
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      return { time: bar.time, value: rsi };
    });

    rsiSeries.setData(rsiData);

    return () => {
      rsiChart.remove();
    };
  }, [chartData]);

  const reasoning = reasoningLog.find((item) => item.agent === "technical");

  return (
    <Panel>
      <SectionHeader
        title="Confluence Engine"
        subtitle="Multi-timeframe alignment with event overlays"
        actions={reasoning ? <TraceLink item={reasoning} /> : null}
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="relative rounded-xl border border-white/10 bg-black/50 p-3">
          {agentStates.technical === "running" ? (
            <div className="absolute inset-0 z-10 rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="h-full w-full rounded-lg shimmer" />
            </div>
          ) : null}
          <div ref={containerRef} />
          <div className="mt-3 flex items-center justify-between text-xs text-ink-3">
            <span>Markers: geopolitical events</span>
            <span className="font-mono">Vol regime: {technicalSignal.volatility_regime}</span>
          </div>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/60 p-2">
            <div className="mb-2 flex items-center justify-between text-xs text-ink-3">
              <span>RSI (14)</span>
              <span className="font-mono">{technicalSignal.indicator_snapshot.rsi.toFixed(1)}</span>
            </div>
            <div ref={rsiRef} className="h-[140px]" />
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Confluence Levels</p>
            <div className="mt-3">
              <ConfluenceLevels levels={technicalSignal.confluence_levels} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Liquidity Heatmap</p>
            <div className="mt-3">
              <LiquidityHeatmap levels={technicalSignal.confluence_levels} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
