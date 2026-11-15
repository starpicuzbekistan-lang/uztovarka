-- 008: nabor tuzish sozlamalari (chegirma limitlari, yetkazib berish) o‘zgarishlarini faoliyat tarixiga yozish.
-- 007 dan keyin ishga tushiring.
drop trigger if exists audit_bundle_builder_settings on public.bundle_builder_settings;
create trigger audit_bundle_builder_settings
  after insert or update or delete on public.bundle_builder_settings
  for each row execute function public.audit_row();
