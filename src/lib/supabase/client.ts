import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase wiring.
 *
 * The URL and anon key are optional. When either is missing the app runs on the
 * bundled demo dataset instead of failing, which is what lets a reviewer clone
 * the repo and see a working system with zero setup.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

export const isSupabaseConfigured: boolean = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

/** Returns a memoised client, or `null` when Supabase is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (cached) return cached;
  cached = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return cached;
}

export type DataSource = "supabase" | "demo";

export const dataSourceLabel: Readonly<Record<DataSource, string>> = {
  supabase: "เชื่อมต่อ Supabase จริง",
  demo: "ชุดข้อมูลตัวอย่าง (ออฟไลน์)",
};
