export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-9 w-9 rounded-xl';
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${s} inline-flex items-center justify-center bg-brand`} aria-hidden>
        <svg viewBox="0 0 64 64" className="h-3/5 w-3/5">
          <path d="M18 14v20a14 14 0 0 0 28 0V14" fill="none" stroke="#171717" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`font-extrabold tracking-tight text-ink ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>UZTOVARKA</span>
    </span>
  );
}
