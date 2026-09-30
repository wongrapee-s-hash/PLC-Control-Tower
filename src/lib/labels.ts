import type {
  AssetKind,
  AssetState,
  Criticality,
  DowntimeCause,
  ReactionState,
} from "@/types/domain";

export const ASSET_STATE_LABELS: Readonly<Record<AssetState, string>> = {
  running: "กำลังผลิต",
  idle: "รองาน",
  setup: "ตั้งค่า",
  fault: "ขัดข้อง",
  maintenance: "กำลังซ่อม",
  decommissioned: "ถอดออกบริการ",
};

export const ASSET_STATE_TONE: Readonly<Record<AssetState, string>> = {
  running: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  idle: "bg-steel-100 text-steel-600 ring-steel-200",
  setup: "bg-ocean-50 text-ocean-700 ring-ocean-200",
  fault: "bg-rose-100 text-rose-800 ring-rose-200",
  maintenance: "bg-signal-100 text-signal-800 ring-signal-300",
  decommissioned: "bg-steel-100 text-steel-400 ring-steel-200",
};

/** A live fault is the only state that should visibly demand attention. */
export const isDisruptive = (state: AssetState): boolean =>
  state === "fault" || state === "maintenance";

export const ASSET_KIND_LABELS: Readonly<Record<AssetKind, string>> = {
  conveyor: "สายพาน",
  robot: "แขนกล",
  cnc: "เครื่องกลึง CNC",
  press: "เครื่องอัดแม่พิมพ์",
  injection: "เครื่องฉีดขึ้นรูป",
  vision: "ระบบมองเห็น",
  compressor: "ปั๊มอัดอากาศ",
  utility: "อุปกรณ์สาธารณูปโภค",
};

export const CRITICALITY_LABELS: Readonly<Record<Criticality, string>> = {
  low: "ต่ำ",
  medium: "กลาง",
  high: "สูง",
  critical: "วิกฤต",
};

export const CRITICALITY_TONE: Readonly<Record<Criticality, string>> = {
  low: "bg-steel-100 text-steel-600 ring-steel-200",
  medium: "bg-ocean-50 text-ocean-700 ring-ocean-200",
  high: "bg-signal-50 text-signal-800 ring-signal-200",
  critical: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const CRITICALITY_RANK: Readonly<Record<Criticality, number>> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const DOWNTIME_CAUSE_LABELS: Readonly<Record<DowntimeCause, string>> = {
  mechanical: "เชิงกล",
  electrical: "ไฟฟ้า",
  operator: "ผู้ปฏิบัติงาน",
  material: "วัสดุ",
  quality: "คุณภาพ",
  process: "กระบวนการ",
  planned: "ตามแผน",
};

export const DOWNTIME_CAUSE_TONE: Readonly<Record<DowntimeCause, string>> = {
  mechanical: "bg-rose-50 text-rose-700 ring-rose-200",
  electrical: "bg-signal-50 text-signal-800 ring-signal-200",
  operator: "bg-steel-100 text-steel-700 ring-steel-200",
  material: "bg-ocean-50 text-ocean-700 ring-ocean-200",
  quality: "bg-violet-50 text-violet-700 ring-violet-200",
  process: "bg-amber-50 text-amber-800 ring-amber-200",
  planned: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const REACTION_LABELS: Readonly<Record<ReactionState, string>> = {
  open: "รอรับทราบ",
  acknowledged: "รับทราบแล้ว",
  mitigated: "บรรเทาสำเร็จ",
  expired: "ปิดอัตโนมัติ",
};

export const REACTION_TONE: Readonly<Record<ReactionState, string>> = {
  open: "bg-rose-100 text-rose-800 ring-rose-200",
  acknowledged: "bg-signal-50 text-signal-800 ring-signal-200",
  mitigated: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  expired: "bg-steel-100 text-steel-500 ring-steel-200",
};
