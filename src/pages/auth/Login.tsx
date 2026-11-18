import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button, Field, Input, Notice } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { humanError, validateEmail } from '@/lib/uz';

/** Havola xatolari (eskirgan taklif/tiklash) Supabase tomonidan #error_code=... ko‘rinishida keladi. */
function linkError(): string | null {
  const p = new URLSearchParams(window.location.hash.slice(1));
  const code = p.get('error_code');
  if (!code && !p.get('error')) return null;
  if (code === 'otp_expired') return 'Havola eskirgan yoki allaqachon ishlatilgan. Administratordan yangi taklif so‘rang yoki "Parolni unutdingizmi?" orqali qayta urinib ko‘ring.';
  return 'Havola yaroqsiz. Qaytadan urinib ko‘ring.';
}

export default function Login() {
  const { signIn, blockedMessage } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const hashError = linkError();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const ev = validateEmail(email);
    if (ev) next.email = ev;
    if (!password) next.password = 'Parolni kiriting.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await signIn(email, password);
      nav('/', { replace: true }); // PublicOnly/RoleHomeRedirect roliga qarab yo‘naltiradi
    } catch (err) {
      setErrors({ form: humanError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-neutral-500">Operatorlar markaziga xush kelibsiz</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-card">
          <h1 className="text-xl font-bold">Tizimga kirish</h1>
          {(errors.form || blockedMessage || hashError) && <Notice tone="error">{errors.form ?? blockedMessage ?? hashError}</Notice>}

          <Field label="Email manzil" error={errors.email}>
            <Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" placeholder="ism@kompaniya.uz"
              value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
          </Field>

          <Field label="Parol" error={errors.password}>
            <div className="relative">
              <Input type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-12"
                value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 hover:text-ink">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={busy}>Kirish</Button>
          <div className="text-center">
            <Link to="/parolni-tiklash" className="text-sm font-medium text-neutral-600 underline decoration-brand decoration-2 underline-offset-4">Parolni unutdingizmi?</Link>
          </div>
        </form>
        <p className="mt-5 text-center text-sm text-neutral-600">
          Hali hisobingiz yo‘qmi? <Link to="/royxatdan-otish" className="font-bold text-ink underline decoration-brand decoration-2 underline-offset-4">Ro‘yxatdan o‘tish</Link>
        </p>
      </div>
    </div>
  );
}
