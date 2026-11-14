import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button, Field, FullPageSpinner, Input, Notice } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { humanError, validatePassword } from '@/lib/uz';

/** Taklif havolasi (birinchi parol) va parolni tiklash havolasi shu sahifaga olib keladi. */
export default function SetPassword() {
  const { session, loading, markPasswordSet, signOut } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <FullPageSpinner />;
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 text-center shadow-card">
          <Notice tone="warn">Havola eskirgan yoki yaroqsiz. Yangi havola so‘rang.</Notice>
          <Link to="/parolni-tiklash" className="font-semibold underline decoration-brand decoration-2 underline-offset-4">Parolni tiklash</Link>
        </div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validatePassword(pw);
    if (v) return setError(v);
    if (pw !== pw2) return setError('Parollar bir-biriga mos kelmadi.');
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: pw });
      if (err) throw err;
      markPasswordSet();
      nav('/', { replace: true });
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo size="lg" /></div>
        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-card">
          <h1 className="text-xl font-bold">Yangi parol o‘rnatish</h1>
          <p className="text-sm text-neutral-600">Kamida 8 ta belgi: katta va kichik harflar hamda raqam.</p>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Yangi parol">
            <div className="relative">
              <Input type={show ? 'text' : 'password'} autoComplete="new-password" className="pr-12" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          <Field label="Parolni takrorlang">
            <Input type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Parolni saqlash</Button>
          <button type="button" onClick={() => void signOut().then(() => nav('/login'))} className="block w-full text-center text-sm text-neutral-500 underline">Bekor qilish</button>
        </form>
      </div>
    </div>
  );
}

export function SetPasswordRedirect() { return <Navigate to="/parol-o-rnatish" replace />; }
