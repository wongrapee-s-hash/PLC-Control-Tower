import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlantSnapshot } from "@/types/domain";

/**
 * Snapshot -> PostgreSQL synchronisation.
 *
 * The UI works on a whole `PlantSnapshot` and the store hands back a new
 * snapshot per mutation. Rather than teaching every mutation about SQL, this
 * module diffs the previous snapshot against the next one and writes only the
 * rows that actually changed. That keeps one code path for all thirteen
 * mutations and makes the SQL easy to audit.
 *
 * Column names match `supabase/schema.sql` exactly. `updated_at` is left to the
 * `touch_updated_at` trigger and `activity_trail` is never written from the
 * client at all - the database trigger owns it.
 */

type TableName =
  | "assets"
  | "spare_parts"
  | "work_orders"
  | "work_order_parts"
  | "downtime_events";

type Collection = keyof Omit<PlantSnapshot, "trail">;

interface Row {
  [column: string]: unknown;
}

/**
 * Collections the operator can change. `sites`, `lines` and `runs` are omitted
 * on purpose: site and line definitions are admin reference data, and shift
 * results are imported from the MES rather than typed in.
 */
const WRITABLE: readonly {
  collection: Collection;
  table: TableName;
  key: string;
}[] = [
  { collection: "assets", table: "assets", key: "asset_id" },
  { collection: "parts", table: "spare_parts", key: "part_id" },
  { collection: "workOrders", table: "work_orders", key: "work_order_id" },
  { collection: "workOrderParts", table: "work_order_parts", key: "wo_part_id" },
  { collection: "downtime", table: "downtime_events", key: "event_id" },
];

/**
 * Columns the database owns, so the client must never send them: the `*_at`
 * stamps are maintained by the `touch_updated_at` trigger.
 */
const GENERATED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  assets: ["created_at", "updated_at"],
  spare_parts: ["created_at", "updated_at"],
  work_orders: ["created_at", "updated_at"],
  work_order_parts: ["created_at", "updated_at"],
  downtime_events: ["created_at", "updated_at"],
};

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  // numeric columns come back from PostgREST as strings
  if (typeof a === "number" && typeof b === "string") return String(a) === b;
  if (typeof a === "string" && typeof b === "number") return a === String(b);
  return false;
}

function changed(before: Row, after: Row, generated: readonly string[]): boolean {
  const columns = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const column of columns) {
    if (generated.includes(column)) continue;
    if (!sameValue(before[column], after[column])) return true;
  }
  return false;
}

interface TableDiff {
  table: TableName;
  key: string;
  inserted: Row[];
  updated: Row[];
  deleted: string[];
}

function diffTable(collection: Collection, table: TableName, key: string, before: PlantSnapshot, after: PlantSnapshot): TableDiff | null {
  const generated = GENERATED_COLUMNS[table]!;

  // Every writable collection is a plain data row, so the diff only needs the
  // index signature that the domain interfaces do not carry.
  const beforeRows = (before[collection] ?? []) as unknown as Row[];
  const afterRows = (after[collection] ?? []) as unknown as Row[];
  const beforeByKey = new Map(beforeRows.map((r) => [String(r[key]), r]));

  const inserted: Row[] = [];
  const updated: Row[] = [];

  for (const row of afterRows) {
    const previous = beforeByKey.get(String(row[key]));
    if (!previous) {
      inserted.push(row);
    } else if (changed(previous, row, generated)) {
      updated.push(row);
    }
  }

  const afterKeys = new Set(afterRows.map((r) => String(r[key])));
  const deleted = beforeRows.filter((r) => !afterKeys.has(String(r[key]))).map((r) => String(r[key]));

  if (inserted.length === 0 && updated.length === 0 && deleted.length === 0) return null;
  return { table, key, inserted, updated, deleted };
}

/**
 * Strip the columns the trigger owns. The primary key is deliberately kept on
 * insert: the store mints ids in the browser, and child rows written in the same
 * pass (a work order plus its parts) must reference the id that the parent
 * actually ended up with. It is dropped on update, where the key is the match
 * target rather than data.
 */
function toPayload(row: Row, generated: readonly string[], { includeKey, key }: { includeKey: boolean; key: string }): Row {
  const payload: Row = {};
  for (const [column, value] of Object.entries(row)) {
    if (generated.includes(column)) continue;
    if (!includeKey && column === key) continue;
    payload[column] = value;
  }
  return payload;
}

export interface SyncResult {
  ok: boolean;
  error: string | null;
  /** Row counts per table, useful in the UI status line. */
  counts: Record<string, { inserted: number; updated: number; deleted: number }>;
}

/**
 * Write the difference between two snapshots to the database.
 *
 * Returns an error message instead of throwing, because the caller has to be
 * able to roll the optimistic update back.
 */
export async function syncSnapshot(
  supabase: SupabaseClient,
  before: PlantSnapshot,
  after: PlantSnapshot,
): Promise<SyncResult> {
  const counts: SyncResult["counts"] = {};

  const diffs = WRITABLE.map(({ collection, table, key }) => diffTable(collection, table, key, before, after)).filter(
    (diff): diff is TableDiff => diff !== null,
  );
  if (diffs.length === 0) return { ok: true, error: null, counts };

  for (const diff of diffs) {
    counts[diff.table] = {
      inserted: diff.inserted.length,
      updated: diff.updated.length,
      deleted: diff.deleted.length,
    };
  }

  // Parents first, children after, so a new work order exists before its parts
  // reference it. The reverse holds for deletes.
  const order = new Map(WRITABLE.map(({ table }, index) => [table, index]));
  const byParentFirst = (a: TableDiff, b: TableDiff) => (order.get(a.table) ?? 0) - (order.get(b.table) ?? 0);

  // Deletes run before inserts so that a row replaced by a new one (a different
  // id) cannot trip a unique constraint or a foreign key.
  for (const diff of [...diffs].sort((a, b) => byParentFirst(b, a))) {
    if (diff.deleted.length === 0) continue;
    const { error } = await supabase.from(diff.table).delete().in(diff.key, diff.deleted);
    if (error) return { ok: false, error: `ลบ ${diff.table} ไม่สำเร็จ: ${error.message}`, counts };
  }

  for (const diff of [...diffs].sort(byParentFirst)) {
    if (diff.inserted.length === 0) continue;
    const generated = GENERATED_COLUMNS[diff.table]!;
    const payload = diff.inserted.map((row) => toPayload(row, generated, { includeKey: true, key: diff.key }));
    const { error } = await supabase.from(diff.table).insert(payload);
    if (error) return { ok: false, error: `บันทึก ${diff.table} ไม่สำเร็จ: ${error.message}`, counts };
  }

  for (const diff of [...diffs].sort(byParentFirst)) {
    if (diff.updated.length === 0) continue;
    const generated = GENERATED_COLUMNS[diff.table]!;
    for (const row of diff.updated) {
      const payload = toPayload(row, generated, { includeKey: false, key: diff.key });
      const { error } = await supabase.from(diff.table).update(payload).eq(diff.key, row[diff.key]);
      if (error) return { ok: false, error: `อัปเดต ${diff.table} ไม่สำเร็จ: ${error.message}`, counts };
    }
  }

  return { ok: true, error: null, counts };
}
