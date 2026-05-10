import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Panel({ title, className, children }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-panel/80 shadow-[0_0_0_1px_rgba(15,23,42,0.6)] backdrop-blur",
        className
      )}
    >
      {title ? (
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <h3 className="text-sm font-semibold tracking-[0.18em] text-ink-3">{title}</h3>
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}
