"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database, LogOut, Moon, RefreshCcw, Sun } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { useTheme } from "@/context/theme-context";
import { dataSourceLabel } from "@/lib/supabase/client";
import { cn, formatTime } from "@/lib/format";
import { ROLE_LABELS, ROLE_TONE } from "@/lib/permissions";

export function CommandBar() {
  const { session, signOut } = useAuth();
  const { source, resetDemo, today } = usePlant();
  const { theme, toggle } = useTheme();
  const router = useRouter();

  if (!session) return null;

  const onSignOut = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <header className="border-b border-steel-200 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-ocean-950/85">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean-600 text-white">
            <Database className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-steel-900 dark:text-white">Control Tower</span>
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset sm:inline-flex",
              source === "supabase"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30"
                : "bg-signal-50 text-signal-700 ring-signal-200 dark:bg-signal-500/10 dark:text-signal-300 dark:ring-signal-400/30",
            )}
            title={
              source === "supabase"
                ? "อ่านและเขียนข้อมูลกับ PostgreSQL จริง"
                : "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL จึงใช้ชุดข้อมูลตัวอย่าง"
            }
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", source === "supabase" ? "bg-emerald-500" : "bg-signal-500")} />
            {dataSourceLabel[source]}
          </span>

          <span className="hidden font-mono text-xs text-steel-500 md:inline">
            ข้อมูล ณ {today} · {formatTime(session.signedInAt)}
          </span>

          {source === "demo" ? (
            <button type="button" onClick={resetDemo} className="btn-ghost !px-2.5 !py-1.5" title="คืนค่าชุดข้อมูลตัวอย่าง">
              <RefreshCcw className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={toggle}
            className="btn-ghost !px-2.5 !py-1.5"
            aria-label={theme === "light" ? "เปลี่ยนเป็นโหมดมืด" : "เปลี่ยนเป็นโหมดสว่าง"}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <div className="flex items-center gap-2 border-l border-steel-200 pl-3 dark:border-white/10">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium leading-tight text-steel-800 dark:text-steel-100">
                {session.displayName}
              </p>
              <p className="text-[11px] leading-tight text-steel-500">{session.email}</p>
            </div>
            <span className={cn("chip !px-2.5 !py-1", ROLE_TONE[session.role])}>
              {ROLE_LABELS[session.role]}
            </span>
            <button type="button" onClick={onSignOut} className="btn-ghost !px-2.5 !py-1.5" title="ออกจากระบบ">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
