import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Bell, House, Package, UserRound, Wallet, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Logo } from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';

// Aynan beshta asosiy bo‘lim.
const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; match: RegExp }[] = [
  { to: '/', label: 'Bosh sahifa', icon: House, end: true, match: /^\/($|maqola)/ },
  { to: '/oylik', label: 'Oylik to‘lov', icon: Wallet, match: /^\/oylik/ },
  { to: '/mahsulotlar', label: 'Mahsulotlar', icon: Package, match: /^\/(mahsulotlar|naborlar)/ },
  { to: '/skriptlar', label: 'Skriptlar', icon: BookOpen, match: /^\/skriptlar/ },
  { to: '/profil', label: 'Profil', icon: UserRound, match: /^\/profil/ },
];

export function useUnreadCount() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['notif-unread', profile?.id],
    enabled: !!profile,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
      return count ?? 0;
    },
  });
}

export function OperatorLayout() {
  const { data: unread = 0 } = useUnreadCount();
  const { pathname } = useLocation();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-surface md:pl-64">
      {/* Desktop yon panel */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-neutral-200 bg-white p-4 md:flex">
        <Link to="/" className="mb-6 px-2 pt-2"><Logo /></Link>
        <nav className="flex flex-col gap-1" aria-label="Asosiy menyu">
          {NAV.map(({ to, label, icon: Icon, end, match }) => (
            <NavLink key={to} to={to} end={end}
              className={clsx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                match.test(pathname) ? 'bg-brand text-ink' : 'text-neutral-600 hover:bg-neutral-100')}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-neutral-400">{profile?.full_name}</p>
      </aside>

      {/* Sarlavha */}
      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/90 backdrop-blur safe-top">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="md:hidden"><Logo /></Link>
          <span className="hidden md:block" />
          <Link to="/bildirishnomalar" aria-label={`Bildirishnomalar${unread ? `, ${unread} ta o‘qilmagan` : ''}`}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-neutral-100">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-ink">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 md:pb-10">
        <Outlet />
      </main>

      {/* Mobil pastki navigatsiya */}
      <nav aria-label="Asosiy menyu" className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white md:hidden safe-bottom">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end, match }) => {
            const active = match.test(pathname);
            return (
              <li key={to}>
                <NavLink to={to} end={end} className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 px-1">
                  <span className={clsx('flex h-7 w-12 items-center justify-center rounded-full transition-colors', active ? 'bg-brand' : '')}>
                    <Icon className={clsx('h-5 w-5', active ? 'text-ink' : 'text-neutral-500')} strokeWidth={active ? 2.4 : 2} />
                  </span>
                  <span className={clsx('text-[11px] leading-tight', active ? 'font-bold text-ink' : 'font-medium text-neutral-500')}>{label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
