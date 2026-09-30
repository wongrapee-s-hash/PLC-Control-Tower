"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import type { SparePart } from "@/types/domain";

type Draft = Omit<SparePart, "part_id" | "reserved">;

const BLANK: Draft = {
  sku: "",
  description: "",
  on_hand: 0,
  reorder_point: 0,
  unit_cost: 0,
  lead_time_days: 7,
  bin_location: "",
};

const toNumber = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function PanelForm({
  onSubmit,
  onClose,
}: {
  /** Return an error message to keep the dialog open, or `null` on success. */
  onSubmit: (draft: Draft) => string | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Draft>(BLANK);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = onSubmit(form);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  };

  return (
    <Modal
      open
      title="เพิ่มรายการอะไหล่"
      description="กำหนดจุดสั่งซื้อและระยะเวลานำเข้า เพื่อให้ระบบเตือนได้ทัน"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            ยกเลิก
          </button>
          <button type="submit" form="part-form" className="btn-primary">
            เพิ่มอะไหล่
          </button>
        </>
      }
    >
      <form id="part-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div>
          <label className="field-label" htmlFor="part_sku">
            SKU *
          </label>
          <input
            id="part_sku"
            required
            value={form.sku}
            onChange={(e) => set("sku", e.target.value.toUpperCase())}
            placeholder="BRG-6205-2RS"
            className="field font-mono"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="part_bin">
            ตำแหน่งชั้นวาง
          </label>
          <input
            id="part_bin"
            value={form.bin_location ?? ""}
            onChange={(e) => set("bin_location", e.target.value || null)}
            placeholder="A-01-03"
            className="field font-mono"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="part_desc">
            รายละเอียด *
          </label>
          <input
            id="part_desc"
            required
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="ลูกปืนแขนหมุน 6205-2RS"
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="part_onhand">
            ยอดเริ่มต้น
          </label>
          <input
            id="part_onhand"
            type="number"
            min={0}
            value={form.on_hand}
            onChange={(e) => set("on_hand", toNumber(e.target.value))}
            className="field font-mono"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="part_reorder">
            จุดสั่งซื้อ
          </label>
          <input
            id="part_reorder"
            type="number"
            min={0}
            value={form.reorder_point}
            onChange={(e) => set("reorder_point", toNumber(e.target.value))}
            className="field font-mono"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="part_cost">
            ราคาต่อชิ้น (บาท)
          </label>
          <input
            id="part_cost"
            type="number"
            min={0}
            step={0.01}
            value={form.unit_cost}
            onChange={(e) => set("unit_cost", toNumber(e.target.value))}
            className="field font-mono"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="part_lead">
            ระยะเวลานำเข้า (วัน)
          </label>
          <input
            id="part_lead"
            type="number"
            min={0}
            value={form.lead_time_days}
            onChange={(e) => set("lead_time_days", toNumber(e.target.value))}
            className="field font-mono"
          />
        </div>

        {error ? (
          <p role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
