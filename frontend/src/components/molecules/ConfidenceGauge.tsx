import { cn } from "@/lib/utils";

interface ConfidenceGaugeProps {
  value: number;
  label: string;
  tone?: "bull" | "bear" | "neutral";
}

export default function ConfidenceGauge({ value, label, tone = "neutral" }: ConfidenceGaugeProps) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const rotation = 180 * clamped;
  const toneColor =
    tone === "bull" ? "from-emerald-400" : tone === "bear" ? "from-rose-400" : "from-slate-400";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-ink-3">{label}</span>
        <span className="font-mono text-sm text-ink-1">{clamped.toFixed(3)}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full bg-gradient-to-r", toneColor, "to-transparent")}
          style={{ width: `${clamped * 100}%` }}
        />
        <div
          className="absolute -top-1 h-5 w-[2px] bg-white/60"
          style={{ left: `${rotation / 1.8}%` }}
        />
      </div>
    </div>
  );
}
