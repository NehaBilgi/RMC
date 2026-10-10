import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type UserProfile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configurationMissing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      setProfile(null);
      throw error;
    }
    setProfile(data);
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) return null;
    return loadProfile(session.user.id);
  }, [loadProfile, session?.user.id]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const client = supabase;
    void client.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) console.error('Unable to restore Supabase session:', error.message);
      setSession(data.session);
      if (data.session?.user.id) {
        try {
          await loadProfile(data.session.user.id);
        } catch (profileError) {
          console.error('Unable to load the signed-in profile:', profileError);
        }
      } else {
        setProfile(null);
      }
      if (mounted) setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // Defer the profile query so it does not run inside the auth event callback.
      window.setTimeout(() => {
        if (!mounted) return;
        void loadProfile(nextSession.user.id)
          .catch((error) => console.error('Unable to load the signed-in profile:', error))
          .finally(() => mounted && setLoading(false));
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    configurationMissing: !isSupabaseConfigured,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    refreshProfile
  }), [session, profile, loading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
