"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, PackageCheck, PackagePlus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { deleteWorkOrder, issuePart, moveWorkOrder, reserveParts } from "@/data/plant-store";
import { joinWorkOrders } from "@/data/selectors";
import { cn, formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { availableStock, shortfalls } from "@/lib/inventory";
import {
  closable,
  nextStates,
  PRIORITY_LABELS,
  TRANSITION_BUTTON_LABELS,
  WORK_STATE_LABELS,
  WORK_STATE_TONE,
} from "@/lib/workflow";
import { WORK_KIND_LABELS } from "@/types/domain";
import type { WorkState } from "@/types/domain";

export default function WorkOrderDetailPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  return <WorkOrderDetail workOrderId={use(params).workOrderId} />;
}

function WorkOrderDetail({ workOrderId }: { workOrderId: string }) {
  const { snapshot, today, run } = usePlant();
  const { can, session } = useAuth();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const workOrder = useMemo(
    () => joinWorkOrders(snapshot).find((w) => w.work_order_id === workOrderId) ?? null,
    [snapshot, workOrderId],
  );

  if (!workOrder) {
    return (
      <Panel>
        <EmptyState title="ไม่พบใบงาน" hint="ใบงานอาจถูกลบไปแล้ว" />
        <div className="flex justify-center pb-5">
          <Link href="/work-orders" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            กลับไปคิวใบงาน
          </Link>
        </div>
      </Panel>
    );
  }

  const lines = snapshot.workOrderParts.filter((p) => p.work_order_id === workOrder.work_order_id);
  const outstanding = shortfalls(lines, snapshot.parts);
  const closeCheck = closable(lines);
  const allowed = nextStates(workOrder.state);
  const canProgress = can("work_order.progress");
  const canVerify = can("work_order.verify");

  /** Every store operation returns an error string, or null when it succeeds. */
  const act = (operation: () => string | null, okText: string) => {
    setMessage(null);
    const error = operation();
    if (error) {
      setMessage({ tone: "error", text: error });
      return;
    }
    setMessage({ tone: "ok", text: okText });
  };

  const transition = (to: WorkState) =>
    act(
      () => run(() => moveWorkOrder(snapshot, session?.email ?? "unknown", workOrder.work_order_id, to)),
      `เลื่อนสถานะเป็น "${WORK_STATE_LABELS[to]}" แล้ว`,
    );

  return (
    <>
      <PageHeader
        eyebrow={workOrder.wo_number}
        title={workOrder.title}
        description={`${workOrder.asset_tag} · ${workOrder.asset_name}`}
        actions={
          <Link href="/work-orders" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            คิวใบงาน
          </Link>
        }
      />

      {message ? (
        <p
          role="status"
          className={cn(
            "mb-4 rounded-lg border px-3.5 py-2.5 text-sm",
            message.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          {message.text}
        </p>
      ) : null}

      {/* ---- Progress rail ---- */}
      <Panel title="สถานะใบงาน" subtitle="เลื่อนได้เฉพาะขั้นตอนที่ระบบอนุญาตเท่านั้น" className="mb-4">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {(["draft", "scheduled", "in_progress", "blocked_parts", "done", "verified"] as const).map(
            (state, index, all) => {
              const currentIndex = all.indexOf(workOrder.state as (typeof all)[number]);
              const isCurrent = state === workOrder.state;
              const isPast = currentIndex > index && currentIndex >= 0;
              return (
                <li key={state} className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                      isCurrent
                        ? "bg-ocean-600 text-white ring-ocean-600"
                        : isPast
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "bg-steel-50 text-steel-400 ring-steel-200 dark:bg-white/5 dark:text-steel-500 dark:ring-white/10",
                    )}
                  >
                    {WORK_STATE_LABELS[state]}
                  </span>
                  {index < all.length - 1 ? (
                    <span className="text-steel-300 dark:text-steel-600">→</span>
                  ) : null}
                </li>
              );
            },
          )}
          {workOrder.state === "cancelled" ? (
            <li>
              <Chip tone={WORK_STATE_TONE.cancelled}>ยกเลิกใบงานนี้แล้ว</Chip>
            </li>
          ) : null}
        </ol>

        <div className="mt-5 flex flex-wrap gap-2">
          {allowed.map((state) => {
            const permission = state === "verified" ? canVerify : canProgress;
            const blockedByParts = state === "done" && !closeCheck.ok;
            const disabled = !permission || blockedByParts;
            return (
              <button
                key={state}
                type="button"
                disabled={disabled}
                title={
                  blockedByParts
                    ? `ยังขาดอะไหล่อีก ${closeCheck.outstanding} ชิ้น`
                    : permission
                      ? undefined
                      : "บัญชีของคุณไม่มีสิทธิ์ดำเนินการนี้"
                }
                onClick={() => transition(state)}
                className={cn(
                  "btn",
                  state === "done" ? "btn-accent" : state === "verified" ? "btn-primary" : "btn-ghost",
                )}
              >
                {state === "verified" ? <CheckCircle2 className="h-4 w-4" /> : null}
                เปลี่ยนเป็น{TRANSITION_BUTTON_LABELS[state]}
              </button>
            );
          })}

          {can("work_order.delete") && ["draft", "scheduled", "cancelled"].includes(workOrder.state) ? (
            <button
              type="button"
              onClick={() =>
                act(
                  () =>
                    run(() =>
                      deleteWorkOrder(snapshot, session?.email ?? "unknown", workOrder.work_order_id),
                    ),
                  "ลบใบงานเรียบร้อย",
                )
              }
              className="btn ml-auto text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
              ลบใบงาน
            </button>
          ) : null}
        </div>
      </Panel>

      {/* ---- Details + parts ---- */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <Panel title="รายละเอียดงาน">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["ประเภทงาน", WORK_KIND_LABELS[workOrder.kind]],
                ["ความสำคัญ", PRIORITY_LABELS[workOrder.priority]],
                ["เปิดใบงาน", formatDateTime(workOrder.opened_at)],
                ["กำหนดวันทำ", formatDate(workOrder.planned_for)],
                ["เริ่มทำงาน", formatDateTime(workOrder.started_at)],
                ["ปิดงาน", formatDateTime(workOrder.completed_at)],
                ["ตรวจรับ", formatDateTime(workOrder.verified_at)],
                ["สถานะ", WORK_STATE_LABELS[workOrder.state]],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] uppercase tracking-wide text-steel-400">{label}</dt>
                  <dd className="mt-0.5 text-steel-800 dark:text-steel-100">{value}</dd>
                </div>
              ))}
            </dl>

            {workOrder.detail ? (
              <p className="mt-4 border-t border-steel-200 pt-4 text-sm leading-relaxed text-steel-600 dark:border-white/10 dark:text-steel-300">
                {workOrder.detail}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-steel-200 pt-4 dark:border-white/10">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel-400">เวลาที่สูญเสีย</p>
                <p className="font-mono text-lg font-semibold text-steel-900 dark:text-white">
                  {formatDuration(workOrder.downtime_minutes)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel-400">ชั่วโมงแรงงาน</p>
                <p className="font-mono text-lg font-semibold text-steel-900 dark:text-white">
                  {formatDuration(workOrder.labour_minutes)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="ข้อมูลอ้างอิง">
            <Link
              href={`/assets/${workOrder.asset_id}`}
              className="flex items-center justify-between rounded-lg border border-steel-200 px-4 py-3 transition-colors hover:border-ocean-300 hover:bg-ocean-50/50 dark:border-white/10 dark:hover:bg-white/5"
            >
              <span>
                <span className="block text-sm font-medium text-steel-800 dark:text-steel-100">
                  {workOrder.asset_name}
                </span>
                <span className="block font-mono text-[11px] text-steel-400">
                  {workOrder.asset_tag}
                  {workOrder.line_name ? ` · ${workOrder.line_name}` : ""}
                </span>
              </span>
              <ArrowLeft className="h-4 w-4 rotate-180 text-steel-300" />
            </Link>
            <p className="mt-3 text-[11px] text-steel-500">
              กำหนดงาน{" "}
              {workOrder.planned_for
                ? `${formatDate(workOrder.planned_for)}${workOrder.planned_for < today ? " (เลยกำหนดแล้ว)" : ""}`
                : "ไม่ระบุ"}
            </p>
          </Panel>
        </div>

        <Panel
          title="รายการอะไหล่"
          subtitle={
            lines.length === 0
              ? "ใบงานนี้ไม่ได้ใช้อะไหล่"
              : closeCheck.ok
                ? "ครบทุกรายการ พร้อมปิดงานได้"
                : `ยังขาดอีก ${closeCheck.outstanding} ชิ้น`
          }
          bodyClassName="p-0"
        >
          {lines.length === 0 ? (
            <EmptyState title="ไม่มีรายการอะไหล่" hint="งานที่ไม่ใช้ชิ้นส่วนไม่ต้องเพิ่มรายการ" />
          ) : (
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[520px]">
                <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    <th className="th">อะไหล่</th>
                    <th className="th">ต้องใช้</th>
                    <th className="th">จองแล้ว</th>
                    <th className="th">เบิกแล้ว</th>
                    <th className="th">คงคลัง</th>
                    <th className="th text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                  {lines.map((line) => {
                    const part = snapshot.parts.find((p) => p.part_id === line.part_id);
                    const free = part ? availableStock(part) : 0;
                    const canReserve = can("parts.edit") && line.qty_reserved < line.qty_required;
                    const canIssue = can("parts.edit") && line.qty_reserved > line.qty_issued;

                    return (
                      <tr key={line.wo_part_id}>
                        <td className="td">
                          <p className="text-xs font-medium text-steel-800 dark:text-steel-100">
                            {part?.description ?? "—"}
                          </p>
                          <p className="font-mono text-[11px] text-steel-400">
                            {part?.sku ?? "—"} · นำเข้า {part?.lead_time_days ?? 0} วัน
                          </p>
                        </td>
                        <td className="td font-mono text-xs">{line.qty_required}</td>
                        <td className="td font-mono text-xs">{line.qty_reserved}</td>
                        <td className="td">
                          <span
                            className={cn(
                              "font-mono text-xs font-semibold",
                              line.qty_issued >= line.qty_required ? "text-emerald-600" : "text-rose-600",
                            )}
                          >
                            {line.qty_issued}
                          </span>
                        </td>
                        <td className="td font-mono text-xs text-steel-500">{free}</td>
                        <td className="td">
                          <div className="flex justify-end gap-1.5">
                            {canReserve ? (
                              <button
                                type="button"
                                onClick={() =>
                                  act(
                                    () =>
                                      run(() =>
                                        reserveParts(snapshot, session?.email ?? "unknown", workOrder.work_order_id, line.part_id),
                                      ),
                                    `จอง ${part?.sku ?? "อะไหล่"} เข้ากองสำรองแล้ว`,
                                  )
                                }
                                className="btn-ghost !px-2 !py-1.5"
                                title="จองจากชั้นวางเข้ากองสำรองของใบงานนี้"
                              >
                                <PackagePlus className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            {canIssue ? (
                              <button
                                type="button"
                                onClick={() =>
                                  act(
                                    () =>
                                      run(() =>
                                        issuePart(snapshot, session?.email ?? "unknown", workOrder.work_order_id, line.part_id),
                                      ),
                                    `เบิก ${part?.sku ?? "อะไหล่"} จากคลังแล้ว`,
                                  )
                                }
                                className="btn-primary !px-2 !py-1.5"
                                title="ตัดออกจากคลังจริงและลงในใบงาน"
                              >
                                <PackageCheck className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {outstanding.length > 0 ? (
            <div className="border-t border-steel-200 px-5 py-4 dark:border-white/10">
              <p className="text-[11px] font-medium uppercase tracking-wide text-signal-600">
                สิ่งที่ยังขาด
              </p>
              <ul className="mt-2 space-y-1.5">
                {outstanding.map((row) => (
                  <li key={row.part_id} className="flex flex-wrap items-center gap-x-2 text-xs text-steel-600 dark:text-steel-300">
                    <span className="font-mono">{row.sku}</span>
                    <span className="font-semibold text-rose-600">ขาด {row.missing} ชิ้น</span>
                    <span className="text-steel-400">
                      ว่าง {row.free} · นำเข้า {row.lead_time_days} วัน
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
