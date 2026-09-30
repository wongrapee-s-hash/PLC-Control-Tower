/**
 * Work order state machine (client mirror).
 *
 * `supabase/schema.sql` installs the same rules in PostgreSQL via
 * `work_order_transition_allowed()` + `guard_work_order_state()`. The UI checks
 * first so the operator gets an inline explanation; the database checks second
 * so a stale client cannot corrupt the workflow. Both tables must stay equal -
 * `tests/workflow.test.mjs` asserts the exact transition set.
 */

import type { WorkPriority, WorkState } from "@/types/domain";

type TransitionTable = Readonly<Record<WorkState, readonly WorkState[]>>;

export const WORK_ORDER_TRANSITIONS: TransitionTable = {
  draft: ["scheduled", "in_progress", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["blocked_parts", "done", "cancelled"],
  blocked_parts: ["in_progress", "done", "cancelled"],
  done: ["verified", "in_progress"],
  verified: ["in_progress", "cancelled"],
  cancelled: ["draft"],
};

export function canTransition(from: WorkState, to: WorkState): boolean {
  if (from === to) return true;
  return WORK_ORDER_TRANSITIONS[from].includes(to);
}

export function nextStates(from: WorkState): readonly WorkState[] {
  return WORK_ORDER_TRANSITIONS[from];
}

/** States that still consume engineering attention (used for the open-load tile). */
export const OPEN_WORK_STATES: readonly WorkState[] = [
  "draft",
  "scheduled",
  "in_progress",
  "blocked_parts",
];

export function isOpen(state: WorkState): boolean {
  return OPEN_WORK_STATES.includes(state);
}

/** The single button the operator is most likely to want next. */
export function primaryNextState(state: WorkState): WorkState | null {
  switch (state) {
    case "draft":
      return "scheduled";
    case "scheduled":
      return "in_progress";
    case "in_progress":
      return "done";
    case "blocked_parts":
      return "in_progress";
    case "done":
      return "verified";
    case "verified":
    case "cancelled":
      return null;
  }
}

export const WORK_STATE_LABELS: Readonly<Record<WorkState, string>> = {
  draft: "ร่าง",
  scheduled: "ตั้งแผนแล้ว",
  in_progress: "กำลังทำงาน",
  blocked_parts: "รออะไหล่",
  done: "ทำเสร็จ",
  verified: "ตรวจรับแล้ว",
  cancelled: "ยกเลิก",
};

export const WORK_STATE_TONE: Readonly<Record<WorkState, string>> = {
  draft: "bg-steel-100 text-steel-700 ring-steel-200",
  scheduled: "bg-ocean-50 text-ocean-700 ring-ocean-200",
  in_progress: "bg-signal-50 text-signal-700 ring-signal-200",
  blocked_parts: "bg-rose-50 text-rose-700 ring-rose-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  verified: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  cancelled: "bg-steel-50 text-steel-400 ring-steel-200 line-through",
};

export const PRIORITY_RANK: Readonly<Record<WorkPriority, number>> = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
};

export const PRIORITY_LABELS: Readonly<Record<WorkPriority, string>> = {
  p1: "P1 ด่วนมาก",
  p2: "P2 ด่วน",
  p3: "P3 ปกติ",
  p4: "P4 ตามคิว",
};

/** Verb-first labels for the transition buttons on the work order screen. */
export const TRANSITION_BUTTON_LABELS: Readonly<Record<WorkState, string>> = {
  draft: "ยกกลับเป็นร่าง",
  scheduled: "ตั้งแผนงาน",
  in_progress: "เริ่มทำงาน",
  blocked_parts: "พักรออะไหล่",
  done: "ปิดงาน",
  verified: "ตรวจรับงาน",
  cancelled: "ยกเลิกงาน",
};

/**
 * A work order may only close when every line item has been fully issued.
 * Mirrors the `work_orders_done_needs_complete` guard plus the trigger's
 * outstanding-parts check.
 */
export function closable(
  parts: readonly { qty_required: number; qty_issued: number }[],
): { ok: boolean; outstanding: number } {
  const outstanding = parts.reduce(
    (sum, p) => sum + Math.max(p.qty_required - p.qty_issued, 0),
    0,
  );
  return { ok: outstanding === 0, outstanding };
}

/** Generate the next `WO-YYYY-NNNN` number for a given year and existing set. */
export function nextWorkOrderNumber(existing: readonly { wo_number: string }[], year: number): string {
  const prefix = `WO-${year}-`;
  const highest = existing.reduce((max, wo) => {
    if (!wo.wo_number.startsWith(prefix)) return max;
    const tail = Number.parseInt(wo.wo_number.slice(prefix.length), 10);
    return Number.isFinite(tail) && tail > max ? tail : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
