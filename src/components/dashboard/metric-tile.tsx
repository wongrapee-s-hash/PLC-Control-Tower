import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/format";

export interface MetricTileProps {
  label: string;
  value: string;
  unit?: string;
  caption: string;
  icon: LucideIcon;
  tone?: "neutral" | "good" | "warn" | "bad";
  /** Rendered as a thin progress bar under the value. 0-100, or omitted. */
  progress?: number;
}

const TONE_RING: Record<NonNullable<MetricTileProps["tone"]>, string> = {
  neutral: "ring-steel-200",
  good: "ring-emerald-200",
  warn: "ring-signal-300",
  bad: "ring-rose-200",
};

const TONE_TEXT: Record<NonNullable<MetricTileProps["tone"]>, string> = {
  neutral: "text-steel-900 dark:text-white",
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-signal-600 dark:text-signal-400",
  bad: "text-rose-600 dark:text-rose-400",
};

const TONE_BAR: Record<NonNullable<MetricTileProps["tone"]>, string> = {
  neutral: "bg-steel-300",
  good: "bg-emerald-500",
  warn: "bg-signal-400",
  bad: "bg-rose-500",
};

export function MetricTile({ label, value, unit, caption, icon: Icon, tone = "neutral", progress }: MetricTileProps) {
  return (
    <div className={cn("panel flex flex-col gap-3 p-4 ring-1 ring-inset", TONE_RING[tone])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-steel-500">{label}</p>
        <Icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[tone])} />
      </div>
      <div>
        <p className={cn("metric", TONE_TEXT[tone])}>
          {value}
          {unit ? <span className="ml-1 text-base font-medium text-steel-400">{unit}</span> : null}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-steel-500">{caption}</p>
      </div>
      {typeof progress === "number" ? (
        <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-steel-200 dark:bg-white/10">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", TONE_BAR[tone])}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
