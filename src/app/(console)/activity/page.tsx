"use client";

import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { usePlant } from "@/context/plant-context";
import { cn, formatDateTime } from "@/lib/format";
import type { ActivityEntry } from "@/types/domain";

const ACTION_LABELS: Readonly<Record<ActivityEntry["action"], string>> = {
  insert: "เพิ่ม",
  update: "แก้ไข",
  delete: "ลบ",
};

const ACTION_TONE: Readonly<Record<ActivityEntry["action"], string>> = {
  insert: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  update: "bg-ocean-50 text-ocean-700 ring-ocean-200",
  delete: "bg-rose-50 text-rose-700 ring-rose-200",
};

const TABLE_LABELS: Readonly<Record<string, string>> = {
  assets: "เครื่องจักร",
  work_orders: "ใบงานซ่อม",
  work_order_parts: "รายการอะไหล่",
  spare_parts: "คลังอะไหล่",
  downtime_events: "เวลาหยุดเครื่อง",
  production_lines: "สายการผลิต",
  sites: "โรงงาน",
};

export default function ActivityPage() {
  const { snapshot, source } = usePlant();
  const [query, setQuery] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.trail
      .filter((entry) => (onlyErrors ? entry.action === "delete" : true))
      .filter((entry) =>
        q === ""
          ? true
          : entry.summary.toLowerCase().includes(q) ||
            (entry.actor_email ?? "").toLowerCase().includes(q) ||
            entry.row_key.toLowerCase().includes(q),
      );
  }, [snapshot.trail, query, onlyErrors]);

  return (
    <>
      <PageHeader
        eyebrow="AUDIT TRAIL"
        title="บันทึกกิจกรรม"
        description="ทุกการเพิ่ม แก้ไข หรือลบข้อมูลถูกบันทึกไว้โดยอัตโนมัติ และไม่สามารถแก้ไขย้อนหลังได้"
      />

      <Panel className="mb-4" bodyClassName="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาจากคำอธิบาย ผู้ดำเนินการ หรือรหัสรายการ"
            className="field pl-9"
            aria-label="ค้นหาบันทึกกิจกรรม"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyErrors((v) => !v)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            onlyErrors
              ? "bg-rose-600 text-white"
              : "bg-steel-100 text-steel-600 hover:bg-steel-200 dark:bg-white/10 dark:text-steel-300",
          )}
        >
          เฉพาะรายการลบ
        </button>
        <span className="ml-auto font-mono text-xs text-steel-400">
          {visible.length}/{snapshot.trail.length} รายการ
        </span>
      </Panel>

      <Panel bodyClassName="p-0">
        {visible.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-8 w-8" />}
            title="ไม่พบบันทึกที่ตรงกับเงื่อนไข"
            hint="บันทึกกิจกรรมจะเพิ่มขึ้นอัตโนมัติเมื่อมีการเปลี่ยนแปลงข้อมูลในระบบ"
          />
        ) : (
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th">เวลา</th>
                  <th className="th">ผู้ดำเนินการ</th>
                  <th className="th">การกระทำ</th>
                  <th className="th">ตาราง</th>
                  <th className="th">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                {visible.map((entry) => (
                  <tr key={entry.trail_id} className="transition-colors hover:bg-steel-50 dark:hover:bg-white/5">
                    <td className="td font-mono text-xs whitespace-nowrap">
                      {formatDateTime(entry.at)}
                    </td>
                    <td className="td font-mono text-xs">{entry.actor_email ?? "—"}</td>
                    <td className="td">
                      <Chip tone={ACTION_TONE[entry.action]}>{ACTION_LABELS[entry.action]}</Chip>
                    </td>
                    <td className="td text-xs">
                      {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                    </td>
                    <td className="td text-xs">
                      <span className="font-mono text-[11px] text-steel-400">{entry.row_key}</span>
                      <p className="mt-0.5 text-steel-600 dark:text-steel-300">
                        {entry.summary.split(" - ").slice(1).join(" - ") || entry.summary}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="mt-4 text-[11px] leading-relaxed text-steel-500">
        ในโหมดเชื่อมต่อฐานข้อมูลจริง ตาราง <span className="font-mono">activity_trail</span> จะถูกเขียน
        โดย trigger <span className="font-mono">record_activity()</span> ในระดับฐานข้อมูล
        และถูกป้องกันด้วย Row Level Security ที่อนุญาตเฉพาะการอ่าน
        แม้ผู้ดูแลระบบก็ไม่สามารถแก้ไขหรือลบบันทึกนี้ได้
        {source === "demo" ? (
          <>
            {" "}ขณะนี้กำลังแสดงบันทึกจากชุดข้อมูลตัวอย่างในเบราว์เซอร์
            ไม่ใช่จากฐานข้อมูลจริง
          </>
        ) : null}
      </p>
    </>
  );
}
