import {
  Award, CheckCheck, Crown, Flame, HeartHandshake,
  Medal, MessageSquareQuote, Rocket, ShieldCheck, Star, Sun, Target, TrendingUp,
  Trophy, Users, Zap, type LucideIcon,
} from 'lucide-react';

export const AUTO_BADGE_CODES = [
  '100','1000','10000','overachiever','green7','green30',
  'team_champion','week_operator','month_operator',
] as const;
export const SPECIAL_BADGE_CODES = [
  'sales_machine','rising_star','unstopable','trust_builder',
  'objection_slayer','deal_closer','early_bird','team_hero',
  'team_lagend','bull',
] as const;
export type AutoBadgeCode = typeof AUTO_BADGE_CODES[number];
export type SpecialBadgeCode = typeof SPECIAL_BADGE_CODES[number];
export type BadgeCode = AutoBadgeCode | SpecialBadgeCode;
export type BadgeMeta = {
  title:string; why:string; motivation:string;
  icon:LucideIcon; iconColor:string; bg:string;
};
export const BADGE_CATALOG: Record<BadgeCode,BadgeMeta> = {
  '100':{
    title:'100 ta qabul',why:'Siz 100 ta tasdiqlangan buyurtmani qabul qilib, birinchi katta marrangizga yetdingiz.',
    motivation:'100 ta qabul — 100 ta imkoniyat. Ilk katta g‘alaba ortda, endi minglik sari!',
    icon:Target,iconColor:'text-amber-700',bg:'bg-amber-100',
  },
  '1000':{
    title:'1 000 ta qabul',why:'Siz jami 1 000 ta buyurtmani qabul qilib, barqaror natijaga erishdingiz.',
    motivation:'Mingta qabul bir kunda yaralmaydi. Siz har bir suhbat bilan katta tajriba to‘pladingiz!',
    icon:Medal,iconColor:'text-orange-700',bg:'bg-orange-100',
  },
  '10000':{
    title:'10 000 ta qabul',why:'Siz jami 10 000 ta tasdiqlangan qabul bilan katta professional marraga chiqdingiz.',
    motivation:'O‘n mingta natija ortida sabr va mahorat bor. Siz boshqalarga namuna bo‘la olasiz!',
    icon:Crown,iconColor:'text-violet-700',bg:'bg-violet-100',
  },
  overachiever:{
    title:'Overachiever',why:'Bir oydagi shaxsiy qabul maqsadingizni kamida 150% bajardingiz.',
    motivation:'Maqsad siz uchun to‘xtash chizig‘i emasligini isbotladingiz. Sizning marrangiz yanada baland!',
    icon:Zap,iconColor:'text-orange-700',bg:'bg-orange-100',
  },
  green7:{
    title:'7 Green Days',why:'Bir oy ichida kamida 7 ta yashil KPI kunini qayd etdingiz.',
    motivation:'Bitta yaxshi kun tasodif bo‘lishi mumkin. Yetti yashil kun esa haqiqiy intizom!',
    icon:Flame,iconColor:'text-green-700',bg:'bg-green-100',
  },
  green30:{
    title:'30 Green Days',why:'Bir oy ichida 30 ta yashil KPI kuniga erishdingiz.',
    motivation:'Har kuni me’yorni bajarish — haqiqiy professionallik. Siz barqarorlik timsolisiz!',
    icon:ShieldCheck,iconColor:'text-emerald-700',bg:'bg-emerald-100',
  },
  team_champion:{
    title:'Team Champion',why:'Sizning jamoangiz oy yakunida Teams Battle g‘olibi bo‘ldi.',
    motivation:'G‘alaba faqat sardorniki emas. Sizning hissangiz ham jamoani cho‘qqiga olib chiqdi!',
    icon:Trophy,iconColor:'text-yellow-700',bg:'bg-yellow-100',
  },
  week_operator:{
    title:'Hafta operatori',why:'Tugallangan haftada tasdiqlangan qabul bo‘yicha birinchi bo‘ldingiz.',
    motivation:'Bu hafta tempni siz belgiladingiz. Keyingi marrani ham shunday zabt eting!',
    icon:Star,iconColor:'text-blue-700',bg:'bg-blue-100',
  },
  month_operator:{
    title:'Oy operatori',why:'Tugallangan oyda tasdiqlangan qabul soni bo‘yicha 1-o‘rinni egalladingiz.',
    motivation:'Bir kun emas, butun oy yetakchi bo‘lish — katta mehnat va katta g‘alaba!',
    icon:Award,iconColor:'text-pink-700',bg:'bg-pink-100',
  },
  sales_machine:{
    title:'Sales Machine',why:'Administrator sizni yuqori va barqaror sotuv natijalaringiz uchun taqdirladi.',
    motivation:'Siz suhbatni shunchaki yakunlamaysiz, uni natijaga aylantirasiz. Bu sizning kuchingiz!',
    icon:TrendingUp,iconColor:'text-violet-700',bg:'bg-violet-100',
  },
  rising_star:{
    title:'Rising Star',why:'Administrator qisqa vaqtdagi sezilarli professional o‘sishingizni e’tirof etdi.',
    motivation:'Kecha o‘rgangan narsangiz bugun natijaga aylandi. Ertangi imkoniyatlaringiz yanada katta!',
    icon:Rocket,iconColor:'text-sky-700',bg:'bg-sky-100',
  },
  unstopable:{
    title:'Unstopable',why:'Administrator to‘siqlarga qaramay natija ko‘rsatganingizni e’tirof etdi.',
    motivation:'Og‘ir kun sizni to‘xtata olmadi. Taslim bo‘lmaslik — haqiqiy ustunligingiz!',
    icon:Flame,iconColor:'text-red-700',bg:'bg-red-100',
  },
  trust_builder:{
    title:'Trust Builder',why:'Administrator mijozlarda ishonch uyg‘otishdagi mahoratingizni e’tirof etdi.',
    motivation:'Savdo ishonchdan boshlanadi. Siz uni har bir suhbatda hurmat bilan yaratyapsiz!',
    icon:HeartHandshake,iconColor:'text-green-700',bg:'bg-green-100',
  },
  objection_slayer:{
    title:'Objection Slayer',why:'Administrator mijozning murakkab e’tirozlariga yechim topish mahoratingizni taqdirladi.',
    motivation:'Boshqalar to‘siq deb ko‘rgan savolni siz yangi imkoniyatga aylantirasiz!',
    icon:MessageSquareQuote,iconColor:'text-purple-700',bg:'bg-purple-100',
  },
  deal_closer:{
    title:'Deal Closer',why:'Administrator suhbatni kelishuv va sotuv bilan yakunlash mahoratingizni taqdirladi.',
    motivation:'Siz mijozni tushunasiz, to‘g‘ri taklif qilasiz va natija bilan yakunlaysiz!',
    icon:CheckCheck,iconColor:'text-emerald-700',bg:'bg-emerald-100',
  },
  early_bird:{
    title:'Early bird',why:'Administrator ishga erta va muntazam tayyor bo‘lishingizni e’tirof etdi.',
    motivation:'Siz kun boshlanishidan avval o‘zingizga ustunlik yaratasiz. Intizom — kuchingiz!',
    icon:Sun,iconColor:'text-amber-700',bg:'bg-amber-100',
  },
  team_hero:{
    title:'Team hero',why:'Administrator jamoaga ko‘rsatgan katta yordamingiz va hissangizni qadrladi.',
    motivation:'Siz faqat o‘zingizni emas, yoningizdagilarni ham yuqoriga tortasiz. Haqiqiy jamoa qahramonisiz!',
    icon:Users,iconColor:'text-blue-700',bg:'bg-blue-100',
  },
  team_lagend:{
    title:'Team lagend',why:'Administrator jamoa ichidagi yetakchi natijangizni alohida e’tirof etdi.',
    motivation:'Natijangiz boshqalarga mezon bo‘ldi. Siz jamoaga faqat raqam emas, ruh ham beryapsiz!',
    icon:Trophy,iconColor:'text-fuchsia-700',bg:'bg-fuchsia-100',
  },
  bull:{
    title:'Bull',why:'Administrator sizning eng katta savdo hajmini shakllantirganingizni e’tirof etdi.',
    motivation:'Katta natija katta jasorat talab qiladi. Siz katta imkoniyatlardan cho‘chimaysiz!',
    icon:TrendingUp,iconColor:'text-rose-700',bg:'bg-rose-100',
  },
};
export const isBadgeCode = (s:string):s is BadgeCode =>
  Object.prototype.hasOwnProperty.call(BADGE_CATALOG,s);
