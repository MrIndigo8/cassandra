'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { User as CassandraUser } from '@/types';

type AuthContextType = {
  user: SupabaseUser | null;
  profile: CassandraUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<CassandraUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Клиент теперь сам является синглтоном внутри `src/lib/supabase/client.ts`
  const [supabase] = useState(() => createClient());

  const fetchProfile = useCallback(async (userId: string) => {

    try {

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        

      if (error) throw error;
      setProfile(data as CassandraUser);
    } catch (err) {
      console.error('[Auth] fetchProfile Error:', err);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {


    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {

      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // ЗАПУСКАЕМ БЕЗ AWAIT! Если сделать await, это вызовет Deadlock внутри 
        // библиотеки GoTrue, так как listener держит лок сессии, а запрос Profile 
        // пытается получить токен и ждет освобождения лока.
        void fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {

      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useUser() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useUser должен использоваться внутри AuthProvider');
  }
  return context;
}
