import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, Users, Calculator, ClipboardCheck, Package, Boxes, BookOpen, Newspaper, Megaphone,
  Banknote, History, Settings, LogOut, Menu, X, MessageCircle, type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/auth/AuthContext';
import { useChatUnread } from '@/lib/supportChat';

const ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: 'Boshqaruv paneli', icon: LayoutDashboard, end: true },
  { to: '/admin/operatorlar', label: 'Operatorlar', icon: Users },
  { to: '/admin/chat', label: 'Chat', icon: MessageCircle },
  { to: '/admin/kpi', label: 'KPI va oyliklar', icon: Calculator },
  { to: '/admin/hisobotlar', label: 'Kunlik hisobotlar', icon: ClipboardCheck },
  { to: '/admin/mahsulotlar', label: 'Mahsulotlar', icon: Package },
  { to: '/admin/naborlar', label: 'Naborlar', icon: Boxes },
  { to: '/admin/skriptlar', label: 'Skriptlar', icon: BookOpen },
  { to: '/admin/maqolalar', label: 'Maqolalar', icon: Newspaper },
  { to: '/admin/elonlar', label: 'E’lonlar', icon: Megaphone },
  { to: '/admin/tolovlar', label: 'To‘lovlar', icon: Banknote },
  { to: '/admin/tarix', label: 'Faoliyat tarixi', icon: History },
  { to: '/admin/sozlamalar', label: 'Sozlamalar', icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Administrator menyusi" className="flex flex-col gap-0.5">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate}
          className={({ isActive }) => clsx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
            isActive ? 'bg-brand text-ink' : 'text-neutral-300 hover:bg-white/10')}>
          <Icon className="h-5 w-5" /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { data: chatUnread = 0 } = useChatUnread();
  return (
    <div className="min-h-screen bg-surface lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink p-4 lg:flex">
        <div className="mb-6 px-2 pt-2 [&_span]:!text-white"><Logo /></div>
        <NavList />
        <div className="mt-auto border-t border-white/10 pt-3">
          <p className="truncate px-2 text-sm text-neutral-300">{profile?.full_name}</p>
          <button onClick={() => void signOut()} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-neutral-300 hover:bg-white/10">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden safe-top">
        <button onClick={() => setOpen(true)} aria-label="Menyuni ochish" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-neutral-100">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/admin"><Logo /></Link>
        <Link to="/admin/chat" aria-label={`Chat${chatUnread?', '+chatUnread+' yangi xabar':''}`} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100">
          <MessageCircle size={21}/>
          {chatUnread>0&&<span className="absolute right-0 top-0 rounded-full bg-brand px-1 text-[10px] font-bold">{chatUnread>9?'9+':chatUnread}</span>}
        </Link>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink p-4 safe-top">
            <div className="mb-4 flex items-center justify-between">
              <div className="[&_span]:!text-white"><Logo /></div>
              <button onClick={() => setOpen(false)} aria-label="Yopish" className="rounded-full p-2 text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto"><NavList onNavigate={() => setOpen(false)} /></div>
            <button onClick={() => void signOut()} className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-neutral-300 hover:bg-white/10">
              <LogOut className="h-4 w-4" /> Chiqish
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
