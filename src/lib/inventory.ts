/**
 * Spare part reservation arithmetic.
 *
 * The `blocked_parts` state is decided from these helpers, never from a
 * hand-maintained boolean, so the work order board and the storeroom can never
 * disagree about whether something is waiting on a part.
 */

import type { SparePart, WorkOrderPart } from "@/types/domain";

export const availableStock = (part: Pick<SparePart, "on_hand" | "reserved">): number =>
  Math.max(part.on_hand - part.reserved, 0);

export const isBelowReorderPoint = (part: SparePart): boolean =>
  availableStock(part) <= part.reorder_point;

export interface Shortfall {
  part_id: string;
  sku: string;
  description: string;
  missing: number;
  lead_time_days: number;
  /** Stock is on the shelf but already promised to another work order. */
  free: number;
  /** Nobody has reserved it anywhere yet. */
  unreserved: number;
}

/**
 * Everything a work order is still waiting on, worst lead time first - the
 * planner buys the slow-moving item first.
 */
export function shortfalls(
  lines: readonly WorkOrderPart[],
  catalogue: readonly SparePart[],
): Shortfall[] {
  const byId = new Map(catalogue.map((p) => [p.part_id, p]));

  return lines
    .map((line) => {
      const part = byId.get(line.part_id);
      const missing = Math.max(line.qty_required - line.qty_issued, 0);
      const partReserved = part ? part.reserved : 0;
      const partOnHand = part ? part.on_hand : 0;
      return {
        part_id: line.part_id,
        sku: part?.sku ?? "—",
        description: part?.description ?? "(ไม่พบในรายการอะไหล่)",
        missing,
        lead_time_days: part?.lead_time_days ?? 0,
        free: Math.max(partOnHand - partReserved, 0),
        unreserved: partOnHand,
      };
    })
    .filter((row) => row.missing > 0)
    .sort((a, b) => b.lead_time_days - a.lead_time_days || b.missing - a.missing);
}

export const hasShortfall = (lines: readonly WorkOrderPart[]): boolean =>
  lines.some((line) => line.qty_issued < line.qty_required);

/** How many more units can be reserved from the shelf without overselling. */
export const reservable = (line: WorkOrderPart, part: SparePart): number => {
  const stillNeeded = Math.max(line.qty_required - Math.max(line.qty_reserved, line.qty_issued), 0);
  return Math.max(Math.min(stillNeeded, availableStock(part)), 0);
};

/** Inventory valuation at the latest known unit cost. */
export const stockValue = (part: SparePart): number => part.on_hand * part.unit_cost;

export const formatBaht = (value: number): string =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
