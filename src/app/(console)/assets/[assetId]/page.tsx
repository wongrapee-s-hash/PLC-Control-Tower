"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Gauge, History, Wrench } from "lucide-react";

import { OeeFactorChart } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/layout/page-header";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { assetPerformance, joinWorkOrders } from "@/data/selectors";
import { setAssetState } from "@/data/plant-store";
import { cn, dueLabel, formatDate, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import {
  ASSET_KIND_LABELS,
  ASSET_STATE_LABELS,
  ASSET_STATE_TONE,
  CRITICALITY_LABELS,
  CRITICALITY_TONE,
  DOWNTIME_CAUSE_LABELS,
} from "@/lib/labels";
import { oeeBand } from "@/lib/oee";
import { isOpen, PRIORITY_LABELS, WORK_STATE_LABELS, WORK_STATE_TONE } from "@/lib/workflow";
import { ASSET_STATES, type AssetState } from "@/types/domain";

type TimelineEntry =
  | { key: string; at: string; kind: "work"; label: string; detail: string; tone: string }
  | { key: string; at: string; kind: "downtime"; label: string; detail: string; tone: string };

export default function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  return <AssetDetail assetId={use(params).assetId} />;
}

function AssetDetail({ assetId }: { assetId: string }) {
  const { snapshot, today, run } = usePlant();
  const { can, session } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const asset = snapshot.assets.find((a) => a.asset_id === assetId) ?? null;
  const line = asset?.line_id ? snapshot.lines.find((l) => l.line_id === asset.line_id) : undefined;
  const oee = asset ? assetPerformance(snapshot, asset.asset_id) : null;

  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!asset) return [];
    const entries: TimelineEntry[] = [];

    for (const wo of joinWorkOrders(snapshot)) {
      if (wo.asset_id !== asset.asset_id) continue;
      entries.push({
        key: `wo-${wo.work_order_id}`,
        at: wo.opened_at,
        kind: "work",
        label: `${wo.wo_number} · ${wo.title}`,
        detail: `${PRIORITY_LABELS[wo.priority]} · ${WORK_STATE_LABELS[wo.state]}`,
        tone: wo.state === "verified" ? "bg-emerald-500" : wo.state === "blocked_parts" ? "bg-rose-500" : "bg-ocean-500",
      });
    }

    for (const event of snapshot.downtime) {
      if (event.asset_id !== asset.asset_id) continue;
      entries.push({
        key: `dt-${event.event_id}`,
        at: event.started_at,
        kind: "downtime",
        label: event.narration ?? DOWNTIME_CAUSE_LABELS[event.cause],
        detail: `${DOWNTIME_CAUSE_LABELS[event.cause]} · ${event.minutes > 0 ? formatDuration(event.minutes) : "ยังไม่ปิด"}`,
        tone: "bg-signal-500",
      });
    }

    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }, [snapshot, asset]);

  if (!asset) {
    return (
      <Panel>
        <EmptyState
          title="ไม่พบเครื่องจักร"
          hint="รหัสที่ระบุอาจไม่ถูกต้อง หรือข้อมูลถูกลบไปแล้ว"
        />
        <div className="flex justify-center pb-5">
          <Link href="/assets" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            กลับไปทะเบียนเครื่องจักร
          </Link>
        </div>
      </Panel>
    );
  }

  const workOrders = joinWorkOrders(snapshot).filter((w) => w.asset_id === asset.asset_id);
  const runs = snapshot.runs.filter((r) => r.asset_id === asset.asset_id);
  const overdue = asset.next_pm_due !== null && asset.next_pm_due <= today;

  const changeState = (state: AssetState) => {
    setError(null);
    const message = run(() => setAssetState(snapshot, session?.email ?? "unknown", asset.asset_id, state));
    if (message) setError(message);
  };

  return (
    <>
      <PageHeader
        eyebrow={asset.asset_tag}
        title={asset.name}
        description={
          line
            ? `${line.code} · ${line.name} · ${ASSET_KIND_LABELS[asset.kind]}`
            : `ไม่ผูกสายการผลิต · ${ASSET_KIND_LABELS[asset.kind]}`
        }
        actions={
          <Link href="/assets" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            ทะเบียนเครื่องจักร
          </Link>
        }
      />

      {/* ---- Identity strip ---- */}
      <Panel bodyClassName="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-steel-400">สถานะปัจจุบัน</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Chip tone={ASSET_STATE_TONE[asset.state]}>{ASSET_STATE_LABELS[asset.state]}</Chip>
            <Chip tone={CRITICALITY_TONE[asset.criticality]}>{CRITICALITY_LABELS[asset.criticality]}</Chip>
          </div>
          {can("asset.edit") ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ASSET_STATES.filter((s) => s !== asset.state && s !== "decommissioned").map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => changeState(state)}
                  className="rounded-full bg-steel-100 px-2.5 py-1 text-[11px] text-steel-600 transition-colors hover:bg-steel-200 dark:bg-white/10 dark:text-steel-300 dark:hover:bg-white/20"
                >
                  สั่งเป็น{ASSET_STATE_LABELS[state]}
                </button>
              ))}
            </div>
          ) : null}
          {error ? <p className="mt-2 text-[11px] text-rose-600">{error}</p> : null}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-steel-400">ผู้ผลิต / รุ่น</p>
          <p className="mt-1.5 text-sm text-steel-800 dark:text-steel-100">
            {asset.manufacturer ?? "—"} {asset.model_name ?? ""}
          </p>
          <p className="font-mono text-[11px] text-steel-400">S/N {asset.serial_number ?? "—"}</p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-steel-400">กำหนดการบำรุง</p>
          <p className="mt-1.5 text-sm text-steel-800 dark:text-steel-100">
            PM ล่าสุด {formatDate(asset.last_pm_on)}
          </p>
          <p className={cn("text-[11px]", overdue ? "font-semibold text-rose-600" : "text-steel-500")}>
            ครั้งถัดไป {formatDate(asset.next_pm_due)} · {dueLabel(asset.next_pm_due, today)}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-steel-400">เป้าหมาย OEE</p>
          <p className="metric mt-1.5">{formatPercent(asset.target_oee, 0)}</p>
          <p className="text-[11px] text-steel-500">
            {oee && oee.plannedMinutes > 0
              ? `ผลงานจริง ${formatPercent(oee.oee)} (${oeeBand(oee.oee).label})`
              : "ยังไม่มีบันทึกกะผลิต"}
          </p>
        </div>
      </Panel>

      {/* ---- Charts ---- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="องค์ประกอบ OEE ของเครื่องนี้">
          {oee && oee.plannedMinutes > 0 ? (
            <OeeFactorChart
              data={[
                { name: "ความพร้อมเครื่อง", value: oee.availability },
                { name: "ประสิทธิภาพ", value: oee.performance },
                { name: "คุณภาพ", value: oee.quality },
              ]}
            />
          ) : (
            <EmptyState icon={<Gauge className="h-8 w-8" />} title="ยังไม่มีข้อมูลกะผลิต" />
          )}
        </Panel>

        <Panel title="ผลผลิตต่อกะ" subtitle={`บันทึกทั้งหมด ${runs.length} กะ`} bodyClassName="p-0">
          {runs.length === 0 ? (
            <EmptyState title="ยังไม่มีบันทึกกะผลิต" />
          ) : (
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[420px]">
                <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    <th className="th">วันที่</th>
                    <th className="th">กะ</th>
                    <th className="th">เวลารัน/ตาราง</th>
                    <th className="th">ดี</th>
                    <th className="th">เสีย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                  {[...runs]
                    .sort((a, b) => b.ran_on.localeCompare(a.ran_on))
                    .map((run_) => (
                      <tr key={run_.run_id}>
                        <td className="td font-mono text-xs">{formatDate(run_.ran_on)}</td>
                        <td className="td font-mono text-xs">{run_.shift_code}</td>
                        <td className="td font-mono text-xs">
                          {formatNumber(run_.running_minutes)}/{formatNumber(run_.planned_minutes)} น.
                        </td>
                        <td className="td font-mono text-xs text-emerald-600">{formatNumber(run_.good_units)}</td>
                        <td className="td font-mono text-xs text-rose-600">{formatNumber(run_.scrap_units)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Timeline + work orders ---- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="ประวัติเหตุการณ์" subtitle="รวมงานซ่อมและเวลาหยุดเครื่องเรียงตามเวลา" bodyClassName="p-0">
          {timeline.length === 0 ? (
            <EmptyState icon={<History className="h-8 w-8" />} title="ยังไม่มีประวัติ" />
          ) : (
            <ol className="relative px-5 py-4">
              {timeline.map((entry, index) => (
                <li key={entry.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < timeline.length - 1 ? (
                    <span className="absolute left-[5px] top-4 h-full w-px bg-steel-200 dark:bg-white/10" />
                  ) : null}
                  <span className={cn("relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", entry.tone)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-mono text-steel-400">{formatDate(entry.at)}</p>
                    <p className="mt-0.5 text-sm font-medium text-steel-800 dark:text-steel-100">
                      {entry.label}
                    </p>
                    <p className="text-[11px] text-steel-500">{entry.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="ใบงานของเครื่องนี้" subtitle={`ทั้งหมด ${workOrders.length} ใบ · ค้างอยู่ ${workOrders.filter((w) => isOpen(w.state)).length} ใบ`} bodyClassName="p-0">
          {workOrders.length === 0 ? (
            <EmptyState icon={<Wrench className="h-8 w-8" />} title="ยังไม่มีใบงาน" />
          ) : (
            <ul className="divide-y divide-steel-200 dark:divide-white/5">
              {workOrders.map((wo) => (
                <li key={wo.work_order_id}>
                  <Link
                    href={`/work-orders/${wo.work_order_id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-steel-50 dark:hover:bg-white/5"
                  >
                    <span className="font-mono text-[11px] text-steel-400">{wo.wo_number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-steel-800 dark:text-steel-100">
                      {wo.title}
                    </span>
                    <Chip tone={WORK_STATE_TONE[wo.state]}>{WORK_STATE_LABELS[wo.state]}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {asset.notes ? (
        <Panel title="หมายเหตุ" className="mt-4">
          <p className="text-sm leading-relaxed text-steel-600 dark:text-steel-300">{asset.notes}</p>
        </Panel>
      ) : null}
    </>
  );
}
