import { useState } from 'react';
import clsx from 'clsx';
import { Package, Newspaper, X, ChevronLeft, ChevronRight, Boxes } from 'lucide-react';
import { publicUrl } from '@/lib/storage';

/** Rasm bo‘lmasa — brend rangidagi sokin joy egasi (begona stok rasmlar ishlatilmaydi). */
export function CoverImage({ path, alt, kind = 'article', className }: { path?: string | null; alt: string; kind?: 'article' | 'product' | 'set'; className?: string }) {
  const src = publicUrl('content', path);
  if (src) return <img src={src} alt={alt} loading="lazy" decoding="async" className={clsx('h-full w-full object-cover', className)} />;
  const Icon = kind === 'article' ? Newspaper : kind === 'set' ? Boxes : Package;
  return (
    <div className={clsx('flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-soft to-neutral-100', className)} aria-hidden>
      <Icon className="h-10 w-10 text-yellow-600/60" />
    </div>
  );
}

/** Galereya: bosganda kattalashtiriladi. */
export function Gallery({ paths, alt, kind }: { paths: string[]; alt: string; kind: 'product' | 'set' }) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  if (!paths.length) return <div className="aspect-[4/3] overflow-hidden rounded-2xl"><CoverImage alt={alt} kind={kind} /></div>;
  const prev = () => setIdx((i) => (i - 1 + paths.length) % paths.length);
  const next = () => setIdx((i) => (i + 1) % paths.length);
  return (
    <div>
      <button onClick={() => setOpen(true)} className="block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-100" aria-label="Rasmni kattalashtirish">
        <CoverImage path={paths[idx]} alt={alt} kind={kind} />
      </button>
      {paths.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          {paths.map((p, i) => (
            <button key={p} onClick={() => setIdx(i)} aria-label={`Rasm ${i + 1}`}
              className={clsx('h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2', i === idx ? 'border-brand' : 'border-transparent')}>
              <CoverImage path={p} alt="" kind={kind} />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-3" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Rasm">
          <button className="absolute right-3 top-3 rounded-full bg-white/10 p-3 text-white" aria-label="Yopish"><X className="h-6 w-6" /></button>
          {paths.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-2 rounded-full bg-white/10 p-3 text-white" aria-label="Oldingi"><ChevronLeft className="h-6 w-6" /></button>
              <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-2 rounded-full bg-white/10 p-3 text-white" aria-label="Keyingi"><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
          <img src={publicUrl('content', paths[idx]) ?? ''} alt={alt} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
