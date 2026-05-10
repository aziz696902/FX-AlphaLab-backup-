import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className={cn("min-h-screen", "grid-glow")}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-ink-3">FX-AlphaLab</p>
            <h1 className="text-2xl font-semibold text-ink-1">
              Multi-Modal Multi-Agent Framework
            </h1>
          </div>
          <div className="flex items-center gap-4 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
            <span className="h-2 w-2 animate-pulseSoft rounded-full bg-emerald-400" />
            Live Decision Support
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
