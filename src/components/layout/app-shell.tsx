"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

import { CommandBar } from "@/components/layout/command-bar";
import { MobileNav, NavRail, NAV_ITEMS } from "@/components/layout/nav-rail";
import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import type { Permission } from "@/lib/permissions";

/**
 * AppShell is the client-side route guard.
 *
 * The sign-in check runs in an effect rather than during render so that the
 * server always sends the same markup and React never warns about a conditional
 * hook order. While the session is still being read we show a neutral splash
 * instead of flashing the login screen at an authenticated operator.
 *
 * Pages declare the permission they need through `<RequirePermission>`. That is
 * a UX guard only - it keeps a planner out of the audit screen and explains why,
 * rather than showing an empty table. The security boundary is RLS in
 * PostgreSQL; a client-side check can always be bypassed.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, isReady, can } = useAuth();
  const { lastError } = usePlant();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isReady && !session) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [isReady, session, router, pathname]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-steel-50 dark:bg-ocean-950">
        <Loader2 className="h-6 w-6 animate-spin text-ocean-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-steel-50 text-sm text-steel-500 dark:bg-ocean-950">
        กำลังตรวจสอบสิทธิ์การเข้าใช้งาน…
      </div>
    );
  }

  // The audit trail is admin-only, so an engineer who types the URL gets an
  // explanation instead of a table the database would refuse to fill.
  const required = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )?.permission;

  const allowed = !required || can(required);

  return (
    <div className="flex min-h-screen">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* One sticky wrapper so the mobile tab strip sits directly under the
            command bar regardless of how many rows the bar wraps to. */}
        <div className="sticky top-0 z-30">
          <CommandBar />
          <MobileNav />
        </div>
        {lastError ? (
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-800 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
            {lastError}
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 lg:px-6">
          {allowed ? (
            children
          ) : (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-steel-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/5">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-50 text-signal-600 dark:bg-signal-500/10 dark:text-signal-400">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <h1 className="mt-4 text-lg font-semibold text-steel-900 dark:text-white">
                ไม่มีสิทธิ์เข้าถึงหน้านี้
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-steel-500">
                บทบาทของคุณไม่มีสิทธิ์ดูหน้าดังกล่าว หากคิดว่าเป็นความผิดพลาด
                ให้ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ที่เหมาะสม
              </p>
              <Link href="/dashboard" className="btn-primary mt-6">
                กลับไปศูนย์ควบคุม
              </Link>
            </div>
          )}
        </main>
        <footer className="border-t border-steel-200 px-6 py-4 text-[11px] text-steel-400 dark:border-white/10">
          Production Control Tower · ข้อมูลตัวอย่างสำหรับการสาธิตระบบเท่านั้น
        </footer>
      </div>
    </div>
  );
}

/**
 * Per-page permission gate. Wrap a page's content in this when the page needs
 * a permission the shell cannot infer from the route.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useAuth();
  if (can(permission)) return <>{children}</>;
  return null;
}
