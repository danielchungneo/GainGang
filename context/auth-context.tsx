import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isAppSession } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isPending: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function resolveSession(session: Session | null): Session | null {
  return isAppSession(session) ? session : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: rawSession } }) => {
      if (rawSession && !isAppSession(rawSession)) {
        await supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(resolveSession(rawSession));
      }
      setIsPending(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, rawSession) => {
        if (rawSession && !isAppSession(rawSession)) {
          await supabase.auth.signOut();
          setSession(null);
          return;
        }
        setSession(resolveSession(rawSession));
      },
    );

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
