/**
 * Domain model for the Production Control Tower.
 *
 * Every string literal that reaches the database is a union member, not a free
 * string, so a typo is a compile error instead of a silent bad row.
 */

export const APP_ROLES = ["admin", "engineer", "planner"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ASSET_STATES = [
  "running",
  "idle",
  "setup",
  "fault",
  "maintenance",
  "decommissioned",
] as const;
export type AssetState = (typeof ASSET_STATES)[number];

export const ASSET_KINDS = [
  "conveyor",
  "robot",
  "cnc",
  "press",
  "injection",
  "vision",
  "compressor",
  "utility",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const CRITICALITIES = ["low", "medium", "high", "critical"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const WORK_KINDS = [
  "preventive",
  "corrective",
  "predictive",
  "calibration",
  "improvement",
] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

export const WORK_STATES = [
  "draft",
  "scheduled",
  "in_progress",
  "blocked_parts",
  "done",
  "verified",
  "cancelled",
] as const;
export type WorkState = (typeof WORK_STATES)[number];

export const WORK_KIND_LABELS: Readonly<Record<WorkKind, string>> = {
  preventive: "ป้องกัน (PM)",
  corrective: "แก้ไข (CM)",
  predictive: "พยากรณ์ (PdM)",
  calibration: "สอบเทียบ",
  improvement: "ปรับปรุง",
};

export const WORK_PRIORITIES = ["p1", "p2", "p3", "p4"] as const;
export type WorkPriority = (typeof WORK_PRIORITIES)[number];

export const DOWNTIME_CAUSES = [
  "mechanical",
  "electrical",
  "operator",
  "material",
  "quality",
  "process",
  "planned",
] as const;
export type DowntimeCause = (typeof DOWNTIME_CAUSES)[number];

export const REACTION_STATES = ["open", "acknowledged", "mitigated", "expired"] as const;
export type ReactionState = (typeof REACTION_STATES)[number];

export interface Site {
  site_id: string;
  code: string;
  name: string;
  timezone: string;
}

export interface ProductionLine {
  line_id: string;
  site_id: string;
  code: string;
  name: string;
  takt_seconds: number;
  shifts_per_day: number;
}

export interface Asset {
  asset_id: string;
  line_id: string | null;
  parent_id: string | null;
  asset_tag: string;
  name: string;
  kind: AssetKind;
  state: AssetState;
  criticality: Criticality;
  manufacturer: string | null;
  model_name: string | null;
  serial_number: string | null;
  commissioned_on: string | null;
  last_pm_on: string | null;
  next_pm_due: string | null;
  target_oee: number;
  notes: string | null;
}

export interface SparePart {
  part_id: string;
  sku: string;
  description: string;
  on_hand: number;
  reserved: number;
  reorder_point: number;
  unit_cost: number;
  lead_time_days: number;
  bin_location: string | null;
}

export interface WorkOrder {
  work_order_id: string;
  wo_number: string;
  asset_id: string;
  kind: WorkKind;
  state: WorkState;
  priority: WorkPriority;
  title: string;
  detail: string | null;
  requested_by: string | null;
  assignee_id: string | null;
  opened_at: string;
  planned_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  downtime_minutes: number;
  labour_minutes: number;
}

export interface WorkOrderPart {
  wo_part_id: string;
  work_order_id: string;
  part_id: string;
  qty_required: number;
  qty_reserved: number;
  qty_issued: number;
  reserved_at: string | null;
  issued_at: string | null;
}

export interface ProductionRun {
  run_id: string;
  asset_id: string;
  shift_code: string;
  ran_on: string;
  planned_minutes: number;
  running_minutes: number;
  good_units: number;
  scrap_units: number;
}

export interface DowntimeEvent {
  event_id: string;
  asset_id: string;
  work_order_id: string | null;
  cause: DowntimeCause;
  reaction: ReactionState;
  started_at: string;
  ended_at: string | null;
  minutes: number;
  narration: string | null;
}

export interface ActivityEntry {
  trail_id: number;
  at: string;
  actor_id: string | null;
  actor_email: string | null;
  action: "insert" | "update" | "delete";
  table_name: string;
  row_key: string;
  summary: string;
  diff: Record<string, unknown>;
}

export interface Principal {
  email: string;
  display_name: string;
  role: AppRole;
  password: string;
}

/** A work order joined with the fields its list view needs. */
export interface WorkOrderRow extends WorkOrder {
  asset_tag: string;
  asset_name: string;
  line_name: string | null;
}

export interface AssetOeeRow {
  asset_id: string;
  asset_tag: string;
  name: string;
  line_id: string | null;
  planned_minutes: number;
  running_minutes: number;
  good_units: number;
  scrap_units: number;
  availability_pct: number;
  quality_pct: number;
}

/** The single object every screen reads from and every mutation writes through. */
export interface PlantSnapshot {
  sites: Site[];
  lines: ProductionLine[];
  assets: Asset[];
  parts: SparePart[];
  workOrders: WorkOrder[];
  workOrderParts: WorkOrderPart[];
  runs: ProductionRun[];
  downtime: DowntimeEvent[];
  trail: ActivityEntry[];
}
