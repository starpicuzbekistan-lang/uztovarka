import { useState } from 'react';
import { Award, ChevronDown, ChevronUp, CircleHelp, Sparkles } from 'lucide-react';
import { BADGE_CATALOG } from '@/lib/badgeCatalog';
import type { Achievement } from '@/lib/earnedBadges';

export function BadgeExplanation() {
  const [open,setOpen] = useState(false);
  return <div>
    <button type="button" onClick={()=>setOpen(v=>!v)}
      aria-expanded={open}
      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 underline-offset-2 hover:underline">
      <CircleHelp size={14}/> Badge o‘zi nima? {open?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
    </button>
    {open&&<div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm leading-relaxed text-blue-950">
      <p><b>Badge</b> — mehnat, mahorat va erishilgan natijalar uchun beriladigan raqamli e’tirof belgisi.</p>
      <p className="mt-1">Ba’zilari natija bajarilganda avtomatik beriladi. <b>Maxsus badgelarni faqat administrator beradi.</b> Hali qo‘lga kiritilmagan badgelar operatorga ko‘rsatilmaydi.</p>
      <p className="mt-1 text-blue-800">Har bir badge — qilgan mehnatingizning ko‘rinib turgan isboti!</p>
    </div>}
  </div>;
}

export function BadgePreviewIcon({item}:{item:Achievement}) {
  const meta=BADGE_CATALOG[item.code];
  const Icon=meta.icon;
  return <div className="flex min-w-0 flex-col items-center gap-1.5 text-center"
    title={meta.why}>
    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${meta.bg}`}>
      <Icon size={24} className={meta.iconColor}/>
    </span>
    <span className="max-w-full break-words text-[10px] font-semibold leading-tight text-neutral-700 sm:text-xs">{meta.title}</span>
  </div>;
}

export function BadgeEarnedRow({item}:{item:Achievement}) {
  const meta=BADGE_CATALOG[item.code];
  const Icon=meta.icon;
  const date=item.earnedAt?.slice(0,10);
  return <article className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm sm:p-4">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${meta.bg}`}>
      <Icon size={26} className={meta.iconColor}/>
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-base font-extrabold text-ink">{meta.title}</h3>
        {item.source==='admin'&&<span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-amber-900">Admin mukofoti</span>}
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Nega bu badgeni oldingiz?</p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-700">{meta.why}</p>
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"/>
        <p className="text-sm font-semibold leading-relaxed">{meta.motivation}</p>
      </div>
      {item.adminReason&&<p className="mt-2 rounded-lg bg-neutral-50 px-2.5 py-2 text-xs text-neutral-600">
        <b>Admin izohi:</b> {item.adminReason}
      </p>}
      <div className="mt-2 flex items-center gap-1 text-xs text-neutral-400">
        <Award size={13}/> Qo‘lga kiritilgan{date?` · ${date}`:''}
      </div>
    </div>
  </article>;
}
