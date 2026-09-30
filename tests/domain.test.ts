/**
 * Unit tests for the pure domain layer.
 *
 * These cover the rules a maintenance system is actually judged on: OEE
 * arithmetic, workflow gates, stock reservation and the audit trail. They run on
 * the demo snapshot, so no database or environment variables are involved.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { createDemoSnapshot, DEMO_TODAY } from "../src/data/demo-dataset";
import {
  addPart,
  adjustStock,
  createWorkOrder,
  deleteWorkOrder,
  issuePart,
  moveWorkOrder,
  recordDowntime,
  reserveParts,
  setAssetState,
  WorkflowError,
} from "../src/data/plant-store";
import { computeOee, meanTimeToRepair, preventiveCompliance } from "../src/lib/oee";
import { availableStock, isBelowReorderPoint, shortfalls, stockValue } from "../src/lib/inventory";
import { canTransition, closable, isOpen, nextStates } from "../src/lib/workflow";
import { assetPerformance, fleetSummary, joinWorkOrders, linePerformance } from "../src/data/selectors";
import type { PlantSnapshot, ProductionRun, SparePart } from "../src/types/domain";

const ACTOR = "tester@factory.th";

/* ------------------------------------------------------------------ */
/* OEE                                                                 */
/* ------------------------------------------------------------------ */

function run(overrides: Partial<ProductionRun> = {}): ProductionRun {
  return {
    run_id: overrides.run_id ?? "r1",
    asset_id: overrides.asset_id ?? "a1",
    ran_on: overrides.ran_on ?? DEMO_TODAY,
    shift_code: overrides.shift_code ?? "A",
    planned_minutes: 480,
    running_minutes: 456,
    good_units: 950,
    scrap_units: 50,
    ...overrides,
  };
}

test("computeOee multiplies availability, performance and quality", () => {
  const result = computeOee([run()]);
  // 456/480 = 95% availability, 950/1000 = 95% quality, no takt -> 100% performance
  assert.equal(result.availability, 95);
  assert.equal(result.quality, 95);
  assert.equal(result.performance, 100);
  assert.equal(result.oee, 90.25);
});

test("computeOee caps performance at 100 when output exceeds the takt rate", () => {
  const result = computeOee([run({ good_units: 5000, scrap_units: 0 })], 20);
  assert.equal(result.performance, 100);
});

test("computeOee survives an empty shift without dividing by zero", () => {
  const result = computeOee([]);
  assert.equal(result.oee, 0);
  assert.equal(result.availability, 0);
  assert.equal(result.quality, 0);
});

test("meanTimeToRepair ignores work that never started", () => {
  const mttr = meanTimeToRepair([
    { downtime_minutes: 60, started_at: "2026-09-01T08:00:00Z", completed_at: "2026-09-01T09:00:00Z" },
    { downtime_minutes: 30, started_at: null, completed_at: null },
  ]);
  assert.equal(mttr, 60);
});

test("preventiveCompliance counts only verified work that was due", () => {
  const rate = preventiveCompliance(
    [
      { kind: "preventive", state: "verified", planned_for: "2026-09-01" },
      { kind: "preventive", state: "in_progress", planned_for: "2026-09-01" },
      { kind: "preventive", state: "verified", planned_for: "2026-12-01" },
      { kind: "corrective", state: "verified", planned_for: "2026-09-01" },
    ],
    DEMO_TODAY,
  );
  assert.equal(rate, 50);
});

/* ------------------------------------------------------------------ */
/* Workflow                                                            */
/* ------------------------------------------------------------------ */

test("workflow allows the documented forward path and blocks shortcuts", () => {
  assert.ok(canTransition("draft", "scheduled"));
  assert.ok(canTransition("scheduled", "in_progress"));
  assert.ok(canTransition("in_progress", "done"));
  assert.ok(canTransition("done", "verified"));
  // A draft may never jump straight to a completed state.
  assert.equal(canTransition("draft", "done"), false);
  assert.equal(canTransition("draft", "verified"), false);
  assert.equal(canTransition("scheduled", "done"), false);
});

test("finished work can be reopened, but never into a state behind it", () => {
  // Rework is a first-class path: verified work can go back to in_progress.
  assert.ok(canTransition("done", "in_progress"));
  assert.ok(canTransition("verified", "in_progress"));
  // A cancelled work order is only salvageable by returning it to draft.
  assert.ok(canTransition("cancelled", "draft"));
  assert.equal(canTransition("cancelled", "in_progress"), false);
  assert.equal(canTransition("verified", "scheduled"), false);
});

test("every non-terminal state exposes at least one next state", () => {
  for (const state of ["draft", "scheduled", "in_progress", "blocked_parts"] as const) {
    assert.ok(nextStates(state).length > 0, `${state} should have an exit`);
  }
});

test("isOpen matches the states shown on the work order board", () => {
  assert.ok(isOpen("scheduled"));
  assert.ok(isOpen("blocked_parts"));
  assert.equal(isOpen("verified"), false);
  assert.equal(isOpen("cancelled"), false);
});

test("closable blocks completion while parts are still outstanding", () => {
  assert.equal(closable([{ qty_required: 2, qty_issued: 2 }]).ok, true);
  assert.equal(closable([{ qty_required: 2, qty_issued: 1 }]).ok, false);
  assert.equal(closable([{ qty_required: 2, qty_issued: 1 }]).outstanding, 1);
});

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

test("availableStock never goes negative when a part is over-reserved", () => {
  assert.equal(availableStock({ on_hand: 3, reserved: 5 }), 0);
});

test("reorder point compares free stock, not total stock", () => {
  const part = (over: Partial<SparePart>): SparePart => ({
    part_id: "p",
    sku: "SKU",
    description: "d",
    on_hand: 10,
    reserved: 2,
    reorder_point: 3,
    unit_cost: 1,
    lead_time_days: 1,
    bin_location: null,
    ...over,
  });
  assert.equal(isBelowReorderPoint(part({})), false);
  assert.equal(isBelowReorderPoint(part({ reserved: 8 })), true);
  assert.equal(isBelowReorderPoint(part({ on_hand: 5, reserved: 2 })), true);
});

test("shortfalls only reports the quantity that is still missing", () => {
  const snapshot = createDemoSnapshot();
  const line = snapshot.workOrderParts[0]!;
  const part = snapshot.parts.find((p) => p.part_id === line.part_id)!;

  const [full] = shortfalls([{ ...line, qty_issued: 0 }], [part]);
  assert.equal(full?.missing, line.qty_required);

  const [none] = shortfalls([{ ...line, qty_issued: line.qty_required }], [part]);
  assert.equal(none, undefined);
});

test("stockValue multiplies quantity by unit cost", () => {
  assert.equal(stockValue({ on_hand: 4, unit_cost: 12.5 } as never), 50);
});

/* ------------------------------------------------------------------ */
/* Store mutations                                                     */
/* ------------------------------------------------------------------ */

test("createWorkOrder rejects an unknown asset", () => {
  const snapshot = createDemoSnapshot();
  assert.throws(
    () =>
      createWorkOrder(snapshot, ACTOR, {
        asset_id: "does-not-exist",
        kind: "corrective",
        priority: "p2",
        title: "งานทดสอบ",
        detail: null,
        planned_for: null,
      }),
    WorkflowError,
  );
});

test("createWorkOrder numbers sequentially within the current year", () => {
  const snapshot = createDemoSnapshot();
  const asset = snapshot.assets[0]!;
  const before = snapshot.workOrders.length;

  const next = createWorkOrder(snapshot, ACTOR, {
    asset_id: asset.asset_id,
    kind: "corrective",
    priority: "p3",
    title: "เปลี่ยนเบรก",
    detail: null,
    planned_for: DEMO_TODAY,
  });

  assert.equal(next.workOrders.length, before + 1);
  assert.ok(next.workOrders.at(-1)!.wo_number.startsWith(`WO-${DEMO_TODAY.slice(0, 4)}-`));
  // The original snapshot is never mutated.
  assert.equal(snapshot.workOrders.length, before);
});

test("moveWorkOrder refuses an illegal transition", () => {
  const snapshot = createDemoSnapshot();
  const draft = snapshot.workOrders.find((w) => w.state === "draft");
  if (!draft) return; // demo data changed shape; nothing to assert
  assert.throws(() => moveWorkOrder(snapshot, ACTOR, draft.work_order_id, "verified"), WorkflowError);
});

test("reserveParts then issuePart moves the same stock without creating it", () => {
  const snapshot = createDemoSnapshot();
  const line = snapshot.workOrderParts.find(
    (l) =>
      l.qty_issued === 0 &&
      l.qty_required > l.qty_reserved &&
      snapshot.parts.some((p) => p.part_id === l.part_id && p.on_hand - p.reserved > 0),
  );
  if (!line) return;

  const partId = line.part_id;
  const workOrderId = line.work_order_id;
  const partBefore = snapshot.parts.find((p) => p.part_id === partId)!;

  const reserved = reserveParts(snapshot, ACTOR, workOrderId, partId);
  const afterReserve = reserved.parts.find((p) => p.part_id === partId)!;
  const lineAfterReserve = reserved.workOrderParts.find((l) => l.wo_part_id === line.wo_part_id)!;

  // Reserving earmarks stock: it never changes the physical balance.
  assert.equal(afterReserve.on_hand, partBefore.on_hand);
  assert.equal(lineAfterReserve.qty_reserved - line.qty_reserved, afterReserve.reserved - partBefore.reserved);
  assert.ok(lineAfterReserve.reserved_at, "a reservation is timestamped");
  assert.equal(lineAfterReserve.qty_issued, line.qty_issued);

  const issued = issuePart(reserved, ACTOR, workOrderId, partId);
  const afterIssue = issued.parts.find((p) => p.part_id === partId)!;
  const lineAfterIssue = issued.workOrderParts.find((l) => l.wo_part_id === line.wo_part_id)!;

  // Issuing consumes the physical unit and releases the reservation it came from.
  assert.equal(afterIssue.on_hand, afterReserve.on_hand - lineAfterReserve.qty_reserved);
  assert.equal(afterIssue.reserved, afterReserve.reserved - lineAfterReserve.qty_reserved);
  assert.equal(lineAfterIssue.qty_issued, line.qty_issued + lineAfterReserve.qty_reserved);
  assert.equal(lineAfterIssue.qty_reserved, 0);
  assert.ok(lineAfterIssue.issued_at, "an issue is timestamped");

  // Nothing was created or destroyed: on hand + issued is conserved.
  assert.equal(afterIssue.on_hand + lineAfterIssue.qty_issued, partBefore.on_hand + line.qty_issued);
});

test("issuePart refuses to run when nothing is reserved for the work order", () => {
  const snapshot = createDemoSnapshot();
  const line = snapshot.workOrderParts.find((l) => l.qty_reserved === 0);
  if (!line) return;
  assert.throws(() => issuePart(snapshot, ACTOR, line.work_order_id, line.part_id), WorkflowError);
});

test("adjustStock will not push stock below the reserved amount", () => {
  const snapshot = createDemoSnapshot();
  const part = snapshot.parts.find((p) => p.reserved > 0);
  if (!part) return;
  // Everything that is not reserved may be written off; one piece more is refused
  // because that stock is already promised to an open work order.
  assert.doesNotThrow(() => adjustStock(snapshot, ACTOR, part.part_id, -(part.on_hand - part.reserved)));
  assert.throws(
    () => adjustStock(snapshot, ACTOR, part.part_id, -(part.on_hand - part.reserved + 1)),
    WorkflowError,
  );
});

test("adjustStock never allows a negative balance", () => {
  const snapshot = createDemoSnapshot();
  const part = snapshot.parts.find((p) => p.reserved === 0)!;
  assert.throws(() => adjustStock(snapshot, ACTOR, part.part_id, -(part.on_hand + 1)), WorkflowError);
});

test("addPart rejects a duplicate SKU regardless of case", () => {
  const snapshot = createDemoSnapshot();
  const existing = snapshot.parts[0]!;
  assert.throws(
    () =>
      addPart(snapshot, ACTOR, {
        sku: existing.sku.toLowerCase(),
        description: "ซ้ำ",
        on_hand: 1,
        reorder_point: 0,
        unit_cost: 1,
        lead_time_days: 1,
        bin_location: null,
      }),
    WorkflowError,
  );
});

test("setAssetState will not start a machine that has work in progress", () => {
  const snapshot = createDemoSnapshot();
  const busy = snapshot.workOrders.find((w) => w.state === "in_progress");
  if (!busy) return;
  const asset = snapshot.assets.find((a) => a.asset_id === busy.asset_id)!;
  // Put the machine into a stopped state first, otherwise setting it to the
  // state it is already in is a no-op and the guard never runs.
  const stopped = setAssetState(snapshot, ACTOR, asset.asset_id, "maintenance");
  assert.throws(() => setAssetState(stopped, ACTOR, asset.asset_id, "running"), WorkflowError);
});

test("deleteWorkOrder refuses to remove history", () => {
  const snapshot = createDemoSnapshot();
  const closed = snapshot.workOrders.find((w) => ["in_progress", "done", "verified"].includes(w.state));
  if (!closed) return;
  assert.throws(() => deleteWorkOrder(snapshot, ACTOR, closed.work_order_id), WorkflowError);
});

test("recordDowntime requires a description and appends to the trail", () => {
  const snapshot = createDemoSnapshot();
  const asset = snapshot.assets.find((a) => a.state !== "decommissioned")!;

  assert.throws(
    () => recordDowntime(snapshot, ACTOR, { asset_id: asset.asset_id, cause: "mechanical", work_order_id: null, narration: "  " }),
    WorkflowError,
  );

  const next = recordDowntime(snapshot, ACTOR, {
    asset_id: asset.asset_id,
    cause: "mechanical",
    work_order_id: null,
    narration: "เบรกไม่คลาย",
  });
  assert.equal(next.downtime.length, snapshot.downtime.length + 1);
  assert.ok(next.trail.length > snapshot.trail.length);
});

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

test("joinWorkOrders attaches the asset and counts missing parts", () => {
  const snapshot: PlantSnapshot = createDemoSnapshot();
  const rows = joinWorkOrders(snapshot);
  assert.equal(rows.length, snapshot.workOrders.length);
  for (const row of rows) {
    assert.ok(row.asset_tag.length > 0);
    assert.ok(row.missing_parts >= 0);
  }
});

test("line and asset OEE stay inside 0-100", () => {
  const snapshot = createDemoSnapshot();
  for (const line of linePerformance(snapshot)) {
    for (const value of [line.availability, line.oee.quality, line.oee.oee]) {
      assert.ok(value >= 0 && value <= 100, `${line.code} produced ${value}`);
    }
  }
  for (const asset of snapshot.assets) {
    const oee = assetPerformance(snapshot, asset.asset_id).oee;
    assert.ok(oee >= 0 && oee <= 100);
  }
});

test("fleetSummary aggregates consistently with the parts catalogue", () => {
  const snapshot = createDemoSnapshot();
  const summary = fleetSummary(snapshot, DEMO_TODAY);
  const expected = snapshot.parts.reduce((sum, p) => sum + stockValue(p), 0);
  assert.ok(Math.abs(summary.partsValue - expected) < 0.01);
  assert.ok(summary.openWork >= 0);
});
