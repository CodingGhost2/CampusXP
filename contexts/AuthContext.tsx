import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getSupabase } from "@/utils/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initialized: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setInitialized(true);
      return;
    }

    let cancelled = false;

    client.auth
      .getSession()
      .then(({ data: { session: next } }) => {
        if (!cancelled) setSession(next);
      })
      .catch(() => {
        /* session restore failed; stay signed out */
      })
      .finally(() => {
        if (!cancelled) setInitialized(true);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabase();
    if (client) {
      await client.auth.signOut();
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      initialized,
      signOut,
    }),
    [session, initialized, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
