-- UZTOVARKA Operator Hub — 004: Storage
-- "content" — mahsulot, nabor va maqola rasmlari (o‘qish: kirgan foydalanuvchilar, yozish: admin).
-- "avatars" — profil rasmlari (har kim faqat o‘z papkasiga: avatars/<user_id>/...).
-- Buckets ochiq (public) — rasmlar ichki, maxfiy emas; havolani bilmagan kishi topa olmaydi, lekin
-- maxfiy fayl yuklamang. Xohlasangiz public=false qilib, signed URL ishlating.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('content', 'content', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy content_read on storage.objects for select to authenticated
  using (bucket_id = 'content' and public.is_active_user());
create policy content_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and public.is_admin());
create policy content_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'content' and public.is_admin());
create policy content_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'content' and public.is_admin());

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_active_user());
create policy avatars_own_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy avatars_own_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
