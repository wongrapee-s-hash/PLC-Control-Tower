"use client";

import { useMemo, useState } from "react";
import { Boxes, Minus, Plus, Search, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { PanelForm } from "@/components/parts/part-form";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { addPart, adjustStock } from "@/data/plant-store";
import { joinWorkOrders } from "@/data/selectors";
import { formatBaht, isBelowReorderPoint, stockValue } from "@/lib/inventory";
import { cn, formatNumber } from "@/lib/format";

export default function PartsPage() {
  const { snapshot, run } = usePlant();
  const { can, session } = useAuth();
  const [query, setQuery] = useState("");
  const [onlyReorder, setOnlyReorder] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Which open work orders are waiting on each SKU, for the "needed for" column. */
  const demandByPart = useMemo(() => {
    const map = new Map<string, number>();
    const open = joinWorkOrders(snapshot).filter((w) =>
      ["draft", "scheduled", "in_progress", "blocked_parts"].includes(w.state),
    );
    for (const wo of open) {
      for (const line of snapshot.workOrderParts) {
        if (line.work_order_id !== wo.work_order_id) continue;
        const missing = Math.max(line.qty_required - line.qty_issued, 0);
        if (missing > 0) map.set(line.part_id, (map.get(line.part_id) ?? 0) + missing);
      }
    }
    return map;
  }, [snapshot]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.parts
      .filter((p) => (onlyReorder ? isBelowReorderPoint(p) : true))
      .filter((p) =>
        q === "" ? true : p.sku.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      )
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }, [snapshot.parts, query, onlyReorder]);

  const adjust = (partId: string, delta: number) => {
    setError(null);
    const message = run(() => adjustStock(snapshot, session?.email ?? "unknown", partId, delta));
    if (message) setError(message);
  };

  const totalValue = snapshot.parts.reduce((sum, p) => sum + stockValue(p), 0);
  const reorderCount = snapshot.parts.filter(isBelowReorderPoint).length;

  return (
    <>
      <PageHeader
        eyebrow="SPARES STORE"
        title="คลังอะไหล่สำรอง"
        description="ติดตามยอดคงเหลือ การจอง และการเบิกใช้เข้ากับใบงานซ่อมบำรุง"
        actions={
          can("parts.edit") ? (
            <button type="button" onClick={() => setCreating(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              เพิ่มอะไหล่
            </button>
          ) : null
        }
      />

      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Panel bodyClassName="p-4">
          <p className="text-xs text-steel-500">มูลค่าสต็อกรวม</p>
          <p className="metric mt-1.5">{formatBaht(totalValue)}</p>
        </Panel>
        <Panel bodyClassName="p-4">
          <p className="text-xs text-steel-500">รายการที่ต้องสั่งซื้อ</p>
          <p className={cn("metric mt-1.5", reorderCount > 0 && "text-signal-600")}>{reorderCount}</p>
        </Panel>
        <Panel bodyClassName="p-4">
          <p className="text-xs text-steel-500">รายการในคลัง</p>
          <p className="metric mt-1.5">{snapshot.parts.length}</p>
        </Panel>
      </div>

      <Panel className="mb-4" bodyClassName="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาด้วย SKU หรือชื่ออะไหล่"
            className="field pl-9"
            aria-label="ค้นหาอะไหล่"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyReorder((v) => !v)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            onlyReorder
              ? "bg-signal-500 text-white"
              : "bg-steel-100 text-steel-600 hover:bg-steel-200 dark:bg-white/10 dark:text-steel-300",
          )}
        >
          <TriangleAlert className="mr-1 inline h-3 w-3" />
          เฉพาะที่ต้องสั่งซื้อ
        </button>
        <span className="ml-auto font-mono text-xs text-steel-400">
          {visible.length}/{snapshot.parts.length} รายการ
        </span>
      </Panel>

      <Panel bodyClassName="p-0">
        {visible.length === 0 ? (
          <EmptyState icon={<Boxes className="h-8 w-8" />} title="ไม่พบอะไหล่ที่ตรงกับเงื่อนไข" />
        ) : (
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[880px]">
              <thead className="border-b border-steel-200 bg-steel-50 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th">อะไหล่</th>
                  <th className="th">คงเหลือ</th>
                  <th className="th">จองไว้</th>
                  <th className="th">ว่างใช้</th>
                  <th className="th">จุดสั่งซื้อ</th>
                  <th className="th">ความต้องการจากงาน</th>
                  <th className="th">ราคา/ชิ้น</th>
                  <th className="th text-right">ปรับยอด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-200 dark:divide-white/5">
                {visible.map((part) => {
                  const free = Math.max(part.on_hand - part.reserved, 0);
                  const low = isBelowReorderPoint(part);
                  const demand = demandByPart.get(part.part_id) ?? 0;

                  return (
                    <tr key={part.part_id} className="transition-colors hover:bg-steel-50 dark:hover:bg-white/5">
                      <td className="td">
                        <p className="text-xs font-medium text-steel-800 dark:text-steel-100">
                          {part.description}
                        </p>
                        <p className="font-mono text-[11px] text-steel-400">
                          {part.sku} · ชั้น {part.bin_location ?? "—"} · นำเข้า {part.lead_time_days} วัน
                        </p>
                      </td>
                      <td className="td font-mono text-xs">{formatNumber(part.on_hand)}</td>
                      <td className="td font-mono text-xs text-signal-600">{formatNumber(part.reserved)}</td>
                      <td className="td">
                        <span className={cn("font-mono text-xs font-semibold", free === 0 && "text-rose-600")}>
                          {formatNumber(free)}
                        </span>
                      </td>
                      <td className="td">
                        {low ? (
                          <Chip tone="bg-signal-50 text-signal-800 ring-signal-200">
                            <TriangleAlert className="h-3 w-3" />
                            ต้องสั่งซื้อ
                          </Chip>
                        ) : (
                          <span className="font-mono text-xs text-steel-500">{part.reorder_point}</span>
                        )}
                      </td>
                      <td className="td">
                        {demand > 0 ? (
                          <span className="font-mono text-xs font-semibold text-rose-600">{demand} ชิ้น</span>
                        ) : (
                          <span className="text-xs text-steel-400">—</span>
                        )}
                      </td>
                      <td className="td font-mono text-xs">{formatBaht(part.unit_cost)}</td>
                      <td className="td">
                        {can("parts.edit") ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => adjust(part.part_id, -1)}
                              disabled={free <= 0}
                              className="btn-ghost !px-2 !py-1.5"
                              title="ลดยอดคงคลัง 1 ชิ้น (เช่น ตรวจสอบแล้วเสีย)"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono text-xs">{part.on_hand}</span>
                            <button
                              type="button"
                              onClick={() => adjust(part.part_id, 1)}
                              className="btn-ghost !px-2 !py-1.5"
                              title="เพิ่มยอดคงคลัง 1 ชิ้น (รับเข้าใหม่)"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-steel-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating ? (
        <PanelForm
          onSubmit={(draft) => run(() => addPart(snapshot, session?.email ?? "unknown", draft))}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </>
  );
}
