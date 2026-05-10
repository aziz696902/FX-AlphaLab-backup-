import type { ConfluenceLevel } from "@/types/agents";

interface LiquidityHeatmapProps {
  levels: ConfluenceLevel[];
}

export default function LiquidityHeatmap({ levels }: LiquidityHeatmapProps) {
  return (
    <div className="space-y-2">
      {levels.map((level) => (
        <div key={`${level.level}-${level.alignment}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>{level.alignment}</span>
            <span className="font-mono text-ink-1">{level.level.toFixed(4)}</span>
          </div>
          <div className="mt-2 h-3 w-full rounded-full bg-white/10">
            <div
              className={`h-3 rounded-full ${
                level.strength === "major" ? "bg-emerald-400/70" : "bg-slate-400/60"
              }`}
              style={{ width: level.strength === "major" ? "85%" : "55%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
