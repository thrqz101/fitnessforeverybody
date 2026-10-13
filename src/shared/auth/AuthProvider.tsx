"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/shared/supabase/browser";

export type AuthStatus = "disabled" | "loading" | "signed_out" | "signed_in";
type AuthState = {
  status: AuthStatus;
  user: User | null;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  /** Default 'local' signs out this device only; 'global' also revokes every other session. */
  signOut: (scope?: "local" | "global") => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [status, setStatus] = useState<AuthStatus>(supabase ? "loading" : "disabled");
  const [user, setUser] = useState<User | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // Fires INITIAL_SESSION on subscribe, which restores the session from cookies.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session ? "signed_in" : "signed_out");
      if (session) setLoginOpen(false);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async (scope: "local" | "global" = "local") => {
    await supabase?.auth.signOut({ scope });
  }, [supabase]);

  const value = useMemo<AuthState>(() => ({
    status, user, loginOpen,
    openLogin: () => setLoginOpen(true),
    closeLogin: () => setLoginOpen(false),
    signOut
  }), [status, user, loginOpen, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
