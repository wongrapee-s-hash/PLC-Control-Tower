/**
 * Plant store: the single write path for every operational table.
 *
 * These are pure functions `(snapshot, input) => PlantSnapshot`. Nothing here
 * touches React, the network, or `localStorage`, which is what makes the whole
 * workflow testable in `tests/plant-store.test.mjs` without a browser.
 *
 * `PlantProvider` is the only caller; it is responsible for persistence and for
 * replaying the same operations against Supabase.
 */

import { createDemoSnapshot } from "@/data/demo-dataset";
import { availableStock, shortfalls } from "@/lib/inventory";
import { nextWorkOrderNumber, canTransition, closable } from "@/lib/workflow";
import type {
  Asset,
  AssetState,
  DowntimeCause,
  PlantSnapshot,
  ReactionState,
  SparePart,
  WorkKind,
  WorkOrder,
  WorkPriority,
  WorkState,
} from "@/types/domain";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

let trailCursor = 1000;

function stamp(actorEmail: string, action: "insert" | "update" | "delete", table: string, key: string, summary: string) {
  trailCursor += 1;
  return {
    trail_id: trailCursor,
    at: new Date().toISOString(),
    actor_id: null,
    actor_email: actorEmail,
    action,
    table_name: table,
    row_key: key,
    summary: `${table} / ${key} - ${summary}`,
    diff: {},
  } as const;
}

const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface AssetInput {
  asset_tag: string;
  name: string;
  kind: Asset["kind"];
  criticality: Asset["criticality"];
  line_id: string | null;
  manufacturer: string | null;
  model_name: string | null;
  serial_number: string | null;
  next_pm_due: string | null;
  target_oee: number;
  notes: string | null;
}

export function upsertAsset(
  snapshot: PlantSnapshot,
  actorEmail: string,
  input: AssetInput,
  assetId?: string,
): PlantSnapshot {
  const tag = input.asset_tag.trim();
  if (!tag) throw new WorkflowError("ต้องระบุรหัสเครื่องจักร (Asset Tag)");

  const clash = snapshot.assets.find(
    (a) => a.asset_tag.toLowerCase() === tag.toLowerCase() && a.asset_id !== assetId,
  );
  if (clash) {
    throw new WorkflowError(`รหัส ${tag} ถูกใช้ไปแล้วที่ ${clash.name}`);
  }

  if (!input.name.trim()) throw new WorkflowError("ต้องระบุชื่อเครื่องจักร");

  if (assetId) {
    const existing = snapshot.assets.find((a) => a.asset_id === assetId);
    if (!existing) throw new WorkflowError("ไม่พบเครื่องจักรที่ต้องการแก้ไข");
    return {
      ...snapshot,
      assets: snapshot.assets.map((a) => (a.asset_id === assetId ? { ...a, ...input } : a)),
      trail: [stamp(actorEmail, "update", "assets", tag, `แก้ไขข้อมูลเครื่องจักร ${input.name}`), ...snapshot.trail],
    };
  }

  const created: Asset = {
    asset_id: uuid(),
    line_id: input.line_id,
    parent_id: null,
    asset_tag: tag,
    name: input.name.trim(),
    kind: input.kind,
    state: "idle",
    criticality: input.criticality,
    manufacturer: input.manufacturer,
    model_name: input.model_name,
    serial_number: input.serial_number,
    commissioned_on: null,
    last_pm_on: null,
    next_pm_due: input.next_pm_due,
    target_oee: input.target_oee,
    notes: input.notes,
  };

  return {
    ...snapshot,
    assets: [created, ...snapshot.assets],
    trail: [stamp(actorEmail, "insert", "assets", tag, `เพิ่มเครื่องจักร ${created.name}`), ...snapshot.trail],
  };
}

export function setAssetState(
  snapshot: PlantSnapshot,
  actorEmail: string,
  assetId: string,
  state: AssetState,
): PlantSnapshot {
  const asset = snapshot.assets.find((a) => a.asset_id === assetId);
  if (!asset) throw new WorkflowError("ไม่พบเครื่องจักร");
  if (asset.state === state) return snapshot;

  // An asset under maintenance or in a fault must not silently keep producing.
  if (state === "running" && snapshot.workOrders.some((w) => w.asset_id === assetId && w.state === "in_progress")) {
    throw new WorkflowError(`เครื่องจักรยังมีงานที่กำลังทำอยู่ ไม่สามารถสั่งกลับไป "กำลังผลิต" ได้`);
  }

  return {
    ...snapshot,
    assets: snapshot.assets.map((a) => (a.asset_id === assetId ? { ...a, state } : a)),
    trail: [stamp(actorEmail, "update", "assets", asset.asset_tag, `เปลี่ยนสถานะเป็น ${state}`), ...snapshot.trail],
  };
}

// ---------------------------------------------------------------------------
// Work orders
// ---------------------------------------------------------------------------

export interface WorkOrderInput {
  asset_id: string;
  kind: WorkKind;
  priority: WorkPriority;
  title: string;
  detail: string | null;
  planned_for: string | null;
}

export function createWorkOrder(
  snapshot: PlantSnapshot,
  actorEmail: string,
  input: WorkOrderInput,
): PlantSnapshot {
  if (!input.title.trim()) throw new WorkflowError("ต้องระบุหัวข้องาน");
  const asset = snapshot.assets.find((a) => a.asset_id === input.asset_id);
  if (!asset) throw new WorkflowError("ต้องเลือกเครื่องจักรที่มีอยู่จริง");

  const year = input.planned_for ? Number.parseInt(input.planned_for.slice(0, 4), 10) : 2026;
  const wo: WorkOrder = {
    work_order_id: uuid(),
    wo_number: nextWorkOrderNumber(snapshot.workOrders, Number.isFinite(year) ? year : 2026),
    asset_id: input.asset_id,
    kind: input.kind,
    state: "draft",
    priority: input.priority,
    title: input.title.trim(),
    detail: input.detail,
    requested_by: null,
    assignee_id: null,
    opened_at: new Date().toISOString(),
    planned_for: input.planned_for,
    started_at: null,
    completed_at: null,
    verified_at: null,
    downtime_minutes: 0,
    labour_minutes: 0,
  };

  return {
    ...snapshot,
    workOrders: [wo, ...snapshot.workOrders],
    trail: [stamp(actorEmail, "insert", "work_orders", wo.wo_number, `เปิดใบงาน ${wo.title}`), ...snapshot.trail],
  };
}

export function moveWorkOrder(
  snapshot: PlantSnapshot,
  actorEmail: string,
  workOrderId: string,
  to: WorkState,
): PlantSnapshot {
  const wo = snapshot.workOrders.find((w) => w.work_order_id === workOrderId);
  if (!wo) throw new WorkflowError("ไม่พบใบงาน");
  if (!canTransition(wo.state, to)) {
    throw new WorkflowError(`เปลี่ยนสถานะจาก ${wo.state} ไป ${to} ไม่ได้`);
  }

  const lines = snapshot.workOrderParts.filter((p) => p.work_order_id === workOrderId);

  if (to === "done") {
    const check = closable(lines);
    if (!check.ok) {
      throw new WorkflowError(`ยังเบิกอะไหล่ไม่ครบ ${check.outstanding} ชิ้น ปิดงานไม่ได้`);
    }
  }

  if (to === "blocked_parts" && shortfalls(lines, snapshot.parts).length === 0) {
    throw new WorkflowError("ใบงานนี้ไม่มีรายการอะไหล่ค้าง จึงเลื่อนเป็นรออะไหล่ไม่ได้");
  }

  const now = new Date().toISOString();
  const patch: Partial<WorkOrder> = { state: to };
  if (to === "in_progress" && !wo.started_at) patch.started_at = now;
  if (to === "done") {
    patch.completed_at = now;
    patch.downtime_minutes = wo.downtime_minutes || elapsedMinutes(wo.started_at, now);
  }
  if (to === "verified") patch.verified_at = now;
  if (["draft", "scheduled", "in_progress", "blocked_parts", "cancelled"].includes(to)) {
    patch.completed_at = null;
    patch.verified_at = null;
  }

  return {
    ...snapshot,
    workOrders: snapshot.workOrders.map((w) => (w.work_order_id === workOrderId ? { ...w, ...patch } : w)),
    trail: [stamp(actorEmail, "update", "work_orders", wo.wo_number, `เปลี่ยนสถานะเป็น ${to}`), ...snapshot.trail],
  };
}

function elapsedMinutes(from: string | null, to: string): number {
  if (!from) return 0;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

export function deleteWorkOrder(
  snapshot: PlantSnapshot,
  actorEmail: string,
  workOrderId: string,
): PlantSnapshot {
  const wo = snapshot.workOrders.find((w) => w.work_order_id === workOrderId);
  if (!wo) throw new WorkflowError("ไม่พบใบงาน");
  if (["in_progress", "done", "verified"].includes(wo.state)) {
    throw new WorkflowError("ลบใบงานที่เริ่มทำแล้วหรือปิดแล้วไม่ได้ เพื่อเก็บประวัติการผลิต");
  }
  return {
    ...snapshot,
    workOrders: snapshot.workOrders.filter((w) => w.work_order_id !== workOrderId),
    workOrderParts: snapshot.workOrderParts.filter((p) => p.work_order_id !== workOrderId),
    trail: [stamp(actorEmail, "delete", "work_orders", wo.wo_number, "ลบใบงานร่าง"), ...snapshot.trail],
  };
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

/** Reserve as much as the shelf allows, and report what could not be covered. */
export function reserveParts(
  snapshot: PlantSnapshot,
  actorEmail: string,
  workOrderId: string,
  partId: string,
): PlantSnapshot {
  const line = snapshot.workOrderParts.find(
    (p) => p.work_order_id === workOrderId && p.part_id === partId,
  );
  if (!line) throw new WorkflowError("ใบงานนี้ไม่มีอะไหล่ชิ้นนี้");
  const part = snapshot.parts.find((p) => p.part_id === partId);
  if (!part) throw new WorkflowError("ไม่พบอะไหล่ในคลัง");

  const wanted = Math.max(line.qty_required - line.qty_reserved, 0);
  const canTake = Math.min(wanted, availableStock(part));
  if (canTake <= 0) {
    throw new WorkflowError(`คลังไม่มี ${part.sku} ว่างพอที่จะจอง (เหลือ ${availableStock(part)} ชิ้น)`);
  }

  const now = new Date().toISOString();
  return {
    ...snapshot,
    parts: snapshot.parts.map((p) =>
      p.part_id === partId ? { ...p, reserved: p.reserved + canTake } : p,
    ),
    workOrderParts: snapshot.workOrderParts.map((p) =>
      p.wo_part_id === line.wo_part_id
        ? { ...p, qty_reserved: p.qty_reserved + canTake, reserved_at: p.reserved_at ?? now }
        : p,
    ),
    trail: [
      stamp(actorEmail, "update", "work_order_parts", part.sku, `จอง ${canTake} ชิ้นเข้ากองสำรอง`),
      ...snapshot.trail,
    ],
  };
}

export function issuePart(
  snapshot: PlantSnapshot,
  actorEmail: string,
  workOrderId: string,
  partId: string,
): PlantSnapshot {
  const line = snapshot.workOrderParts.find(
    (p) => p.work_order_id === workOrderId && p.part_id === partId,
  );
  if (!line) throw new WorkflowError("ใบงานนี้ไม่มีอะไหล่ชิ้นนี้");
  const part = snapshot.parts.find((p) => p.part_id === partId);
  if (!part) throw new WorkflowError("ไม่พบอะไหล่ในคลัง");

  const issue = Math.max(line.qty_reserved, 0);
  if (issue <= 0) throw new WorkflowError(`ยังไม่ได้จอง ${part.sku} จึงยังเบิกไม่ได้`);

  const now = new Date().toISOString();
  return {
    ...snapshot,
    // Issuing consumes both the reservation and the physical unit.
    parts: snapshot.parts.map((p) =>
      p.part_id === partId
        ? { ...p, on_hand: Math.max(p.on_hand - issue, 0), reserved: Math.max(p.reserved - issue, 0) }
        : p,
    ),
    workOrderParts: snapshot.workOrderParts.map((p) =>
      p.wo_part_id === line.wo_part_id
        ? { ...p, qty_issued: p.qty_issued + issue, qty_reserved: Math.max(p.qty_reserved - issue, 0), issued_at: now }
        : p,
    ),
    trail: [stamp(actorEmail, "update", "work_order_parts", part.sku, `เบิกจากคลัง ${issue} ชิ้น`), ...snapshot.trail],
  };
}

/** Add a consumable line to a work order. Mirrors the wo_parts unique constraint. */
export function attachPartToWorkOrder(
  snapshot: PlantSnapshot,
  actorEmail: string,
  workOrderId: string,
  partId: string,
  qtyRequired: number,
): PlantSnapshot {
  if (!Number.isInteger(qtyRequired) || qtyRequired <= 0) {
    throw new WorkflowError("จำนวนที่ต้องใช้ต้องเป็นจำนวนเต็มที่มากกว่า 0");
  }
  if (snapshot.workOrderParts.some((p) => p.work_order_id === workOrderId && p.part_id === partId)) {
    throw new WorkflowError("ใบงานนี้มีอะไหล่ชิ้นนี้อยู่แล้ว");
  }
  const part = snapshot.parts.find((p) => p.part_id === partId);
  if (!part) throw new WorkflowError("ไม่พบอะไหล่ชิ้นนี้");

  return {
    ...snapshot,
    workOrderParts: [
      ...snapshot.workOrderParts,
      {
        wo_part_id: uuid(),
        work_order_id: workOrderId,
        part_id: partId,
        qty_required: qtyRequired,
        qty_reserved: 0,
        qty_issued: 0,
        reserved_at: null,
        issued_at: null,
      },
    ],
    trail: [stamp(actorEmail, "insert", "work_order_parts", part.sku, `เพิ่มรายการอะไหล่ ${qtyRequired} ชิ้น`), ...snapshot.trail],
  };
}

export function adjustStock(
  snapshot: PlantSnapshot,
  actorEmail: string,
  partId: string,
  delta: number,
): PlantSnapshot {
  const part = snapshot.parts.find((p) => p.part_id === partId);
  if (!part) throw new WorkflowError("ไม่พบอะไหล่ชิ้นนี้");
  const next = part.on_hand + delta;
  if (next < part.reserved) {
    throw new WorkflowError(`ลดได้ไม่เกิน ${part.on_hand - part.reserved} ชิ้น เพราะมีของจองไว้ ${part.reserved} ชิ้น`);
  }
  if (next < 0) throw new WorkflowError("จำนวนคงคลังต้องไม่ติดลบ");
  return {
    ...snapshot,
    parts: snapshot.parts.map((p) => (p.part_id === partId ? { ...p, on_hand: next } : p)),
    trail: [stamp(actorEmail, "update", "spare_parts", part.sku, `ปรับยอดคงคลัง ${delta > 0 ? "+" : ""}${delta}`), ...snapshot.trail],
  };
}

export function addPart(
  snapshot: PlantSnapshot,
  actorEmail: string,
  input: Omit<SparePart, "part_id" | "reserved">,
): PlantSnapshot {
  if (snapshot.parts.some((p) => p.sku.toLowerCase() === input.sku.trim().toLowerCase())) {
    throw new WorkflowError(`SKU ${input.sku} มีอยู่แล้วในระบบ`);
  }
  const created: SparePart = { ...input, part_id: uuid(), reserved: 0 };
  return {
    ...snapshot,
    parts: [created, ...snapshot.parts],
    trail: [stamp(actorEmail, "insert", "spare_parts", created.sku, `เพิ่มอะไหล่ ${created.description}`), ...snapshot.trail],
  };
}

// ---------------------------------------------------------------------------
// Downtime
// ---------------------------------------------------------------------------

export function recordDowntime(
  snapshot: PlantSnapshot,
  actorEmail: string,
  input: { asset_id: string; cause: DowntimeCause; work_order_id: string | null; narration: string | null },
): PlantSnapshot {
  if (!input.narration?.trim()) throw new WorkflowError("ต้องระบุรายละเอียดเหตุการณ์");
  const event = {
    event_id: uuid(),
    asset_id: input.asset_id,
    work_order_id: input.work_order_id,
    cause: input.cause,
    reaction: "open" as ReactionState,
    started_at: new Date().toISOString(),
    ended_at: null,
    minutes: 0,
    narration: input.narration.trim(),
  };
  const asset = snapshot.assets.find((a) => a.asset_id === input.asset_id);
  return {
    ...snapshot,
    downtime: [event, ...snapshot.downtime],
    trail: [stamp(actorEmail, "insert", "downtime_events", asset?.asset_tag ?? input.asset_id, event.narration), ...snapshot.trail],
  };
}

export function closeDowntime(
  snapshot: PlantSnapshot,
  actorEmail: string,
  eventId: string,
  reaction: Exclude<ReactionState, "open">,
): PlantSnapshot {
  const event = snapshot.downtime.find((e) => e.event_id === eventId);
  if (!event) throw new WorkflowError("ไม่พบเหตุการณ์");
  if (event.ended_at) throw new WorkflowError("เหตุการณ์นี้ปิดไปแล้ว");
  const asset = snapshot.assets.find((a) => a.asset_id === event.asset_id);
  const ended = new Date().toISOString();
  return {
    ...snapshot,
    downtime: snapshot.downtime.map((e) =>
      e.event_id === eventId
        ? { ...e, reaction, ended_at: ended, minutes: elapsedMinutes(e.started_at, ended) }
        : e,
    ),
    trail: [
      stamp(actorEmail, "update", "downtime_events", asset?.asset_tag ?? event.asset_id, `ปิดเหตุการณ์ (${reaction})`),
      ...snapshot.trail,
    ],
  };
}

/** A pristine copy of the bundled dataset - used by the "reset demo" action. */
export const createEmptySnapshot = createDemoSnapshot;
