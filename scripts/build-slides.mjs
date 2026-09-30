/**
 * Builds the presentation deck.
 *
 *   npm run slides
 *
 * Reads the 16:9 crops in deliverables/Slides/assets (see crop-for-slides.ps1)
 * and the figures baked into STATS below, which are the numbers the demo
 * dataset actually produces - not hand-written approximations.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import PptxGenJS from "pptxgenjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const ASSETS = join(ROOT, "deliverables", "Slides", "assets");
const OUT = join(ROOT, "deliverables", "Slides", "Production-Control-Tower.pptx");

/** Figures from `npx tsx scripts/slide-stats.ts` against the demo dataset. */
const STATS = {
  oeeByLine: [
    { line: "LN-A สายวางลูกษา SMT", availability: 57.3, quality: 99.0, oee: 56.7, stop: 42.7 },
    { line: "LN-B สายเติมวงจรและทดสอบ", availability: 74.1, quality: 98.7, oee: 73.1, stop: 25.9 },
    { line: "LN-C สายฉีดขึ้นรูปพลาสติก", availability: 56.0, quality: 98.4, oee: 55.1, stop: 44.0 },
  ],
  total: { availability: 58.4, quality: 98.6, oee: 57.6, good: 47259, scrap: 656, stop: 41.6 },
  downtime: { open: 1, acknowledged: 2, mitigated: 3, minutes: 253, unclosed: 3 },
  maintenance: { mttr: 284, pmCompliance: 50, corrective: 4, preventive: 3, calibration: 1 },
  inventory: { belowReorder: 3, total: 8, value: 102320 },
  assets: { critical: 3, total: 10, running: 5, fault: 1 },
};

const C = {
  ink: "0F172A",
  slate: "334155",
  muted: "64748B",
  line: "E2E8F0",
  paper: "FFFFFF",
  wash: "F8FAFC",
  amber: "D97706",
  amberSoft: "FEF3C7",
  sky: "0369A1",
  skySoft: "E0F2FE",
  red: "B91C1C",
  redSoft: "FEE2E2",
  green: "15803D",
  greenSoft: "DCFCE7",
  violet: "6D28D9",
  violetSoft: "EDE9FE",
};

const FONT = "Leelawadee UI";
const MONO = "Consolas";

const pptx = new PptxGenJS();
// pptxgenjs' LAYOUT_16x9 is 10 x 5.625in. Every coordinate below assumes the
// wider 13.333 x 7.5in canvas, so the layout is defined explicitly.
pptx.defineLayout({ name: "WIDE_16x9", width: 13.333, height: 7.5 });
pptx.layout = "WIDE_16x9";
pptx.author = "Production Control Tower";
pptx.title = "Production Control Tower";

const W = 13.333;
const H = 7.5;

/** Slide chrome: title, kicker, footer and page number. */
function frame(slide, { kicker, title, page, tone = "light" }) {
  const dark = tone === "dark";
  slide.background = { color: dark ? C.ink : C.wash };

  if (kicker) {
    slide.addText(kicker.toUpperCase(), {
      x: 0.7, y: 0.42, w: 9, h: 0.3, fontFace: FONT, fontSize: 11, bold: true,
      color: dark ? C.amber : C.amber, charSpacing: 2,
    });
  }
  if (title) {
    slide.addText(title, {
      x: 0.7, y: 0.72, w: 11.9, h: 0.72, fontFace: FONT, fontSize: 30, bold: true,
      color: dark ? C.paper : C.ink,
    });
  }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.7, y: H - 0.62, w: W - 1.4, h: 0.012, fill: { color: dark ? "1E293B" : C.line },
  });
  slide.addText("Production Control Tower", {
    x: 0.7, y: H - 0.55, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: dark ? C.muted : C.muted,
  });
  if (page) {
    slide.addText(String(page), {
      x: W - 1.3, y: H - 0.55, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 9,
      color: C.muted, align: "right",
    });
  }
}

/** A titled card with an optional accent stripe down the left edge. */
function card(slide, { x, y, w, h, fill = C.paper, stripe, title, titleColor = C.ink }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, fill: { color: fill }, line: { color: C.line, width: 0.75 },
    rectRadius: 0.06, shadow: { type: "outer", blur: 6, offset: 1, angle: 90, color: "94A3B8", opacity: 0.16 },
  });
  if (stripe) {
    slide.addShape(pptx.ShapeType.rect, {
      x, y: y + 0.1, w: 0.055, h: h - 0.2, fill: { color: stripe },
    });
  }
  if (title) {
    slide.addText(title, {
      x: x + 0.28, y: y + 0.16, w: w - 0.5, h: 0.34, fontFace: FONT, fontSize: 14, bold: true, color: titleColor,
    });
  }
}

/** Bullet list with control over per-bullet colour. */
function bullets(slide, items, opts) {
  slide.addText(
    items.map((t) => ({
      text: typeof t === "string" ? t : t.text,
      options: {
        bullet: { code: "25AA" },
        color: typeof t === "string" ? C.slate : (t.color ?? C.slate),
        bold: typeof t === "string" ? false : (t.bold ?? false),
        fontSize: opts.fontSize ?? 14,
        paraSpaceAfter: opts.gap ?? 8,
      },
    })),
    { x: opts.x, y: opts.y, w: opts.w, h: opts.h, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.15 },
  );
}

const shot = (name) => join(ASSETS, name);
function requireShots(names) {
  const missing = names.filter((n) => !existsSync(shot(n)));
  if (missing.length) {
    throw new Error(`Missing slide images: ${missing.join(", ")}\nRun scripts/crop-for-slides.ps1 first.`);
  }
}

// ---------------------------------------------------------------- 1. title

{
  const s = pptx.addSlide();
  s.background = { color: C.ink };

  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: C.amber } });

  s.addText("โปรเจกต์จบการศึกษา", {
    x: 1.1, y: 1.5, w: 10, h: 0.34, fontFace: FONT, fontSize: 13, bold: true,
    color: C.amber, charSpacing: 3,
  });
  s.addText("Production Control Tower", {
    x: 1.1, y: 1.95, w: 11, h: 1.05, fontFace: FONT, fontSize: 52, bold: true, color: C.paper,
  });
  s.addText("ระบบติดตามประสิทธิภาพการผลิต อุปกรณ์ และการบำรุงรักษา\nสำหรับโรงงานอุตสาหกรรมการผลิตแบบมีสายการผลิต", {
    x: 1.1, y: 3.1, w: 10.4, h: 0.95, fontFace: FONT, fontSize: 17, color: "CBD5E1", lineSpacingMultiple: 1.3,
  });

  const facts = [
    { k: "Next.js 15 + React 19", v: "TypeScript ทั้งหมด" },
    { k: "Supabase + RLS", v: "สิทธิ์บังคับที่ฐานข้อมูล" },
    { k: "37 unit tests", v: "+ 13 RLS assertions" },
  ];
  facts.forEach((f, i) => {
    const x = 1.1 + i * 3.55;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: 4.55, w: 3.25, h: 1.05, fill: { color: "1E293B" }, line: { color: "334155", width: 0.75 }, rectRadius: 0.06,
    });
    s.addText(f.k, { x: x + 0.22, y: 4.72, w: 2.9, h: 0.32, fontFace: FONT, fontSize: 13, bold: true, color: C.paper });
    s.addText(f.v, { x: x + 0.22, y: 5.05, w: 2.9, h: 0.32, fontFace: FONT, fontSize: 11, color: "94A3B8" });
  });

  s.addText("ชื่อ - นามสกุล  ·  รหัสนักศึกษา  ·  อาจารย์ที่ปรึกษา", {
    x: 1.1, y: 6.25, w: 10, h: 0.36, fontFace: FONT, fontSize: 13, color: "64748B",
  });
}

// ---------------------------------------------------------------- 2. problem

{
  const s = pptx.addSlide();
  frame(s, { kicker: "ปัญหา", title: "ทำไมต้องมีระบบนี้", page: 2 });

  card(s, { x: 0.7, y: 1.65, w: 5.9, h: 4.6, stripe: C.red, title: "สภาพเดิม — ข้อมูลกระจายเกินกว่าจะตัดสินใจได้" });
  bullets(s, [
    "ข้อมูล OEE อยู่ในไฟล์ Excel ของหัวหน้ากะ ต่างแผนกไม่เห็นชุดเดียวกัน",
    "เครื่องจักรหยุดแล้วไม่มีใครรู้ว่าเป็นเพราะอะไร หรือจะเสร็จเมื่อไหร่",
    "ประวัติการซ่อมอยู่ในกระดาษ ค้นย้อนหลังไม่ได้",
    "อะไหล่ขาดตอนงานด่วน เพราะไม่รู้ว่าของอะไรกำลังจะหมด",
    "ไม่มีใครรู้ว่าใครแก้อะไรไปแล้ว ทำให้แก้ข้อมูลชนกัน",
  ], { x: 1.0, y: 2.2, w: 5.3, h: 3.8, fontSize: 13 });

  card(s, { x: 6.85, y: 1.65, w: 5.75, h: 4.6, stripe: C.green, title: "สิ่งที่ต้องการ" });
  bullets(s, [
    { text: "เห็นภาพรวม OEE ของทุกสายในหน้าเดียว", bold: true },
    "บันทึกเหตุหยุดเครื่องพร้อมเหตุผลและผู้รับผิดชอบ",
    "วางแผนงานซ่อมได้ก่อนเครื่องพังจริง (งานตามรอบ)",
    "รู้สถานะอะไหล่ก่อนสั่งซื้อ",
    "ตรวจสอบย้อนหลังได้ว่าใครเปลี่ยนอะไร",
    "บทบาทชัดเจน คนละสิทธิ์กันจริง ไม่ใช่แค่ซ่อนปุ่ม",
  ], { x: 7.15, y: 2.2, w: 5.15, h: 3.8, fontSize: 13 });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.7, y: 6.42, w: 11.9, h: 0.52, fill: { color: C.amberSoft }, line: { color: C.amber, width: 0.75 }, rectRadius: 0.05,
  });
  s.addText([
    { text: "หัวใจของงาน:  ", options: { bold: true, color: C.amber } },
    { text: "ทุกอย่างต้องคำนวณจากข้อมูลจริงในฐานข้อมูล ไม่ใช่ค่าที่พิมพ์กรอกเอง", options: { color: C.slate } },
  ], { x: 0.95, y: 6.5, w: 11.4, h: 0.36, fontFace: FONT, fontSize: 13 });
}

// ---------------------------------------------------------------- 3. scope

{
  const s = pptx.addSlide();
  frame(s, { kicker: "ขอบเขต", title: "ระบบนี้ทำอะไรได้บ้าง", page: 3 });

  const mods = [
    { t: "แดชบอร์ด OEE", d: "สรุป A/P/Q แยกรายสาย พร้อมกราฟย้อนหลัง", c: C.sky, f: C.skySoft },
    { t: "ทรัพย์สิน", d: "ทะเบียนเครื่องจักร สถานะ ประวัติการซ่อม", c: C.violet, f: C.violetSoft },
    { t: "ใบงานบำรุง", d: "งานถูกต้อง งานตามรอบ งานสอบเทียบ", c: C.amber, f: C.amberSoft },
    { t: "หยุดเครื่อง", d: "บันทึกเหตุ แจ้งเตือน คำนวณ MTTR", c: C.red, f: C.redSoft },
    { t: "คลังอะไหล่", d: "จอง เบิก กันของติดลบ", c: C.green, f: C.greenSoft },
    { t: "รายงาน", d: "ส่งออก CSV ได้ทุกหน้า", c: C.sky, f: C.skySoft },
    { t: "บันทึกการกระทำ", d: "ประวัติทุกครั้งที่มีการแก้ไข", c: C.violet, f: C.violetSoft },
  ];

  mods.forEach((m, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.7 + col * 3.05;
    const y = 1.7 + row * 1.62;
    const w = i < 4 ? 2.85 : 2.85;
    card(s, { x, y, w, h: 1.42, fill: m.f, stripe: m.c });
    s.addText(m.t, { x: x + 0.26, y: y + 0.17, w: w - 0.45, h: 0.32, fontFace: FONT, fontSize: 13, bold: true, color: m.c });
    s.addText(m.d, { x: x + 0.26, y: y + 0.52, w: w - 0.45, h: 0.8, fontFace: FONT, fontSize: 10.5, color: C.slate, lineSpacingMultiple: 1.12 });
  });

  // 7th card sits alone on the second row; use the space for the totals.
  const x7 = 0.7 + 3 * 3.05;
  card(s, { x: x7, y: 3.32, w: 2.85, h: 1.42, fill: C.ink, stripe: C.amber });
  s.addText("ข้อมูลตัวอย่าง", { x: x7 + 0.26, y: 3.49, w: 2.4, h: 0.32, fontFace: FONT, fontSize: 13, bold: true, color: C.amber });
  s.addText("2 โรงงาน · 3 สาย\n10 เครื่อง · 8 ใบงาน\n8 อะไหล่ · 30 รอบการผลิต", {
    x: x7 + 0.26, y: 3.84, w: 2.4, h: 0.8, fontFace: FONT, fontSize: 10, color: "CBD5E1", lineSpacingMultiple: 1.2,
  });

  card(s, { x: 0.7, y: 4.98, w: 11.9, h: 1.45, fill: C.paper, stripe: C.ink, title: "สิ่งที่ระบบนี้ไม่ทำ — บอกไว้ตรง ๆ ไม่งอน" });
  bullets(s, [
    "ไม่ได้อ่านสัญญาณจาก PLC จริง เวลาหยุดเครื่องยังให้คนกรอกเอง",
    "ยังไม่ต่อกับ ERP หรือระบบสั่งซื้ออะไหล่ของโรงงาน",
    "ไม่ได้ทำหน้าจัดการผู้ใช้ (เพิ่มผู้ใช้ต้องเขียน SQL เอง)",
  ], { x: 1.0, y: 5.45, w: 11.3, h: 0.95, fontSize: 11.5, gap: 4 });
}

// ---------------------------------------------------------------- 4. dashboard

requireShots(["02-dashboard-admin.png", "14-dashboard-dark.png"]);

{
  const s = pptx.addSlide();
  frame(s, { kicker: "หน้าจอหลัก", title: "แดชบอร์ด — เห็นภาพรวมทั้งโรงงานในหน้าเดียว", page: 4 });

  s.addImage({ path: shot("02-dashboard-admin.png"), x: 0.7, y: 1.62, w: 8.15, h: 4.59 });
  s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.62, w: 8.15, h: 4.59, fill: { type: "none" }, line: { color: C.line, width: 1 } });

  card(s, { x: 9.05, y: 1.62, w: 3.55, h: 2.2, stripe: C.amber, title: "OEE รวมทุกสาย" });
  s.addText(`${STATS.total.oee}%`, { x: 9.3, y: 2.05, w: 3.05, h: 0.72, fontFace: FONT, fontSize: 42, bold: true, color: C.ink });
  s.addText(`ของดี ${STATS.total.good.toLocaleString("en-US")} ชิ้น  ·  ของเสีย ${STATS.total.scrap.toLocaleString("en-US")} ชิ้น`, {
    x: 9.3, y: 2.8, w: 3.05, h: 0.5, fontFace: FONT, fontSize: 11, color: C.muted, lineSpacingMultiple: 1.2,
  });
  s.addText(`Availability ${STATS.total.availability}%   ·   Quality ${STATS.total.quality}%`, {
    x: 9.3, y: 3.35, w: 3.05, h: 0.3, fontFace: FONT, fontSize: 10.5, color: C.slate,
  });

  card(s, { x: 9.05, y: 4.0, w: 3.55, h: 2.21, stripe: C.red, title: "จุดที่ระบบชี้ให้เห็น" });
  bullets(s, [
    { text: `${STATS.downtime.unclosed} เหตุหยุดเครื่องที่ยังไม่ปิด รวม ${STATS.downtime.minutes} นาที`, color: C.red },
    `${STATS.inventory.belowReorder} อะไหล่เหลือต่ำกว่าจุดสั่งซื้อ`,
    `MTTR ${STATS.maintenance.mttr} นาที  ·  งานตามรอบทำได้ ${STATS.maintenance.pmCompliance}%`,
  ], { x: 9.3, y: 4.45, w: 3.05, h: 1.6, fontSize: 11, gap: 6 });

  s.addText("ภาพหน้าจอจริงจากระบบ ผู้ใช้บทบาทผู้ดูแล", {
    x: 0.7, y: 6.32, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted,
  });
}

// ---------------------------------------------------------------- 5. OEE math

{
  const s = pptx.addSlide();
  frame(s, { kicker: "หัวใจของระบบ", title: "OEE คำนวณอย่างไร และได้เท่าไหร่จริง", page: 5 });

  const formulas = [
    { k: "Availability", f: "เวลาที่เครื่องเดินจริง ÷ เวลาที่วางแผนไว้", v: `${STATS.total.availability}%`, c: C.sky, f2: C.skySoft },
    { k: "Performance", f: "ผลผลิตตามทฤษฎี ÷ ผลผลิตจริง", v: "100.0%", c: C.violet, f2: C.violetSoft },
    { k: "Quality", f: "ของดี ÷ ของทั้งหมด", v: `${STATS.total.quality}%`, c: C.green, f2: C.greenSoft },
  ];
  formulas.forEach((m, i) => {
    const x = 0.7 + i * 4.03;
    card(s, { x, y: 1.62, w: 3.85, h: 1.72, fill: m.f2, stripe: m.c });
    s.addText(m.k, { x: x + 0.28, y: 1.78, w: 3.3, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: m.c });
    s.addText(m.f, { x: x + 0.28, y: 2.12, w: 3.3, h: 0.5, fontFace: FONT, fontSize: 11, color: C.slate, lineSpacingMultiple: 1.15 });
    s.addText(m.v, { x: x + 0.28, y: 2.62, w: 3.3, h: 0.58, fontFace: FONT, fontSize: 30, bold: true, color: C.ink });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.7, y: 3.52, w: 11.9, h: 0.5, fill: { color: C.ink }, rectRadius: 0.05,
  });
  s.addText([
    { text: "OEE = Availability × Performance × Quality = ", options: { color: "94A3B8" } },
    { text: `${STATS.total.oee}%`, options: { bold: true, color: C.amber, fontSize: 15 } },
    { text: "   ทั้งระบบ", options: { color: "94A3B8", fontSize: 12 } },
  ], { x: 0.95, y: 3.6, w: 11.4, h: 0.34, fontFace: FONT, fontSize: 13 });

  // per-line table
  const heads = ["สายการผลิต", "Availability", "Quality", "OEE", "เวลาที่หยุด"];
  const rows = [
    ...STATS.oeeByLine.map((r) => [
      { text: r.line, options: { align: "left" } },
      { text: `${r.availability}%`, options: { align: "right" } },
      { text: `${r.quality}%`, options: { align: "right" } },
      { text: `${r.oee}%`, options: { align: "right", bold: true, color: r.oee < 60 ? C.red : C.green } },
      { text: `${r.stop}%`, options: { align: "right" } },
    ]),
    [
      { text: "รวม", options: { align: "left", bold: true } },
      { text: `${STATS.total.availability}%`, options: { align: "right", bold: true } },
      { text: `${STATS.total.quality}%`, options: { align: "right", bold: true } },
      { text: `${STATS.total.oee}%`, options: { align: "right", bold: true, color: C.red } },
      { text: `${STATS.total.stop}%`, options: { align: "right", bold: true } },
    ],
  ];
  s.addTable(
    [
      heads.map((h) => ({ text: h, options: { fill: { color: C.ink }, color: C.paper, bold: true, fontSize: 11.5, align: "center" } })),
      ...rows.map((r, ri) =>
        r.map((c) => ({
          text: c.text,
          options: {
            ...c.options,
            fontSize: 12,
            color: c.options.color ?? C.slate,
            fill: { color: ri === rows.length - 1 ? "F1F5F9" : C.paper },
            border: { type: "solid", color: C.line, pt: 0.5 },
          },
        })),
      ),
    ],
    { x: 0.7, y: 4.22, w: 11.9, colW: [4.1, 2.0, 1.7, 1.7, 2.4], fontFace: FONT, rowH: 0.36, valign: "middle" },
  );

  s.addText("ตัวเลขทั้งหมดมาจากการรันคำสวณจริงบนชุดข้อมูลตัวอย่าง ไม่ได้เขียนขึ้นมือ", {
    x: 0.7, y: 6.55, w: 8.5, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted,
  });
}

// ---------------------------------------------------------------- 6. downtime

requireShots(["08-downtime.png"]);

{
  const s = pptx.addSlide();
  frame(s, { kicker: "กระบวนการ", title: "จัดการเหตุหยุดเครื่อง", page: 6 });

  s.addImage({ path: shot("08-downtime.png"), x: 0.7, y: 1.62, w: 7.4, h: 4.16 });
  s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.62, w: 7.4, h: 4.16, fill: { type: "none" }, line: { color: C.line, width: 1 } });

  card(s, { x: 8.35, y: 1.62, w: 4.25, h: 2.0, stripe: C.sky, title: "สถานะของเหตุหยุดเครื่อง" });
  const flow = [
    { t: "open", d: "พบเหตุ เครื่องหยุด", c: C.red },
    { t: "acknowledged", d: "มีคนรับทราบแล้ว แต่ยังไม่กลับมาทำงาน", c: C.amber },
    { t: "mitigated", d: "แก้แล้ว เครื่องกลับมาทำงาน", c: C.green },
  ];
  flow.forEach((f, i) => {
    const y = 2.12 + i * 0.46;
    s.addShape(pptx.ShapeType.roundRect, { x: 8.6, y, w: 1.32, h: 0.34, fill: { color: f.c }, rectRadius: 0.04 });
    s.addText(f.t, { x: 8.6, y: y + 0.03, w: 1.32, h: 0.28, fontFace: MONO, fontSize: 9, bold: true, color: C.paper, align: "center" });
    s.addText(f.d, { x: 10.02, y: y + 0.02, w: 2.5, h: 0.32, fontFace: FONT, fontSize: 9.5, color: C.slate });
  });

  card(s, { x: 8.35, y: 3.78, w: 4.25, h: 2.0, stripe: C.ink, title: "ตัวเลขจากข้อมูลจริง" });
  s.addText([
    { text: `${STATS.downtime.open} เหตุ `, options: { color: C.red, bold: true } },
    { text: "ยังไม่มีใครรับทราบ   ", options: { color: C.slate } },
    { text: `${STATS.downtime.acknowledged} เหตุ `, options: { color: C.amber, bold: true } },
    { text: "รับทราบแล้ว\n", options: { color: C.slate } },
    { text: `${STATS.downtime.mitigated} เหตุ `, options: { color: C.green, bold: true } },
    { text: "ปิดเรียบร้อย  ·  รวม ", options: { color: C.slate } },
    { text: `${STATS.downtime.minutes} นาที`, options: { color: C.ink, bold: true } },
  ], { x: 8.62, y: 4.24, w: 3.75, h: 1.0, fontFace: FONT, fontSize: 12, lineSpacingMultiple: 1.35 });

  s.addText(`MTTR เฉลี่ย ${STATS.maintenance.mttr} นาที`, {
    x: 8.62, y: 5.28, w: 3.75, h: 0.32, fontFace: FONT, fontSize: 12, bold: true, color: C.ink,
  });

  s.addText("ระบบไม่ปิดเหตุให้อัตโนมัติ — ต้องมีคนยืนยันว่าเครื่องกลับมาทำงานจริง", {
    x: 0.7, y: 6.0, w: 7.4, h: 0.3, fontFace: FONT, fontSize: 10.5, color: C.muted,
  });
}

// ---------------------------------------------------------------- 7. parts

requireShots(["09-parts.png"]);

{
  const s = pptx.addSlide();
  frame(s, { kicker: "กระบวนการ", title: "อะไหล่ — กันงานค้างเพราะของขาด", page: 7 });

  s.addImage({ path: shot("09-parts.png"), x: 0.7, y: 1.62, w: 7.4, h: 4.16 });
  s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.62, w: 7.4, h: 4.16, fill: { type: "none" }, line: { color: C.line, width: 1 } });

  card(s, { x: 8.35, y: 1.62, w: 4.25, h: 2.28, stripe: C.green, title: "กฎที่ระบบบังคับ" });
  bullets(s, [
    "ของที่จองไว้แล้วห้ามเบิกเกิน",
    "ห้ามเบิกจนเหลือน้อยกว่าจุดสั่งซื้อ",
    "เบิกไม่ได้ถ้าของหมด — ต้องสั่งซื้อก่อน",
    "ทุกครั้งที่เบิก ต้องผูกกับใบงาน",
  ], { x: 8.62, y: 2.05, w: 3.75, h: 1.7, fontSize: 11.5, gap: 7 });

  card(s, { x: 8.35, y: 4.06, w: 4.25, h: 1.72, stripe: C.amber, title: "สถานะคลัง" });
  const kv = [
    { k: "ต่ำกว่าจุดสั่งซื้อ", v: `${STATS.inventory.belowReorder} / ${STATS.inventory.total} รายการ`, c: C.red },
    { k: "มูลค่าของคงคลัง", v: `${STATS.inventory.value.toLocaleString("en-US")} บาท`, c: C.ink },
  ];
  kv.forEach((r, i) => {
    const y = 4.52 + i * 0.56;
    s.addText(r.k, { x: 8.62, y, w: 2.0, h: 0.3, fontFace: FONT, fontSize: 11, color: C.muted });
    s.addText(r.v, { x: 10.3, y, w: 2.05, h: 0.3, fontFace: FONT, fontSize: 11.5, bold: true, color: r.c, align: "right" });
  });

  s.addText(`ใบงาน ${STATS.maintenance.corrective} ใบรอซ่อม  ·  งานตามรอบ ${STATS.maintenance.preventive} ใบ  ·  งานสอบเทียบ ${STATS.maintenance.calibration} ใบ`, {
    x: 0.7, y: 6.0, w: 7.4, h: 0.3, fontFace: FONT, fontSize: 10.5, color: C.muted,
  });
}

// ---------------------------------------------------------------- 8. screens

requireShots([
  "01-login.png", "04-assets.png", "05-asset-detail.png", "06-work-orders.png",
  "07-work-order-detail.png", "10-reports.png", "11-activity.png", "13-work-orders-planner.png",
]);

{
  const s = pptx.addSlide();
  frame(s, { kicker: "หน้าจอทั้งหมด", title: "ระบบมี 12 หน้า ผ่านการทดสอบทุกหน้า", page: 8 });

  const grid = [
    ["01-login.png", "หน้าเข้าสู่ระบบ"],
    ["04-assets.png", "ทะเบียนเครื่องจักร"],
    ["05-asset-detail.png", "รายละเอียดเครื่อง"],
    ["06-work-orders.png", "ใบงานบำรุง"],
    ["07-work-order-detail.png", "รายละเอียดใบงาน"],
    ["10-reports.png", "รายงานและส่งออก CSV"],
    ["11-activity.png", "ประวัติการแก้ไข"],
    ["13-work-orders-planner.png", "มุมมองผู้วางแผน"],
  ];
  const cw = 2.86;
  const ch = 1.87;
  grid.forEach(([file, label], i) => {
    const x = 0.7 + (i % 4) * 3.05;
    const y = 1.62 + Math.floor(i / 4) * 2.06;
    s.addImage({ path: shot(file), x, y, w: cw, h: ch * (cw / (cw * 1.6)) });
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: cw, h: cw / 1.6, fill: { type: "none" }, line: { color: C.line, width: 0.75 },
    });
    s.addText(label, { x, y: y + cw / 1.6 + 0.06, w: cw, h: 0.26, fontFace: FONT, fontSize: 10, color: C.slate, align: "center" });
  });

  s.addText("มีอีก: แดชบอร์ดผู้ดูแล · แดชบอร์ดวิศวกร · แดชบอร์ดผู้วางแผน · โหมดมืด · มุมมองมือถือ", {
    x: 0.7, y: 5.85, w: 11.9, h: 0.32, fontFace: FONT, fontSize: 11, color: C.muted, align: "center",
  });
}

// ---------------------------------------------------------------- 9. architecture

{
  const s = pptx.addSlide();
  frame(s, { kicker: "การออกแบบ", title: "ข้อมูลเดินทางอย่างไร", page: 9 });

  const layers = [
    { t: "ชั้นแสดงผล", d: "React + Next.js  ·  12 หน้า  ·  Tailwind + Recharts", c: C.sky, f: C.skySoft },
    { t: "ชั้นตรรกะ", d: "สูตร OEE · กติกาเปลี่ยนสถานะ · ตารางสิทธิ์ตามบทบาท", c: C.violet, f: C.violetSoft },
    { t: "ชั้นข้อมูล", d: "Supabase (PostgreSQL)  ·  11 ตาราง  ·  25 สิทธิ์ระดับแถว  ·  15 trigger", c: C.green, f: C.greenSoft },
  ];
  layers.forEach((l, i) => {
    const y = 1.65 + i * 1.12;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.7, y, w: 7.6, h: 0.95, fill: { color: l.f }, line: { color: l.c, width: 1 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, { x: 0.7, y: y + 0.12, w: 0.06, h: 0.71, fill: { color: l.c } });
    s.addText(l.t, { x: 0.98, y: y + 0.14, w: 2.1, h: 0.32, fontFace: FONT, fontSize: 13, bold: true, color: l.c });
    s.addText(l.d, { x: 0.98, y: y + 0.48, w: 6.4, h: 0.34, fontFace: FONT, fontSize: 11, color: C.slate });
    if (i < 2) {
      s.addShape(pptx.ShapeType.downArrow, { x: 4.35, y: y + 0.97, w: 0.3, h: 0.14, fill: { color: C.muted } });
    }
  });

  card(s, { x: 8.55, y: 1.65, w: 4.05, h: 2.0, stripe: C.amber, title: "ทำงานได้แม้ไม่มีเซิร์ฟเวอร์" });
  bullets(s, [
    "ถ้ายังไม่ได้ต่อฐานข้อมูล ระบบจะใช้ชุดข้อมูลตัวอย่างในเครื่อง",
    "เหมาะกับการสาธิตและทดสอบหน้าจอโดยไม่ต้องตั้งค่าอะไร",
  ], { x: 8.82, y: 2.08, w: 3.5, h: 1.5, fontSize: 11, gap: 6 });

  card(s, { x: 8.55, y: 3.81, w: 4.05, h: 2.42, stripe: C.ink, title: "การเขียนข้อมูล" });
  bullets(s, [
    { text: "หน้าจออัปเดตทันที ไม่ต้องรอเครือข่าย", bold: true },
    "ถ้าฐานข้อมูลปฏิเสธ ระบบย้อนกลับหน้าจอให้ตรงเดิม",
    "บันทึกรหัสอุปกรณ์เป็นรหัสธุรกิจ ไม่ใช่ UUID",
  ], { x: 8.82, y: 4.24, w: 3.5, h: 1.9, fontSize: 11, gap: 6 });
}

// ---------------------------------------------------------------- 10. RLS

{
  const s = pptx.addSlide();
  frame(s, { kicker: "ความปลอดภัย", title: "สิทธิ์บังคับที่ฐานข้อมูล ไม่ใช่แค่ซ่อนปุ่ม", page: 10 });

  s.addText("ตัวอย่างที่ทดสอบแล้ว — ผู้ใช้ที่พิสูจน์ตัวตนแล้วแต่ส่งคำขอที่ไม่มีสิทธิ์ ฐานข้อมูลปฏิเสธเอง", {
    x: 0.7, y: 1.58, w: 11.9, h: 0.32, fontFace: FONT, fontSize: 12, color: C.muted,
  });

  const roles = [
    { t: "ผู้ดูแล", en: "admin", c: C.red, f: C.redSoft, can: ["ดูและแก้ข้อมูลทุกอย่าง", "จัดการผู้ใช้", "อ่านประวัติการแก้ไขทั้งหมด", "แก้หรือลบประวัติ — ไม่ได้"] },
    { t: "วิศวกร", en: "engineer", c: C.amber, f: C.amberSoft, can: ["แก้สถานะเครื่องจักร", "เปิดและปิดใบงานซ่อม", "บันทึกเหตุหยุดเครื่อง", "เพิ่มหรือแก้ข้อมูลอะไหล่ — ไม่ได้"] },
    { t: "ผู้วางแผน", en: "planner", c: C.sky, f: C.skySoft, can: ["ดูข้อมูลได้ทั้งหมด", "วางแผนงานตามรอบ", "เปิดงานซ่อมฉุกเฉิน — ไม่ได้", "แก้เครื่องจักร — ไม่ได้"] },
  ];
  roles.forEach((r, i) => {
    const x = 0.7 + i * 4.03;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: 2.05, w: 3.85, h: 3.5, fill: { color: r.f }, line: { color: r.c, width: 1 }, rectRadius: 0.06,
    });
    s.addText(r.t, { x: x + 0.28, y: 2.22, w: 2.4, h: 0.36, fontFace: FONT, fontSize: 17, bold: true, color: r.c });
    s.addText(r.en, { x: x + 0.28, y: 2.6, w: 3.3, h: 0.26, fontFace: MONO, fontSize: 10, color: C.muted });
    r.can.forEach((c, j) => {
      const denied = c.includes("ไม่ได้");
      s.addText(denied ? "✕" : "✓", {
        x: x + 0.28, y: 3.0 + j * 0.56, w: 0.28, h: 0.3, fontFace: FONT, fontSize: 13,
        bold: true, color: denied ? C.red : C.green, align: "center",
      });
      s.addText(c, {
        x: x + 0.62, y: 3.0 + j * 0.56, w: 3.0, h: 0.5, fontFace: FONT, fontSize: 11,
        color: denied ? C.red : C.slate, bold: denied,
      });
    });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.7, y: 5.75, w: 11.9, h: 0.9, fill: { color: C.ink }, rectRadius: 0.06,
  });
  s.addText([
    { text: "เจาะลึก:  ", options: { bold: true, color: C.amber } },
    { text: "ผู้ใช้ที่ยังไม่ล็อกอินจะได้สิทธิ์เท่าผู้วางแผน ไม่ใช่สิทธิ์สูงสุด — ถ้าตั้งค่าผิดจะเป็นการปิดทางเข้า ไม่ใช่เปิดกว้าง", options: { color: "CBD5E1" } },
  ], { x: 0.98, y: 5.92, w: 11.3, h: 0.6, fontFace: FONT, fontSize: 12, lineSpacingMultiple: 1.2 });
}

// ---------------------------------------------------------------- 11. bug 1

{
  const s = pptx.addSlide();
  frame(s, { kicker: "สิ่งที่พบระหว่างทำ", title: "บั๊กที่ 1 — โค้ดที่อ่านผ่าน แต่รันไม่ผ่าน", page: 11 });

  s.addText("ทั้งโปรเจกต์เขียนเสร็จ ทุกเทสต์ผ่าน แต่พอเอา SQL ไปรันกับฐานข้อมูลจริงกลับพังตั้งแต่บรรทัดแรก", {
    x: 0.7, y: 1.58, w: 11.9, h: 0.34, fontFace: FONT, fontSize: 13, bold: true, color: C.red,
  });

  card(s, { x: 0.7, y: 2.05, w: 5.85, h: 2.5, fill: "1E293B", stripe: C.red, title: "ก่อนแก้", titleColor: C.paper });
  s.addText([
    { text: "-- ฟังก์ชันอยู่ตรงนี้\n", options: { color: "94A3B8" } },
    { text: "create function authz.current_role()\n", options: { color: "E2E8F0" } },
    { text: "returns app_role as $$\n", options: { color: "E2E8F0" } },
    { text: "  select role from public.app_users\n", options: { color: "F87171" } },
    { text: "  where user_id = auth.uid();\n", options: { color: "F87171" } },
    { text: "$$ language sql;\n\n", options: { color: "E2E8F0" } },
    { text: "-- แต่ตาราง app_users ถูกสร้างทีหลัง", options: { color: "F87171" } },
  ], { x: 0.98, y: 2.55, w: 5.3, h: 1.9, fontFace: MONO, fontSize: 9.5, lineSpacingMultiple: 1.1 });

  card(s, { x: 6.75, y: 2.05, w: 5.85, h: 2.5, fill: "1E293B", stripe: C.green, title: "หลังแก้", titleColor: C.paper });
  s.addText([
    { text: "-- สร้างตารางก่อน\n", options: { color: "94A3B8" } },
    { text: "create table public.app_users (...);\n\n", options: { color: "E2E8F0" } },
    { text: "-- แล้วค่อยสร้างฟังก์ชัน\n", options: { color: "94A3B8" } },
    { text: "create function authz.current_role()\n", options: { color: "86EFAC" } },
    { text: "returns app_role as $$\n", options: { color: "86EFAC" } },
    { text: "  select role from public.app_users\n", options: { color: "86EFAC" } },
    { text: "  where user_id = auth.uid();\n", options: { color: "86EFAC" } },
    { text: "$$ language sql;", options: { color: "86EFAC" } },
  ], { x: 7.03, y: 2.55, w: 5.3, h: 1.9, fontFace: MONO, fontSize: 9.5, lineSpacingMultiple: 1.1 });

  card(s, { x: 0.7, y: 4.75, w: 11.9, h: 1.75, stripe: C.amber, title: "บอกได้ตรง ๆ ว่าเป็นบั๊กอะไร" });
  s.addText("PostgreSQL ตรวจการอ้างถึงตารางข้างในฟังก์ชันตอนสร้าง ไม่ใช่ตอนเรียกใช้ การอ่านโค้ดด้วยตาจะเห็นว่า “เฮ้ย อ้างถึงตารางที่ยังไม่มี” แต่ถ้าไม่เคยรันจริงก็จะไม่มีวันรู้ว่ามันพัง", {
    x: 0.98, y: 5.2, w: 11.3, h: 0.7, fontFace: FONT, fontSize: 12.5, color: C.slate, lineSpacingMultiple: 1.25,
  });
  s.addText("วิธีแก้ที่ถาวร: ให้เขียน schema ให้รันซ้ำได้ และมีชุดทดสอบที่รัน SQL จริงทุกครั้ง", {
    x: 0.98, y: 5.95, w: 11.3, h: 0.34, fontFace: FONT, fontSize: 12, bold: true, color: C.ink,
  });
}

// ---------------------------------------------------------------- 12. bugs 2 and 3

{
  const s = pptx.addSlide();
  frame(s, { kicker: "สิ่งที่พบระหว่างทำ", title: "บั๊กที่ 2 และ 3 — จุดที่อ่านโค้ดไม่ออก", page: 12 });

  card(s, { x: 0.7, y: 1.62, w: 5.85, h: 2.45, stripe: C.amber, title: "บั๊กที่ 2 — ตัวพิมพ์ใหญ่เล็กไม่ตรงกัน" });
  s.addText([
    { text: "trigger ได้ค่า ", options: { color: C.slate } },
    { text: "INSERT", options: { fontFace: MONO, bold: true, color: C.red } },
    { text: " (ตัวพิมพ์ใหญ่)\nแต่ชนิดข้อมูล enum เก็บเป็น ", options: { color: C.slate } },
    { text: "insert", options: { fontFace: MONO, bold: true, color: C.green } },
    { text: " (ตัวพิมพ์เล็ก)", options: { color: C.slate } },
  ], { x: 0.98, y: 2.1, w: 5.3, h: 0.8, fontFace: FONT, fontSize: 12, lineSpacingMultiple: 1.3 });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.98, y: 3.0, w: 5.3, h: 0.42, fill: { color: C.ink }, rectRadius: 0.04 });
  s.addText([
    { text: "ก่อน:  ", options: { color: "94A3B8" } },
    { text: "tg_op::trail_action", options: { fontFace: MONO, color: "F87171" } },
    { text: "        แก้:  ", options: { color: "94A3B8" } },
    { text: "lower(tg_op)::trail_action", options: { fontFace: MONO, color: "86EFAC" } },
  ], { x: 1.12, y: 3.08, w: 5.05, h: 0.28, fontFace: FONT, fontSize: 10 });

  card(s, { x: 6.75, y: 1.62, w: 5.85, h: 2.45, stripe: C.red, title: "บั๊กที่ 3 — ข้อมูลกับกฎทางธุรกิจขัดกันเอง" });
  s.addText([
    { text: "กฎเดิม: ถ้ายังไม่ปิดเหตุ ต้องมีเวลาสิ้นสุด\nแต่ข้อมูลจริงมีเหตุที่ ", options: { color: C.slate } },
    { text: "“รับทราบแล้ว เครื่องยังไม่กลับมา”", options: { bold: true, color: C.ink } },
    { text: " ซึ่งยังไม่จบจริง", options: { color: C.slate } },
  ], { x: 7.03, y: 2.1, w: 5.3, h: 0.85, fontFace: FONT, fontSize: 12, lineSpacingMultiple: 1.3 });
  s.addShape(pptx.ShapeType.roundRect, { x: 7.03, y: 3.0, w: 5.3, h: 0.85, fill: { color: C.greenSoft }, rectRadius: 0.04 });
  s.addText("แก้โดยบังคับเวลาสิ้นสุดเฉพาะสถานะที่เครื่องกลับมาทำงานแล้วเท่านั้น", {
    x: 7.17, y: 3.1, w: 5.0, h: 0.68, fontFace: FONT, fontSize: 10.5, color: C.green, lineSpacingMultiple: 1.2,
  });

  card(s, { x: 0.7, y: 4.28, w: 11.9, h: 2.2, fill: C.ink, stripe: C.amber, title: "บั๊กที่ 3 สำคัญที่สุด เพราะมันไม่ใช่บั๊กทางเทคนิค", titleColor: C.paper });
  s.addText("ตัวไหนผิด — SQL หรือข้อมูล — ขึ้นอยู่กับความหมายทางธุรกิจ ไม่ใช่ไวยากรณ์ ถ้าผมเดาเองแล้วแก้ผิดฝั่ง ระบบจะทำงานผิดแบบเงียบ ๆ ไม่มี error ให้เห็น", {
    x: 0.98, y: 4.75, w: 11.3, h: 0.6, fontFace: FONT, fontSize: 12.5, color: "CBD5E1", lineSpacingMultiple: 1.25,
  });
  s.addText("ผลที่ได้: ตอนนี้มีการทดสอบอัตโนมัติที่ยกคอนเทนเนอร์ฐานข้อมูลจริงขึ้นมารันทุกครั้ง บั๊กแบบนี้จะไม่หลุดออกไปได้อีก", {
    x: 0.98, y: 5.45, w: 11.3, h: 0.7, fontFace: FONT, fontSize: 12.5, bold: true, color: C.amber, lineSpacingMultiple: 1.25,
  });
}

// ---------------------------------------------------------------- 13. tests

{
  const s = pptx.addSlide();
  frame(s, { kicker: "การตรวจสอบ", title: "ทดสอบอะไรไปบ้าง และผ่านหมดหรือยัง", page: 13 });

  const results = [
    { k: "ตรวจชนิดข้อมูล", v: "ผ่าน", d: "ไม่มี error", ok: true },
    { k: "ตรวจกฎการเขียนโค้ด", v: "ผ่าน", d: "ไม่มี warning", ok: true },
    { k: "ทดสอบสูตรและกติกา", v: "37 / 37", d: "หน่วยทดสอบ", ok: true },
    { k: "สร้างไฟล์จริง", v: "ผ่าน", d: "12 หน้า", ok: true },
    { k: "รัน SQL กับฐานข้อมูลจริง", v: "ผ่าน", d: "PostgreSQL 16", ok: true },
    { k: "ทดสอบสิทธิ์ระดับแถว", v: "13 / 13", d: "RLS", ok: true },
    { k: "รันกับ Supabase จริง", v: "ยังไม่ได้", d: "รอการเชื่อมต่อ", ok: false },
    { k: "ทดสอบผู้ใช้หลายคนพร้อมกัน", v: "ยังไม่ได้", d: "ต้องมีคนจริง 2 คน", ok: false },
  ];
  results.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.7 + col * 6.05;
    const y = 1.68 + row * 0.72;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 5.85, h: 0.6, fill: { color: r.ok ? C.paper : C.amberSoft },
      line: { color: r.ok ? C.line : C.amber, width: 0.75 }, rectRadius: 0.05,
    });
    s.addText(r.ok ? "✓" : "—", {
      x: x + 0.2, y: y + 0.12, w: 0.35, h: 0.34, fontFace: FONT, fontSize: 15, bold: true,
      color: r.ok ? C.green : C.amber, align: "center",
    });
    s.addText(r.k, { x: x + 0.66, y: y + 0.15, w: 3.0, h: 0.3, fontFace: FONT, fontSize: 12, color: C.slate });
    s.addText(r.v, { x: x + 3.7, y: y + 0.14, w: 1.0, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: r.ok ? C.green : C.amber, align: "right" });
    s.addText(r.d, { x: x + 4.75, y: y + 0.17, w: 0.95, h: 0.28, fontFace: FONT, fontSize: 9, color: C.muted, align: "right" });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.7, y: 4.75, w: 11.9, h: 1.7, fill: { color: C.ink }, rectRadius: 0.06,
  });
  s.addText("คำสั่งเดียวที่ยืนยันได้ทั้งหมด", {
    x: 0.98, y: 4.95, w: 11.3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.amber,
  });
  s.addText("npm run db:test", {
    x: 0.98, y: 5.3, w: 5, h: 0.42, fontFace: MONO, fontSize: 18, bold: true, color: C.paper,
  });
  s.addText("ยกฐานข้อมูลจริงขึ้นมาใหม่ทุกครั้ง ใส่ข้อมูลตัวอย่าง แล้วทดสอบสิทธิ์ทีละบทบาท ใช้เวลาไม่ถึงหนึ่งนาที ปิดท้ายด้วยการลบคอนเทนเนอร์ทิ้ง ไม่มีอะไรค้างในเครื่อง", {
    x: 0.98, y: 5.78, w: 11.3, h: 0.6, fontFace: FONT, fontSize: 11.5, color: "94A3B8", lineSpacingMultiple: 1.2,
  });
}

// ---------------------------------------------------------------- 14. limits

{
  const s = pptx.addSlide();
  frame(s, { kicker: "ความซื่อสัตย์", title: "สิ่งที่ยังทำไม่ได้ และจะทำต่ออย่างไร", page: 14 });

  const limits = [
    { t: "ยังไม่ได้ต่อกับ Supabase จริง", d: "ทดสอบกับฐานข้อมูลจริงแล้ว แต่ยังใช้ตัวจำลองแทนส่วนที่ Supabase เพิ่มเข้ามา", next: "ต่อโปรเจกต์จริงแล้วรันซ้ำ", c: C.red },
    { t: "ยังไม่ได้ทดสอบหลายคนพร้อมกัน", d: "ระบบเขียนแบบเร็วที่สุดแล้วย้อนกลับเมื่อพัง ถ้าสองคนแก้ข้อมูลเดียวกัน คนหลังจะทับคนแรก", next: "ต้องทดสอบกับผู้ใช้จริง", c: C.amber },
    { t: "เวลายังกรอกเอง ไม่ได้มาจาก PLC", d: "ยังไม่ได้ต่อสัญญาณจริงผ่าน Modbus หรือ OPC UA", next: "ต่อกับ PLC เมื่อมีอุปกรณ์จริง", c: C.sky },
    { t: "เขียนข้อมูลเป็นรายคำสั่ง ไม่มีธุรกรรม", d: "ถ้าฐานข้อมูลปฏิเสธบางแถว ของที่เขียนไปแล้วจะไม่ถูกย้อนกลับ", next: "ใช้ฟังก์ชันที่ห่อธุรกรรมเดียว", c: C.violet },
    { t: "รหัสผ่านตัวอย่างเก็บเป็นข้อความธรรมดา", d: "เหมาะกับการสาธิตเท่านั้น", next: "ต้องลบตารางนี้ก่อนใช้จริง", c: C.red },
    { t: "ยังมีช่องโหว่ในไลบรารีที่ Next.js ดึงมา", d: "อยู่ในขั้นตอน build ไม่กระทบผู้ใช้ปลายทาง แต่ควรอัปเกรดเมื่อมีเวลา", next: "อัปเกรด Next.js เป็นเวอร์ชันใหม่", c: C.amber },
  ];

  limits.forEach((l, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.7 + col * 6.05;
    const y = 1.68 + row * 1.68;
    card(s, { x, y, w: 5.85, h: 1.52, stripe: l.c });
    s.addText(l.t, { x: x + 0.28, y: y + 0.14, w: 5.3, h: 0.3, fontFace: FONT, fontSize: 12.5, bold: true, color: C.ink });
    s.addText(l.d, { x: x + 0.28, y: y + 0.46, w: 5.3, h: 0.62, fontFace: FONT, fontSize: 10.5, color: C.slate, lineSpacingMultiple: 1.15 });
    s.addText([
      { text: "→ " , options: { color: l.c, bold: true } },
      { text: l.next, options: { color: l.c } },
    ], { x: x + 0.28, y: y + 1.12, w: 5.3, h: 0.28, fontFace: FONT, fontSize: 10.5, bold: true });
  });
}

// ---------------------------------------------------------------- 15. summary

requireShots(["03-dashboard-engineer.png", "14-dashboard-dark.png"]);

{
  const s = pptx.addSlide();
  s.background = { color: C.ink };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: C.amber } });

  s.addText("สรุป", {
    x: 1.05, y: 0.7, w: 6, h: 0.72, fontFace: FONT, fontSize: 34, bold: true, color: C.paper,
  });
  s.addText("ระบบทำงานได้จริง และตอนนี้ผมรู้แน่ชัดว่าอะไรยังไม่น่าเชื่อถือ", {
    x: 1.05, y: 1.5, w: 10.5, h: 0.4, fontFace: FONT, fontSize: 15, color: "94A3B8",
  });

  const points = [
    { k: "12 หน้า", d: "OEE เครื่องจักร ใบงาน หยุดเครื่อง อะไหล่ รายงาน และประวัติการแก้ไข" },
    { k: "3 บทบาท", d: "สิทธิ์บังคับที่ฐานข้อมูลจริง ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ" },
    { k: "50 เคสทดสอบ", d: "ทดสอบหน่วย 37 เคส และทดสอบสิทธิ์ 13 เคสกับฐานข้อมูลจริง" },
    { k: "3 บั๊กที่แก้แล้ว", d: "เจอเพราะรัน SQL จริง ไม่ใช่เพราะอ่านโค้ด" },
  ];
  points.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 1.05 + col * 5.55;
    const y = 2.25 + row * 1.12;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 5.25, h: 0.95, fill: { color: "1E293B" }, line: { color: "334155", width: 0.75 }, rectRadius: 0.06,
    });
    s.addText(p.k, { x: x + 0.26, y: y + 0.13, w: 4.8, h: 0.3, fontFace: FONT, fontSize: 14, bold: true, color: C.amber });
    s.addText(p.d, { x: x + 0.26, y: y + 0.47, w: 4.8, h: 0.4, fontFace: FONT, fontSize: 10.5, color: "CBD5E1", lineSpacingMultiple: 1.12 });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 1.05, y: 4.62, w: 10.8, h: 0.62, fill: { color: "1E293B" }, line: { color: C.amber, width: 1 }, rectRadius: 0.05,
  });
  s.addText("ขั้นต่อไปที่สำคัญที่สุด: เชื่อมฐานข้อมูลจริง แล้วรันชุดทดสอบเดิมซ้ำอีกครั้ง", {
    x: 1.3, y: 4.76, w: 10.3, h: 0.34, fontFace: FONT, fontSize: 13, bold: true, color: C.amber,
  });

  s.addText("ขอบคุณที่รับฟังครับ", {
    x: 1.05, y: 5.6, w: 6, h: 0.5, fontFace: FONT, fontSize: 22, bold: true, color: C.paper,
  });
  s.addText("ถามได้ทุกข้อ", { x: 1.05, y: 6.15, w: 6, h: 0.32, fontFace: FONT, fontSize: 12, color: "64748B" });

  s.addImage({ path: shot("14-dashboard-dark.png"), x: 7.75, y: 2.25, w: 4.1, h: 2.31, transparency: 8 });
  s.addShape(pptx.ShapeType.rect, { x: 7.75, y: 2.25, w: 4.1, h: 2.31, fill: { type: "none" }, line: { color: "334155", width: 1 } });
  s.addText("โหมดมืด", { x: 7.75, y: 4.62, w: 4.1, h: 0.28, fontFace: FONT, fontSize: 9.5, color: "64748B", align: "center" });
}

await pptx.writeFile({ fileName: OUT });
console.log(`Wrote ${OUT}`);
