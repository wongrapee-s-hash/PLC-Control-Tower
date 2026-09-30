"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { upsertAsset, type AssetInput } from "@/data/plant-store";
import { ASSET_KINDS, CRITICALITIES, type Asset, type AssetKind, type Criticality } from "@/types/domain";
import { ASSET_KIND_LABELS, CRITICALITY_LABELS } from "@/lib/labels";

const BLANK: AssetInput = {
  asset_tag: "",
  name: "",
  kind: "conveyor",
  criticality: "medium",
  line_id: null,
  manufacturer: null,
  model_name: null,
  serial_number: null,
  next_pm_due: null,
  target_oee: 85,
  notes: null,
};

const toInput = (asset: Asset): AssetInput => ({
  asset_tag: asset.asset_tag,
  name: asset.name,
  kind: asset.kind,
  criticality: asset.criticality,
  line_id: asset.line_id,
  manufacturer: asset.manufacturer,
  model_name: asset.model_name,
  serial_number: asset.serial_number,
  next_pm_due: asset.next_pm_due,
  target_oee: asset.target_oee,
  notes: asset.notes,
});

export function AssetFormModal({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const { snapshot, run } = usePlant();
  const { session } = useAuth();
  const [form, setForm] = useState<AssetInput>(() => (asset ? toInput(asset) : BLANK));
  const [error, setError] = useState<string | null>(null);

  const isEdit = asset !== null;
  const set = <K extends keyof AssetInput>(key: K, value: AssetInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const message = run(() =>
      upsertAsset(snapshot, session?.email ?? "unknown", form, asset?.asset_id),
    );
    if (message) {
      setError(message);
      return;
    }
    onClose();
  };

  return (
    <Modal
      open
      width="lg"
      title={isEdit ? `แก้ไขเครื่องจักร ${asset.asset_tag}` : "เพิ่มเครื่องจักรใหม่"}
      description="ข้อมูลนี้จะถูกบันทึกลงทะเบียนหลัก และแสดงในบันทึกกิจกรรม"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            ยกเลิก
          </button>
          <button type="submit" form="asset-form" className="btn-primary">
            {isEdit ? "บันทึกการแก้ไข" : "เพิ่มเครื่องจักร"}
          </button>
        </>
      }
    >
      <form id="asset-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div>
          <label className="field-label" htmlFor="asset_tag">
            รหัสเครื่องจักร (Asset Tag) *
          </label>
          <input
            id="asset_tag"
            required
            value={form.asset_tag}
            onChange={(e) => set("asset_tag", e.target.value)}
            placeholder="AST-PRN-011"
            className="field font-mono"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="asset_name">
            ชื่อเครื่องจักร *
          </label>
          <input
            id="asset_name"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="เครื่องพิมพ์ซิลเกรฟฟี่"
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="asset_kind">
            ประเภท
          </label>
          <select
            id="asset_kind"
            value={form.kind}
            onChange={(e) => set("kind", e.target.value as AssetKind)}
            className="field"
          >
            {ASSET_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ASSET_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="asset_crit">
            ระดับความสำคัญ
          </label>
          <select
            id="asset_crit"
            value={form.criticality}
            onChange={(e) => set("criticality", e.target.value as Criticality)}
            className="field"
          >
            {CRITICALITIES.map((level) => (
              <option key={level} value={level}>
                {CRITICALITY_LABELS[level]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="asset_line">
            สายการผลิต
          </label>
          <select
            id="asset_line"
            value={form.line_id ?? ""}
            onChange={(e) => set("line_id", e.target.value || null)}
            className="field"
          >
            <option value="">ไม่ผูกสาย</option>
            {snapshot.lines.map((line) => (
              <option key={line.line_id} value={line.line_id}>
                {line.code} · {line.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="asset_pm">
            กำหนด PM ครั้งถัดไป
          </label>
          <input
            id="asset_pm"
            type="date"
            value={form.next_pm_due ?? ""}
            onChange={(e) => set("next_pm_due", e.target.value || null)}
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="asset_manufacturer">
            ผู้ผลิต
          </label>
          <input
            id="asset_manufacturer"
            value={form.manufacturer ?? ""}
            onChange={(e) => set("manufacturer", e.target.value || null)}
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="asset_model">
            รุ่น
          </label>
          <input
            id="asset_model"
            value={form.model_name ?? ""}
            onChange={(e) => set("model_name", e.target.value || null)}
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="asset_serial">
            หมายเลขประจำเครื่อง
          </label>
          <input
            id="asset_serial"
            value={form.serial_number ?? ""}
            onChange={(e) => set("serial_number", e.target.value || null)}
            className="field font-mono"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="asset_oee">
            เป้าหมาย OEE (%)
          </label>
          <input
            id="asset_oee"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={form.target_oee}
            onChange={(e) => set("target_oee", Number(e.target.value))}
            className="field font-mono"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="asset_notes">
            หมายเหตุ
          </label>
          <textarea
            id="asset_notes"
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            placeholder="ข้อมูลสำคัญต่อการวางแผนซ่อมบำรุง"
            className="field resize-y"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
