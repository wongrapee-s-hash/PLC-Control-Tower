"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Factory, Pencil, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AssetFormModal } from "@/components/assets/asset-form";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { assetPerformance, joinWorkOrders, openWorkOrders } from "@/data/selectors";
import { cn, dueLabel, formatPercent } from "@/lib/format";
import {
  ASSET_KIND_LABELS,
  ASSET_STATE_LABELS,
  ASSET_STATE_TONE,
  CRITICALITY_LABELS,
  CRITICALITY_RANK,
  CRITICALITY_TONE,
} from "@/lib/labels";
import type { Asset, AssetState } from "@/types/domain";

const STATE_FILTERS: readonly (AssetState | "all")[] = [
  "all",
  "running",
  "fault",
  "maintenance",
  "idle",
  "setup",
  "decommissioned",
];

export default function AssetsPage() {
  const { snapshot, today } = usePlant();
  const { can } = useAuth();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<AssetState | "all">("all");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);

  const lineName = useMemo(
    () => new Map(snapshot.lines.map((l) => [l.line_id, l.name])),
    [snapshot.lines],
  );

  const openByAsset = useMemo(() => {
    const rows = openWorkOrders(joinWorkOrders(snapshot));
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.asset_id, (map.get(row.asset_id) ?? 0) + 1);
    return map;
  }, [snapshot]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.assets
      .filter((a) => (stateFilter === "all" ? true : a.state === stateFilter))
      .filter((a) =>
        q === ""
          ? true
          : a.asset_tag.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            (a.manufacturer ?? "").toLowerCase().includes(q) ||
            (a.model_name ?? "").toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          CRITICALITY_RANK[b.criticality] - CRITICALITY_RANK[a.criticality] ||
          a.asset_tag.localeCompare(b.asset_tag),
      );
  }, [snapshot.assets, query, stateFilter]);

  return (
    <>
      <PageHeader
        eyebrow="ASSET REGISTRY"
        title="ทะเบียนเครื่องจักร"
        description="รายการเครื่องจักรทั้งหมดในสายการผลิต พร้อม OEE เฉลี่ยและจำนวนใบงานที่ค้างอยู่"
        actions={
          can("asset.edit") ? (
            <button type="button" onClick={() => setCreating(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              เพิ่มเครื่องจักร
            </button>
          ) : null
        }
      />

      {/* ---- Filters ---- */}
      <Panel className="mb-4" bodyClassName="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาด้วยรหัส ชื่อ ผู้ผลิต หรือรุ่นเครื่อง"
            className="field pl-9"
            aria-label="ค้นหาเครื่องจักร"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATE_FILTERS.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setStateFilter(state)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                stateFilter === state
                  ? "bg-ocean-600 text-white"
                  : "bg-steel-100 text-steel-600 hover:bg-steel-200 dark:bg-white/10 dark:text-steel-300 dark:hover:bg-white/20",
              )}
            >
              {state === "all" ? "ทั้งหมด" : ASSET_STATE_LABELS[state]}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs text-steel-400">
          {visible.length}/{snapshot.assets.length} รายการ
        </span>
      </Panel>

      <Panel bodyClassName="p-0">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Factory className="h-8 w-8" />}
            title="ไม่พบเครื่องจักรที่ตรงกับเงื่อนไข"
            hint="ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น"
          />
        ) : (
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[920px]">
              <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th">เครื่องจักร</th>
                  <th className="th">สาย / ประเภท</th>
                  <th className="th">สถานะ</th>
                  <th className="th">ระดับความสำคัญ</th>
                  <th className="th">OEE เฉลี่ย</th>
                  <th className="th">งานค้าง</th>
                  <th className="th">PM ถัดไป</th>
                  <th className="th text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                {visible.map((asset) => {
                  const oee = assetPerformance(snapshot, asset.asset_id);
                  const open = openByAsset.get(asset.asset_id) ?? 0;
                  const overdue = asset.next_pm_due !== null && asset.next_pm_due <= today;

                  return (
                    <tr
                      key={asset.asset_id}
                      className="transition-colors hover:bg-steel-50 dark:hover:bg-white/5"
                    >
                      <td className="td">
                        <Link href={`/assets/${asset.asset_id}`} className="row-link block">
                          {asset.name}
                        </Link>
                        <p className="font-mono text-[11px] text-steel-400">
                          {asset.asset_tag}
                          {asset.manufacturer ? ` · ${asset.manufacturer} ${asset.model_name ?? ""}` : ""}
                        </p>
                      </td>
                      <td className="td">
                        <p className="text-steel-700 dark:text-steel-200">
                          {asset.line_id ? (lineName.get(asset.line_id) ?? "—") : "ไม่ผูกสาย"}
                        </p>
                        <p className="text-[11px] text-steel-400">{ASSET_KIND_LABELS[asset.kind]}</p>
                      </td>
                      <td className="td">
                        <Chip tone={ASSET_STATE_TONE[asset.state]}>{ASSET_STATE_LABELS[asset.state]}</Chip>
                      </td>
                      <td className="td">
                        <Chip tone={CRITICALITY_TONE[asset.criticality]}>
                          {CRITICALITY_LABELS[asset.criticality]}
                        </Chip>
                      </td>
                      <td className="td">
                        {oee.plannedMinutes === 0 ? (
                          <span className="text-steel-400">—</span>
                        ) : (
                          <span className="font-mono font-semibold text-steel-900 dark:text-white">
                            {formatPercent(oee.oee)}
                          </span>
                        )}
                      </td>
                      <td className="td">
                        {open > 0 ? (
                          <span className="font-mono font-semibold text-signal-600">{open} ใบ</span>
                        ) : (
                          <span className="text-steel-400">—</span>
                        )}
                      </td>
                      <td className="td">
                        {asset.next_pm_due ? (
                          <span className={cn("text-xs", overdue ? "font-semibold text-rose-600" : "text-steel-600 dark:text-steel-300")}>
                            {dueLabel(asset.next_pm_due, today)}
                          </span>
                        ) : (
                          <span className="text-steel-400">—</span>
                        )}
                      </td>
                      <td className="td text-right">
                        <div className="flex justify-end gap-1.5">
                          {can("asset.edit") ? (
                            <button
                              type="button"
                              onClick={() => setEditing(asset)}
                              className="btn-ghost !px-2 !py-1.5"
                              title="แก้ไขข้อมูล"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          <Link href={`/assets/${asset.asset_id}`} className="btn-ghost !px-2.5 !py-1.5 text-xs">
                            รายละเอียด
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {(creating || editing) && (
        <AssetFormModal
          asset={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
