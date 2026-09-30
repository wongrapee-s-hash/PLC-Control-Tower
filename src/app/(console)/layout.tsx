import { AppShell } from "@/components/layout/app-shell";

/**
 * Route group `(console)`.
 *
 * The parenthesised name keeps the URL clean (`/dashboard`, not `/(console)/dashboard`)
 * while letting every signed-in screen share one authenticated shell.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
