"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/primitives";
import { usePlant } from "@/context/plant-context";
import {
  assetPerformance,
  downtimeByCause,
  fleetSummary,
  joinWorkOrders,
  linePerformance,
  type WorkOrderJoined,
} from "@/data/selectors";
import { downloadCsv, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { formatBaht, isBelowReorderPoint, stockValue } from "@/lib/inventory";
import { ASSET_KIND_LABELS, ASSET_STATE_LABELS, DOWNTIME_CAUSE_LABELS } from "@/lib/labels";
import { PRIORITY_LABELS, WORK_STATE_LABELS } from "@/lib/workflow";
import { WORK_KIND_LABELS } from "@/types/domain";
import type { DowntimeCause, PlantSnapshot } from "@/types/domain";


type ReportKey = "work_orders" | "assets" | "downtime" | "parts" | "production";

const REPORTS: readonly { key: ReportKey; label: string; description: string }[] = [
  { key: "work_orders", label: "ใบงานซ่อมบำรุง", description: "สถานะ ต้นทุนเวลา และผู้รับผิดชอบของทุกใบงาน" },
  { key: "assets", label: "ทะเบียนเครื่องจักร", description: "สเปก สถานะ และ OEE ที่คำนวณได้ของแต่ละเครื่อง" },
  { key: "downtime", label: "เวลาหยุดเครื่อง", description: "สาเหตุ ระยะเวลา และเหตุการณ์ที่ยังไม่ปิด" },
  { key: "parts", label: "คลังอะไหล่", description: "ยอดคงเหลือ การจอง และมูลค่าสต็อก" },
  { key: "production", label: "ผลผลิตรายกะ", description: "เวลารัน จำนวนชิ้นดี และชิ้นเสียแยกตามกะ" },
];

export default function ReportsPage() {
  const { snapshot, today } = usePlant();
  const [active, setActive] = useState<ReportKey>("work_orders");

  const summary = useMemo(() => fleetSummary(snapshot, today), [snapshot, today]);
  const lines = useMemo(() => linePerformance(snapshot), [snapshot]);
  const causes = useMemo(() => downtimeByCause(snapshot), [snapshot]);
  const rows = useMemo(() => joinWorkOrders(snapshot), [snapshot]);

  const assetChart = useMemo(
    () =>
      snapshot.assets
        .filter((a) => a.state !== "decommissioned")
        .map((asset) => ({
          name: asset.asset_tag.replace("AST-", ""),
          oee: assetPerformance(snapshot, asset.asset_id).oee,
        }))
        .sort((a, b) => b.oee - a.oee),
    [snapshot],
  );

  const exportReport = () => {
    switch (active) {
      case "work_orders":
        downloadCsv(
          `work-orders-${today}.csv`,
          ["เลขใบงาน", "หัวข้องาน", "เครื่องจักร", "ประเภท", "สถานะ", "ความสำคัญ", "กำหนดงาน", "เวลาสูญเสีย (นาที)", "ชั่วโมงแรงงาน (นาที)"],
          rows.map((r) => [
            r.wo_number,
            r.title,
            `${r.asset_tag} ${r.asset_name}`,
            WORK_KIND_LABELS[r.kind],
            WORK_STATE_LABELS[r.state],
            PRIORITY_LABELS[r.priority],
            r.planned_for ?? "",
            r.downtime_minutes,
            r.labour_minutes,
          ]),
        );
        break;

      case "assets":
        downloadCsv(
          `asset-registry-${today}.csv`,
          ["รหัสเครื่องจักร", "ชื่อ", "ประเภท", "สถานะ", "ระดับความสำคัญ", "ผู้ผลิต", "รุ่น", "วันที่เริ่มใช้งาน", "PM ล่าสุด", "PM ถัดไป", "เป้า OEE (%)", "OEE จริง (%)"],
          snapshot.assets.map((a) => [
            a.asset_tag,
            a.name,
            ASSET_KIND_LABELS[a.kind],
            ASSET_STATE_LABELS[a.state],
            a.criticality,
            a.manufacturer ?? "",
            a.model_name ?? "",
            a.commissioned_on ?? "",
            a.last_pm_on ?? "",
            a.next_pm_due ?? "",
            a.target_oee,
            assetPerformance(snapshot, a.asset_id).oee,
          ]),
        );
        break;

      case "downtime":
        downloadCsv(
          `downtime-${today}.csv`,
          ["เวลาเริ่ม", "เวลาจบ", "เครื่องจักร", "สาเหตุ", "สถานะ", "นาที", "รายละเอียด"],
          snapshot.downtime.map((d) => [
            d.started_at,
            d.ended_at ?? "",
            snapshot.assets.find((a) => a.asset_id === d.asset_id)?.asset_tag ?? "",
            DOWNTIME_CAUSE_LABELS[d.cause],
            d.reaction,
            d.minutes,
            d.narration ?? "",
          ]),
        );
        break;

      case "parts":
        downloadCsv(
          `spare-parts-${today}.csv`,
          ["SKU", "รายละเอียด", "คงเหลือ", "จองไว้", "ว่างใช้", "จุดสั่งซื้อ", "ราคาต่อชิ้น", "มูลค่าสต็อก", "นำเข้า (วัน)", "ชั้นวาง", "ต้องสั่งซื้อ"],
          snapshot.parts.map((p) => [
            p.sku,
            p.description,
            p.on_hand,
            p.reserved,
            Math.max(p.on_hand - p.reserved, 0),
            p.reorder_point,
            p.unit_cost,
            stockValue(p),
            p.lead_time_days,
            p.bin_location ?? "",
            isBelowReorderPoint(p) ? "ต้องสั่งซื้อ" : "",
          ]),
        );
        break;

      case "production":
        downloadCsv(
          `production-runs-${today}.csv`,
          ["วันที่", "กะ", "เครื่องจักร", "ตาราง (นาที)", "เวลารัน (นาที)", "ความพร้อมเครื่อง (%)", "ชิ้นดี", "ชิ้นเสีย", "คุณภาพ (%)"],
          [...snapshot.runs]
            .sort((a, b) => b.ran_on.localeCompare(a.ran_on))
            .map((r) => {
              const planned = r.planned_minutes || 1;
              const total = r.good_units + r.scrap_units;
              return [
                r.ran_on,
                r.shift_code,
                snapshot.assets.find((a) => a.asset_id === r.asset_id)?.asset_tag ?? "",
                r.planned_minutes,
                r.running_minutes,
                ((r.running_minutes / planned) * 100).toFixed(2),
                r.good_units,
                r.scrap_units,
                total > 0 ? ((r.good_units / total) * 100).toFixed(2) : "0.00",
              ];
            }),
        );
        break;
    }
  };

  const current = REPORTS.find((r) => r.key === active) ?? REPORTS[0]!;

  return (
    <>
      <PageHeader
        eyebrow="DATA EXPORT"
        title="ศูนย์รายงาน"
        description="ส่งออกข้อมูลเป็นไฟล์ CSV เข้ารหัส UTF-8 พร้อม BOM เพื่อให้เปิดใน Excel ภาษาไทยได้ถูกต้อง"
        actions={
          <button type="button" onClick={exportReport} className="btn-primary">
            <Download className="h-4 w-4" />
            ดาวน์โหลด {current.label}
          </button>
        }
      />

      {/* ---- Tiles ---- */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "OEE รวม", value: formatPercent(summary.oee.oee), hint: "เป้าหมาย 85%" },
          { label: "PM ตรงกำหนด", value: formatPercent(summary.pmCompliance), hint: "ของใบงานป้องกัน" },
          { label: "มูลค่าสต็อก", value: formatBaht(summary.partsValue), hint: `${snapshot.parts.length} รายการ` },
          { label: "ใบงานทั้งหมด", value: formatNumber(snapshot.workOrders.length), hint: `ค้าง ${summary.openWork} ใบ` },
        ].map((tile) => (
          <Panel key={tile.label} bodyClassName="p-4">
            <p className="text-xs text-steel-500">{tile.label}</p>
            <p className="metric mt-1.5">{tile.value}</p>
            <p className="mt-0.5 text-[11px] text-steel-400">{tile.hint}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel title="เลือกรายงาน" bodyClassName="p-2">
          <ul className="space-y-1">
            {REPORTS.map((report) => (
              <li key={report.key}>
                <button
                  type="button"
                  onClick={() => setActive(report.key)}
                  className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                    active === report.key
                      ? "bg-ocean-50 dark:bg-ocean-500/15"
                      : "hover:bg-steel-50 dark:hover:bg-white/5"
                  }`}
                  aria-current={active === report.key ? "true" : undefined}
                >
                  <span
                    className={`block text-sm font-medium ${
                      active === report.key
                        ? "text-ocean-800 dark:text-ocean-100"
                        : "text-steel-700 dark:text-steel-200"
                    }`}
                  >
                    {report.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-steel-500">
                    {report.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-steel-200 px-4 py-4 dark:border-white/10">
            <p className="text-[11px] leading-relaxed text-steel-500">
              ไฟล์ทุกชุดมีหัวตารางภาษาไทย และหน่วยนาที/บาทตามที่ระบบใช้จริง
              สามารถนำไปเปิดใน Excel, Google Sheets หรือ BI tool ได้ทันที
            </p>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title={`${current.label} · ตัวอย่างข้อมูล`}
            subtitle={`${previewRows(active, snapshot, rows).length} แถว (แสดงสูงสุด 8 แถว)`}
            bodyClassName="p-0"
            action={
              <button type="button" onClick={exportReport} className="btn-ghost !py-1.5 text-xs">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                ส่งออก
              </button>
            }
          >
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[520px]">
                <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    {previewColumns(active).map((col) => (
                      <th key={col} className="th">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                  {previewRows(active, snapshot, rows)
                    .slice(0, 8)
                    .map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="td font-mono text-xs">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="OEE เปรียบเทียบรายเครื่อง" subtitle="เรียงจากสูงไปต่ำ" bodyClassName="p-5">
            {assetChart.length === 0 ? (
              <p className="text-sm text-steel-500">ยังไม่มีข้อมูลกะผลิต</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={assetChart} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(133,151,172,.25)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#667a92" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#667a92" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid rgba(213,219,227,.9)", fontSize: 12 }}
                    formatter={(value: number) => formatPercent(value)}
                  />
                  <Bar dataKey="oee" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {assetChart.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.oee >= 85 ? "#198387" : entry.oee >= 60 ? "#ff9a2e" : "#e11d48"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="สรุป OEE รายสาย" bodyClassName="p-0">
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[420px]">
                <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    <th className="th">สาย</th>
                    <th className="th">เครื่อง</th>
                    <th className="th">ความพร้อม</th>
                    <th className="th">OEE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                  {lines.map((line) => (
                    <tr key={line.line_id}>
                      <td className="td text-xs">{line.name}</td>
                      <td className="td font-mono text-xs">{line.assetCount}</td>
                      <td className="td font-mono text-xs">{formatPercent(line.availability)}</td>
                      <td className="td font-mono text-xs font-semibold">{formatPercent(line.oee.oee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="สาเหตุหยุดเครื่องสะสม" subtitle="ไม่รวมการหยุดตามแผน">
            {causes.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-steel-500">
                <TrendingUp className="h-4 w-4" />
                ยังไม่มีข้อมูล
              </p>
            ) : (
              <ul className="space-y-2.5">
                {causes.map((cause) => {
                  const max = causes[0]?.minutes ?? 1;
                  return (
                    <li key={cause.cause}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-steel-600 dark:text-steel-300">
                          {DOWNTIME_CAUSE_LABELS[cause.cause as DowntimeCause]}
                        </span>
                        <span className="font-mono text-steel-500">
                          {formatNumber(cause.minutes)} นาที · {cause.events} ครั้ง
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-steel-200 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-ocean-500"
                          style={{ width: `${max > 0 ? (cause.minutes / max) * 100 : 0}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Preview helpers - mirror the CSV shapes so the table on screen and  */
/* the downloaded file can never disagree about column order.          */
/* ------------------------------------------------------------------ */

function previewColumns(key: ReportKey): string[] {
  switch (key) {
    case "work_orders":
      return ["เลขใบงาน", "เครื่องจักร", "สถานะ", "กำหนดงาน", "นาที"];
    case "assets":
      return ["รหัส", "ชื่อ", "สถานะ", "PM ถัดไป", "OEE"];
    case "downtime":
      return ["เวลาเริ่ม", "เครื่องจักร", "สาเหตุ", "สถานะ", "นาที"];
    case "parts":
      return ["SKU", "คงเหลือ", "จอง", "ว่างใช้", "มูลค่า"];
    case "production":
      return ["วันที่", "กะ", "เครื่องจักร", "รัน/ตาราง", "ดี/เสีย"];
  }
}

function previewRows(
  key: ReportKey,
  snapshot: PlantSnapshot,
  workOrders: WorkOrderJoined[],
): (string | number)[][] {
  switch (key) {
    case "work_orders":
      return workOrders.map((r) => [
        r.wo_number,
        r.asset_tag,
        WORK_STATE_LABELS[r.state],
        r.planned_for ? formatDate(r.planned_for) : "—",
        r.downtime_minutes,
      ]);
    case "assets":
      return snapshot.assets.map((a) => [
        a.asset_tag,
        a.name,
        ASSET_STATE_LABELS[a.state],
        a.next_pm_due ? formatDate(a.next_pm_due) : "—",
        formatPercent(assetPerformance(snapshot, a.asset_id).oee),
      ]);
    case "downtime":
      return snapshot.downtime.map((d) => [
        formatDate(d.started_at),
        snapshot.assets.find((a) => a.asset_id === d.asset_id)?.asset_tag ?? "—",
        DOWNTIME_CAUSE_LABELS[d.cause],
        d.reaction,
        d.minutes,
      ]);
    case "parts":
      return snapshot.parts.map((p) => [
        p.sku,
        p.on_hand,
        p.reserved,
        Math.max(p.on_hand - p.reserved, 0),
        formatBaht(stockValue(p)),
      ]);
    case "production":
      return [...snapshot.runs]
        .sort((a, b) => b.ran_on.localeCompare(a.ran_on))
        .slice(0, 8)
        .map((r) => [
          r.ran_on,
          r.shift_code,
          snapshot.assets.find((a) => a.asset_id === r.asset_id)?.asset_tag ?? "—",
          `${r.running_minutes}/${r.planned_minutes}`,
          `${r.good_units}/${r.scrap_units}`,
        ]);
  }
}
