import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isPending: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: rawSession } }) => {
      setSession(rawSession);
      setIsPending(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, rawSession) => {
      setSession(rawSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, isPending }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
