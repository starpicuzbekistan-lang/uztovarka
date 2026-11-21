import {
  createContext, useCallback, useContext, useEffect, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert, X, XCircle, Inbox } from 'lucide-react';
import { initials } from '@/lib/format';
import { publicUrl } from '@/lib/storage';

/* ───────── Tugmalar ───────── */
type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-ink hover:bg-brand-dark font-semibold',
  dark: 'bg-ink text-white hover:bg-ink-soft font-semibold',
  outline: 'border border-neutral-300 bg-white text-ink hover:bg-neutral-50 font-medium',
  ghost: 'text-ink hover:bg-neutral-100 font-medium',
  danger: 'bg-red-600 text-white hover:bg-red-700 font-semibold',
};

export function Button({
  variant = 'primary', loading, size = 'md', className, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none',
        size === 'sm' ? 'min-h-9 px-3 text-sm' : size === 'lg' ? 'min-h-14 px-6 text-base' : 'min-h-11 px-4 text-[15px]',
        VARIANTS[variant], className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ───────── Maydonlar ───────── */
export function Field({ label, error, hint, children, className }: { label?: string; error?: string | null; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

const inputCls = 'w-full min-h-11 rounded-xl border border-neutral-300 bg-white px-3.5 text-[15px] text-ink placeholder:text-neutral-400 focus:border-ink disabled:bg-neutral-100';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={clsx(inputCls, 'py-2.5 leading-6 min-h-[88px]', p.className)} />
);
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx(inputCls, 'pr-8', p.className)} />;

/* ───────── Kartalar va belgilar ───────── */
export const Card = ({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
  <div {...rest} className={clsx('rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-card', className)}>{children}</div>
);

const TONES = {
  neutral: 'bg-neutral-100 text-neutral-700',
  yellow: 'bg-brand-soft text-yellow-900',
  green: 'bg-kpi-greenbg text-green-800',
  red: 'bg-kpi-redbg text-red-800',
  dark: 'bg-ink text-white',
  blue: 'bg-sky-100 text-sky-800',
} as const;
export type Tone = keyof typeof TONES;
export const Badge = ({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>{children}</span>
);

export const DemoBadge = () => <Badge tone="blue">DEMO</Badge>;

export function Avatar({ name, path, size = 40 }: { name: string; path?: string | null; size?: number }) {
  const src = publicUrl('avatars', path);
  return src ? (
    <img src={src} alt={name} width={size} height={size} loading="lazy" className="rounded-full object-cover bg-neutral-200" style={{ width: size, height: size }} />
  ) : (
    <span className="inline-flex items-center justify-center rounded-full bg-brand text-ink font-bold" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-label={name}>
      {initials(name)}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div role="tablist" className={clsx('flex gap-1 overflow-x-auto rounded-xl bg-neutral-200/60 p-1 no-scrollbar', className)}>
      {options.map((o) => (
        <button
          key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors',
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-neutral-600 hover:text-ink')}
        >{o.label}</button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={clsx('min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
      active ? 'border-ink bg-ink text-white' : 'border-neutral-300 bg-white text-ink hover:bg-neutral-50')}>{children}</button>
  );
}

/* ───────── Holatlar ───────── */
export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx('h-5 w-5 animate-spin text-neutral-500', className)} aria-label="Yuklanmoqda" />;

export const FullPageSpinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-surface"><Spinner className="h-8 w-8" /></div>
);

export const LoadingBlock = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Yuklanmoqda">
    {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-200/70" />)}
  </div>
);

export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
      <div className="mb-3 text-neutral-400">{icon ?? <Inbox className="h-9 w-9" />}</div>
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-neutral-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <AlertTriangle className="mb-2 h-8 w-8 text-red-500" />
      <p className="font-semibold text-red-900">{message ?? 'Ma’lumotlarni yuklab bo‘lmadi.'}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Qayta urinish</Button>}
    </div>
  );
}

export function AccessDenied({ onSwitchAccount }: { onSwitchAccount?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-6 text-center">
      <ShieldAlert className="h-12 w-12 text-neutral-400" />
      <h1 className="text-xl font-bold">Ushbu bo‘limga kirish uchun ruxsatingiz yo‘q.</h1>
      <p className="max-w-sm text-sm text-neutral-600">Bu sahifa boshqa rol uchun. Administrator paneliga kirish uchun administrator hisobi bilan kiring.</p>
      {onSwitchAccount && <Button onClick={onSwitchAccount}>Boshqa hisob bilan kirish</Button>}
      <Link to="/" className="font-semibold underline decoration-brand decoration-2 underline-offset-4">O‘z panelimga qaytish</Link>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'success' | 'error'; children: ReactNode }) {
  const map = {
    info: ['bg-sky-50 border-sky-200 text-sky-900', Info],
    warn: ['bg-brand-soft border-yellow-300 text-yellow-900', AlertTriangle],
    success: ['bg-kpi-greenbg border-green-300 text-green-900', CheckCircle2],
    error: ['bg-kpi-redbg border-red-300 text-red-900', XCircle],
  } as const;
  const [cls, Icon] = map[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('flex gap-2.5 rounded-xl border p-3 text-sm', cls)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ───────── Modal / tasdiqlash ───────── */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className={clsx('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Yopish" className="rounded-full p-2 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Tasdiqlash', danger, onConfirm, onClose }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => Promise<void> | void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-[15px] text-ink-soft">{message}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy}
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────── Toast ───────── */
interface ToastItem { id: number; tone: 'success' | 'error' | 'info'; text: string }
const ToastCtx = createContext<(tone: ToastItem['tone'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastItem['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, tone, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg',
            t.tone === 'success' ? 'bg-ink text-white' : t.tone === 'error' ? 'bg-red-600 text-white' : 'bg-white text-ink border border-neutral-200')}>
            {t.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand" /> : t.tone === 'error' ? <XCircle className="mt-0.5 h-4 w-4" /> : <Info className="mt-0.5 h-4 w-4" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ───────── Sahifa sarlavhasi, statistika kartasi ───────── */
export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'green' | 'yellow' | 'red' }) {
  const bar = tone === 'green' ? 'bg-kpi-green' : tone === 'yellow' ? 'bg-yellow-400' : tone === 'red' ? 'bg-kpi-red' : 'bg-brand';
  return (
    <Card className="relative overflow-hidden">
      <span className={clsx('absolute left-0 top-0 h-full w-1', bar)} aria-hidden />
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </Card>
  );
}

export function BackLink({ to, label = 'Orqaga' }: { to: string; label?: string }) {
  return <Link to={to} className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-neutral-600 hover:text-ink">← {label}</Link>;
}

/** Nashr holati: demo belgisi bilan */
export const ValueOrMissing = ({ v }: { v: ReactNode | null | undefined | '' }) =>
  v ? <>{v}</> : <span className="text-neutral-400 italic">Administrator tomonidan kiritilmagan</span>;
