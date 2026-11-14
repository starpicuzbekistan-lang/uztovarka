-- UZTOVARKA Operator Hub — 005: boshlang‘ich ma’lumotlar
-- • KPI standart sozlamalari (haqiqiy konfiguratsiya).
-- • DEMO kontent: is_demo = true bilan belgilangan. NARX, KAFOLATLANGAN MOSLIK, ZAXIRA kiritilmagan — buni administrator to‘ldiradi.
--   Admin panel → Sozlamalar → "Demo ma’lumotlarni o‘chirish" barcha demo kontentni bir bosishda o‘chiradi.

insert into kpi_setting_versions
  (operator_id, effective_from, monthly_target_uzs, working_days, daily_target, min_threshold,
   shortfall_coef_uzs, bonus_coef_uzs, absence_rule, absence_fixed_uzs, leave_policy, note)
values
  (null, '2020-01-01', 2000000, 30, 60, 50, 1000, 2000, 'prorata', 0, 'neutral', 'Boshlang‘ich standart sozlama')
on conflict do nothing;

insert into product_categories (name, position) values
  ('Avtokosmetika', 1), ('Aksessuarlar', 2), ('Yoritish', 3) on conflict do nothing;
insert into article_categories (name, position) values
  ('Sotuv texnikasi', 1), ('E’tirozlar bilan ishlash', 2), ('Telefon muloqoti', 3), ('Kundalik amaliyot', 4) on conflict do nothing;

-- ───────────── DEMO mahsulotlar ─────────────
insert into products (sku, name, category_id, description, benefits, intended_use, usage_steps, faqs, concerns, status, is_demo)
select v.sku, v.name, (select id from product_categories where name = v.cat), v.descr, v.benefits, v.use_, v.steps, v.faqs::jsonb, v.concerns, 'published', true
from (values
  ('KRB-001', 'Karbon lenta (eshik osti)', 'Aksessuarlar',
   'Eshik osti qismlarini tirnalish va ishqalanishdan himoyalashga yordam beruvchi yopishtiriladigan lenta.',
   array['Eshik osti qismini tirnalishdan himoyalashga yordam beradi','Yopishtiriladigan, o‘rnatish uchun alohida asbob talab qilinmaydi'],
   'Avtomobil eshik osti (porog) qismi.',
   array['Yopishtiriladigan joyni tozalang va quriting','Lentani joyiga qo‘yib o‘lchang','Himoya qatlamini asta olib, silliq bosib yopishtiring'],
   '[{"q":"Qayerga yopishtiriladi?","a":"Eshik osti qismiga. Aniq joylashuvni mahsulot bilan birga berilgan yo‘riqnomadan tekshiring."},{"q":"Qaysi avtomobillarga mos?","a":"Moslik ma’lumoti administrator tomonidan kiritilmagan. Mijozga taxmin bilan javob bermang."}]',
   array['Mashinamga mos keladimi?','Qancha muddat turadi?']),
  ('DSH-001', 'Dashboard spreyi', 'Avtokosmetika',
   'Avtomobil salon paneli (dashboard) yuzasini tozalash va parvarishlash uchun sprey.',
   array['Panel yuzasini changdan tozalashga yordam beradi'],
   'Salon paneli va plastik yuzalar.',
   array['Spreyni sochiqqa sepib oling','Yuzani artib chiqing','Quruq sochiq bilan yuzani silliqlang'],
   '[{"q":"Barcha plastik turlariga mosmi?","a":"Kiritilmagan. Avval ko‘zga ko‘rinmas joyda sinab ko‘rish tavsiya etiladi."}]',
   array['Yog‘li iz qoldirmaydimi?']),
  ('SOC-001', 'Avto sochiq (mikrofibra)', 'Avtokosmetika',
   'Avtomobilni artish va parvarishlash uchun mikrofibra sochiq.',
   array['Yuzani tirnamasdan artishga mo‘ljallangan'],
   'Kuzov, oynalar va salon yuzalarini artish.',
   array['Toza va quruq sochiq ishlating','Ifloslangach yuving'],
   '[]', array[]::text[]),
  ('HYD-001', 'Gidropolimer', 'Avtokosmetika',
   'Avtomobil yuzasiga surtiladigan himoya vositasi.',
   array[]::text[], 'Kuzov yuzasi.', array[]::text[], '[]', array[]::text[]),
  ('TIR-001', 'Shina yaltiratgich', 'Avtokosmetika',
   'G‘ildirak shinalarining yon qismini parvarishlash uchun vosita.',
   array[]::text[], 'Shina yon yuzasi.', array[]::text[], '[]', array[]::text[]),
  ('CRY-001', 'Crystal coating', 'Avtokosmetika',
   'Avtomobil kuzovi uchun himoya qoplamasi.',
   array[]::text[], 'Kuzov yuzasi.', array[]::text[], '[]', array[]::text[]),
  ('LED-001', 'Polik LED yoritgich', 'Yoritish',
   'Salon pol qismi (oyoq osti) uchun LED yoritgich.',
   array[]::text[], 'Salon pol qismi.', array[]::text[], '[]', array['Akkumulyatorni tez bo‘shatmaydimi?']),
  ('ESH-001', 'Eshik amortizatorlari', 'Aksessuarlar',
   'Eshikni yumshoq yopilishiga yordam beruvchi amortizatorlar.',
   array[]::text[], 'Avtomobil eshiklari.', array[]::text[], '[]', array['Mashinamga mos keladimi?'])
) as v(sku, name, cat, descr, benefits, use_, steps, faqs, concerns)
on conflict (sku) do nothing;

-- ───────────── DEMO naborlar (narx va yetkazib berish — administrator kiritadi) ─────────────
insert into sets (code, name, description, status, is_demo) values
  ('SET-01', 'Karbon + Dashboard spreyi + Sochiq', 'Eshik osti himoyasi va salon parvarishi uchun nabor.', 'published', true),
  ('SET-02', 'Karbon + Dashboard spreyi + Gidropolimer', 'Eshik osti himoyasi, salon va kuzov parvarishi uchun nabor.', 'published', true),
  ('SET-03', 'Crystal coating + Shina yaltiratgich + Sochiq', 'Kuzov va shina parvarishi uchun nabor.', 'published', true),
  ('SET-04', 'Eshik amortizatorlari + Polik LED', 'Avtomobil salonini yangilash uchun nabor.', 'published', true)
on conflict (code) do nothing;

insert into set_items (set_id, product_id, quantity, is_bonus, position)
select s.id, p.id, v.qty, false, v.pos
from (values
  ('SET-01','KRB-001',4,1), ('SET-01','DSH-001',1,2), ('SET-01','SOC-001',1,3),
  ('SET-02','KRB-001',4,1), ('SET-02','DSH-001',1,2), ('SET-02','HYD-001',1,3),
  ('SET-03','CRY-001',1,1), ('SET-03','TIR-001',1,2), ('SET-03','SOC-001',1,3),
  ('SET-04','ESH-001',1,1), ('SET-04','LED-001',1,2)
) as v(code, sku, qty, pos)
join sets s on s.code = v.code join products p on p.sku = v.sku
on conflict do nothing;

-- ───────────── DEMO skriptlar ─────────────
do $$
declare g uuid; s1 uuid; st uuid; set1 uuid;
begin
  select id into set1 from sets where code = 'SET-01';

  insert into scripts (title, category, description, status, is_demo)
  values ('Umumiy sotuv skripti', 'general', 'Har qanday mahsulot uchun 5 bosqichli telefon suhbati.', 'published', true)
  returning id into g;
  insert into script_stages (script_id, position, title, objective, body, notes) values
   (g, 1, 'Salomlashish', 'Kompaniyani tanishtirish va mijoz qiziqishini tasdiqlash.',
    'Assalomu alaykum, men UZTOVARKA operatori [ismingiz]. Siz avtomobil uchun mahsulotga so‘rov qoldirgan edingiz. Hozir 2 daqiqa gaplashsak bo‘ladimi?',
    'Sekin va xotirjam gapiring. Mijoz band bo‘lsa, qulay vaqtni so‘rang.'),
   (g, 2, 'Ehtiyojni aniqlash', 'Mijoz vaziyatini tushunish.',
    'Qaysi avtomobilingiz bor? Aynan nimani hal qilmoqchisiz — himoya, tozalik yoki salon ko‘rinishi?',
    'Ochiq savollar bering va oxirigacha tinglang. Mijoz javobini yozib boring.'),
   (g, 3, 'Mahsulot taqdimoti', 'Mijoz ehtiyojiga mos taklifni tushuntirish.',
    'Siz aytgan ehtiyoj uchun [nabor nomi] mos keladi. Tarkibida: {{tarkib}}.',
    'Faqat tasdiqlangan ma’lumotni ayting. Moslik yoki xususiyatni bilmasangiz, "aniqlab beraman" deng.'),
   (g, 4, 'E’tirozlar bilan ishlash', 'Mijoz xavotirlarini tinglash va aniq javob berish.',
    'Tushunaman, bu muhim savol. Aytingchi, aynan nima sizni o‘ylantiryapti?',
    'E’tirozlar kutubxonasidan mos javobni toping. Bahslashmang.'),
   (g, 5, 'Buyurtmani tasdiqlash', 'Kelishilgan shartlarni takrorlash.',
    'Keling, buyurtmani tasdiqlab olamiz: {{nabor_nomi}}, narxi {{narx}}. Yetkazib berish: {{yetkazib_berish}}. Manzilingizni aytib bera olasizmi?',
    'Ism, telefon, manzil, tarkib va narxni ovoz chiqarib takrorlang.');

  insert into scripts (title, category, description, status, is_demo)
  values ('SET-01 skripti', 'sets', 'Karbon + Dashboard spreyi + Sochiq naborini taklif qilish.', 'published', true)
  returning id into s1;
  insert into script_sets (script_id, set_id) values (s1, set1);
  insert into script_stages (script_id, position, title, objective, body, notes) values
   (s1, 1, 'Salomlashish', 'Tanishuv.', 'Assalomu alaykum, men UZTOVARKA operatori [ismingiz]. Avtomobil parvarishi bo‘yicha so‘rov qoldirgan edingiz. Gaplashsak bo‘ladimi?', null),
   (s1, 2, 'Ehtiyojni aniqlash', 'Mijoz ehtiyojini bilish.', 'Mashinangizning eshik osti qismi va salon paneli holati qanday? Qaysi biriga ko‘proq e’tibor berasiz?', null),
   (s1, 3, 'Mahsulot taqdimoti', 'Nabor tarkibini tushuntirish.', '{{nabor_nomi}} naborida: {{tarkib}}. Narxi: {{narx}}.', 'Narx ko‘rinmasa — administrator kiritmagan; mijozga taxminiy narx aytmang.'),
   (s1, 4, 'E’tirozlar bilan ishlash', 'Savollarga javob.', 'Mashinangizga moslik haqida: moslik ma’lumotini mahsulot sahifasidan tekshirib, aniq aytaman.', null),
   (s1, 5, 'Buyurtmani tasdiqlash', 'Shartlarni tasdiqlash.', 'Buyurtma: {{nabor_nomi}}, {{narx}}. Yetkazib berish: {{yetkazib_berish}}. Manzilingizni ayting.', null);

  insert into scripts (title, category, description, status, is_demo)
  values ('Suhbat standartlari', 'standards', 'Har bir qo‘ng‘iroq uchun umumiy qoidalar.', 'published', true)
  returning id into st;
  insert into script_stages (script_id, position, title, objective, body, notes) values
   (st, 1, 'Muloqot qoidalari', 'Yagona muloqot uslubi.',
    'Mijozga "Siz" deb murojaat qiling. Ismini so‘rab, suhbat davomida ishlating. Gapini bo‘lmang. Va’dani faqat bajara olsangiz bering.',
    'Mijoz xafa bo‘lsa, avval tinglang, keyin yechim taklif qiling.');
end $$;

-- ───────────── DEMO e’tirozlar ─────────────
insert into objections (objection, response, explanation, category, position, is_demo) values
 ('Qimmat ekan', 'Tushunaman, narx muhim. Aytingchi, nimaga nisbatan qimmat deb o‘ylayapsiz? Naborda nimalar borligini sanab chiqay, keyin birga baholaymiz.', 'Avval aniqlang: narxmi yoki qiymatni tushunmaslikmi. Bahslashmang, tarkib va miqdorni ko‘rsating.', 'Narx', 1, true),
 ('Keyin olaman', 'Albatta. Keyinroq qaysi vaqtda qayta bog‘lansam qulay bo‘ladi? Shu orada savollaringiz bo‘lsa, hoziroq javob beray.', 'Aniq vaqt kelishib oling. Bosim o‘tkazmang.', 'Kechiktirish', 2, true),
 ('O‘ylab ko‘raman', 'Yaxshi. Odatda mijozlar o‘ylaganda bitta narsaga to‘xtaladi — narx, sifat yoki moslik. Sizni aynan nima o‘ylantiryapti?', 'Haqiqiy e’tirozni aniqlash uchun savol bering.', 'Kechiktirish', 3, true),
 ('Menga kerak emas', 'Tushundim. Avtomobilingizni hozir qanday parvarish qilasiz, bilsam bo‘ladimi? Balki sizga mos boshqa variant bordir.', 'Ehtiyojni qayta aniqlang, majburlamang.', 'Ehtiyoj', 4, true),
 ('Sizlarga qanday ishonaman?', 'Yaxshi savol. Buyurtma shartlari, yetkazib berish va to‘lov tartibini aniq aytib beraman, siz hamma narsani tushunib, keyin qaror qilasiz.', 'Faqat haqiqiy shartlarni ayting. Ortiqcha va’da bermang.', 'Ishonch', 5, true),
 ('Boshqa joyda arzonroq ekan', 'Taqqoslaganingiz yaxshi. Ular taklif qilayotgan tarkib va miqdorni aytsangiz, birga solishtirib ko‘ramiz.', 'Raqobatchini yomonlamang. Tarkib va shartlarni taqqoslang.', 'Narx', 6, true),
 ('Mahsulot yaxshi ishlaydimi?', 'Mahsulotning vazifasi va qo‘llanilishini aniq tushuntirib beraman. Natija foydalanish usuliga ham bog‘liq, shu sababli yo‘riqnomani ham aytib o‘tay.', 'Ortiqcha va kafolatlangan natija va’da qilmang.', 'Sifat', 7, true),
 ('Mashinamga mos keladimi?', 'Avtomobilingiz markasi va modelini ayting, mahsulot ma’lumotlari bo‘yicha tekshirib, aniq javob beraman.', 'Moslik tasdiqlanmagan bo‘lsa, taxmin qilmang; administratorga murojaat qiling.', 'Moslik', 8, true);

-- ───────────── DEMO maqolalar (6 ta) ─────────────
insert into articles (title, excerpt, content, category_id, status, pinned, read_minutes, published_at, is_demo)
select v.title, v.excerpt, v.content, (select id from article_categories where name = v.cat), 'published', v.pinned, v.mins, now() - (v.age || ' days')::interval, true
from (values
('Mijoz bilan suhbatning dastlabki 15 soniyasi',
 'Telefon suhbatida birinchi soniyalar mijoz davom ettirish yoki to‘xtatishini hal qiladi. Qisqa va aniq ochilish qanday bo‘ladi?',
 $a$<p>Telefon orqali suhbatda mijoz dastlabki soniyalardayoq «bu menga kerakmi?» degan savolga javob izlaydi. Shu sababli ochilish qismi qisqa, aniq va xotirjam bo‘lishi kerak.</p>
<h2>Dastlabki 15 soniyada nima aytish kerak?</h2>
<ol><li>Salomlashing va ismingizni ayting.</li><li>Qaysi kompaniyadan qo‘ng‘iroq qilayotganingizni ayting.</li><li>Qo‘ng‘iroq sababini bitta jumlada tushuntiring (masalan, mijoz so‘rov qoldirgan).</li><li>Gaplashish uchun qulay vaqt ekanini so‘rang.</li></ol>
<h2>Misol</h2>
<p><em>«Assalomu alaykum, men UZTOVARKA operatori Aziza. Siz avtomobil uchun mahsulotga so‘rov qoldirgan edingiz. Hozir ikki daqiqa gaplashsak bo‘ladimi?»</em></p>
<h2>Tez-tez uchraydigan xatolar</h2>
<ul><li>Juda tez va bir nafasda gapirish.</li><li>Uzun kirish: mijoz nima uchun qo‘ng‘iroq qilinganini tushunmaydi.</li><li>Suhbatni darhol narxdan boshlash.</li><li>Mijoz ismini noto‘g‘ri yoki aniq bo‘lmagan holda aytish.</li></ul>
<h2>Amaliy maslahat</h2>
<p>Ochilish gapini yozib oling va ovoz chiqarib mashq qiling. Maqsad — yodlab, robot kabi o‘qish emas, balki o‘z so‘zlaringiz bilan tabiiy aytishdir. Ovozingiz yoqimli va ishonchli chiqishi uchun gapirayotganda tabassum qilish yordam beradi.</p>$a$,
 'Telefon muloqoti', true, 4, 1),

('Mijoz qimmat desa, qanday javob berish kerak?',
 '«Qimmat ekan» — eng ko‘p uchraydigan e’tiroz. Ko‘pincha gap narxda emas, qiymatni to‘liq tushunmaslikda bo‘ladi.',
 $a$<p>«Qimmat ekan» degan gap har doim ham «sotib olmayman» degani emas. Ko‘pincha mijoz nima olayotganini hali to‘liq tasavvur qilmagan bo‘ladi.</p>
<h2>4 qadamli yondashuv</h2>
<ol><li><strong>Tinglang.</strong> Gapni bo‘lmang, bahslashmang.</li><li><strong>Aniqlang.</strong> «Nimaga nisbatan qimmat deb o‘ylayapsiz?» — javob sizga haqiqiy sababni ko‘rsatadi.</li><li><strong>Qiymatni ko‘rsating.</strong> Naborda nimalar borligini, nechta dona ekanini va qanday foyda berishini aniq sanab bering.</li><li><strong>Tasdiqlang.</strong> «Shu tarkib sizga mos keladimi?» deb so‘rang.</li></ol>
<h2>Misol</h2>
<p><em>Mijoz:</em> «Qimmat ekan.»<br><em>Operator:</em> «Tushunaman, narx muhim. Aytingchi, nimaga nisbatan qimmat deb o‘ylayapsiz? Naborda nimalar borligini aytib o‘tay, keyin birga baholaymiz.»</p>
<h2>Nimalardan qochish kerak</h2>
<ul><li>Narxni asossiz tushirishni va’da qilish.</li><li>Boshqa sotuvchilarni yomonlash.</li><li>Mahsulot haqida bo‘rttirilgan gaplar aytish.</li></ul>
<p>Esda tuting: sizning vazifangiz mijozni ishontirib yuborish emas, balki unga to‘g‘ri ma’lumot berib, o‘z qarorini qabul qilishga yordam berishdir.</p>$a$,
 'E’tirozlar bilan ishlash', false, 5, 3),

('Buyurtmani tasdiqlashda operatorlar qiladigan 5 ta xato',
 'Buyurtma tasdiqlanayotgan paytdagi kichik xatolar keyinchalik qaytarilgan buyurtmaga olib keladi. Eng ko‘p uchraydigan 5 ta xato.',
 $a$<p>Mijoz roziligini olgandan keyin ishning yarmi qolgan bo‘ladi. Buyurtmani noto‘g‘ri tasdiqlash qaytarilgan yoki yetkazib berilmagan buyurtmalarga sabab bo‘ladi.</p>
<h2>5 ta keng tarqalgan xato</h2>
<ol>
<li><strong>Manzilni to‘liq aniqlamaslik.</strong> Tuman, ko‘cha, uy raqami va mo‘ljalni so‘rang.</li>
<li><strong>Shartlarni aytmaslik.</strong> Narx, yetkazib berish va to‘lov tartibini mijozga aniq ayting.</li>
<li><strong>Tarkibni takrorlamaslik.</strong> Mijoz aynan nima olayotganini bilishi kerak.</li>
<li><strong>Telefon raqamini tekshirmaslik.</strong> Raqamni ovoz chiqarib takrorlang.</li>
<li><strong>Ortiqcha va’da berish.</strong> Bajara olmaydigan muddat yoki natijani va’da qilmang.</li>
</ol>
<h2>Tasdiqlash tekshiruv ro‘yxati</h2>
<ul><li>Ism va telefon raqami</li><li>To‘liq manzil</li><li>Nabor nomi va tarkibi</li><li>Narx va yetkazib berish shartlari</li></ul>
<p>Oxirida: «Hammasini to‘g‘ri yozib oldimmi?» deb so‘rang. Bu bir necha soniya oladi, lekin ko‘p muammoning oldini oladi.</p>$a$,
 'Sotuv texnikasi', false, 4, 5),

('Telefon orqali mijoz ishonchini oshirish usullari',
 'Mijoz sizni ko‘rmaydi, faqat eshitadi. Ishonchni ovoz, aniqlik va halollik orqali qanday qurish mumkin?',
 $a$<p>Telefon orqali sotuvda mijoz sizning yuzingizni ko‘rmaydi. Ishonch faqat so‘zlaringiz, ovoz ohangingiz va aniqligingizga tayanadi.</p>
<h2>Ishonchni oshiradigan odatlar</h2>
<ol>
<li><strong>Aniq gapiring.</strong> «Taxminan», «chamasi» kabi so‘zlarni kamaytiring; bilmasangiz, «aniqlab beraman» deng.</li>
<li><strong>Ismi bilan murojaat qiling.</strong> Bu mijozga e’tibor berayotganingizni bildiradi.</li>
<li><strong>Shartlarni oldindan ayting.</strong> Yetkazib berish va to‘lov tartibini yashirmang.</li>
<li><strong>Tinglang.</strong> Mijoz gapini tugatmaguncha javob bermang.</li>
<li><strong>Va’dani bajaring.</strong> Qayta qo‘ng‘iroq qilaman desangiz, qiling.</li>
</ol>
<h2>Misol</h2>
<p><em>«Bu savolga aniq javob berish uchun mahsulot ma’lumotini tekshirib olaman, bir daqiqa kuting.»</em> Bu taxmin qilib noto‘g‘ri javob berishdan yaxshiroq.</p>
<p>Halollik uzoq muddatda har doim yutadi: mijoz sizga yana murojaat qiladi va boshqalarga tavsiya qiladi.</p>$a$,
 'Telefon muloqoti', false, 4, 8),

('Kuchli sotuv operatorining 7 ta kundalik odati',
 'Natija bir kunda emas, har kuni takrorlanadigan kichik odatlardan shakllanadi. Kuningizni qanday tashkil qilish mumkin?',
 $a$<p>Yaxshi natijalar odatda tasodif emas — ular kundalik kichik odatlardan shakllanadi.</p>
<h2>7 ta odat</h2>
<ol>
<li><strong>Kunni maqsad bilan boshlang.</strong> Bugun nechta buyurtma qabul qilmoqchisiz?</li>
<li><strong>Mahsulotni takrorlang.</strong> Tarkib va foydalanish usullarini ish boshlashdan oldin ko‘z yugurtiring.</li>
<li><strong>Skriptni o‘z so‘zlaringiz bilan ayting.</strong> Yodlangan matn tabiiy eshitilmaydi.</li>
<li><strong>Qo‘ng‘iroqlar orasida qisqa tanaffus qiling.</strong> Ovoz va kayfiyatni tiklash uchun.</li>
<li><strong>Natijani halol kiriting.</strong> To‘g‘ri hisobot — to‘g‘ri tahlilning asosi.</li>
<li><strong>Xatolardan xulosa chiqaring.</strong> Muvaffaqiyatsiz suhbatda nima qilsa bo‘lar edi?</li>
<li><strong>Kunni yakunlang.</strong> Ertangi kun uchun bitta narsani yaxshilashni belgilang.</li>
</ol>
<p>Hammasini bir kunda joriy etish shart emas: bitta odatdan boshlang va uni ikki hafta davom ettiring.</p>$a$,
 'Kundalik amaliyot', false, 4, 11),

('Mijoz e’tirozlarini to‘g‘ri aniqlash va yengish',
 'Har bir e’tiroz ortida aniq sabab bor. Bahona bilan haqiqiy e’tirozni ajratib olish va unga javob berish usuli.',
 $a$<p>E’tiroz — bu mijozning qiziqishi borligining belgisi. Befarq mijoz savol bermaydi.</p>
<h2>Haqiqiy e’tiroz va bahona</h2>
<p>«Keyin olaman» yoki «o‘ylab ko‘raman» ko‘pincha bahona bo‘ladi. Haqiqiy sabab narx, ishonch yoki moslik bo‘lishi mumkin. Uni aniqlash uchun savol bering.</p>
<h2>Javob berish formulasi</h2>
<ol>
<li><strong>Tushunish.</strong> «Tushunaman, bu muhim masala.»</li>
<li><strong>Aniqlash.</strong> «Aynan nima sizni o‘ylantiryapti?»</li>
<li><strong>Javob berish.</strong> Faqat tasdiqlangan ma’lumot bilan javob bering.</li>
<li><strong>Tasdiqlash.</strong> «Shu javob sizga to‘g‘ri keldimi?»</li>
</ol>
<h2>Misol</h2>
<p><em>Mijoz:</em> «O‘ylab ko‘raman.»<br><em>Operator:</em> «Albatta. Odatda mijozlar o‘ylaganda bitta narsaga to‘xtaladi — narx, sifat yoki moslik. Sizni qaysi biri o‘ylantiryapti?»</p>
<p>Agar mijoz javob bera olmasa yoki istamasa, bosim o‘tkazmang. Aniq vaqt kelishib, keyinroq bog‘laning.</p>$a$,
 'E’tirozlar bilan ishlash', false, 5, 14)
) as v(title, excerpt, content, cat, pinned, mins, age);
