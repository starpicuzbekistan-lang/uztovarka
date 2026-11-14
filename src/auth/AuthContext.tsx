import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

// Taklif / parolni tiklash havolasidan kelgan foydalanuvchi parol o‘rnatmaguncha ilovaga kira olmaydi.
const NEEDS_PW_KEY = 'uz_needs_password';
try {
  const t = new URLSearchParams(window.location.hash.slice(1)).get('type');
  if (t === 'invite' || t === 'recovery') sessionStorage.setItem(NEEDS_PW_KEY, '1');
} catch { /* ignore */ }

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  needsPassword: boolean;
  blockedMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markPasswordSet: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(() => sessionStorage.getItem(NEEDS_PW_KEY) === '1');
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    if (error) {
      console.error('Supabase profil so‘rovi xatosi:', error);
      setBlockedMessage(`Profilni yuklashda xatolik: ${error.message}`);
      setProfile(null);
      return;
    }
    const p = data as Profile | null;
    if (!p) {
      setBlockedMessage('Ushbu akkaunt uchun profil topilmadi. Administratorga murojaat qiling.');
      setProfile(null);
      return;
    }
    if (!p.is_active) {
      setBlockedMessage('Hisobingiz faol emas. Administratorga murojaat qiling.');
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setBlockedMessage(null);
    setProfile(p);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      sessionRef.current = data.session;
      setSession(data.session);
      await loadProfile(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      sessionRef.current = s;
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem(NEEDS_PW_KEY, '1');
        setNeedsPassword(true);
      }
      if (event === 'SIGNED_OUT') { setProfile(null); return; }
      // Supabase talabi: callback ichida to‘g‘ridan-to‘g‘ri await qilmaslik
      setTimeout(() => { void loadProfile(s); }, 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  // Administrator hisobni o‘chirsa, foydalanuvchi qaytib kelganda (fokus) tizimdan chiqariladi.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && sessionRef.current) void loadProfile(sessionRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadProfile]);

  const value = useMemo<AuthState>(() => ({
    session, profile, loading, needsPassword, blockedMessage,
    signIn: async (email, password) => {
      setBlockedMessage(null);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
    },
    signOut: async () => {
      sessionStorage.removeItem(NEEDS_PW_KEY);
      setNeedsPassword(false);
      await supabase.auth.signOut();
    },
    refreshProfile: () => loadProfile(sessionRef.current),
    markPasswordSet: () => { sessionStorage.removeItem(NEEDS_PW_KEY); setNeedsPassword(false); },
  }), [session, profile, loading, needsPassword, blockedMessage, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
