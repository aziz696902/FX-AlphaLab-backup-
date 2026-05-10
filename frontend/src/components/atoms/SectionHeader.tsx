import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  actions?: React.ReactNode;
}

export default function SectionHeader({ title, subtitle, className, actions }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div>
        <h2 className="text-lg font-semibold text-ink-1">{title}</h2>
        {subtitle ? <p className="text-xs text-ink-3">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
