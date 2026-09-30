/**
 * OEE arithmetic.
 *
 * Every function here is pure and total: empty input returns 0 rather than NaN
 * so a chart can never render "NaN%". The SQL view `asset_oee` computes the
 * same two ratios in the database; the two implementations are kept in step on
 * purpose so the offline demo and the live deployment agree to two decimals.
 */

import type { ProductionRun } from "@/types/domain";

export interface OeeBreakdown {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  plannedMinutes: number;
  runningMinutes: number;
  goodUnits: number;
  scrapUnits: number;
}

const ratio = (numerator: number, denominator: number): number =>
  denominator > 0 ? (numerator / denominator) * 100 : 0;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Availability  = runtime / planned schedule
 * Performance   = theoretical cycle output / actual output
 * Quality       = good units / total units
 *
 * Performance is approximated from takt time. When a line's takt is unknown we
 * degrade to treating runtime as fully productive, which yields performance
 * = 100 rather than a divide-by-zero.
 */
export function computeOee(runs: readonly ProductionRun[], taktSeconds = 0): OeeBreakdown {
  const plannedMinutes = runs.reduce((sum, r) => sum + r.planned_minutes, 0);
  const runningMinutes = runs.reduce((sum, r) => sum + r.running_minutes, 0);
  const goodUnits = runs.reduce((sum, r) => sum + r.good_units, 0);
  const scrapUnits = runs.reduce((sum, r) => sum + r.scrap_units, 0);
  const totalUnits = goodUnits + scrapUnits;

  const availability = round2(ratio(runningMinutes, plannedMinutes));
  const quality = round2(ratio(goodUnits, totalUnits));

  let performance = 100;
  if (taktSeconds > 0 && runningMinutes > 0) {
    // One ideal piece every `taktSeconds` for the whole scheduled window.
    const theoreticalUnits = (plannedMinutes * 60) / taktSeconds;
    performance = round2(Math.min(ratio(totalUnits, theoreticalUnits), 100));
  }

  return {
    availability,
    performance,
    quality,
    oee: round2((availability * performance * quality) / 10000),
    plannedMinutes,
    runningMinutes,
    goodUnits,
    scrapUnits,
  };
}

export interface OeeBand {
  label: string;
  min: number;
  tone: "good" | "warn" | "bad";
}

/** Thresholds follow the usual world-class / acceptable / low convention. */
export const OEE_BANDS: readonly OeeBand[] = [
  { label: "ระดับโลก", min: 85, tone: "good" },
  { label: "ยอมรับได้", min: 60, tone: "warn" },
  { label: "ต่ำกว่าเกณฑ์", min: 0, tone: "bad" },
];

export function oeeBand(value: number): OeeBand {
  return OEE_BANDS.find((band) => value >= band.min) ?? OEE_BANDS[OEE_BANDS.length - 1]!;
}

/** Downtime expressed as a share of the scheduled window, in percent. */
export function downtimeShare(runningMinutes: number, plannedMinutes: number): number {
  return round2(ratio(Math.max(plannedMinutes - runningMinutes, 0), plannedMinutes));
}

/** Mean time to repair over a set of work orders that carry a downtime cost. */
export function meanTimeToRepair(workOrders: readonly { downtime_minutes: number; started_at: string | null; completed_at: string | null }[]): number {
  const completed = workOrders.filter(
    (wo) => wo.downtime_minutes > 0 && wo.started_at && wo.completed_at,
  );
  if (completed.length === 0) return 0;
  const total = completed.reduce((sum, wo) => sum + wo.downtime_minutes, 0);
  return Math.round(total / completed.length);
}

/** Compliance = share of PM work orders that reached `verified` on time. */
export function preventiveCompliance(workOrders: readonly { kind: string; state: string; planned_for: string | null }[], asOf: string): number {
  const due = workOrders.filter(
    (wo) => wo.kind === "preventive" && wo.planned_for !== null && wo.planned_for <= asOf,
  );
  if (due.length === 0) return 0;
  const onTime = due.filter((wo) => wo.state === "verified").length;
  return round2(ratio(onTime, due.length));
}
