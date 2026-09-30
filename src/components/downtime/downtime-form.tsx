"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { recordDowntime, setAssetState } from "@/data/plant-store";
import { DOWNTIME_CAUSE_LABELS } from "@/lib/labels";
import { DOWNTIME_CAUSES, type DowntimeCause } from "@/types/domain";

export function DowntimeFormModal({ onClose }: { onClose: () => void }) {
  const { snapshot, run } = usePlant();
  const { session } = useAuth();
  const [form, setForm] = useState({
    asset_id: "",
    cause: "mechanical" as DowntimeCause,
    work_order_id: "",
    narration: "",
    alsoFault: true,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const message = run(() => {
      const next = recordDowntime(snapshot, session?.email ?? "unknown", {
        asset_id: form.asset_id,
        cause: form.cause,
        work_order_id: form.work_order_id || null,
        narration: form.narration,
      });
      // A machine that stopped producing is a machine in `fault`; keeping the
      // asset row honest is what stops the fleet tile from drifting.
      return form.alsoFault
        ? setAssetState(next, session?.email ?? "unknown", form.asset_id, "fault")
        : next;
    });

    if (message) {
      setError(message);
      return;
    }
    onClose();
  };

  const active = snapshot.assets.filter((a) => a.state !== "decommissioned");
  const openWorkOrders = snapshot.workOrders.filter((w) =>
    ["draft", "scheduled", "in_progress", "blocked_parts"].includes(w.state),
  );

  return (
    <Modal
      open
      title="บันทึกเวลาหยุดเครื่อง"
      description="ระบุสาเหตุให้ชัดเจน ระบบจะนำไปคำนวณ OEE และสถิติสาเหตุอัตโนมัติ"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            ยกเลิก
          </button>
          <button type="submit" form="dt-form" className="btn-accent">
            บันทึกเหตุการณ์
          </button>
        </>
      }
    >
      <form id="dt-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="field-label" htmlFor="dt_asset">
            เครื่องจักร *
          </label>
          <select
            id="dt_asset"
            required
            value={form.asset_id}
            onChange={(e) => setForm((p) => ({ ...p, asset_id: e.target.value }))}
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
          <span className="field-label">สาเหตุ</span>
          <div className="flex flex-wrap gap-1.5">
            {DOWNTIME_CAUSES.map((cause) => (
              <button
                key={cause}
                type="button"
                onClick={() => setForm((p) => ({ ...p, cause }))}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.cause === cause
                    ? "bg-ocean-600 text-white"
                    : "bg-steel-100 text-steel-600 hover:bg-steel-200 dark:bg-white/10 dark:text-steel-300"
                }`}
              >
                {DOWNTIME_CAUSE_LABELS[cause]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="dt_wo">
            เชื่อมกับใบงาน (ถ้ามี)
          </label>
          <select
            id="dt_wo"
            value={form.work_order_id}
            onChange={(e) => setForm((p) => ({ ...p, work_order_id: e.target.value }))}
            className="field"
          >
            <option value="">ไม่ผูกกับใบงาน</option>
            {openWorkOrders.map((wo) => (
              <option key={wo.work_order_id} value={wo.work_order_id}>
                {wo.wo_number} · {wo.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="dt_note">
            รายละเอียดเหตุการณ์ *
          </label>
          <textarea
            id="dt_note"
            rows={3}
            required
            value={form.narration}
            onChange={(e) => setForm((p) => ({ ...p, narration: e.target.value }))}
            placeholder="อาการที่พบ ตำแหน่ง และสิ่งที่ตรวจแล้ว"
            className="field resize-y"
          />
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-steel-200 px-3.5 py-3 dark:border-white/10">
          <input
            type="checkbox"
            checked={form.alsoFault}
            onChange={(e) => setForm((p) => ({ ...p, alsoFault: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-steel-300 text-ocean-600"
          />
          <span className="text-xs leading-relaxed text-steel-600 dark:text-steel-300">
            เปลี่ยนสถานะเครื่องจักรเป็น <strong>ขัดข้อง</strong> พร้อมกัน
            <span className="block text-steel-400">
              เหมาะกับกรณีสายหยุดผลิตจริง หากเป็นการหยุดชั่วคราวให้เอาออก
            </span>
          </span>
        </label>

        {error ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
