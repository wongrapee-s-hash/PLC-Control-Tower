import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware class joiner. Later classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const TH_BE = "th-TH";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(TH_BE, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(TH_BE, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(TH_BE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** 0 -> "0 นาที", 95 -> "1 ชม. 35 น." */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 นาที";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} นาที`;
  if (m === 0) return `${h} ชม.`;
  return `${h} ชม. ${m} น.`;
}

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat(TH_BE).format(value);

export const formatPercent = (value: number, digits = 1): string =>
  `${value.toFixed(digits)}%`;

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat(TH_BE, {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);

/** Whole days between today and an ISO date. Negative means overdue. */
export function daysUntil(isoDate: string | null | undefined, today: string): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const base = new Date(`${today}T00:00:00`);
  const diff = target.getTime() - base.getTime();
  return Math.round(diff / 86_400_000);
}

export function dueLabel(isoDate: string | null | undefined, today: string): string {
  const days = daysUntil(isoDate, today);
  if (days === null) return "ไม่กำหนด";
  if (days < 0) return `เกินกำหนด ${Math.abs(days)} วัน`;
  if (days === 0) return "ครบกำหนดวันนี้";
  if (days <= 14) return `อีก ${days} วัน`;
  return `อีก ${days} วัน`;
}

/** CSV cell escaping. Always quotes, doubles internal quotes, keeps the BOM. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${body}`;
}

export function downloadCsv(filename: string, headers: readonly string[], rows: readonly (readonly unknown[])[]): void {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
