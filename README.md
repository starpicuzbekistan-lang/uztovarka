# UZTOVARKA Operator Hub

React + TypeScript + Vite + Tailwind + Supabase (Auth, Postgres, Storage, RLS). Interfeys — o‘zbek tilida (lotin).

## Sozlash

1. **Supabase loyihasini yarating** (supabase.com) va `supabase/migrations/001…005` fayllarini tartib bilan SQL Editor’da ishga tushiring (yoki `supabase db push`).
   `005_seed_content.sql` — faqat demo kontent; ishlab chiqarishda kerak bo‘lmasa o‘tkazib yuboring.
2. `.env.example` → `.env` nusxasini oling va `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ni kiriting.
   `service_role` kalitini **hech qachon** `VITE_` o‘zgaruvchisiga yozmang.
3. `npm install && npm run dev` · testlar: `npm test` · yig‘ish: `npm run build`.

## Autentifikatsiya (email + parol)

Supabase Dashboard → **Authentication**:

| Joy | Sozlama |
|---|---|
| Sign In / Providers → Email | Enable Email provider **ON**, **Allow new users to sign up = OFF** (ommaviy ro‘yxatdan o‘tish o‘chiq) |
| Sign In / Providers → Email | Confirm email = ON, Minimum password length = 8 |
| URL Configuration | Site URL = `https://SIZNING-SAYT.vercel.app`; Redirect URLs ga `https://SIZNING-SAYT.vercel.app/parol-o-rnatish` va `http://localhost:5173/parol-o-rnatish` qo‘shing |
| Email Templates | "Invite user" va "Reset password" matnlarini o‘zbekchaga o‘zgartiring (havola `{{ .ConfirmationURL }}` qolsin) |

Mahalliy `supabase start` uchun bu sozlamalar `supabase/config.toml` da berilgan.

### Edge Function (hisoblarni boshqarish)

Taklif yuborish, faol/nofaol qilish, rol berish va parolni tiklash **faqat** serverda, `admin-users` funksiyasi orqali bajariladi
(u chaqiruvchi administrator ekanini tekshiradi; `SUPABASE_SERVICE_ROLE_KEY` faqat shu yerda bor).

```bash
supabase link --project-ref <REF>
supabase secrets set SITE_URL=https://SIZNING-SAYT.vercel.app
supabase functions deploy admin-users
```

### Birinchi administratorni yaratish

Administrator yo‘q bo‘lsa, panelga kirib bo‘lmaydi, shuning uchun birinchisi qo‘lda yaratiladi:

1. Dashboard → Authentication → Users → **Add user → Send invitation** (yoki *Create new user* + parol, "Auto Confirm" belgilang).
2. SQL Editor’da rolni bering:
   ```sql
   update public.profiles set role = 'admin', position = 'Administrator'
   where email = 'admin@sizning-kompaniya.uz';
   ```
   (`guard_profile_update` triggeri service-role/SQL Editor chaqiruvlariga ruxsat beradi; oddiy foydalanuvchi o‘z rolini o‘zgartira olmaydi.)
3. Tizimga kiring — `/admin` ga yo‘naltirilasiz. Keyingi operatorlarni **Operatorlar → Yangi operator** orqali taklif qiling.

## Xavfsizlik qisqacha

- Ro‘yxatdan o‘tish tugmasi yo‘q; Supabase tomonda signup o‘chiq.
- Parollar Supabase Auth’da (bcrypt) xeshlanadi; ilovada saqlanmaydi.
- Nofaol hisob: Auth darajasida ban + `profiles.is_active=false`; ilova ham uni darhol chiqarib yuboradi.
- Rol/holat maydonlarini operator o‘zgartira olmaydi (trigger + RLS).
- Barcha autentifikatsiya xabarlari `src/lib/uz.ts → humanError` orqali o‘zbekchaga o‘giriladi.

## Testlar

- **Biznes mantiq** (KPI, oylik, reyting, skript o‘rinbosarlari): `npm test`
- **Ma’lumotlar bazasi xavfsizligi** (RLS, RPC, yopilgan davr). Oddiy PostgreSQL 15+ da, Supabase o‘rniga stublar bilan:
  ```bash
  createdb hub
  psql -d hub -f supabase/tests/00_auth_storage_stub.sql
  for f in supabase/migrations/00*.sql; do psql -d hub -v ON_ERROR_STOP=1 -f $f; done
  psql -d hub -f supabase/tests/01_security_smoke.sql
  psql -d hub -f supabase/tests/02_security_smoke_part2.sql
  ```
  Kutilgan natija: har bir “-> ” bilan tugagan qatordan keyin xato xabari chiqadi (taqiqlangan amal bloklangan).
  (`01` dagi birinchi xato — demo KPI qatori allaqachon mavjudligi sababli, e’tibor bermang.)

## Admin sahifalari

Operatorlar · KPI va oyliklar (yakunlash, tasdiqlash, davrni yopish, KPI versiyalari) · Kunlik hisobotlar · Mahsulotlar · Naborlar · Skriptlar (+ e’tirozlar) · Maqolalar · E’lonlar · To‘lovlar · Faoliyat tarixi · Sozlamalar.
