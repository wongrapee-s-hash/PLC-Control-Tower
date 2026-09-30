import { createDemoSnapshot } from "@/data/demo-dataset";
import { computeOee, meanTimeToRepair, preventiveCompliance, downtimeShare } from "@/lib/oee";
import type { Asset } from "@/types/domain";

const s = createDemoSnapshot();

console.log("=== counts ===");
for (const [k, v] of Object.entries(s)) console.log(`${k}: ${v.length}`);

const assetsByLine = (lineId: string) =>
  s.assets.filter((a: Asset) => a.line_id === lineId).map((a: Asset) => a.asset_id);

console.log("\n=== oee by line (runs are per asset) ===");
const rows: string[] = [];
for (const line of s.lines) {
  const ids = new Set(assetsByLine(line.line_id));
  const runs = s.runs.filter((r) => ids.has(r.asset_id));
  const o = computeOee(runs, line.takt_seconds);
  const stop = downtimeShare(o.runningMinutes, o.plannedMinutes);
  rows.push(
    `${line.name}\truns=${runs.length}\tA=${o.availability.toFixed(1)}\tP=${o.performance.toFixed(1)}\tQ=${o.quality.toFixed(1)}\tOEE=${o.oee.toFixed(1)}\tstop=${stop.toFixed(1)}%`,
  );
}
console.log(rows.join("\n"));

const total = computeOee(s.runs, s.lines[0]?.takt_seconds ?? 0);
console.log(
  `\nรวมทุกสาย\tA=${total.availability.toFixed(1)}\tP=${total.performance.toFixed(1)}\tQ=${total.quality.toFixed(1)}\tOEE=${total.oee.toFixed(1)}\tgood=${total.goodUnits}\tscrap=${total.scrapUnits}\tstop=${downtimeShare(total.runningMinutes, total.plannedMinutes).toFixed(1)}%`,
);

console.log("\n=== downtime by reaction ===");
console.log(
  s.downtime.reduce<Record<string, number>>((a, d) => ((a[d.reaction] = (a[d.reaction] ?? 0) + 1), a), {}),
);
console.log(`เวลาหยุดเครื่องรวม: ${s.downtime.reduce((t, d) => t + d.minutes, 0)} นาที`);
console.log(
  `เหตุที่ยังไม่ปิด: ${s.downtime.filter((d) => d.ended_at === null).length}`,
);

console.log("\n=== maintenance ===");
console.log(`MTTR: ${meanTimeToRepair(s.workOrders).toFixed(1)} นาที`);
console.log(`PM compliance: ${preventiveCompliance(s.workOrders, "2026-09-30").toFixed(1)}%`);
console.log(`ชนิดงาน: ${JSON.stringify(s.workOrders.reduce<Record<string, number>>((a, w) => ((a[w.kind] = (a[w.kind] ?? 0) + 1), a), {}))}`);
console.log(`สถานะ: ${JSON.stringify(s.workOrders.reduce<Record<string, number>>((a, w) => ((a[w.state] = (a[w.state] ?? 0) + 1), a), {}))}`);

console.log("\n=== inventory ===");
console.log(`ต่ำกว่าจุดสั่งซื้อ: ${s.parts.filter((p) => p.on_hand - p.reserved <= p.reorder_point).length} / ${s.parts.length}`);
console.log(`มูลค่าของคงคลัง: ${s.parts.reduce((t, p) => t + p.on_hand * p.unit_cost, 0).toFixed(0)} บาท`);

console.log("\n=== assets ===");
console.log(`critical: ${s.assets.filter((a) => a.criticality === "critical").length} / ${s.assets.length}`);
console.log(`สถานะ: ${JSON.stringify(s.assets.reduce<Record<string, number>>((a, x) => ((a[x.state] = (a[x.state] ?? 0) + 1), a), {}))}`);
console.log(`takt: ${s.lines.map((l) => `${l.code}=${l.takt_seconds}s`).join(", ")}`);
