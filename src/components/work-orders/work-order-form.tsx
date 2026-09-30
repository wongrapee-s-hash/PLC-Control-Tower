"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { createWorkOrder } from "@/data/plant-store";
import { cn } from "@/lib/format";
import {
  WORK_KINDS,
  WORK_KIND_LABELS,
  WORK_PRIORITIES,
  type WorkKind,
  type WorkPriority,
} from "@/types/domain";
import { PRIORITY_LABELS } from "@/lib/workflow";

export function WorkOrderFormModal({ onClose }: { onClose: () => void }) {
  const { snapshot, today, run } = usePlant();
  const { session } = useAuth();

  // A planner schedules preventive work; the database enforces the same rule in
  // `wo_insert`. Offering anything else here would only produce a rejected
  // insert and an error toast later.
  const isPlanner = session?.role === "planner";
  const allowedKinds = isPlanner ? (["preventive"] as const) : WORK_KINDS;

  const [form, setForm] = useState({
    asset_id: "",
    kind: (isPlanner ? "preventive" : "corrective") as WorkKind,
    priority: "p3" as WorkPriority,
    title: "",
    detail: "",
    planned_for: today,
  });
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const message = run(() =>
      createWorkOrder(snapshot, session?.email ?? "unknown", {
        asset_id: form.asset_id,
        kind: form.kind,
        priority: form.priority,
        title: form.title,
        detail: form.detail || null,
        planned_for: form.planned_for || null,
      }),
    );
    if (message) {
      setError(message);
      return;
    }
    onClose();
  };

  const active = snapshot.assets.filter((a) => a.state !== "decommissioned");

  return (
    <Modal
      open
      title="เปิดใบงานซ่อมบำรุง"
      description={
        isPlanner
          ? "นักวางแผนงานเปิดได้เฉพาะงานบำรุงป้องกัน (PM) ซึ่งจะเริ่มที่สถานะ 'ร่าง'"
          : "ใบงานใหม่จะเริ่มที่สถานะ 'ร่าง' เสมอ แล้วค่อยเลื่อนตามลำดับที่กำหนด"
      }

      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            ยกเลิก
          </button>
          <button type="submit" form="wo-form" className="btn-primary">
            สร้างใบงาน
          </button>
        </>
      }
    >
      <form id="wo-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="field-label" htmlFor="wo_asset">
            เครื่องจักร *
          </label>
          <select
            id="wo_asset"
            required
            value={form.asset_id}
            onChange={(e) => set("asset_id", e.target.value)}
            className="field"
          >
            <option value="">เลือกเครื่องจักร</option>
            {active.map((asset) => (
              <option key={asset.asset_id} value={asset.asset_id}>
                {asset.asset_tag} · {asset.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="wo_title">
            หัวข้องาน *
          </label>
          <input
            id="wo_title"
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="เปลี่ยนลูกปืนข้อต่อแกน 2"
            className="field"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="field-label">ประเภทงาน</span>
            <div className="flex flex-wrap gap-1.5">
              {allowedKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => set("kind", kind)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    form.kind === kind
                      ? "bg-ocean-600 text-white"
                      : "bg-steel-100 text-steel-600 hover:bg-steel-200 dark:bg-white/10 dark:text-steel-300",
                  )}
                >
                  {WORK_KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="field-label">ความสำคัญ</span>
            <div className="flex flex-wrap gap-1.5">
              {WORK_PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => set("priority", priority)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    form.priority === priority
                      ? priority === "p1"
                        ? "bg-rose-600 text-white"
                        : "bg-ocean-600 text-white"
                      : "bg-steel-100 text-steel-600 hover:bg-steel-200 dark:bg-white/10 dark:text-steel-300",
                  )}
                >
                  {PRIORITY_LABELS[priority]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="wo_planned">
            กำหนดวันที่ทำ
          </label>
          <input
            id="wo_planned"
            type="date"
            value={form.planned_for}
            onChange={(e) => set("planned_for", e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="wo_detail">
            รายละเอียด / อาการเสีย
          </label>
          <textarea
            id="wo_detail"
            rows={4}
            value={form.detail}
            onChange={(e) => set("detail", e.target.value)}
            placeholder="อาการที่พบ วิธีตรวจ และผลที่คาดหวังหลังซ่อม"
            className="field resize-y"
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
