"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Factory, Gauge, KeyRound, Mail, ShieldCheck } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { usePlant } from "@/context/plant-context";
import { dataSourceLabel, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/format";
import { ROLE_BLURB, ROLE_LABELS, ROLE_TONE } from "@/lib/permissions";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-steel-50 dark:bg-ocean-950" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { signIn, principals } = useAuth();
  const { source, today } = usePlant();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectTo = params.get("from") ?? "/dashboard";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const result = await signIn(email, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace(redirectTo);
  };

  const quickFill = (principalEmail: string, principalPassword: string) => {
    setEmail(principalEmail);
    setPassword(principalPassword);
    setError(null);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ---- Brand column ---- */}
      <section className="relative hidden overflow-hidden bg-ocean-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-white/20">
            <Factory className="h-4 w-4" />
            Production Control Tower
          </span>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            เห็นทั้งโรงงาน<br />
            ในหน้าจอเดียว
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ocean-100/90">
            ติดตาม OEE รายสาย เวลาหยุดเครื่อง และสถานะใบงานซ่อมบำรุง
            ตั้งแต่เปิดใบงานจนตรวจรับงาน พร้อมเชื่อมกับคลังอะไหล่และบันทึกกิจกรรมทุกขั้นตอน
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-4">
            {[
              { label: "OEE", hint: "คำนวณจากเวลาทำงานจริง" },
              { label: "MTBF", hint: "อายุเครื่องก่อนพัง" },
              { label: "PM Compliance", hint: "ตรงตามกำหนดร้อยละ" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
                <dt className="text-sm font-semibold">{item.label}</dt>
                <dd className="mt-0.5 text-[11px] text-ocean-200/80">{item.hint}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative font-mono text-[11px] text-ocean-300/70">
          Next.js 15 · TypeScript · Supabase PostgreSQL · Tailwind CSS
        </p>
      </section>

      {/* ---- Form column ---- */}
      <section className="flex items-center justify-center bg-steel-50 px-5 py-10 dark:bg-ocean-950">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-600 text-white">
              <Factory className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-steel-900 dark:text-white">Production Control Tower</p>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-steel-900 dark:text-white">
            เข้าสู่ระบบ
          </h2>
          <p className="mt-1.5 text-sm text-steel-500">
            {isSupabaseConfigured
              ? "เข้าสู่ระบบด้วยบัญชีที่ลงทะเบียนไว้กับระบบ"
              : "ใช้บัญชีทดลองด้านล่างเพื่อดูสิทธิ์ของแต่ละบทบาท"}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <div>
              <label className="field-label" htmlFor="email">
                อีเมลผู้ใช้
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@factory.th"
                  className="field pl-9"
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="password">
                รหัสผ่าน
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field pl-9"
                />
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">
              เข้าสู่ระบบ
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/*
            The demo shortcut exposes the bundled passwords, so it is only shown
            when there is no Supabase project to sign in against.
          */}
          {!isSupabaseConfigured ? (
            <div className="mt-8">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-steel-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                บัญชีสาธิตระบบ
              </p>
              <ul className="space-y-2">
                {principals.map((principal) => (
                  <li key={principal.email}>
                    <button
                      type="button"
                      onClick={() => quickFill(principal.email, principal.password)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border border-steel-200 bg-white px-3.5 py-3 text-left transition-colors",
                        "hover:border-ocean-300 hover:bg-ocean-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                      )}
                    >
                      <span className={cn("chip shrink-0", ROLE_TONE[principal.role])}>
                        {ROLE_LABELS[principal.role]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-steel-800 dark:text-steel-100">
                          {principal.email}
                        </span>
                        <span className="block truncate text-[11px] text-steel-500">
                          {ROLE_BLURB[principal.role]}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-steel-400">
                        {principal.password}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-steel-400">
            <span className="inline-flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {dataSourceLabel[source]}
            </span>
            <span>·</span>
            <span className="font-mono">ข้อมูล ณ {today}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
