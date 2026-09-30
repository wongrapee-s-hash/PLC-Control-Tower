/**
 * Tests for the Supabase write-back layer.
 *
 * `syncSnapshot` talks to a `SupabaseClient`, so the tests use a recording stub
 * instead of a live project. The point is to pin down the contract that matters
 * when the database is involved: which rows are written, in which order, and
 * that a browser-minted primary key survives the round trip.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createDemoSnapshot } from "../src/data/demo-dataset";
import { attachPartToWorkOrder, createWorkOrder } from "../src/data/plant-store";
import { syncSnapshot, type SyncResult } from "../src/lib/supabase/sync";
import type { PlantSnapshot } from "../src/types/domain";

/** One captured call to `.from(table).insert/update/delete()`. */
interface Call {
  table: string;
  op: "insert" | "update" | "delete";
  payload: unknown;
  match?: { column: string; value: unknown };
}

interface Stub extends SupabaseClient {
  calls: Call[];
  /** Force the nth call to fail, to exercise the error path. */
  failAt: (index: number, message: string) => void;
}

function makeStub(): Stub {
  const calls: Call[] = [];
  const failures = new Map<number, string>();
  let index = 0;

  const builder = (table: string, op: Call["op"], payload: unknown, match?: Call["match"]) => {
    const at = index++;
    const { error } = (() => {
      const message = failures.get(at);
      return message ? { error: { message } } : { error: null };
    })();
    calls.push({ table, op, payload, match });
    // PostgREST builders are thenable and chainable; the sync only awaits them.
    const promise = Promise.resolve({ error, data: null });
    return Object.assign(promise, {
      select: () => promise,
      eq: (column: string, value: unknown) => {
        calls[calls.length - 1]!.match = { column, value };
        return promise;
      },
      in: (column: string, values: unknown) => {
        calls[calls.length - 1]!.match = { column, value: values };
        return promise;
      },
    });
  };

  const client = {
    calls,
    failAt: (at: number, message: string) => failures.set(at, message),
    from: (table: string) => ({
      insert: (payload: unknown) => builder(table, "insert", payload),
      update: (payload: unknown) => builder(table, "update", payload),
      delete: () => builder(table, "delete", undefined),
    }),
  };

  return client as unknown as Stub;
}

function insertsFor(stub: Stub, table: string): Record<string, unknown>[] {
  return stub.calls.filter((c) => c.op === "insert" && c.table === table).flatMap((c) => c.payload as Record<string, unknown>[]);
}

const empty: PlantSnapshot = {
  sites: [],
  lines: [],
  assets: [],
  parts: [],
  workOrders: [],
  workOrderParts: [],
  runs: [],
  downtime: [],
  trail: [],
};

/* ------------------------------------------------------------------ */
/* Primary keys must survive                                          */
/* ------------------------------------------------------------------ */

test("a new row keeps the id the browser generated", async () => {
  const stub = makeStub();
  const before = empty;
  const after = createWorkOrder(
    { ...empty, assets: createDemoSnapshot().assets.slice(0, 1) },
    "tester@factory.th",
    {
      asset_id: createDemoSnapshot().assets[0]!.asset_id,
      kind: "corrective",
      priority: "p1",
      title: "เปลี่ยนเบรก",
      detail: null,
      planned_for: null,
    },
  );

  const result = await syncSnapshot(stub, before, after);
  assert.equal(result.ok, true, result.error ?? "");

  const [row] = insertsFor(stub, "work_orders");
  const clientId = after.workOrders[0]!.work_order_id;
  // The FK on work_order_parts points at this value; if the insert dropped it
  // PostgreSQL would mint a different id and the child row would dangle.
  assert.equal(row!.work_order_id, clientId);
});

test("generated timestamp columns are never sent by the client", async () => {
  const stub = makeStub();
  const after = { ...createDemoSnapshot(), parts: [] };
  const before: PlantSnapshot = { ...after, parts: [createDemoSnapshot().parts[0]!] };

  const result = await syncSnapshot(stub, before, after);
  assert.equal(result.ok, true, result.error ?? "");

  for (const call of stub.calls) {
    for (const row of (call.payload ?? []) as Record<string, unknown>[]) {
      assert.equal("created_at" in row, false);
      assert.equal("updated_at" in row, false);
    }
  }
});

test("an update never rewrites the primary key it matches on", async () => {
  const stub = makeStub();
  const before = createDemoSnapshot();
  const after: PlantSnapshot = {
    ...before,
    assets: before.assets.map((a, i) => (i === 0 ? { ...a, state: "fault" as const } : a)),
  };

  const result = await syncSnapshot(stub, before, after);
  assert.equal(result.ok, true, result.error ?? "");

  const update = stub.calls.find((c) => c.op === "update");
  assert.ok(update, "expected one update");
  const payload = update.payload as Record<string, unknown>;
  assert.equal("asset_id" in payload, false);
  assert.equal(update.match?.column, "asset_id");
  assert.equal(update.match?.value, before.assets[0]!.asset_id);
});

/* ------------------------------------------------------------------ */
/* Ordering                                                           */
/* ------------------------------------------------------------------ */

test("a parent is inserted before the child that references it", async () => {
  const stub = makeStub();
  const base = createDemoSnapshot();
  const asset = base.assets[0]!;
  const part = base.parts[0]!;

  const withWorkOrder = createWorkOrder(base, "tester@factory.th", {
    asset_id: asset.asset_id,
    kind: "corrective",
    priority: "p1",
    title: "เปลี่ยนเบรก",
    detail: null,
    planned_for: null,
  });
  const withPart = attachPartToWorkOrder(withWorkOrder, "tester@factory.th", withWorkOrder.workOrders[0]!.work_order_id, part.part_id, 2);

  const result = await syncSnapshot(stub, empty, withPart);
  assert.equal(result.ok, true, result.error ?? "");

  const order = stub.calls.map((c) => `${c.op}:${c.table}`);
  const workOrderAt = order.indexOf("insert:work_orders");
  const partAt = order.indexOf("insert:work_order_parts");
  assert.ok(workOrderAt >= 0 && partAt >= 0, `missing inserts in ${order.join(", ")}`);
  assert.ok(workOrderAt < partAt, `work_orders must be written first, got ${order.join(", ")}`);
});

test("deletes run before inserts so a replaced row cannot collide", async () => {
  const stub = makeStub();
  const before = createDemoSnapshot();
  // Same assets, one removed and one added: a delete and an insert on the same
  // table in a single mutation.
  const after: PlantSnapshot = {
    ...before,
    assets: [
      ...before.assets.slice(1),
      {
        ...before.assets[0]!,
        asset_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        asset_tag: "NEW-001",
      },
    ],
  };

  const result = await syncSnapshot(stub, before, after);
  assert.equal(result.ok, true, result.error ?? "");

  const assetOps = stub.calls.filter((c) => c.table === "assets").map((c) => c.op);
  assert.equal(assetOps[0], "delete", `expected delete first, got ${assetOps.join(", ")}`);
  assert.equal(assetOps[1], "insert");
});

test("child rows are deleted before their parent", async () => {
  const stub = makeStub();
  const before = createDemoSnapshot();
  const workOrder = before.workOrders[0]!;
  const after: PlantSnapshot = {
    ...before,
    workOrders: before.workOrders.filter((w) => w.work_order_id !== workOrder.work_order_id),
    workOrderParts: before.workOrderParts.filter((p) => p.work_order_id !== workOrder.work_order_id),
  };

  const result = await syncSnapshot(stub, before, after);
  assert.equal(result.ok, true, result.error ?? "");

  const order = stub.calls.map((c) => `${c.op}:${c.table}`);
  const child = order.indexOf("delete:work_order_parts");
  const parent = order.indexOf("delete:work_orders");
  assert.ok(child >= 0 && parent >= 0, `missing deletes in ${order.join(", ")}`);
  assert.ok(child < parent, `children must go first, got ${order.join(", ")}`);
});

/* ------------------------------------------------------------------ */
/* No-op and failure                                                  */
/* ------------------------------------------------------------------ */

test("identical snapshots produce no statements at all", async () => {
  const stub = makeStub();
  const snapshot = createDemoSnapshot();
  const result = await syncSnapshot(stub, snapshot, structuredClone(snapshot));

  assert.deepEqual(result, { ok: true, error: null, counts: {} } satisfies SyncResult);
  assert.equal(stub.calls.length, 0);
});

test("a rejected statement is reported instead of thrown", async () => {
  const stub = makeStub();
  const before = createDemoSnapshot();
  const after: PlantSnapshot = {
    ...before,
    parts: before.parts.map((p, i) => (i === 0 ? { ...p, on_hand: p.on_hand + 5 } : p)),
  };

  stub.failAt(0, "row-level security violation");

  const result = await syncSnapshot(stub, before, after);
  assert.equal(result.ok, false);
  assert.match(result.error!, /row-level security violation/);
  assert.match(result.error!, /spare_parts/);
});

test("counts describe every table that changed", async () => {
  const stub = makeStub();
  const before = createDemoSnapshot();
  const after: PlantSnapshot = {
    ...before,
    parts: before.parts.map((p, i) => (i === 0 ? { ...p, on_hand: p.on_hand + 1 } : p)),
    assets: before.assets.map((a, i) => (i === 0 ? { ...a, notes: "ตรวจสอบ" } : a)),
  };

  const result = await syncSnapshot(stub, before, after);
  assert.deepEqual(result.counts, {
    spare_parts: { inserted: 0, updated: 1, deleted: 0 },
    assets: { inserted: 0, updated: 1, deleted: 0 },
  });
});
