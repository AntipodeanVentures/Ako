import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { env } from '@/src/lib/env';
import { getSupabase } from '@/src/lib/supabase';

import { confirmRedirect } from './redirects';

type SignUpParams = {
  email: string;
  password: string;
  displayName: string;
};

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signUp: (params: SignUpParams) => Promise<{ needsConfirmation: boolean }>;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = env.isSupabaseConfigured;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, [configured]);

  const signUp = async ({ email, password, displayName }: SignUpParams) => {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo: confirmRedirect() },
    });
    if (error) throw error;
    // When email confirmation is enabled, no session is returned until the
    // user confirms via the emailed link.
    return { needsConfirmation: data.session === null };
  };

  const signIn = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!configured) return;
    await getSupabase().auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, loading, configured, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
