import { cn } from "@/lib/utils";
import type { Direction } from "@/types/agents";

interface SignalPillProps {
  direction: Direction;
  className?: string;
}

export default function SignalPill({ direction, className }: SignalPillProps) {
  const styleMap: Record<Direction, string> = {
    bullish: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    bearish: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    neutral: "bg-white/10 text-ink-2 border-white/10"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
        styleMap[direction],
        className
      )}
    >
      {direction}
    </span>
  );
}
