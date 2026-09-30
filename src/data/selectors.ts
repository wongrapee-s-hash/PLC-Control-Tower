/**
 * Read-side selectors.
 *
 * The dashboard and the list screens compose their rows from these, never by
 * joining inline inside a component. That keeps one definition of "open work"
 * and "OEE for this line" in the whole codebase.
 */

import { computeOee, meanTimeToRepair, preventiveCompliance, type OeeBreakdown } from "@/lib/oee";
import { isBelowReorderPoint, shortfalls, stockValue } from "@/lib/inventory";
import { isOpen, PRIORITY_RANK } from "@/lib/workflow";
import { CRITICALITY_RANK } from "@/lib/labels";
import type { Asset, PlantSnapshot, ProductionRun, WorkOrderRow } from "@/types/domain";

export interface WorkOrderJoined extends WorkOrderRow {
  missing_parts: number;
}

export function joinWorkOrders(snapshot: PlantSnapshot): WorkOrderJoined[] {
  const assetById = new Map(snapshot.assets.map((a) => [a.asset_id, a]));
  const lineById = new Map(snapshot.lines.map((l) => [l.line_id, l]));

  return snapshot.workOrders.map((wo) => {
    const asset = assetById.get(wo.asset_id);
    const lines = snapshot.workOrderParts.filter((p) => p.work_order_id === wo.work_order_id);
    const missing = shortfalls(lines, snapshot.parts).reduce((sum, s) => sum + s.missing, 0);
    return {
      ...wo,
      asset_tag: asset?.asset_tag ?? "—",
      asset_name: asset?.name ?? "(เครื่องจักรถูกลบ)",
      line_name: asset?.line_id ? (lineById.get(asset.line_id)?.name ?? null) : null,
      missing_parts: missing,
    };
  });
}

export const openWorkOrders = (rows: readonly WorkOrderJoined[]): WorkOrderJoined[] =>
  rows.filter((r) => isOpen(r.state));

/** Open work ordered the way a shift lead would read a board: P1 first, then oldest. */
export function sortByUrgency(rows: readonly WorkOrderJoined[]): WorkOrderJoined[] {
  return [...rows].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.opened_at.localeCompare(b.opened_at),
  );
}

export interface LinePerformance {
  line_id: string;
  code: string;
  name: string;
  assetCount: number;
  taktSeconds: number;
  shiftsPerDay: number;
  oee: OeeBreakdown;
  availability: number;
  faults: number;
}

export function linePerformance(snapshot: PlantSnapshot): LinePerformance[] {
  return snapshot.lines.map((line) => {
    const assetIds = new Set(
      snapshot.assets.filter((a) => a.line_id === line.line_id).map((a) => a.asset_id),
    );
    const runs = snapshot.runs.filter((r) => assetIds.has(r.asset_id));
    const oee = computeOee(runs, line.takt_seconds);
    return {
      line_id: line.line_id,
      code: line.code,
      name: line.name,
      assetCount: assetIds.size,
      taktSeconds: line.takt_seconds,
      shiftsPerDay: line.shifts_per_day,
      oee,
      availability: oee.availability,
      faults: snapshot.assets.filter((a) => a.line_id === line.line_id && a.state === "fault").length,
    };
  });
}

export function assetPerformance(snapshot: PlantSnapshot, assetId: string): OeeBreakdown {
  const asset = snapshot.assets.find((a) => a.asset_id === assetId);
  const line = asset?.line_id ? snapshot.lines.find((l) => l.line_id === asset.line_id) : undefined;
  const runs = snapshot.runs.filter((r) => r.asset_id === assetId);
  return computeOee(runs, line?.takt_seconds ?? 0);
}

/** Availability per day for the trend chart, most recent day last. */
export function availabilityTrend(
  runs: readonly ProductionRun[],
  days = 7,
): { date: string; label: string; availability: number }[] {
  const byDate = new Map<string, { planned: number; running: number }>();
  for (const run of runs) {
    const bucket = byDate.get(run.ran_on) ?? { planned: 0, running: 0 };
    bucket.planned += run.planned_minutes;
    bucket.running += run.running_minutes;
    byDate.set(run.ran_on, bucket);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, bucket]) => ({
      date,
      label: new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short" }).format(
        new Date(`${date}T00:00:00`),
      ),
      availability: roundTo(bucket.planned > 0 ? (bucket.running / bucket.planned) * 100 : 0),
    }));
}

const roundTo = (value: number): number => Math.round(value * 10) / 10;

export interface FleetSummary {
  assetCount: number;
  running: number;
  faulted: number;
  oee: OeeBreakdown;
  openWork: number;
  blockedWork: number;
  p1Count: number;
  mttrMinutes: number;
  pmCompliance: number;
  openDowntime: number;
  shortfallItems: number;
  partsValue: number;
  reorderCount: number;
}

export function fleetSummary(snapshot: PlantSnapshot, today: string): FleetSummary {
  const rows = joinWorkOrders(snapshot);
  const open = openWorkOrders(rows);
  const activeAssets = snapshot.assets.filter((a) => a.state !== "decommissioned");
  const runs = snapshot.runs;

  return {
    assetCount: activeAssets.length,
    running: activeAssets.filter((a) => a.state === "running").length,
    faulted: activeAssets.filter((a) => a.state === "fault").length,
    oee: computeOee(runs),
    openWork: open.length,
    blockedWork: open.filter((r) => r.state === "blocked_parts").length,
    p1Count: open.filter((r) => r.priority === "p1").length,
    mttrMinutes: meanTimeToRepair(snapshot.workOrders),
    pmCompliance: preventiveCompliance(snapshot.workOrders, today),
    openDowntime: snapshot.downtime.filter((d) => d.reaction !== "mitigated").length,
    shortfallItems: snapshot.workOrderParts
      .filter((p) => p.qty_issued < p.qty_required)
      .reduce((sum, p) => sum + (p.qty_required - p.qty_issued), 0),
    partsValue: snapshot.parts.reduce((sum, p) => sum + stockValue(p), 0),
    reorderCount: snapshot.parts.filter(isBelowReorderPoint).length,
  };
}

export interface AssetRisk {
  asset: Asset;
  reasons: string[];
  score: number;
}

/**
 * What deserves attention on the dashboard rail. Score is a plain weighted sum
 * so the ordering is explainable to the operator rather than a black box.
 */
export function riskQueue(snapshot: PlantSnapshot, today: string, limit = 5): AssetRisk[] {
  const rows = joinWorkOrders(snapshot);
  const ranked: AssetRisk[] = snapshot.assets.map((asset) => {
    const reasons: string[] = [];
    let score = 0;

    if (asset.state === "fault") {
      score += 50;
      reasons.push("อยู่ในสถานะขัดข้อง");
    }
    if (asset.state === "maintenance") {
      score += 20;
      reasons.push("อยู่ระหว่างซ่อม");
    }
    if (asset.next_pm_due && asset.next_pm_due <= today) {
      score += 30;
      reasons.push("ถึงกำหนด PM แล้ว");
    }

    const open = rows.filter((r) => r.asset_id === asset.asset_id && isOpen(r.state));
    const p1 = open.filter((r) => r.priority === "p1");
    score += p1.length * 15 + open.filter((r) => r.state === "blocked_parts").length * 12;

    if (p1.length > 0) reasons.push(`มีงานด่วน P1 ${p1.length} ใบ`);
    if (open.some((r) => r.state === "blocked_parts")) reasons.push("ค้างรออะไหล่");
    if (open.length > 0) reasons.push(`เปิดงานค้าง ${open.length} ใบ`);

    return { asset, reasons, score };
  });

  return ranked
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        CRITICALITY_RANK[b.asset.criticality] - CRITICALITY_RANK[a.asset.criticality],
    )
    .slice(0, limit);
}

export interface DowntimeCauseSlice {
  cause: string;
  minutes: number;
  events: number;
}

export function downtimeByCause(snapshot: PlantSnapshot, excludePlanned = true): DowntimeCauseSlice[] {
  const buckets = new Map<string, DowntimeCauseSlice>();
  for (const event of snapshot.downtime) {
    if (excludePlanned && event.cause === "planned") continue;
    const bucket = buckets.get(event.cause) ?? { cause: event.cause, minutes: 0, events: 0 };
    bucket.minutes += event.minutes;
    bucket.events += 1;
    buckets.set(event.cause, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.minutes - a.minutes);
}
