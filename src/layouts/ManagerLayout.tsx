import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, ChartNoAxesColumn, House, ListChecks, LogOut, UserRound, Users, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/auth/AuthContext';

const NAV: {to:string;label:string;icon:LucideIcon;end?:boolean}[] = [
  {to:'/manager',label:'Home',icon:House,end:true},
  {to:'/manager/jamoa',label:'Jamoa',icon:Users},
  {to:'/manager/kpi',label:'KPI',icon:ChartNoAxesColumn},
  {to:'/manager/vazifalar',label:'Vazifalar',icon:ListChecks},
  {to:'/manager/profil',label:'Profil',icon:UserRound},
];

export function ManagerLayout(){
  const {profile,signOut}=useAuth();
  return <div className="min-h-screen bg-[#F7F8FA] md:pl-64">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-neutral-200 bg-white p-5 md:flex">
      <div className="mb-2"><Logo/></div>
      <p className="mb-8 text-xs font-semibold tracking-wide text-neutral-400">MANAGER HUB</p>
      <nav aria-label="Menejer menyusi" className="flex flex-col gap-1">
        {NAV.map(n=><NavLink key={n.to} to={n.to} end={n.end}
          className={({isActive})=>clsx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',isActive?'bg-brand text-ink':'text-neutral-600 hover:bg-neutral-100')}>
          <n.icon className="h-5 w-5"/>{n.label}</NavLink>)}
      </nav>
      <div className="mt-auto border-t border-neutral-100 pt-4">
        <p className="truncate text-sm font-semibold">{profile?.full_name}</p>
        <p className="text-xs text-neutral-500">Menejer</p>
        <button onClick={()=>void signOut()} className="mt-3 flex min-h-11 w-full items-center gap-2 text-sm text-neutral-600"><LogOut size={17}/> Chiqish</button>
      </div>
    </aside>
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/90 backdrop-blur safe-top">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3"><Logo/><span className="hidden text-xs text-neutral-500 sm:inline">Manager Hub</span></div>
        <div className="flex items-center gap-3">
          <NavLink to="/manager" title="Bosh sahifa" className="rounded-full p-2 hover:bg-neutral-100"><Bell size={19}/></NavLink>
          <NavLink to="/manager/profil" className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-800" title={profile?.full_name}><UserRound size={19}/></NavLink>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:px-8 md:pb-12">
      <Outlet/>
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 shadow-sm backdrop-blur md:hidden safe-bottom" aria-label="Menejer pastki menyusi">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {NAV.map(n=><NavLink key={n.to} to={n.to} end={n.end} className={({isActive})=>clsx('flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[11px]',isActive?'font-bold text-ink':'text-neutral-500')}>
          {({isActive})=><>
            <span className={clsx('flex h-8 w-12 items-center justify-center rounded-xl',isActive?'bg-brand':'')}><n.icon size={20} strokeWidth={isActive?2.5:2}/></span>
            <span>{n.label}</span>
          </>}
        </NavLink>)}
      </div>
    </nav>
  </div>;
}
