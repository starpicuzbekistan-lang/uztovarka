import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, Users, Calculator, ClipboardCheck, Package, Boxes, BookOpen, Newspaper, Megaphone,
  Banknote, History, Settings, LogOut, Menu, X, MessageCircle, ChevronDown, type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/auth/AuthContext';
import { useChatUnread } from '@/lib/supportChat';

type Item = { to: string; label: string; icon: LucideIcon };
type Group = { id: string; label: string; icon: LucideIcon; items: Item[] };

// Barcha mavjud admin yo‘llari saqlanadi. Yon menyuda bir vaqtning o‘zida
// faqat bitta guruh ochiladi — yangi funksiya uchun alohida asosiy menyu kerak emas.
const GROUPS: Group[] = [
  {
    id: 'team', label: 'Jamoa', icon: Users,
    items: [
      { to: '/admin/operatorlar', label: 'Operatorlar', icon: Users },
      { to: '/admin/chat', label: 'Chat', icon: MessageCircle },
    ],
  },
  {
    id: 'sales', label: 'Savdo va mahsulotlar', icon: Package,
    items: [
      { to: '/admin/mahsulotlar', label: 'Mahsulotlar', icon: Package },
      { to: '/admin/naborlar', label: 'Naborlar', icon: Boxes },
      { to: '/admin/skriptlar', label: 'Skriptlar', icon: BookOpen },
    ],
  },
  {
    id: 'content', label: 'Kontent', icon: Newspaper,
    items: [
      { to: '/admin/maqolalar', label: 'Maqolalar', icon: Newspaper },
      { to: '/admin/elonlar', label: 'E’lonlar', icon: Megaphone },
    ],
  },
  {
    id: 'finance', label: 'Hisobot va moliya', icon: Calculator,
    items: [
      { to: '/admin/hisobotlar', label: 'Kunlik hisobotlar', icon: ClipboardCheck },
      { to: '/admin/kpi', label: 'KPI va oyliklar', icon: Calculator },
      { to: '/admin/tolovlar', label: 'To‘lovlar', icon: Banknote },
    ],
  },
  {
    id: 'system', label: 'Tizim', icon: Settings,
    items: [
      { to: '/admin/tarix', label: 'Faoliyat tarixi', icon: History },
      { to: '/admin/sozlamalar', label: 'Sozlamalar', icon: Settings },
    ],
  },
];

function groupForPath(path: string): string | null {
  return GROUPS.find((group) => group.items.some((item) => path === item.to || path.startsWith(item.to + '/')))?.id ?? null;
}

function NavList({ onNavigate, prefix }: { onNavigate?: () => void; prefix: string }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<string | null>(() => groupForPath(pathname));
  // Direct link, back/forward or page reload: open the section containing the active page.
  useEffect(() => { setExpanded(groupForPath(pathname)); }, [pathname]);

  return (
    <nav aria-label="Administrator menyusi" className="space-y-1">
      <NavLink to="/admin" end onClick={onNavigate}
        className={({ isActive }) => clsx(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
          isActive ? 'bg-brand text-ink' : 'text-neutral-200 hover:bg-white/10',
        )}>
        <LayoutDashboard className="h-5 w-5 shrink-0" /> Dashboard
      </NavLink>

      <div className="my-3 border-t border-white/10" aria-hidden="true" />
      {GROUPS.map((group) => {
        const Icon = group.icon;
        const isActive = group.items.some((item) => pathname === item.to || pathname.startsWith(item.to + '/'));
        const isExpanded = expanded === group.id;
        const panelId = `${prefix}-nav-${group.id}`;
        return (
          <div key={group.id}>
            <button type="button" aria-controls={panelId} aria-expanded={isExpanded}
              onClick={() => setExpanded((current) => current === group.id ? null : group.id)}
              className={clsx(
                'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors',
                isActive ? 'bg-white/10 text-white' : 'text-neutral-200 hover:bg-white/10',
              )}>
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 leading-snug">{group.label}</span>
              <ChevronDown className={clsx('h-4 w-4 shrink-0 transition-transform', isExpanded && 'rotate-180')} />
            </button>
            <div id={panelId} hidden={!isExpanded} className="ml-5 border-l border-white/15 pl-2 py-1">
              {group.items.map(({ to, label, icon: ChildIcon }) => (
                <NavLink key={to} to={to} onClick={onNavigate}
                  className={({ isActive: active }) => clsx(
                    'flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                    active ? 'bg-brand text-ink' : 'text-neutral-300 hover:bg-white/10 hover:text-white',
                  )}>
                  <ChildIcon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { data: chatUnread = 0 } = useChatUnread();

  // Prevent the background document from scrolling while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-surface lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink p-4 lg:flex">
        <Link to="/admin" className="mb-5 px-2 pt-2 [&_span]:!text-white"><Logo /></Link>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <NavList prefix="desktop" />
        </div>
        <div className="mt-3 shrink-0 border-t border-white/10 pt-3">
          <p className="truncate px-2 text-sm text-neutral-300">{profile?.full_name}</p>
          <button onClick={() => void signOut()} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-neutral-300 hover:bg-white/10">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden safe-top">
        <button onClick={() => setOpen(true)} aria-label="Menyuni ochish" aria-expanded={open}
          className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-neutral-100">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/admin"><Logo /></Link>
        <Link to="/admin/chat" aria-label={`Chat${chatUnread ? ', ' + chatUnread + ' yangi xabar' : ''}`}
          className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100">
          <MessageCircle size={21} />
          {chatUnread > 0 && <span className="absolute right-0 top-0 rounded-full bg-brand px-1 text-[10px] font-bold">{chatUnread > 9 ? '9+' : chatUnread}</span>}
        </Link>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Administrator menyusi">
          <button type="button" aria-label="Menyuni yopish" className="absolute inset-0 w-full bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(19rem,88vw)] flex-col bg-ink p-4 safe-top safe-bottom">
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <Link to="/admin" onClick={() => setOpen(false)} className="[&_span]:!text-white"><Logo /></Link>
              <button onClick={() => setOpen(false)} aria-label="Yopish" className="rounded-full p-2 text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              <NavList prefix="mobile" onNavigate={() => setOpen(false)} />
            </div>
            <button onClick={() => { setOpen(false); void signOut(); }}
              className="mt-3 flex min-h-11 shrink-0 items-center gap-3 rounded-xl border-t border-white/10 px-3 text-sm text-neutral-300 hover:bg-white/10">
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
