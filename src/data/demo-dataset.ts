/**
 * Offline demo dataset.
 *
 * This is a faithful TypeScript transcription of `supabase/seed.sql`: the same
 * identifiers, the same values, the same dates. When Supabase credentials are
 * absent the app runs entirely on this, which is what makes the Vercel preview
 * and the screenshots reproducible with no backend.
 *
 * `DEMO_TODAY` is pinned rather than `new Date()` so the dashboard, the due-date
 * labels and the tests all agree regardless of when the page is opened.
 */

import type {
  ActivityEntry,
  Asset,
  DowntimeEvent,
  PlantSnapshot,
  Principal,
  ProductionLine,
  ProductionRun,
  Site,
  SparePart,
  WorkOrder,
  WorkOrderPart,
} from "@/types/domain";

export const DEMO_TODAY = "2026-09-30";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "11111111-1111-4111-8111-222222222222";
const LA = "22222222-2222-4222-8222-111111111111";
const LB = "22222222-2222-4222-8222-222222222222";
const LC = "22222222-2222-4222-8222-333333333333";

export const DEMO_PRINCIPALS: readonly Principal[] = [
  {
    email: "supervisor@factory.th",
    display_name: "คุณธนกฤต ศรีสุวรรณ",
    role: "admin",
    password: "supervisor2026",
  },
  {
    email: "engineer@factory.th",
    display_name: "คุณภูมิ วงศ์ทอง",
    role: "engineer",
    password: "engineer2026",
  },
  {
    email: "planner@factory.th",
    display_name: "คุณวิภา ใจดี",
    role: "planner",
    password: "planner2026",
  },
];

const SITES: Site[] = [
  { site_id: S1, code: "SMT-01", name: "โรงงานประกอบสาย SMT อุตสาหกรรม 1", timezone: "Asia/Bangkok" },
  { site_id: S2, code: "ASM-02", name: "โรงงานประกอบชิ้นส่วนหล่อขึ้นรูป 2", timezone: "Asia/Bangkok" },
];

const LINES: ProductionLine[] = [
  { line_id: LA, site_id: S1, code: "LN-A", name: "สายวางลูกษา SMT อัตโนมัติ A", takt_seconds: 42, shifts_per_day: 3 },
  { line_id: LB, site_id: S1, code: "LN-B", name: "สายเติมวงจรและทดสอบ B", takt_seconds: 55, shifts_per_day: 3 },
  { line_id: LC, site_id: S2, code: "LN-C", name: "สายฉีดขึ้นรูปพลาสติก C", takt_seconds: 68, shifts_per_day: 2 },
];

const A = {
  printer: "33333333-3333-4333-8333-111111111111",
  mounter: "33333333-3333-4333-8333-222222222222",
  oven: "33333333-3333-4333-8333-333333333333",
  ict: "33333333-3333-4333-8333-444444444444",
  compressor: "33333333-3333-4333-8333-555555555555",
  injection: "33333333-3333-4333-8333-666666666666",
  robot: "33333333-3333-4333-8333-777777777777",
  press: "33333333-3333-4333-8333-888888888888",
  cnc: "33333333-3333-4333-8333-999999999999",
  sensor: "33333333-3333-4333-8333-aaaaaaaaaaaa",
} as const;

const ASSETS: Asset[] = [
  {
    asset_id: A.printer, line_id: LA, parent_id: null, asset_tag: "AST-PRN-001",
    name: "เครื่องพิมพ์ซิลเกรฟฟี่รุ่นใหม่", kind: "vision", state: "running",
    criticality: "critical", manufacturer: "Koki", model_name: "JUKI-680ALG",
    serial_number: "KI-68-2291", commissioned_on: "2022-03-14", last_pm_on: "2026-08-21",
    next_pm_due: "2026-11-21", target_oee: 92, notes: "เป็นจุดคอขวดของสาย A หยุดแล้วกระทบทั้งสาย",
  },
  {
    asset_id: A.mounter, line_id: LA, parent_id: null, asset_tag: "AST-MNT-002",
    name: "เครื่องวางลูกษาแบบเคลื่อนที่", kind: "conveyor", state: "running",
    criticality: "high", manufacturer: "ASM", model_name: "MSR-450",
    serial_number: "ASM-450-77", commissioned_on: "2022-03-14", last_pm_on: "2026-09-02",
    next_pm_due: "2026-10-02", target_oee: 90, notes: null,
  },
  {
    asset_id: A.oven, line_id: LA, parent_id: null, asset_tag: "AST-OVN-003",
    name: "เตาอบรีโฟลล์หลอดละลาย", kind: "utility", state: "fault",
    criticality: "critical", manufacturer: "BTU", model_name: "TF-2200",
    serial_number: "BTU-22-9012", commissioned_on: "2021-08-02", last_pm_on: "2026-07-30",
    next_pm_due: "2026-10-30", target_oee: 88,
    notes: "สัญญาณเตาอุณหภูมิต่ำกว่าจุดตั้ง 12 องศา",
  },
  {
    asset_id: A.ict, line_id: LB, parent_id: null, asset_tag: "AST-ICT-010",
    name: "โต๊ะทดสอบวงจร ICT อัตโนมัติ", kind: "vision", state: "running",
    criticality: "high", manufacturer: "Advantest", model_name: "TR-4080",
    serial_number: "ADT-40-5567", commissioned_on: "2023-01-20", last_pm_on: "2026-08-30",
    next_pm_due: "2026-11-30", target_oee: 90, notes: null,
  },
  {
    asset_id: A.compressor, line_id: LB, parent_id: null, asset_tag: "AST-CMP-011",
    name: "ตู้ปั๊มสุญญากาศอัดแบบสมุด", kind: "compressor", state: "idle",
    criticality: "medium", manufacturer: "Atlas Copco", model_name: "GA-22VSD",
    serial_number: "ATC-22-3310", commissioned_on: "2022-11-05", last_pm_on: "2026-09-12",
    next_pm_due: "2026-12-12", target_oee: 85, notes: null,
  },
  {
    asset_id: A.injection, line_id: LC, parent_id: null, asset_tag: "AST-INJ-020",
    name: "เครื่องฉีดขึ้นรูปพลาสติก 20 ตัน", kind: "injection", state: "running",
    criticality: "critical", manufacturer: "Fuji", model_name: "S50SV",
    serial_number: "FJ-50-8811", commissioned_on: "2020-05-18", last_pm_on: "2026-06-30",
    next_pm_due: "2026-09-30", target_oee: 86,
    notes: "ครบกำหนด PM แล้ว ต้องลงแผนภายในเดือนนี้",
  },
  {
    asset_id: A.robot, line_id: LC, parent_id: null, asset_tag: "AST-RBT-021",
    name: "แขนกลหยิบชิ้นงาน 6 แกน", kind: "robot", state: "maintenance",
    criticality: "high", manufacturer: "FANUC", model_name: "M-710iC",
    serial_number: "FN-710-0042", commissioned_on: "2023-04-08", last_pm_on: "2026-08-15",
    next_pm_due: "2026-11-15", target_oee: 88, notes: "รออะไหล่เซอร์โวโมเตอร์แกน 4",
  },
  {
    asset_id: A.press, line_id: LC, parent_id: null, asset_tag: "AST-PRS-022",
    name: "เครื่องอัดแม่พิมพ์ 400 ตัน", kind: "press", state: "setup",
    criticality: "medium", manufacturer: "Aida", model_name: "CFI-400",
    serial_number: "AD-400-1177", commissioned_on: "2019-09-12", last_pm_on: "2026-08-05",
    next_pm_due: "2026-11-05", target_oee: 82, notes: null,
  },
  {
    asset_id: A.cnc, line_id: null, parent_id: null, asset_tag: "AST-CNC-030",
    name: "เครื่องกลึง CNC 5 แกน", kind: "cnc", state: "decommissioned",
    criticality: "low", manufacturer: "Mazak", model_name: "INTEGREX i-400",
    serial_number: "MZ-400-2210", commissioned_on: "2015-02-20", last_pm_on: "2024-12-01",
    next_pm_due: null, target_oee: 70, notes: "ถอดออกจากบริการแล้ว รอขายเครื่องมือสอง",
  },
  {
    asset_id: A.sensor, line_id: LA, parent_id: A.mounter, asset_tag: "AST-SNS-002A",
    name: "เซลส์วัดแรงดึงเย็น แขน 1", kind: "vision", state: "running",
    criticality: "medium", manufacturer: "Keyence", model_name: "LJ-X8000",
    serial_number: "KY-800-3312", commissioned_on: "2023-02-11", last_pm_on: "2026-09-01",
    next_pm_due: "2026-12-01", target_oee: 87, notes: null,
  },
];

const P = {
  bearing: "44444444-4444-4444-8444-111111111111",
  bolt: "44444444-4444-4444-8444-222222222222",
  servo: "44444444-4444-4444-8444-333333333333",
  ntc: "44444444-4444-4444-8444-444444444444",
  belt: "44444444-4444-4444-8444-555555555555",
  force: "44444444-4444-4444-8444-666666666666",
  oil: "44444444-4444-4444-8444-777777777777",
  estop: "44444444-4444-4444-8444-888888888888",
} as const;

const PARTS: SparePart[] = [
  { part_id: P.bearing, sku: "BRG-6205-2RS", description: "ลูกปืนแขนหมุน 6205-2RS ปิดฝาสองด้าน", on_hand: 48, reserved: 4, reorder_point: 10, unit_cost: 185, lead_time_days: 5, bin_location: "A-01-03" },
  { part_id: P.bolt, sku: "BLT-M12-60", description: "สกรูหกหัว M12x60 เกรด 12.9", on_hand: 240, reserved: 20, reorder_point: 60, unit_cost: 22.5, lead_time_days: 3, bin_location: "A-02-01" },
  { part_id: P.servo, sku: "SVR-FAN-0230", description: "พัดลมเซอร์โว 230V 23W", on_hand: 2, reserved: 2, reorder_point: 4, unit_cost: 1450, lead_time_days: 28, bin_location: "C-04-02" },
  { part_id: P.ntc, sku: "NTC-100K-B395", description: "เทอร์มิสเตอร์ NTC 100K บี395", on_hand: 6, reserved: 0, reorder_point: 8, unit_cost: 320, lead_time_days: 14, bin_location: "B-03-05" },
  { part_id: P.belt, sku: "BLT-CONV-08", description: "สายพานตาข่าย 8 มม. กว้าง 1200", on_hand: 14, reserved: 0, reorder_point: 6, unit_cost: 2100, lead_time_days: 21, bin_location: "D-01-01" },
  { part_id: P.force, sku: "SNS-FT-500", description: "เซลส์แรงดึง 500 กรัม", on_hand: 3, reserved: 0, reorder_point: 5, unit_cost: 2890, lead_time_days: 35, bin_location: "C-01-07" },
  { part_id: P.oil, sku: "OIL-ISO-68", description: "น้ำมันเกียร์ ISO VG 68 (18 ลิตร)", on_hand: 22, reserved: 2, reorder_point: 8, unit_cost: 1750, lead_time_days: 7, bin_location: "A-05-04" },
  { part_id: P.estop, sku: "TAP-EMG-2T", description: "ปุ่มฉุกเฉินหยุดฉุกเฉิน 2 ตัว", on_hand: 35, reserved: 0, reorder_point: 10, unit_cost: 190, lead_time_days: 4, bin_location: "B-01-01" },
];

const W = {
  ovenThermistor: "55555555-5555-4555-8555-111111111111",
  pmGearbox: "55555555-5555-4555-8555-222222222222",
  servoJoint: "55555555-5555-4555-8555-333333333333",
  jointBearing: "55555555-5555-4555-8555-444444444444",
  pmNozzle: "55555555-5555-4555-8555-555555555555",
  calAir: "55555555-5555-4555-8555-666666666666",
  pmPress: "55555555-5555-4555-8555-777777777777",
  ovenBurnout: "55555555-5555-4555-8555-888888888888",
} as const;

const WORK_ORDERS: WorkOrder[] = [
  {
    work_order_id: W.ovenThermistor, wo_number: "WO-2026-0141", asset_id: A.oven,
    kind: "corrective", state: "verified", priority: "p1",
    title: "แก้ไขเทอร์มิสเตอร์เตาอบรีโฟลล์ตัวที่ 3 อ่านค่าผิดพลาด",
    detail: "เทอร์มิสเตอร์ NTC 100K อ่านได้ 38.2 kOhm แทนที่จะเป็น 3.8 kOhm ทำให้ตัวควบคุมตัดเฟียว",
    requested_by: null, assignee_id: null,
    opened_at: "2026-09-24T08:12:00+07:00", planned_for: "2026-09-24",
    started_at: "2026-09-24T08:35:00+07:00", completed_at: "2026-09-24T10:20:00+07:00",
    verified_at: "2026-09-25T09:00:00+07:00", downtime_minutes: 105, labour_minutes: 105,
  },
  {
    work_order_id: W.pmGearbox, wo_number: "WO-2026-0142", asset_id: A.injection,
    kind: "preventive", state: "verified", priority: "p2",
    title: "PM รอบที่ 6 ปี 2026: เปลี่ยนน้ำมันเกียร์และกรองสัญญาณ",
    detail: "รอบทุก 6 เดือน ตามแผนงานป้องกันของสาย C",
    requested_by: null, assignee_id: null,
    opened_at: "2026-09-19T13:00:00+07:00", planned_for: "2026-09-20",
    started_at: "2026-09-20T08:00:00+07:00", completed_at: "2026-09-20T12:40:00+07:00",
    verified_at: "2026-09-21T10:00:00+07:00", downtime_minutes: 280, labour_minutes: 280,
  },
  {
    work_order_id: W.servoJoint, wo_number: "WO-2026-0143", asset_id: A.robot,
    kind: "corrective", state: "done", priority: "p1",
    title: "เปลี่ยนเซอร์โวมอเตอร์แกน 4 และปรับเทียบตำแหน่งหยิบ",
    detail: "เซอร์โวเสียงดังผิดปกติและหยิบชิ้นงานคลาดจุด 0.4 มม. ต้องใช้ตัวสำรองรุ่นเดิมเท่านั้น",
    requested_by: null, assignee_id: null,
    opened_at: "2026-09-26T15:40:00+07:00", planned_for: "2026-09-26",
    started_at: "2026-09-26T16:05:00+07:00", completed_at: "2026-09-27T11:30:00+07:00",
    verified_at: null, downtime_minutes: 660, labour_minutes: 195,
  },
  {
    work_order_id: W.jointBearing, wo_number: "WO-2026-0144", asset_id: A.robot,
    kind: "corrective", state: "blocked_parts", priority: "p2",
    title: "เปลี่ยนลูกปืนข้อต่อช่วงแกน 2 และข้อต่อของเฟืองขับ",
    detail: "พบเสียงหึ่งขณะหมุน ตรวจแล้วมีรอยหลอมร้อนบนของลูกปืน",
    requested_by: null, assignee_id: null,
    opened_at: "2026-09-28T10:15:00+07:00", planned_for: "2026-09-29",
    started_at: "2026-09-28T11:00:00+07:00", completed_at: null, verified_at: null,
    downtime_minutes: 0, labour_minutes: 40,
  },
  {
    work_order_id: W.pmNozzle, wo_number: "WO-2026-0145", asset_id: A.printer,
    kind: "preventive", state: "in_progress", priority: "p2",
    title: "PM รอบที่ 9 ปี 2026: ทำความสะอาดหัวฉีดและตรวจระยะน็อตซิลินเดอร์",
    detail: "ตรวจทุก 90 วัน ตามแผน PM ของสาย A",
    requested_by: null, assignee_id: null,
    opened_at: "2026-09-29T09:00:00+07:00", planned_for: "2026-09-29",
    started_at: "2026-09-29T09:20:00+07:00", completed_at: null, verified_at: null,
    downtime_minutes: 0, labour_minutes: 120,
  },
  {
    work_order_id: W.calAir, wo_number: "WO-2026-0146", asset_id: A.compressor,
    kind: "calibration", state: "scheduled", priority: "p3",
    title: "สอบเทียบเครื่องวัดความดันและเทอร์มิสเตอร์สายอากาศ",
    detail: "ห้องควบคุมความดัน 3 ชุด ตรวจปีละ 2 ครั้ง",
    requested_by: null, assignee_id: null,
    opened_at: "2026-09-28T16:20:00+07:00", planned_for: "2026-10-03",
    started_at: null, completed_at: null, verified_at: null,
    downtime_minutes: 0, labour_minutes: 0,
  },
  {
    work_order_id: W.pmPress, wo_number: "WO-2026-0147", asset_id: A.press,
    kind: "preventive", state: "draft", priority: "p4",
    title: "PM ปีละครั้ง: ตรวจระบบป้องกันมือเกิดความร้อนเหนือ",
    detail: "ตรวจสัญญาณเตือนด้วยการเปิดฝาทดสอบโดยไม่ให้เครื่องทำงาน",
    requested_by: null, assignee_id: null,
    opened_at: "2026-09-30T08:00:00+07:00", planned_for: "2026-10-20",
    started_at: null, completed_at: null, verified_at: null,
    downtime_minutes: 0, labour_minutes: 0,
  },
  {
    work_order_id: W.ovenBurnout, wo_number: "WO-2026-0148", asset_id: A.oven,
    kind: "corrective", state: "verified", priority: "p1",
    title: "เปลี่ยนเทอร์มิสเตอร์เตาอบรีโฟลล์ตัวที่ 1",
    detail: "รอบก่อนหน้าไฟไหม้ตัวต้านทานตอนไล่อุณหภูมิขึ้น",
    requested_by: null, assignee_id: null,
    opened_at: "2026-09-10T07:30:00+07:00", planned_for: "2026-09-10",
    started_at: "2026-09-10T07:45:00+07:00", completed_at: "2026-09-10T09:15:00+07:00",
    verified_at: "2026-09-11T08:30:00+07:00", downtime_minutes: 90, labour_minutes: 90,
  },
];

const WO_PARTS: WorkOrderPart[] = [
  { wo_part_id: "a1", work_order_id: W.ovenThermistor, part_id: P.ntc, qty_required: 1, qty_reserved: 1, qty_issued: 1, reserved_at: "2026-09-24T08:30:00+07:00", issued_at: "2026-09-24T08:45:00+07:00" },
  { wo_part_id: "a2", work_order_id: W.pmGearbox, part_id: P.oil, qty_required: 1, qty_reserved: 1, qty_issued: 1, reserved_at: "2026-09-20T07:40:00+07:00", issued_at: "2026-09-20T08:10:00+07:00" },
  { wo_part_id: "a3", work_order_id: W.servoJoint, part_id: P.servo, qty_required: 1, qty_reserved: 1, qty_issued: 1, reserved_at: "2026-09-26T15:50:00+07:00", issued_at: "2026-09-26T16:20:00+07:00" },
  { wo_part_id: "a4", work_order_id: W.jointBearing, part_id: P.bearing, qty_required: 4, qty_reserved: 2, qty_issued: 0, reserved_at: "2026-09-28T11:20:00+07:00", issued_at: null },
  { wo_part_id: "a5", work_order_id: W.jointBearing, part_id: P.bolt, qty_required: 8, qty_reserved: 8, qty_issued: 0, reserved_at: "2026-09-28T11:20:00+07:00", issued_at: null },
  { wo_part_id: "a6", work_order_id: W.pmNozzle, part_id: P.estop, qty_required: 2, qty_reserved: 0, qty_issued: 0, reserved_at: null, issued_at: null },
  { wo_part_id: "a7", work_order_id: W.calAir, part_id: P.oil, qty_required: 1, qty_reserved: 0, qty_issued: 0, reserved_at: null, issued_at: null },
];

type RunSeed = [string, string, string, number, number, number, number];

const RUN_SEED: readonly RunSeed[] = [
  [A.printer, "A", "2026-09-28", 480, 431, 1420, 14],
  [A.printer, "B", "2026-09-28", 480, 402, 1305, 21],
  [A.printer, "C", "2026-09-28", 480, 455, 1488, 9],
  [A.printer, "A", "2026-09-29", 480, 468, 1533, 8],
  [A.printer, "B", "2026-09-29", 480, 441, 1466, 13],
  [A.printer, "C", "2026-09-29", 480, 472, 1545, 7],
  [A.printer, "A", "2026-09-30", 480, 120, 395, 6],

  [A.mounter, "A", "2026-09-29", 480, 449, 1712, 18],
  [A.mounter, "B", "2026-09-29", 480, 433, 1640, 24],
  [A.mounter, "A", "2026-09-30", 480, 150, 540, 7],

  [A.oven, "A", "2026-09-28", 480, 120, 0, 0],
  [A.oven, "B", "2026-09-28", 480, 0, 0, 0],
  [A.oven, "A", "2026-09-29", 480, 95, 0, 0],
  [A.oven, "B", "2026-09-29", 480, 88, 0, 0],
  [A.oven, "A", "2026-09-30", 480, 0, 0, 0],

  [A.ict, "A", "2026-09-29", 480, 455, 2180, 26],
  [A.ict, "B", "2026-09-29", 480, 447, 2105, 31],
  [A.ict, "A", "2026-09-30", 480, 165, 760, 9],

  [A.injection, "A", "2026-09-26", 480, 470, 6420, 88],
  [A.injection, "B", "2026-09-26", 480, 462, 6280, 95],
  [A.injection, "A", "2026-09-29", 480, 478, 6510, 81],
  [A.injection, "B", "2026-09-29", 480, 466, 6335, 92],

  [A.robot, "A", "2026-09-27", 480, 300, 1150, 42],
  [A.robot, "B", "2026-09-27", 480, 145, 540, 38],
  [A.robot, "A", "2026-09-28", 480, 0, 0, 0],
  [A.robot, "B", "2026-09-28", 480, 0, 0, 0],
  [A.robot, "A", "2026-09-29", 480, 0, 0, 0],
  [A.robot, "B", "2026-09-29", 480, 0, 0, 0],

  [A.press, "A", "2026-09-29", 480, 455, 980, 12],
  [A.press, "B", "2026-09-29", 480, 448, 955, 15],
];

const RUNS: ProductionRun[] = RUN_SEED.map(
  ([asset_id, shift_code, ran_on, planned_minutes, running_minutes, good_units, scrap_units], index) => ({
    run_id: `run-${String(index + 1).padStart(3, "0")}`,
    asset_id,
    shift_code,
    ran_on,
    planned_minutes,
    running_minutes,
    good_units,
    scrap_units,
  }),
);

const DOWNTIME: DowntimeEvent[] = [
  {
    event_id: "66666666-6666-4666-8666-111111111111", asset_id: A.oven, work_order_id: W.ovenThermistor,
    cause: "electrical", reaction: "mitigated",
    started_at: "2026-09-24T07:40:00+07:00", ended_at: "2026-09-24T10:10:00+07:00",
    minutes: 150, narration: "ตัวควบคุมเตาตัดเฟียวจากสัญญาณเทอร์มิสเตอร์หลุด",
  },
  {
    event_id: "66666666-6666-4666-8666-222222222222", asset_id: A.oven, work_order_id: null,
    cause: "process", reaction: "acknowledged",
    started_at: "2026-09-29T02:10:00+07:00", ended_at: null,
    minutes: 0, narration: "อุณหภูมิโซนทำความร้อนต่ำกว่าจุดตั้งตอนเปลี่ยนวัตถุดิบ",
  },
  {
    event_id: "66666666-6666-4666-8666-333333333333", asset_id: A.robot, work_order_id: W.jointBearing,
    cause: "mechanical", reaction: "acknowledged",
    started_at: "2026-09-28T09:50:00+07:00", ended_at: null,
    minutes: 0, narration: "เสียงหึ่งจากข้อต่อแกน 2 กำลังรอลูกปืน",
  },
  {
    event_id: "66666666-6666-4666-8666-444444444444", asset_id: A.mounter, work_order_id: null,
    cause: "operator", reaction: "mitigated",
    started_at: "2026-09-29T11:20:00+07:00", ended_at: "2026-09-29T11:48:00+07:00",
    minutes: 28, narration: "หยุดสายเพื่อเปลี่ยนชุดลูกปืนตามรอบสัปดาห์",
  },
  {
    event_id: "66666666-6666-4666-8666-555555555555", asset_id: A.press, work_order_id: null,
    cause: "material", reaction: "open",
    started_at: "2026-09-30T08:05:00+07:00", ended_at: null,
    minutes: 0, narration: "แถบวัสดุหมด รอใบสั่งซื้อจากซัพพลายเออร์",
  },
  {
    event_id: "66666666-6666-4666-8666-666666666666", asset_id: A.injection, work_order_id: null,
    cause: "planned", reaction: "mitigated",
    started_at: "2026-09-30T06:00:00+07:00", ended_at: "2026-09-30T07:15:00+07:00",
    minutes: 75, narration: "หยุดเปลี่ยนแม่พิมพ์ตามแผนผลิต",
  },
];

const TRAIL_SEED: readonly [string, string, string, string, string][] = [
  ["2026-09-30T08:05:00+07:00", "insert", "downtime_events", "AST-PRS-022", "พบสายพานหยุดเพราะวัสดุหมด"],
  ["2026-09-30T08:02:00+07:00", "update", "work_orders", "WO-2026-0147", "เปลี่ยนวันที่วางแผนเป็น 20 ต.ค."],
  ["2026-09-29T16:44:00+07:00", "update", "work_orders", "WO-2026-0144", "เลื่อนเป็นรออะไหล่ เพราะลูกปืนขาด"],
  ["2026-09-29T11:20:00+07:00", "insert", "work_order_parts", "BRG-6205-2RS", "จองลูกปืน 2 ชิ้นจากคลัง"],
  ["2026-09-29T09:22:00+07:00", "update", "work_orders", "WO-2026-0145", "เริ่มงาน PM หัวฉีด"],
  ["2026-09-28T15:10:00+07:00", "update", "assets", "AST-OVN-003", "เปลี่ยนสถานะเป็นขัดข้อง"],
  ["2026-09-27T11:35:00+07:00", "update", "work_orders", "WO-2026-0143", "ปิดงานเปลี่ยนเซอร์โวโมเตอร์"],
  ["2026-09-26T16:24:00+07:00", "insert", "work_order_parts", "SVR-FAN-0230", "ตัดพัดลมเซอร์โวออกจากคลัง"],
  ["2026-09-25T09:05:00+07:00", "update", "work_orders", "WO-2026-0141", "ตรวจรับงานผ่าน"],
  ["2026-09-24T08:36:00+07:00", "update", "work_orders", "WO-2026-0141", "เริ่มแก้ไขเทอร์มิสเตอร์"],
];

const TRAIL: ActivityEntry[] = TRAIL_SEED.map(([at, action, table_name, row_key, summary], index) => ({
  trail_id: TRAIL_SEED.length - index,
  at,
  actor_id: null,
  actor_email: index % 3 === 0 ? "engineer@factory.th" : index % 3 === 1 ? "supervisor@factory.th" : "planner@factory.th",
  action: action as ActivityEntry["action"],
  table_name,
  row_key,
  summary: `${table_name} / ${row_key} - ${summary}`,
  diff: {},
}));

export function createDemoSnapshot(): PlantSnapshot {
  return structuredClone({
    sites: SITES,
    lines: LINES,
    assets: ASSETS,
    parts: PARTS,
    workOrders: WORK_ORDERS,
    workOrderParts: WO_PARTS,
    runs: RUNS,
    downtime: DOWNTIME,
    trail: TRAIL,
  });
}
