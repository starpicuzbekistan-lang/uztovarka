import { useEffect } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { supabase } from '@/lib/supabase';

/** Operator qurilmada ilova ochiq/ko‘rinib turganda heartbeat yuboradi.
 * Bu ishga kelganlikni qayd etish tizimi emas: brauzer fon rejimida signal to‘xtashi mumkin.
 */
export default function OperatorPresenceTracker() {
  const { session, profile } = useAuth();
  useEffect(() => {
    if (!session || !profile || !profile.is_active || profile.role !== 'operator') return;
    let alive = true;
    const send = async (action: 'heartbeat' | 'away' | 'login' | 'logout') => {
      if (!alive && action !== 'away' && action !== 'logout') return;
      try { await supabase.rpc('record_operator_presence', { p_action: action }); }
      catch { /* Kuzatuv xatosi operator ishini to‘xtatmasin. */ }
    };
    const handleVisibility = () => { void send(document.visibilityState === 'visible' ? 'heartbeat' : 'away'); };
    const onPageHide = () => { void send('away'); };
    void send('heartbeat');
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void send('heartbeat');
    }, 30_000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [profile?.id, profile?.is_active, profile?.role, session?.user.id]);
  return null;
}
