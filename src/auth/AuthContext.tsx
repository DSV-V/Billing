import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Role } from '../lib/types';

interface AuthValue {
  ready: boolean;          // проверка сессии завершена
  signedIn: boolean;       // есть сессия Supabase Auth
  role: Role | null;       // null: нет записи в users или пользователь неактивен
  userId: number | null;   // users.id текущего пользователя
  recovery: boolean;       // пользователь пришёл по ссылке сброса пароля
  clearRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [recovery, setRecovery] = useState(false);

  // Связываем аккаунт Auth с users и читаем роль. Вызывается после входа.
  async function loadIdentity() {
    await supabase.rpc('link_auth_user');
    const r = await supabase.rpc('current_app_role');
    const u = await supabase.rpc('current_app_user_id');
    setRole((r.data as Role | null) ?? null);
    setUserId((u.data as number | null) ?? null);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      const has = !!session;
      setSignedIn(has);
      if (has) {
        // Вызовы Supabase внутри колбэка onAuthStateChange откладываем, иначе возможна блокировка.
        setTimeout(() => {
          loadIdentity().finally(() => setReady(true));
        }, 0);
      } else {
        setRole(null);
        setUserId(null);
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value: AuthValue = {
    ready,
    signedIn,
    role,
    userId,
    recovery,
    clearRecovery: () => setRecovery(false),
    signOut,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth вне AuthProvider');
  return v;
}
