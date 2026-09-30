import type { ReactNode } from "react";
import { cn } from "@/lib/format";

/** Small coloured pill. `tone` maps to a Tailwind class string. */
export function Chip({ tone, children, className }: { tone: string; children: ReactNode; className?: string }) {
  return <span className={cn("chip", tone, className)}>{children}</span>;
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      {title ? (
        <header className="panel-header">
          <div>
            <h2 className="panel-title">{title}</h2>
            {subtitle ? <p className="panel-subtitle mt-0.5">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn(bodyClassName ?? "p-5")}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="text-steel-300">{icon}</div> : null}
      <p className="text-sm font-medium text-steel-600">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-steel-400">{hint}</p> : null}
    </div>
  );
}
