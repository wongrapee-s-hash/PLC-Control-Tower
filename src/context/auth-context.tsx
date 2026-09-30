"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { DEMO_PRINCIPALS } from "@/data/demo-dataset";
import { can, type Permission } from "@/lib/permissions";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { APP_ROLES, type AppRole, type Principal } from "@/types/domain";

/**
 * Credential gate.
 *
 * Two modes, chosen by whether Supabase is configured:
 *
 *  * Supabase configured -> `signInWithPassword`. The role is then read from
 *    `app_users`, so the value the UI checks is the same one the RLS policies
 *    see, and `auth.uid()` is populated so writes pass the policies.
 *  * Supabase not configured -> the bundled `demo_principals` list, so a
 *    reviewer can clone the repo and sign in with no account setup.
 *
 * Either way the session has the same shape, every screen asks `can()` for
 * permission, and the permission matrix mirrors the RLS roles.
 */

export interface Session {
  email: string;
  displayName: string;
  role: AppRole;
  signedInAt: string;
}

interface AuthValue {
  session: Session | null;
  principals: readonly Principal[];
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
  can: (permission: Permission) => boolean;
  isReady: boolean;
}

const STORAGE_KEY = "pct.session.v1";

const AuthContext = createContext<AuthValue | null>(null);

/**
 * A stored session is untrusted input: it lives in `sessionStorage`, which any
 * script on the page could edit. Validate the shape and check the role against
 * the real role list before trusting it, so a hand-edited role cannot grant
 * permissions the UI would then act on.
 */
function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (isSupabaseConfigured) {
    // With Supabase Auth the token is the source of truth; the provider
    // rehydrates the session from it, so ignore the cached copy.
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<Session>;
    if (typeof candidate.email !== "string") return null;
    if (typeof candidate.displayName !== "string") return null;
    if (typeof candidate.signedInAt !== "string") return null;
    if (!APP_ROLES.includes(candidate.role as AppRole)) return null;
    return {
      email: candidate.email,
      displayName: candidate.displayName,
      role: candidate.role as AppRole,
      signedInAt: candidate.signedInAt,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Hydrate after mount so server and client markup agree on the first paint.
  useEffect(() => {
    if (isSupabaseConfigured) {
      const supabase = getSupabase();
      if (!supabase) {
        setIsReady(true);
        return;
      }
      // Rehydrate from the Supabase token rather than from cached storage.
      void supabase.auth
        .getSession()
        .then(async ({ data }) => {
          const user = data.session?.user;
          if (!user?.email) {
            setSession(null);
            return;
          }
          const { data: profile } = await supabase
            .from("app_users")
            .select("email, display_name, role")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!profile || !APP_ROLES.includes(profile.role as AppRole)) {
            setSession(null);
            return;
          }
          setSession({
            email: profile.email,
            displayName: profile.display_name,
            role: profile.role as AppRole,
            signedInAt: new Date().toISOString(),
          });
        })
        .finally(() => setIsReady(true));
      return;
    }
    setSession(readStoredSession());
    setIsReady(true);
  }, []);

  const signIn = useCallback<AuthValue["signIn"]>(async (email, password) => {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
      }

      // RLS derives the role from `app_users`; read the same row so the buttons
      // the user sees and the rows they can write always agree.
      const { data: profile } = await supabase
        .from("app_users")
        .select("email, display_name, role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.auth.signOut();
        return { ok: false, error: "บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งาน" };
      }

      const next: Session = {
        email: profile.email,
        displayName: profile.display_name,
        role: profile.role as AppRole,
        signedInAt: new Date().toISOString(),
      };
      setSession(next);
      return { ok: true };
    }

    // Demo mode: no server, so validate against the bundled principal list.
    const principal = DEMO_PRINCIPALS.find(
      (p) => p.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!principal) {
      return { ok: false, error: "ไม่พบบัญชีนี้ในระบบ" };
    }
    if (principal.password !== password) {
      return { ok: false, error: "รหัสผ่านไม่ถูกต้อง" };
    }
    const next: Session = {
      email: principal.email,
      displayName: principal.display_name,
      role: principal.role,
      signedInAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    void getSupabase()?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      principals: DEMO_PRINCIPALS,
      signIn,
      signOut,
      can: (permission) => (session ? can(session.role, permission) : false),
      isReady,
    }),
    [session, signIn, signOut, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
