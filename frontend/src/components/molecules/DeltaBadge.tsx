import { cn } from "@/lib/utils";

interface DeltaBadgeProps {
  value: number;
}

export default function DeltaBadge({ value }: DeltaBadgeProps) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-mono",
        positive
          ? "border-emerald-400/40 text-emerald-300"
          : "border-rose-400/40 text-rose-300"
      )}
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}
    </span>
  );
}
