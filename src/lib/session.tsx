import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get, post } from './api.ts';

export interface User { id: number; email: string; name: string; role: 'kitchen' | 'customer'; is_demo: boolean }
interface Ctx { user: User | null; ready: boolean; refresh: () => Promise<void>; setUser: (u: User | null) => void; signOut: () => Promise<void> }

const SessionCtx = createContext<Ctx>({ user: null, ready: false, refresh: async () => {}, setUser: () => {}, signOut: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await get<{ user: User | null }>('/api/auth/me');
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const signOut = useCallback(async () => {
    try {
      await post('/api/auth/logout', {});
    } finally {
      setUser(null);
    }
  }, []);
  return <SessionCtx.Provider value={{ user, ready, refresh, setUser, signOut }}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);
