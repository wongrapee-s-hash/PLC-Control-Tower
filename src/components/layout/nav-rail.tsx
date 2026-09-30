"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  ClipboardList,
  Factory,
  LayoutDashboard,
  ScrollText,
  Timer,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { joinWorkOrders, openWorkOrders } from "@/data/selectors";
import { cn } from "@/lib/format";
import type { Permission } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  hint: string;
  short: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  badge?: number;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "ศูนย์ควบคุม", hint: "ภาพรวมการผลิต", short: "ศูนย์ควบคุม", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/assets", label: "เครื่องจักร", hint: "ทะเบียนและสถานะ", short: "เครื่องจักร", icon: Factory, permission: "asset.view" },
  { href: "/work-orders", label: "ใบงานซ่อม", hint: "คิวงานทั้งหมด", short: "ใบงาน", icon: ClipboardList, permission: "work_order.view" },
  { href: "/downtime", label: "เวลาหยุดเครื่อง", hint: "บันทึกเหตุการณ์", short: "หยุดเครื่อง", icon: Timer, permission: "downtime.view" },
  { href: "/parts", label: "คลังอะไหล่", hint: "จองและเบิกชิ้นส่วน", short: "อะไหล่", icon: Boxes, permission: "parts.view" },
  { href: "/reports", label: "รายงาน", hint: "ส่งออกข้อมูล CSV", short: "รายงาน", icon: Activity, permission: "report.export" },
  { href: "/activity", label: "บันทึกกิจกรรม", hint: "ตรวจสอบย้อนหลัง", short: "บันทึก", icon: ScrollText, permission: "trail.view" },
];

/** Counts shown as a badge beside each destination. */
function useNavBadges() {
  const { snapshot } = usePlant();
  return {
    "/work-orders": openWorkOrders(joinWorkOrders(snapshot)).length,
    "/downtime": snapshot.assets.filter((a) => a.state === "fault").length,
    "/parts": snapshot.workOrderParts
      .filter((p) => p.qty_issued < p.qty_required)
      .reduce((sum, p) => sum + (p.qty_required - p.qty_issued), 0),
  } satisfies Partial<Record<string, number>>;
}

export function NavRail() {
  const pathname = usePathname();
  const { can, session } = useAuth();
  const badges = useNavBadges();

  const visible = NAV_ITEMS.filter((item) => session && can(item.permission));
  const withBadges: NavItem[] = visible.map((item) => ({
    ...item,
    badge: badges[item.href as keyof typeof badges],
  }));

  return (
    <nav
      aria-label="เมนูหลัก"
      className="hidden w-60 shrink-0 flex-col border-r border-steel-200 bg-white lg:flex dark:border-white/10 dark:bg-ocean-900/40"
    >
      <div className="flex items-center gap-2.5 border-b border-steel-200 px-5 py-5 dark:border-white/10">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-600 text-white">
          <Factory className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-steel-900 dark:text-white">Control Tower</p>
          <p className="text-[11px] text-steel-500">ระบบบริหารสายผลิต</p>
        </div>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-slim">
        {withBadges.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-ocean-50 font-medium text-ocean-800 dark:bg-ocean-500/15 dark:text-ocean-100"
                    : "text-steel-600 hover:bg-steel-100 dark:text-steel-300 dark:hover:bg-white/5",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-ocean-600" : "text-steel-400 group-hover:text-steel-600")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate leading-tight">{item.label}</span>
                  <span className="block truncate text-[11px] text-steel-400">{item.hint}</span>
                </span>
                {item.badge ? <Badge value={item.badge} active={active} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Below `lg` the rail is hidden, so the same destinations are offered as a
 * scrollable tab strip under the command bar instead of being unreachable.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { can, session } = useAuth();
  const badges = useNavBadges();

  const visible = NAV_ITEMS.filter((item) => session && can(item.permission));
  if (visible.length === 0) return null;

  return (
    <nav
      aria-label="เมนูหลัก (มือถือ)"
      className="-mx-4 border-b border-steel-200 bg-white/95 backdrop-blur lg:hidden dark:border-white/10 dark:bg-ocean-950/95"
    >
      <ul className="scrollbar-slim flex gap-1 overflow-x-auto px-3 py-2">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const badge = badges[item.href as keyof typeof badges];
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-ocean-600 text-white"
                    : "text-steel-600 hover:bg-steel-100 dark:text-steel-300 dark:hover:bg-white/10",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.short}
                {badge ? <Badge value={badge} active={active} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Badge({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[11px]",
        active
          ? "bg-white/25 text-white"
          : "bg-steel-100 text-steel-600 dark:bg-white/10 dark:text-steel-200",
      )}
    >
      {value}
    </span>
  );
}
