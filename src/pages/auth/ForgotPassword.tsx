import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button, Field, Input, Notice } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { humanError, validateEmail } from '@/lib/uz';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validateEmail(email);
    if (v) { setError(v); return; }
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/parol-o-rnatish`,
      });
      if (err && /rate|too many|security/i.test(err.message)) throw err;
      // Foydalanuvchi mavjudligini oshkor qilmaslik uchun doim bir xil javob ko‘rsatiladi.
      setSent(true);
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
        <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-card">
          <h1 className="text-xl font-bold">Parolni tiklash</h1>
          {sent ? (
            <Notice tone="success">
              Agar bu email bilan hisob mavjud bo‘lsa, parolni tiklash havolasi yuborildi. Pochtangizni (va "Spam" papkasini) tekshiring.
            </Notice>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <p className="text-sm text-neutral-600">Email manzilingizni kiriting — parolni yangilash uchun havola yuboramiz.</p>
              {error && <Notice tone="error">{error}</Notice>}
              <Field label="Email manzil">
                <Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button type="submit" size="lg" className="w-full" loading={busy}>Havola yuborish</Button>
            </form>
          )}
          <div className="text-center"><Link to="/login" className="text-sm font-medium text-neutral-600 underline decoration-brand decoration-2 underline-offset-4">Kirish sahifasiga qaytish</Link></div>
        </div>
      </div>
    </div>
  );
}
