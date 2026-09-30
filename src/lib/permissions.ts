/**
 * Role based access control.
 *
 * Three roles, one table. `Permission` is the unit of authorisation; components
 * ask `can(role, "work_order.edit")` instead of comparing role strings inline,
 * so adding a role later is a data change rather than a code sweep.
 *
 * The database enforces the same matrix through RLS (see schema.sql section 10).
 * Client checks are for UX; RLS is the security boundary.
 */

import type { AppRole } from "@/types/domain";

export const PERMISSIONS = [
  "dashboard.view",
  "asset.view",
  "asset.edit",
  "work_order.view",
  "work_order.create",
  "work_order.progress",
  "work_order.verify",
  "work_order.delete",
  "parts.view",
  "parts.edit",
  "downtime.view",
  "downtime.edit",
  "report.export",
  "trail.view",
  "user.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Readonly<Record<AppRole, ReadonlySet<Permission>>> = {
  admin: new Set<Permission>(PERMISSIONS),
  engineer: new Set<Permission>([
    "dashboard.view",
    "asset.view",
    "asset.edit",
    "work_order.view",
    "work_order.create",
    "work_order.progress",
    "work_order.verify",
    "parts.view",
    "parts.edit",
    "downtime.view",
    "downtime.edit",
    "report.export",
  ]),
  planner: new Set<Permission>([
    "dashboard.view",
    "asset.view",
    "work_order.view",
    "work_order.create",
    "parts.view",
    "downtime.view",
    "report.export",
  ]),
};

export function can(role: AppRole, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

/** Human-readable labels for the login screen and the profile chip. */
export const ROLE_LABELS: Readonly<Record<AppRole, string>> = {
  admin: "ผู้ควบคุมการผลิต",
  engineer: "วิศวกรเครื่องจักร",
  planner: "นักวางแผนงาน",
};

export const ROLE_BLURB: Readonly<Record<AppRole, string>> = {
  admin: "ตรวจสอบได้ทุกหน้า รวมบันทึกกิจกรรมและจัดการผู้ใช้",
  engineer: "เปิด-ปิดงานซ่อม จองอะไหล่ และบันทึกเวลาหยุด",
  planner: "ดูภาพรวมและเปิดใบงาน แต่ไม่ปิดงานหรือแก้ข้อมูลหลัก",
};

export const ROLE_TONE: Readonly<Record<AppRole, string>> = {
  admin: "bg-ocean-600 text-white",
  engineer: "bg-signal-500 text-white",
  planner: "bg-steel-500 text-white",
};
