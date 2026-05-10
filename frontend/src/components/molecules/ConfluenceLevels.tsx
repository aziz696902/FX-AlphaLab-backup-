import type { ConfluenceLevel } from "@/types/agents";

interface ConfluenceLevelsProps {
  levels: ConfluenceLevel[];
}

export default function ConfluenceLevels({ levels }: ConfluenceLevelsProps) {
  return (
    <div className="space-y-2">
      {levels.map((level) => (
        <div
          key={`${level.level}-${level.alignment}`}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
        >
          <div>
            <p className="text-sm font-semibold text-ink-1">{level.level.toFixed(4)}</p>
            <p className="text-xs text-ink-3">{level.alignment}</p>
          </div>
          <span
            className={`text-[11px] uppercase tracking-[0.18em] ${
              level.strength === "major" ? "text-emerald-300" : "text-ink-3"
            }`}
          >
            {level.strength}
          </span>
        </div>
      ))}
    </div>
  );
}
