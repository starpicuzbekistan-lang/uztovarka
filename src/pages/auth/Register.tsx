import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button, Field, Input, Notice } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { humanError, validateEmail, validatePassword } from '@/lib/uz';

export default function Register() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [again,setAgain]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');

  async function submit(e:FormEvent) {
    e.preventDefault();
    const eErr=validateEmail(email);
    const pwErr=validatePassword(password);
    if(eErr||pwErr||password!==again) {
      setError(eErr??pwErr??'Parollar bir xil bo‘lishi kerak.');
      return;
    }
    setBusy(true);setError('');
    try {
      const {error:err}=await supabase.auth.signUp({
        email:email.trim().toLowerCase(), password,
        options:{
          emailRedirectTo:`${window.location.origin}/login`
        }
      });
      if(err)throw err;
      // Supabase email tasdiqlash o'chirilgan bo'lsa signUp session yaratishi mumkin.
      // Admin faollashtirmaguncha hisobni ilovada ochiq qoldirmaymiz.
      await supabase.auth.signOut();
      setSent(true);
      setPassword('');setAgain('');
    } catch(err) {
      const authErr=err as {status?:number;code?:string;message?:string};
      const msg=authErr.message??'';
      if(authErr.status===429 || /rate limit|too many|security purposes|over_email_send_rate_limit/i.test(msg)){
        setError('Juda ko‘p urinish yoki email yuborish limiti. Ariza allaqachon yuborilgan bo‘lsa, qayta ro‘yxatdan o‘tmang. Administratorga murojaat qiling; cheklov tugagach urinib ko‘ring.');
      }else if(/already registered|user already exists/i.test(msg)){
        setError('Bu email bilan hisob mavjud. Qayta ro‘yxatdan o‘tish o‘rniga Kirish sahifasidan foydalaning yoki admin bilan bog‘laning.');
      }else{
        setError(humanError(err));
      }
    } finally {setBusy(false);}
  }

  return <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 safe-top safe-bottom">
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="lg"/>
        <p className="mt-3 text-sm text-neutral-500">UZTOVARKA Operatorlar markazi</p>
      </div>
      {sent?<div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-700"><CheckCircle2 size={32}/></span>
        <h1 className="text-xl font-extrabold">Ariza yuborildi!</h1>
        <p className="text-sm leading-relaxed text-neutral-700">Admin tasdiqlashini kuting. Hisobingiz faollashtirilgandan keyin o‘zingiz tanlagan parol bilan kirishingiz mumkin.</p>
        <Notice tone="info">Qayta ro‘yxatdan o‘tish shart emas. Admin tasdiqlaganidan keyin shu email va parol bilan kiring. Agar kirishda xatolik bo‘lsa, adminga murojaat qiling.</Notice>
        <Link to="/login" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-ink">Kirish sahifasiga qaytish</Link>
      </div>:<form onSubmit={submit} noValidate className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2"><UserPlus size={20} className="text-amber-600"/><h1 className="text-xl font-bold">Ro‘yxatdan o‘tish</h1></div>
        <p className="text-sm text-neutral-500">Emailingiz va yangi parolingizni kiriting. Admin tasdig‘idan keyin ilovaga kira olasiz.</p>
        {error&&<Notice tone="error">{error}</Notice>}
        <Field label="Gmail yoki email manzil">
          <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
            placeholder="ism@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        </Field>
        <Field label="Yangi parol">
          <div className="relative">
            <Input type={showPassword?'text':'password'} autoComplete="new-password" className="pr-12"
              value={password} onChange={e=>setPassword(e.target.value)}/>
            <button type="button" aria-label={showPassword?'Parolni yashirish':'Parolni ko‘rsatish'}
              onClick={()=>setShowPassword(x=>!x)}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-neutral-500">
              {showPassword?<EyeOff size={19}/>:<Eye size={19}/>}
            </button>
          </div>
        </Field>
        <Field label="Parolni takrorlang">
          <Input type={showPassword?'text':'password'} autoComplete="new-password" value={again} onChange={e=>setAgain(e.target.value)}/>
        </Field>
        <p className="text-xs text-neutral-500">Parolda kamida 8 belgi, katta va kichik harf hamda raqam bo‘lishi kerak.</p>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Ro‘yxatdan o‘tish</Button>
        <p className="text-center text-sm text-neutral-500">Hisobingiz bormi? <Link to="/login" className="font-bold text-ink underline decoration-brand decoration-2 underline-offset-4">Kirish</Link></p>
      </form>}
    </div>
  </div>;
}
