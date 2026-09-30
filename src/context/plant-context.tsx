"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createDemoSnapshot, DEMO_TODAY } from "@/data/demo-dataset";
import * as store from "@/data/plant-store";
import { getSupabase, isSupabaseConfigured, type DataSource } from "@/lib/supabase/client";
import { syncSnapshot, type SyncResult } from "@/lib/supabase/sync";
import type {
  ActivityEntry,
  Asset,
  DowntimeEvent,
  PlantSnapshot,
  ProductionLine,
  ProductionRun,
  Site,
  SparePart,
  WorkOrder,
  WorkOrderPart,
} from "@/types/domain";
import { useAuth } from "@/context/auth-context";

/**
 * PlantProvider owns the single in-memory copy of the plant and is the only
 * place that persists a mutation.
 *
 * Writes go through `src/data/plant-store.ts`, which returns a *new* snapshot.
 * In Supabase mode that same snapshot is also written to PostgreSQL (see
 * `src/lib/supabase/sync.ts`); in demo mode it goes to `localStorage` so a page
 * refresh keeps the operator's work.
 *
 * A Supabase write is asynchronous, so `run` is optimistic: the screen updates
 * immediately and, if the database rejects the change, the previous snapshot is
 * restored and the reason is shown. That way the operator never sees a state
 * the database never accepted.
 */

const STORAGE_KEY = "pct.snapshot.v1";

interface PlantValue {
  snapshot: PlantSnapshot;
  source: DataSource;
  today: string;
  isLoading: boolean;
  lastError: string | null;
  /** Run a store operation; returns the failure message, or null on success. */
  run: (operation: () => PlantSnapshot) => string | null;
  resetDemo: () => void;
}

const PlantContext = createContext<PlantValue | null>(null);

function loadLocalSnapshot(): PlantSnapshot {
  if (typeof window === "undefined") return createDemoSnapshot();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoSnapshot();
    const parsed = JSON.parse(raw) as PlantSnapshot;
    if (!parsed.assets || !parsed.workOrders) return createDemoSnapshot();
    return parsed;
  } catch {
    return createDemoSnapshot();
  }
}

function persist(snapshot: PlantSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // A full quota must not break the session; the in-memory copy is the truth.
  }
}

/**
 * Pick exactly the columns a collection needs and coerce PostgREST output into
 * the domain shape.
 *
 * PostgREST returns `numeric` columns as strings and omits nothing, so this also
 * turns `target_oee: "85.00"` into the `number` the selectors expect and fills
 * absent columns with `null`. Restricting the column list means an unexpected
 * column added to a table later cannot silently widen a domain type.
 */
function pick<T>(rows: Record<string, unknown>[], columns: readonly (keyof T)[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const column of columns) {
      const value = row[column as string];
      if (value === undefined) {
        out[column as string] = null;
      } else if (NUMERIC_COLUMNS.has(column as string) && value !== null) {
        out[column as string] = Number(value);
      } else {
        out[column as string] = value;
      }
    }
    return out as T;
  });
}

/** Columns stored as `numeric` in PostgreSQL, which PostgREST sends as text. */
const NUMERIC_COLUMNS = new Set([
  "unit_cost",
  "target_oee",
  "takt_seconds",
  "shifts_per_day",
]);

export function PlantProvider({ children }: { children: ReactNode }) {
  const { session, isReady: authReady } = useAuth();
  const [snapshot, setSnapshot] = useState<PlantSnapshot>(() => createDemoSnapshot());
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  // `run` needs the current snapshot to diff against, but must not re-create
  // the callback (and therefore re-render every consumer) on every keystroke.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // Writes are serialised through this chain. Two overlapping syncs could
  // otherwise interleave their delete/insert passes and write a state that
  // neither mutation asked for.
  const syncChain = useRef<Promise<unknown>>(Promise.resolve());

  // Counts up per mutation so a late failure knows which snapshot it produced.
  const revision = useRef(0);

  const source: DataSource = isSupabaseConfigured ? "supabase" : "demo";

  // Wait for the auth layer to settle before reading: with Supabase the JWT
  // arrives asynchronously, and querying before then would come back empty
  // under RLS. Sign-out (session -> null) reloads the demo data so the next
  // sign-in starts from a known state.
  useEffect(() => {
    if (!authReady) return;
    if (isSupabaseConfigured && !session) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const supabase = getSupabase();

      if (!supabase) {
        if (!cancelled) {
          setSnapshot(loadLocalSnapshot());
          setIsLoading(false);
        }
        return;
      }

      const [sites, lines, assets, parts, workOrders, workOrderParts, runs, downtime, trail] =
        await Promise.all([
          supabase.from("sites").select("*"),
          supabase.from("production_lines").select("*"),
          supabase.from("assets").select("*"),
          supabase.from("spare_parts").select("*"),
          supabase.from("work_orders").select("*"),
          supabase.from("work_order_parts").select("*"),
          supabase.from("production_runs").select("*"),
          supabase.from("downtime_events").select("*").order("started_at", { ascending: false }),
          supabase.from("activity_trail").select("*").order("trail_id", { ascending: false }).limit(300),
        ]);

      if (cancelled) return;

      const failure = [sites, lines, assets, parts, workOrders, workOrderParts, runs, downtime, trail].find(
        (r) => r.error,
      );
      if (failure?.error) {
        // A misconfigured project should still render something useful.
        setLastError(`อ่านข้อมูลจาก Supabase ไม่สำเร็จ: ${failure.error.message}`);
        setSnapshot(createDemoSnapshot());
        setIsLoading(false);
        return;
      }

      const rows = (r: { data: unknown }) => (r.data ?? []) as Record<string, unknown>[];

      setSnapshot((prev) => ({
        ...prev,
        sites: pick<Site>(rows(sites), ["site_id", "code", "name", "timezone"]),
        lines: pick<ProductionLine>(rows(lines), [
          "line_id",
          "site_id",
          "code",
          "name",
          "takt_seconds",
          "shifts_per_day",
        ]),
        assets: pick<Asset>(rows(assets), [
          "asset_id",
          "line_id",
          "parent_id",
          "asset_tag",
          "name",
          "kind",
          "state",
          "criticality",
          "manufacturer",
          "model_name",
          "serial_number",
          "commissioned_on",
          "last_pm_on",
          "next_pm_due",
          "target_oee",
          "notes",
        ]),
        parts: pick<SparePart>(rows(parts), [
          "part_id",
          "sku",
          "description",
          "on_hand",
          "reserved",
          "reorder_point",
          "unit_cost",
          "lead_time_days",
          "bin_location",
        ]),
        workOrders: pick<WorkOrder>(rows(workOrders), [
          "work_order_id",
          "wo_number",
          "asset_id",
          "kind",
          "state",
          "priority",
          "title",
          "detail",
          "requested_by",
          "assignee_id",
          "opened_at",
          "planned_for",
          "started_at",
          "completed_at",
          "verified_at",
          "downtime_minutes",
          "labour_minutes",
        ]),
        workOrderParts: pick<WorkOrderPart>(rows(workOrderParts), [
          "wo_part_id",
          "work_order_id",
          "part_id",
          "qty_required",
          "qty_reserved",
          "qty_issued",
          "reserved_at",
          "issued_at",
        ]),
        runs: pick<ProductionRun>(rows(runs), [
          "run_id",
          "asset_id",
          "shift_code",
          "ran_on",
          "planned_minutes",
          "running_minutes",
          "good_units",
          "scrap_units",
        ]),
        downtime: pick<DowntimeEvent>(rows(downtime), [
          "event_id",
          "asset_id",
          "work_order_id",
          "cause",
          "reaction",
          "started_at",
          "ended_at",
          "minutes",
          "narration",
        ]),
        trail: pick<ActivityEntry>(rows(trail), [
          "trail_id",
          "at",
          "actor_id",
          "actor_email",
          "action",
          "table_name",
          "row_key",
          "summary",
          "diff",
        ]),
      }));
      setIsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authReady, session]);

  const run = useCallback<PlantValue["run"]>(
    (operation) => {
      if (!session) return "ยังไม่ได้เข้าสู่ระบบ";
      const previous = snapshotRef.current;
      let next: PlantSnapshot;
      try {
        next = operation();
      } catch (error) {
        const message =
          error instanceof store.WorkflowError ? error.message : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
        setLastError(message);
        return message;
      }

      const mine = ++revision.current;

      // Optimistic: show the result straight away.
      snapshotRef.current = next;
      setSnapshot(next);
      setLastError(null);
      if (!isSupabaseConfigured) persist(next);

      const supabase = getSupabase();
      if (supabase) {
        syncChain.current = syncChain.current
          .then(() => syncSnapshot(supabase, previous, next))
          .then((result: SyncResult) => {
            if (result.ok) return;
            // A newer mutation has already moved the UI on. Rolling back to
            // `previous` now would silently discard work the user just did, so
            // only undo this failure while it is still the newest one.
            if (revision.current === mine) {
              snapshotRef.current = previous;
              setSnapshot(previous);
            }
            setLastError(result.error);
          });
      }

      return null;
    },
    [session],
  );

  const resetDemo = useCallback(() => {
    const fresh = createDemoSnapshot();
    snapshotRef.current = fresh;
    setSnapshot(fresh);
    persist(fresh);
    setLastError(null);
  }, []);

  const value = useMemo<PlantValue>(
    () => ({ snapshot, source, today: DEMO_TODAY, isLoading, lastError, run, resetDemo }),
    [snapshot, source, isLoading, lastError, run, resetDemo],
  );

  return <PlantContext.Provider value={value}>{children}</PlantContext.Provider>;
}

export function usePlant(): PlantValue {
  const ctx = useContext(PlantContext);
  if (!ctx) throw new Error("usePlant must be used inside <PlantProvider>");
  return ctx;
}
