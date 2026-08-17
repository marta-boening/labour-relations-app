import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";

interface AuthState {
  configured: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  userId: string;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

// Ohne Supabase-Projekt läuft die App unverändert im bisherigen Einzelnutzer-Modus (fester
// Default, wie zuvor in index.js hartkodiert) — kein erzwungenes Login, kein Funktionsverlust.
const FALLBACK_USER_ID = "marta-boening";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(supabaseConfigured);

  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    configured: supabaseConfigured,
    loading,
    user: session?.user ?? null,
    session,
    userId: session?.user?.id ?? FALLBACK_USER_ID,
    async signInWithPassword(email, password) {
      if (!supabase) return { error: "Supabase ist nicht konfiguriert." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    async signUp(email, password) {
      if (!supabase) return { error: "Supabase ist nicht konfiguriert." };
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message };
    },
    async signOut() {
      if (!supabase) return;
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}
