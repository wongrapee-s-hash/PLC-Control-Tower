"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Filter, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { WorkOrderFormModal } from "@/components/work-orders/work-order-form";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { joinWorkOrders, sortByUrgency } from "@/data/selectors";
import { cn, dueLabel, formatDate } from "@/lib/format";
import {
  PRIORITY_LABELS,
  WORK_STATE_LABELS,
  WORK_STATE_TONE,
} from "@/lib/workflow";
import { WORK_KIND_LABELS, WORK_STATES } from "@/types/domain";
import type { WorkState } from "@/types/domain";

type StateFilter = WorkState | "open" | "all";

export default function WorkOrdersPage() {
  const { snapshot, today } = usePlant();
  const { can } = useAuth();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => sortByUrgency(joinWorkOrders(snapshot)), [snapshot]);

  const counts = useMemo(() => {
    const map = new Map<StateFilter, number>();
    map.set("all", all.length);
    map.set("open", all.filter((r) => ["draft", "scheduled", "in_progress", "blocked_parts"].includes(r.state)).length);
    for (const state of WORK_STATES) map.set(state, all.filter((r) => r.state === state).length);
    return map;
  }, [all]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((row) => {
        if (stateFilter === "all") return true;
        if (stateFilter === "open") return ["draft", "scheduled", "in_progress", "blocked_parts"].includes(row.state);
        return row.state === stateFilter;
      })
      .filter((row) =>
        q === ""
          ? true
          : row.wo_number.toLowerCase().includes(q) ||
            row.title.toLowerCase().includes(q) ||
            row.asset_tag.toLowerCase().includes(q) ||
            row.asset_name.toLowerCase().includes(q),
      );
  }, [all, query, stateFilter]);

  const filters: StateFilter[] = ["open", "all", ...WORK_STATES];

  return (
    <>
      <PageHeader
        eyebrow="MAINTENANCE BOARD"
        title="คิวใบงานซ่อมบำรุง"
        description="ทุกใบงานไหลผ่านสถานะตามเครื่องสถานะเดียวกันกับที่ฝังไว้ในฐานข้อมูล"
        actions={
          can("work_order.create") ? (
            <button type="button" onClick={() => setCreating(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              เปิดใบงานใหม่
            </button>
          ) : null
        }
      />

      <Panel className="mb-4" bodyClassName="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาด้วยเลขใบงาน หัวข้องาน หรือรหัสเครื่องจักร"
            className="field pl-9"
            aria-label="ค้นหาใบงาน"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-steel-400" />
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStateFilter(filter)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                stateFilter === filter
                  ? "bg-ocean-600 text-white"
                  : "bg-steel-100 text-steel-600 hover:bg-steel-200 dark:bg-white/10 dark:text-steel-300 dark:hover:bg-white/20",
              )}
            >
              {filter === "open" ? "งานค้าง" : filter === "all" ? "ทั้งหมด" : WORK_STATE_LABELS[filter]}
              <span className="ml-1 font-mono opacity-70">{counts.get(filter) ?? 0}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel bodyClassName="p-0">
        {visible.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="ไม่พบใบงานที่ตรงกับเงื่อนไข"
            hint="ลองเปลี่ยนตัวกรองสถานะหรือคำค้นหา"
          />
        ) : (
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[880px]">
              <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th">เลขใบงาน</th>
                  <th className="th">หัวข้องาน</th>
                  <th className="th">เครื่องจักร</th>
                  <th className="th">ประเภท</th>
                  <th className="th">ความสำคัญ</th>
                  <th className="th">กำหนดงาน</th>
                  <th className="th">อะไหล่ค้าง</th>
                  <th className="th">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                {visible.map((wo) => (
                  <tr key={wo.work_order_id} className="transition-colors hover:bg-steel-50 dark:hover:bg-white/5">
                    <td className="td font-mono text-xs">{wo.wo_number}</td>
                    <td className="td max-w-[260px]">
                      <Link href={`/work-orders/${wo.work_order_id}`} className="row-link line-clamp-2">
                        {wo.title}
                      </Link>
                    </td>
                    <td className="td">
                      <Link href={`/assets/${wo.asset_id}`} className="text-xs text-steel-700 hover:underline dark:text-steel-200">
                        {wo.asset_tag}
                      </Link>
                      <p className="text-[11px] text-steel-400">{wo.asset_name}</p>
                    </td>
                    <td className="td text-xs">{WORK_KIND_LABELS[wo.kind]}</td>
                    <td className="td">
                      <span
                        className={cn(
                          "font-mono text-xs font-semibold",
                          wo.priority === "p1"
                            ? "text-rose-600"
                            : wo.priority === "p2"
                              ? "text-signal-600"
                              : "text-steel-500",
                        )}
                      >
                        {PRIORITY_LABELS[wo.priority]}
                      </span>
                    </td>
                    <td className="td">
                      {wo.planned_for ? (
                        <>
                          <p className="font-mono text-xs">{formatDate(wo.planned_for)}</p>
                          <p
                            className={cn(
                              "text-[11px]",
                              wo.planned_for < today && wo.state !== "verified" && wo.state !== "done"
                                ? "font-semibold text-rose-600"
                                : "text-steel-400",
                            )}
                          >
                            {dueLabel(wo.planned_for, today)}
                          </p>
                        </>
                      ) : (
                        <span className="text-steel-400">—</span>
                      )}
                    </td>
                    <td className="td">
                      {wo.missing_parts > 0 ? (
                        <span className="font-mono text-xs font-semibold text-signal-600">
                          {wo.missing_parts} ชิ้น
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600">ครบ</span>
                      )}
                    </td>
                    <td className="td">
                      <Chip tone={WORK_STATE_TONE[wo.state]}>{WORK_STATE_LABELS[wo.state]}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating ? <WorkOrderFormModal onClose={() => setCreating(false)} /> : null}
    </>
  );
}
