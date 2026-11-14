// Supabase Edge Function: admin-users
// Foydalanuvchilarni boshqarish (taklif, faol/nofaol, rol, parolni tiklash havolasi).
// SERVICE_ROLE kaliti faqat shu yerda (serverda) ishlatiladi — brauzerga HECH QACHON chiqmaydi.
// Deploy: supabase functions deploy admin-users
// Kerakli secretlar (Supabase avtomatik beradi): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Qo‘lda beriladigan: SITE_URL (masalan https://sizning-sayt.vercel.app)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Usul qo‘llab-quvvatlanmaydi' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') ?? '';

  // 1) Chaqiruvchini JWT orqali aniqlash
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Tizimga kiring' }, 401);

  // 2) Admin ekanini tekshirish (service client bilan — RLS ga bog‘liq emas)
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: me } = await admin.from('profiles').select('role,is_active').eq('id', userData.user.id).single();
  if (!me || me.role !== 'admin' || !me.is_active) return json({ error: 'Ruxsat yo‘q' }, 403);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Noto‘g‘ri so‘rov' }, 400); }

  const audit = (action: string, entityId: string | null, after: unknown) =>
    admin.from('audit_logs').insert({ actor_id: userData.user.id, action, entity: 'auth_user', entity_id: entityId, after_data: after });

  try {
    switch (body.action) {
      case 'invite': {
        const email = String(body.email ?? '').trim().toLowerCase();
        const fullName = String(body.full_name ?? '').trim();
        const role = body.role === 'admin' ? 'admin' : 'operator';
        if (!EMAIL_RE.test(email)) return json({ error: 'Email manzili noto‘g‘ri' }, 400);
        if (!fullName) return json({ error: 'Ism-familiya kiritilishi shart' }, 400);

        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName },
          redirectTo: `${siteUrl}/parol-o-rnatish`,
        });
        if (error) {
          const exists = /already|registered|exists/i.test(error.message);
          return json({ error: exists ? 'Bu email bilan foydalanuvchi allaqachon mavjud' : 'Taklif yuborib bo‘lmadi' }, exists ? 409 : 400);
        }
        // Profil trigger orqali yaratilgan; rol va qo‘shimcha maydonlarni xavfsiz tarzda server o‘rnatadi.
        await admin.from('profiles').update({
          role, full_name: fullName,
          position: body.position ? String(body.position) : (role === 'admin' ? 'Administrator' : 'Operator'),
          employee_id: body.employee_id ? String(body.employee_id) : null,
        }).eq('id', data.user.id);
        await audit('user_invited', data.user.id, { email, role });
        return json({ ok: true, user_id: data.user.id });
      }

      case 'set_active': {
        const id = String(body.user_id ?? '');
        const active = Boolean(body.active);
        if (id === userData.user.id && !active) return json({ error: 'O‘z hisobingizni o‘chira olmaysiz' }, 400);
        // Auth darajasida bloklash: faol sessiyalar ham yangilanishda to‘xtaydi
        const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' });
        if (error) return json({ error: 'Holatni o‘zgartirib bo‘lmadi' }, 400);
        await admin.from('profiles').update({ is_active: active }).eq('id', id);
        if (!active) await admin.auth.admin.signOut(id, 'global').catch(() => {});
        await audit(active ? 'user_activated' : 'user_deactivated', id, { active });
        return json({ ok: true });
      }

      case 'set_role': {
        const id = String(body.user_id ?? '');
        const role = body.role === 'admin' ? 'admin' : 'operator';
        if (id === userData.user.id && role !== 'admin') return json({ error: 'O‘z rolingizni pasaytira olmaysiz' }, 400);
        const { data: before } = await admin.from('profiles').select('role').eq('id', id).single();
        await admin.from('profiles').update({ role }).eq('id', id);
        await audit('role_changed', id, { from: before?.role, to: role });
        return json({ ok: true });
      }

      case 'send_reset': {
        const email = String(body.email ?? '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) return json({ error: 'Email manzili noto‘g‘ri' }, 400);
        // Oddiy (anon) mijoz orqali — Supabase o‘zi xat yuboradi
        const pub = createClient(url, anon, { auth: { persistSession: false } });
        const { error } = await pub.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/parol-o-rnatish` });
        if (error) return json({ error: 'Xat yuborib bo‘lmadi. Birozdan keyin urinib ko‘ring' }, 400);
        await audit('password_reset_sent', null, { email });
        return json({ ok: true });
      }

      case 'resend_invite': {
        const email = String(body.email ?? '').trim().toLowerCase();
        const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl}/parol-o-rnatish` });
        if (error) return json({ error: 'Taklifni qayta yuborib bo‘lmadi (foydalanuvchi allaqachon parol o‘rnatgan bo‘lishi mumkin)' }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: 'Noma’lum amal' }, 400);
    }
  } catch (_e) {
    return json({ error: 'Server xatosi. Qayta urinib ko‘ring' }, 500);
  }
});
