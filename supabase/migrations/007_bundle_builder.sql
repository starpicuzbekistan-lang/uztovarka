-- UZTOVARKA Operator Hub — 007: individual nabor narxini xavfsiz hisoblash
-- 001-006 migratsiyalar avvaldan qo‘llangan bo‘lishi kerak.

create table if not exists public.bundle_builder_settings (
  id smallint primary key default 1 check (id = 1),
  discount_enabled boolean not null default false,
  operators_can_discount boolean not null default false,
  max_discount_percent numeric(5,2) not null default 0 check (max_discount_percent between 0 and 100),
  max_discount_uzs bigint not null default 0 check (max_discount_uzs >= 0),
  free_delivery boolean not null default true,
  delivery_fee_uzs bigint not null default 0 check (delivery_fee_uzs >= 0)
);

insert into public.bundle_builder_settings(id) values (1) on conflict (id) do nothing;
alter table public.bundle_builder_settings enable row level security;

drop policy if exists bundle_builder_settings_read on public.bundle_builder_settings;
create policy bundle_builder_settings_read on public.bundle_builder_settings
  for select to authenticated using (public.is_active_user());
drop policy if exists bundle_builder_settings_admin on public.bundle_builder_settings;
create policy bundle_builder_settings_admin on public.bundle_builder_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.bundle_builder_settings to authenticated;

-- Hisob operator brauzerida emas, serverdagi HAQIQIY mahsulot narxlari asosida tekshiriladi.
create or replace function public.calculate_custom_bundle(
  p_items jsonb,
  p_discount_type text default 'none',
  p_discount_value numeric default 0
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_settings public.bundle_builder_settings%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_id uuid;
  v_qty int;
  v_count int;
  v_seen uuid[] := array[]::uuid[];
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_type text := coalesce(p_discount_type, 'none');
  v_value numeric := coalesce(p_discount_value, 0);
begin
  if not public.is_active_user() then
    raise exception 'Hisob faol emas' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Mahsulotlar ro‘yxati noto‘g‘ri' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 30 then
    raise exception '1 tadan 30 tagacha mahsulot tanlang' using errcode = '22023';
  end if;
  select * into strict v_settings from public.bundle_builder_settings where id = 1;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'product_id', '') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(v_item->>'quantity', '') !~ '^[0-9]{1,2}$' then
      raise exception 'Mahsulot yoki miqdor noto‘g‘ri' using errcode = '22023';
    end if;
    v_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    if v_qty < 1 or v_qty > 99 or v_id = any(v_seen) then
      raise exception 'Mahsulot miqdori yoki takrorlanishi noto‘g‘ri' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_id);
    select * into v_product from public.products where id = v_id and status = 'published' and availability <> 'unavailable';
    if not found then
      raise exception 'Mahsulot mavjud emas yoki nashr etilmagan' using errcode = '22023';
    end if;
    if v_product.price_uzs is null then
      raise exception 'Mahsulot narxi kiritilmagan' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + v_product.price_uzs * v_qty;
    if v_subtotal > 9007199254740991 then
      raise exception 'Umumiy narx juda katta' using errcode = '22023';
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'id', v_product.id, 'sku', v_product.sku, 'name', v_product.name,
      'price_uzs', v_product.price_uzs, 'quantity', v_qty,
      'subtotal_uzs', v_product.price_uzs * v_qty
    ));
  end loop;

  if v_type not in ('none', 'percent', 'fixed') or v_value < 0 or v_value is null then
    raise exception 'Chegirma qiymati noto‘g‘ri' using errcode = '22023';
  end if;
  if v_type = 'none' then
    if v_value <> 0 then raise exception 'Chegirma noto‘g‘ri' using errcode = '22023'; end if;
  else
    if not v_settings.discount_enabled or (not public.is_admin() and not v_settings.operators_can_discount) then
      raise exception 'Chegirmaga ruxsat yo‘q' using errcode = '42501';
    end if;
    if v_type = 'percent' then
      if v_value > v_settings.max_discount_percent then
        raise exception 'Foizli chegirma limiti oshirilgan' using errcode = '22023';
      end if;
      v_discount := least(v_subtotal, round(v_subtotal * v_value / 100));
    else
      if v_value <> trunc(v_value) or v_value > v_settings.max_discount_uzs then
        raise exception 'Summali chegirma limiti oshirilgan' using errcode = '22023';
      end if;
      v_discount := least(v_subtotal, v_value);
    end if;
  end if;

  v_delivery := case when v_settings.free_delivery then 0 else v_settings.delivery_fee_uzs end;
  if v_subtotal - v_discount + v_delivery > 9007199254740991 then
    raise exception 'Yakuniy narx juda katta' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'items', v_lines,
    'subtotal_uzs', v_subtotal,
    'discount_uzs', v_discount,
    'delivery_uzs', v_delivery,
    'total_uzs', v_subtotal - v_discount + v_delivery
  );
end;
$$;

revoke all on function public.calculate_custom_bundle(jsonb, text, numeric) from public, anon;
grant execute on function public.calculate_custom_bundle(jsonb, text, numeric) to authenticated;
