// Supabase Edge Function: admin-users
// Foydalanuvchilarni boshqarish (taklif, faol/nofaol, rol, parolni tiklash havolasi).
// SERVICE_ROLE kaliti faqat shu yerda (serverda) ishlatiladi — brauzerga HECH QACHON chiqmaydi.
// Deploy: supabase functions deploy admin-users
// Kerakli secretlar (Supabase avtomatik beradi): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Qo‘lda beriladigan: SITE_URL (masalan https://sizning-sayt.vercel.app)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Browser CORS: the app's primary host and its Netlify Deploy Previews are trusted.
// An OPTIONS request is not authorization; every privileged POST still validates the user JWT and admin role.
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  let trusted = false;
  if (origin) {
    try {
      const incoming = new URL(origin);
      const configured = Deno.env.get('SITE_URL');
      const siteOrigin = configured ? new URL(configured).origin : '';
      const validProtocol = incoming.protocol === 'https:' || (incoming.hostname === 'localhost' && incoming.protocol === 'http:');
      trusted = validProtocol && (
        incoming.origin === siteOrigin ||
        incoming.hostname === 'silver-entremet-54da02.netlify.app' ||
        /^deploy-preview-\d+--silver-entremet-54da02\.netlify\.app$/.test(incoming.hostname) ||
        (incoming.hostname === 'localhost' && ['5173', '4173'].includes(incoming.port))
      );
    } catch { trusted = false; }
  }
  return {
    ...(trusted && origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

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
        const role = body.role === 'admin' || body.role === 'manager' ? body.role : 'operator';
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
          position: body.position ? String(body.position) : (role === 'admin' ? 'Administrator' : role === 'manager' ? 'Jamoa menejeri' : 'Operator'),
          employee_id: body.employee_id ? String(body.employee_id) : null,
        }).eq('id', data.user.id);
        await audit('user_invited', data.user.id, { email, role });
        return json({ ok: true, user_id: data.user.id });
      }

      case 'set_active': {
        const id = String(body.user_id ?? '');
        const active = Boolean(body.active);
        if (id === userData.user.id && !active) return json({ error: 'O‘z hisobingizni o‘chira olmaysiz' }, 400);
        // Operator mustaqil ro‘yxatdan o‘tganida ikki marta tasdiq talab qilmaymiz.
        // Admin tasdig‘i shu yangi operatorning email statusini ham yakunlaydi.
        const { data: target, error: targetErr } = await admin.from('profiles')
          .select('role,is_active,signup_requested_at').eq('id', id).maybeSingle();
        if (targetErr || !target) return json({ error: 'Operator profili topilmadi' }, 404);

        const approvalOfSignup = active && target.role === 'operator' && !!target.signup_requested_at;
        const authChange = approvalOfSignup
          ? { ban_duration: 'none', email_confirm: true }
          : { ban_duration: active ? 'none' : '876000h' };
        const { error } = await admin.auth.admin.updateUserById(id, authChange);
        if (error) return json({ error: 'Auth hisobini tasdiqlab bo‘lmadi: ' + error.message }, 400);

        const { error: profileErr } = await admin.from('profiles')
          .update({ is_active: active }).eq('id', id);
        if (profileErr) {
          if (active) await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
          return json({ error: 'Profilni faollashtirib bo‘lmadi: ' + profileErr.message }, 500);
        }
        if (!active) await admin.auth.admin.signOut(id, 'global').catch(() => {});
        await audit(active ? 'user_activated' : 'user_deactivated', id, {
          active, confirmed_by_admin: approvalOfSignup,
        });
        return json({ ok: true, email_confirmed_by_admin: approvalOfSignup });
      }

      // Eski versiyada admin tasdiqlagan, lekin Auth emaili hali tasdiqlanmagan
      // operatorlar uchun bir martalik tuzatish. Faqat faol, o'zi ro'yxatdan o'tgan
      // operatorga ruxsat; roli va paroli o'zgartirilmaydi.
      case 'confirm_signup_email': {
        const id = String(body.user_id ?? '');
        const { data: p, error: profileErr } = await admin.from('profiles')
          .select('role,is_active,signup_requested_at').eq('id', id).maybeSingle();
        if (profileErr || !p || p.role !== 'operator' || !p.is_active || !p.signup_requested_at)
          return json({ error: 'Faqat admin tasdiqlagan operator uchun ruxsat' }, 403);
        const { error } = await admin.auth.admin.updateUserById(id, { email_confirm: true });
        if (error) return json({ error: 'Emailni faollashtirib bo‘lmadi: ' + error.message }, 400);
        await audit('signup_email_approved', id, { confirmed_by_admin: true });
        return json({ ok: true });
      }

      case 'set_role': {
        const id = String(body.user_id ?? '');
        const role = body.role === 'admin' || body.role === 'manager' ? body.role : 'operator';
        if (id === userData.user.id && role !== 'admin') return json({ error: 'O‘z rolingizni pasaytira olmaysiz' }, 400);
        const { data: before, error: beforeErr } = await admin.from('profiles').select('role').eq('id', id).maybeSingle();
        if (beforeErr) return json({ error: 'Xodim ma’lumotini yuklab bo‘lmadi: ' + beforeErr.message }, 500);
        if (!before) return json({ error: 'Xodim topilmadi' }, 404);
        if (before.role === role) return json({ ok: true, unchanged: true });
        const { data: updated, error: roleErr } = await admin.from('profiles')
          .update({ role }).eq('id', id).select('id,role').maybeSingle();
        if (roleErr) return json({ error: 'Rolni o‘zgartirib bo‘lmadi: ' + roleErr.message }, 400);
        if (!updated) return json({ error: 'Rol yangilanmadi. Xodim profilini tekshiring.' }, 409);
        await audit('role_changed', id, { from: before.role, to: role });
        return json({ ok: true, role: updated.role });
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
