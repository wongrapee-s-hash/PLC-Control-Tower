"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ClipboardList,
  Factory,
  Gauge,
  PackageSearch,
  ShieldAlert,
  Timer,
  Wrench,
} from "lucide-react";

import { AvailabilityChart, DowntimeCauseChart, OeeFactorChart } from "@/components/dashboard/charts";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { PageHeader } from "@/components/layout/page-header";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { usePlant } from "@/context/plant-context";
import {
  availabilityTrend,
  downtimeByCause,
  fleetSummary,
  joinWorkOrders,
  linePerformance,
  openWorkOrders,
  riskQueue,
  sortByUrgency,
} from "@/data/selectors";
import { dueLabel, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { DOWNTIME_CAUSE_LABELS } from "@/lib/labels";
import { oeeBand } from "@/lib/oee";
import { PRIORITY_LABELS, WORK_STATE_LABELS, WORK_STATE_TONE } from "@/lib/workflow";
import type { DowntimeCause } from "@/types/domain";

export default function DashboardPage() {
  const { snapshot, today } = usePlant();

  const summary = useMemo(() => fleetSummary(snapshot, today), [snapshot, today]);
  const lines = useMemo(() => linePerformance(snapshot), [snapshot]);
  const risk = useMemo(() => riskQueue(snapshot, today), [snapshot, today]);
  const trend = useMemo(() => availabilityTrend(snapshot.runs), [snapshot.runs]);
  const causes = useMemo(() => downtimeByCause(snapshot), [snapshot]);
  const board = useMemo(
    () => sortByUrgency(openWorkOrders(joinWorkOrders(snapshot))),
    [snapshot],
  );

  const oeeTone = summary.oee.oee >= 85 ? "good" : summary.oee.oee >= 60 ? "warn" : "bad";
  const pmDue = snapshot.assets.filter((a) => a.next_pm_due && a.next_pm_due <= today);

  return (
    <>
      <PageHeader
        eyebrow="CONTROL TOWER"
        title="ภาพรวมการผลิต"
        description={`สรุปสถานะทั้งโรงงาน ณ วันที่ ${today} คำนวณจากบันทึกกะผลิตจริงในระบบ`}
        actions={
          <>
            <Link href="/work-orders" className="btn-ghost">
              <ClipboardList className="h-4 w-4" />
              คิวใบงาน
            </Link>
            <Link href="/reports" className="btn-primary">
              <Gauge className="h-4 w-4" />
              รายงานเชิงลึก
            </Link>
          </>
        }
      />

      {/* ---- Metric strip ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricTile
          label="OEE รวมทั้งโรงงาน"
          value={formatPercent(summary.oee.oee)}
          caption={`เป้าหมาย 85% · ${oeeBand(summary.oee.oee).label}`}
          icon={Gauge}
          tone={oeeTone}
          progress={summary.oee.oee}
        />
        <MetricTile
          label="เครื่องจักรที่กำลังผลิต"
          value={formatNumber(summary.running)}
          unit={`/ ${summary.assetCount}`}
          caption={`${summary.faulted} เครื่องอยู่ในสถานะขัดข้อง`}
          icon={Factory}
          tone={summary.faulted > 0 ? "bad" : "good"}
          progress={summary.assetCount > 0 ? (summary.running / summary.assetCount) * 100 : 0}
        />
        <MetricTile
          label="ใบงานที่เปิดอยู่"
          value={formatNumber(summary.openWork)}
          unit="ใบ"
          caption={`${summary.p1Count} ใบอยู่ที่ระดับ P1`}
          icon={ClipboardList}
          tone={summary.p1Count > 0 ? "bad" : "neutral"}
        />
        <MetricTile
          label="ค้างรออะไหล่"
          value={formatNumber(summary.shortfallItems)}
          unit="ชิ้น"
          caption={`${summary.blockedWork} ใบงานถูกบล็อกด้วยคลัง`}
          icon={PackageSearch}
          tone={summary.blockedWork > 0 ? "warn" : "neutral"}
        />
        <MetricTile
          label="MTTR เฉลี่ย"
          value={formatDuration(summary.mttrMinutes)}
          caption="เวลาเฉลี่ยตั้งแต่เริ่มซ่อมจนเสร็จ"
          icon={Wrench}
          tone="neutral"
        />
        <MetricTile
          label="PM ตรงกำหนด"
          value={formatPercent(summary.pmCompliance)}
          caption={`${summary.openDowntime} เหตุการณ์หยุดเครื่องที่ยังไม่ปิด`}
          icon={CalendarClock}
          tone={summary.pmCompliance >= 80 ? "good" : "warn"}
          progress={summary.pmCompliance}
        />
      </div>

      {/* ---- Charts ---- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="องค์ประกอบ OEE" subtitle="เทียบกับเกณฑ์มาตรฐาน 85%">
          <OeeFactorChart
            data={[
              { name: "ความพร้อมเครื่อง", value: summary.oee.availability },
              { name: "ประสิทธิภาพ", value: summary.oee.performance },
              { name: "คุณภาพ", value: summary.oee.quality },
            ]}
          />
        </Panel>

        <Panel title="ความพร้อมเครื่องรายวัน" subtitle="เฉลี่ยทุกสาย ย้อนหลัง 7 วันล่าสุด">
          {trend.length > 0 ? (
            <AvailabilityChart data={trend} target={85} />
          ) : (
            <EmptyState title="ยังไม่มีบันทึกกะผลิต" hint="เพิ่มข้อมูล production_runs เพื่อสร้างกราฟ" />
          )}
        </Panel>

        <Panel title="สาเหตุการหยุดเครื่อง" subtitle="นาทีสะสม ไม่รวมการหยุดตามแผน">
          {causes.length > 0 ? (
            <DowntimeCauseChart
              data={causes.map((c) => ({
                cause: DOWNTIME_CAUSE_LABELS[c.cause as DowntimeCause] ?? c.cause,
                minutes: c.minutes,
              }))}
            />
          ) : (
            <EmptyState title="ยังไม่มีเหตุการณ์หยุดเครื่อง" />
          )}
        </Panel>
      </div>

      {/* ---- Line performance ---- */}
      <Panel
        title="ผลงานรายสายการผลิต"
        subtitle="OEE คำนวณจากเวลาทำงานจริงเทียบกับตารางผลิต"
        className="mt-4"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto scrollbar-slim">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="th">สาย</th>
                <th className="th">จำนวนเครื่อง</th>
                <th className="th">ความพร้อมเครื่อง</th>
                <th className="th">คุณภาพ</th>
                <th className="th">OEE</th>
                <th className="th">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-200 dark:divide-white/5">
              {lines.map((line) => {
                const band = oeeBand(line.oee.oee);
                return (
                  <tr key={line.line_id} className="transition-colors hover:bg-steel-50 dark:hover:bg-white/5">
                    <td className="td">
                      <p className="font-medium text-steel-900 dark:text-white">{line.name}</p>
                      <p className="font-mono text-[11px] text-steel-400">
                        {line.code} · {line.shiftsPerDay} กะ/วัน
                      </p>
                    </td>
                    <td className="td font-mono">{line.assetCount}</td>
                    <td className="td font-mono">{formatPercent(line.availability)}</td>
                    <td className="td font-mono">{formatPercent(line.oee.quality)}</td>
                    <td className="td">
                      <span
                        className={`font-mono text-base font-semibold ${
                          band.tone === "good"
                            ? "text-emerald-600"
                            : band.tone === "warn"
                              ? "text-signal-600"
                              : "text-rose-600"
                        }`}
                      >
                        {formatPercent(line.oee.oee)}
                      </span>
                    </td>
                    <td className="td">
                      {line.faults > 0 ? (
                        <Chip tone="bg-rose-100 text-rose-800 ring-rose-200">
                          <AlertTriangle className="h-3 w-3" />
                          ขัดข้อง {line.faults} เครื่อง
                        </Chip>
                      ) : (
                        <Chip tone="bg-emerald-50 text-emerald-700 ring-emerald-200">ปกติ</Chip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---- Board + risk rail ---- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="คิวงานที่ต้องตัดสินใจ"
          subtitle="เรียงตามระดับความเร่งด่วน แล้วตามวันที่เปิดงาน"
          bodyClassName="p-0"
          action={
            <Link href="/work-orders" className="btn-ghost !py-1.5 text-xs">
              ดูทั้งหมด
            </Link>
          }
        >
          {board.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" />}
              title="ไม่มีใบงานค้าง"
              hint="ทุกใบงานอยู่ในสถานะที่ปิดหรือตรวจรับแล้ว"
            />
          ) : (
            <ul className="divide-y divide-steel-200 dark:divide-white/5">
              {board.slice(0, 6).map((wo) => (
                <li key={wo.work_order_id}>
                  <Link
                    href={`/work-orders/${wo.work_order_id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-steel-50 dark:hover:bg-white/5"
                  >
                    <span className="font-mono text-[11px] text-steel-400">{wo.wo_number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-steel-900 dark:text-white">
                      {wo.title}
                    </span>
                    <span className="font-mono text-[11px] text-steel-500">{wo.asset_tag}</span>
                    <Chip tone={WORK_STATE_TONE[wo.state]}>{WORK_STATE_LABELS[wo.state]}</Chip>
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        wo.priority === "p1" ? "text-rose-600" : "text-steel-500"
                      }`}
                    >
                      {PRIORITY_LABELS[wo.priority]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="จุดที่ต้องระวัง" subtitle="จัดอันดับตามคะแนนความเสี่ยง" bodyClassName="p-0">
            {risk.length === 0 ? (
              <EmptyState icon={<ShieldAlert className="h-8 w-8" />} title="ไม่มีจุดเสี่ยงที่ต้องติดตาม" />
            ) : (
              <ul className="divide-y divide-steel-200 dark:divide-white/5">
                {risk.map(({ asset, reasons, score }) => (
                  <li key={asset.asset_id}>
                    <Link
                      href={`/assets/${asset.asset_id}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-steel-50 dark:hover:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-steel-900 dark:text-white">{asset.name}</p>
                        <span className="shrink-0 font-mono text-[11px] text-steel-400">{asset.asset_tag}</span>
                      </div>
                      <ul className="mt-1.5 space-y-0.5">
                        {reasons.map((reason) => (
                          <li key={reason} className="flex items-center gap-1.5 text-[11px] text-steel-500">
                            <span className="h-1 w-1 rounded-full bg-signal-400" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-steel-200 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-signal-400"
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="สถานะคลังอะไหล่" bodyClassName="space-y-3 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-steel-600 dark:text-steel-300">
                <Boxes className="h-4 w-4 text-steel-400" />
                มูลค่าสต็อกคงเหลือ
              </span>
              <span className="font-mono font-semibold text-steel-900 dark:text-white">
                {formatNumber(Math.round(summary.partsValue))} ฿
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-steel-600 dark:text-steel-300">
                <Timer className="h-4 w-4 text-steel-400" />
                ต่ำกว่าจุดสั่งซื้อ
              </span>
              <span
                className={`font-mono font-semibold ${
                  summary.reorderCount > 0 ? "text-signal-600" : "text-emerald-600"
                }`}
              >
                {summary.reorderCount} รายการ
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-steel-600 dark:text-steel-300">
                <CalendarClock className="h-4 w-4 text-steel-400" />
                PM ครบกำหนดแล้ว
              </span>
              <span className="font-mono font-semibold text-steel-900 dark:text-white">
                {pmDue.length} เครื่อง
              </span>
            </div>
            <p className="border-t border-steel-200 pt-3 text-[11px] leading-relaxed text-steel-500 dark:border-white/10">
              {pmDue.length > 0
                ? pmDue.map((a) => `${a.asset_tag} (${dueLabel(a.next_pm_due, today)})`).join(", ")
                : "ไม่มีเครื่องจักรที่ครบกำหนด PM"}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
