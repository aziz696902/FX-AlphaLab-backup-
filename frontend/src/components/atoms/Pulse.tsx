import { cn } from "@/lib/utils";

interface PulseProps {
  tone: "bull" | "bear" | "neutral";
  className?: string;
}

export default function Pulse({ tone, className }: PulseProps) {
  const toneClass =
    tone === "bull" ? "bg-accent-bull" : tone === "bear" ? "bg-accent-bear" : "bg-ink-3";

  return (
    <span className={cn("relative flex h-2.5 w-2.5", className)}>
      <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-50", toneClass, "animate-pulseSoft")} />
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", toneClass)} />
    </span>
  );
}
