"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Timer } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { DowntimeFormModal } from "@/components/downtime/downtime-form";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { closeDowntime } from "@/data/plant-store";
import { downtimeByCause } from "@/data/selectors";
import { formatDateTime, formatDuration } from "@/lib/format";
import {
  DOWNTIME_CAUSE_LABELS,
  DOWNTIME_CAUSE_TONE,
  REACTION_LABELS,
  REACTION_TONE,
} from "@/lib/labels";
import type { DowntimeCause, ReactionState } from "@/types/domain";

const OPEN_REACTIONS: readonly ReactionState[] = ["open", "acknowledged"];

export default function DowntimePage() {
  const { snapshot, run } = usePlant();
  const { can, session } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assetById = useMemo(
    () => new Map(snapshot.assets.map((a) => [a.asset_id, a])),
    [snapshot.assets],
  );

  const rows = useMemo(
    () =>
      [...snapshot.downtime].sort((a, b) => {
        const aOpen = OPEN_REACTIONS.includes(a.reaction) ? 0 : 1;
        const bOpen = OPEN_REACTIONS.includes(b.reaction) ? 0 : 1;
        return aOpen - bOpen || b.started_at.localeCompare(a.started_at);
      }),
    [snapshot.downtime],
  );

  const causes = useMemo(() => downtimeByCause(snapshot), [snapshot]);
  const totalMinutes = snapshot.downtime
    .filter((d) => d.cause !== "planned")
    .reduce((sum, d) => sum + d.minutes, 0);

  const close = (eventId: string, reaction: Exclude<ReactionState, "open">) => {
    setError(null);
    const message = run(() => closeDowntime(snapshot, session?.email ?? "unknown", eventId, reaction));
    if (message) setError(message);
  };

  return (
    <>
      <PageHeader
        eyebrow="DOWNTIME LOG"
        title="บันทึกเวลาหยุดเครื่อง"
        description="ทุกครั้งที่สายหยุด บันทึกสาเหตุและเวลาที่เสียไป เพื่อให้คำนวณ OEE และแผนซ่อมได้ตรงความจริง"
        actions={
          can("downtime.edit") ? (
            <button type="button" onClick={() => setCreating(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              บันทึกเหตุการณ์
            </button>
          ) : null
        }
      />

      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {/* ---- Summary ---- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel bodyClassName="p-4">
          <p className="text-xs text-steel-500">เวลาหยุดสะสม (ไม่รวมตามแผน)</p>
          <p className="metric mt-1.5">{formatDuration(totalMinutes)}</p>
        </Panel>
        <Panel bodyClassName="p-4">
          <p className="text-xs text-steel-500">เหตุการณ์ที่ยังไม่ปิด</p>
          <p className="metric mt-1.5 text-rose-600">
            {snapshot.downtime.filter((d) => OPEN_REACTIONS.includes(d.reaction)).length}
          </p>
        </Panel>
        <Panel bodyClassName="p-4">
          <p className="text-xs text-steel-500">สาเหตุอันดับ 1</p>
          <p className="mt-1.5 text-sm font-semibold text-steel-900 dark:text-white">
            {causes[0]
              ? `${DOWNTIME_CAUSE_LABELS[causes[0].cause as DowntimeCause]} · ${formatDuration(causes[0].minutes)}`
              : "—"}
          </p>
        </Panel>
        <Panel bodyClassName="p-4">
          <p className="text-xs text-steel-500">เหตุการณ์ทั้งหมด</p>
          <p className="metric mt-1.5">{snapshot.downtime.length}</p>
        </Panel>
      </div>

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Timer className="h-8 w-8" />}
            title="ยังไม่มีบันทึกเวลาหยุดเครื่อง"
            hint="เมื่อมีเหตุการณ์เกิดขึ้น ให้บันทึกทันทีเพื่อความแม่นยำของ OEE"
          />
        ) : (
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th">เวลาเริ่ม</th>
                  <th className="th">เครื่องจักร</th>
                  <th className="th">สาเหตุ</th>
                  <th className="th">รายละเอียด</th>
                  <th className="th">ระยะเวลา</th>
                  <th className="th">สถานะ</th>
                  {can("downtime.edit") ? <th className="th text-right">ปิดเหตุการณ์</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                {rows.map((event) => {
                  const asset = assetById.get(event.asset_id);
                  const isOpen = OPEN_REACTIONS.includes(event.reaction);
                  return (
                    <tr key={event.event_id} className="transition-colors hover:bg-steel-50 dark:hover:bg-white/5">
                      <td className="td font-mono text-xs whitespace-nowrap">{formatDateTime(event.started_at)}</td>
                      <td className="td">
                        {asset ? (
                          <Link href={`/assets/${asset.asset_id}`} className="text-xs hover:underline">
                            {asset.asset_tag}
                          </Link>
                        ) : (
                          <span className="text-xs text-steel-400">—</span>
                        )}
                        <p className="text-[11px] text-steel-400">{asset?.name ?? ""}</p>
                      </td>
                      <td className="td">
                        <Chip tone={DOWNTIME_CAUSE_TONE[event.cause]}>
                          {DOWNTIME_CAUSE_LABELS[event.cause]}
                        </Chip>
                      </td>
                      <td className="td max-w-[280px] text-xs">{event.narration ?? "—"}</td>
                      <td className="td font-mono text-xs">
                        {event.ended_at ? formatDuration(event.minutes) : <span className="text-signal-600">ยังหยุดอยู่</span>}
                      </td>
                      <td className="td">
                        <Chip tone={REACTION_TONE[event.reaction]}>{REACTION_LABELS[event.reaction]}</Chip>
                      </td>
                      {can("downtime.edit") ? (
                        <td className="td">
                          {isOpen ? (
                            <div className="flex justify-end gap-1.5">
                              {event.reaction === "open" ? (
                                <button
                                  type="button"
                                  onClick={() => close(event.event_id, "acknowledged")}
                                  className="btn-ghost !px-2.5 !py-1.5 text-xs"
                                >
                                  รับทราบ
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => close(event.event_id, "mitigated")}
                                className="btn-primary !px-2.5 !py-1.5 text-xs"
                              >
                                ปิด
                              </button>
                            </div>
                          ) : (
                            <span className="block text-right font-mono text-[11px] text-steel-400">
                              {formatDuration(event.minutes)}
                            </span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating ? <DowntimeFormModal onClose={() => setCreating(false)} /> : null}
    </>
  );
}
