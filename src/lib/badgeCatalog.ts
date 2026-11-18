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
    title:'100 ta qabul',why:'Jami 100 ta tasdiqlangan qabul qilganingiz uchun.',
    motivation:'Katta natijalar yuzta kichik g‘alabadan boshlanadi. Birinchi marrani zabt etdingiz!',
    icon:Target,iconColor:'text-amber-700',bg:'bg-amber-100',
  },
  '1000':{
    title:'1 000 ta qabul',why:'Jami 1 000 ta tasdiqlangan qabulga yetganingiz uchun.',
    motivation:'Mingta qabul — bu tajriba, sabr va tinimsiz harakat natijasi. Oldinga!',
    icon:Medal,iconColor:'text-orange-700',bg:'bg-orange-100',
  },
  '10000':{
    title:'10 000 ta qabul',why:'Jami 10 000 ta tasdiqlangan qabulga erishganingiz uchun.',
    motivation:'Bu marraga faqat izchil mehnat bilan yetiladi. Siz chinakam ustasiz!',
    icon:Crown,iconColor:'text-violet-700',bg:'bg-violet-100',
  },
  overachiever:{
    title:'Overachiever',why:'Bir oyda shaxsiy qabul maqsadining 150% ini bajarganingiz uchun.',
    motivation:'Maqsad shunchaki chegara edi. Siz undan ham yuqoriga ko‘tarildingiz!',
    icon:Zap,iconColor:'text-orange-700',bg:'bg-orange-100',
  },
  green7:{
    title:'7 Green Days',why:'Bir oyda kamida 7 ta yashil kun natijasiga erishganingiz uchun.',
    motivation:'Bir haftalik intizom — katta g‘alabalarning poydevori!',
    icon:Flame,iconColor:'text-green-700',bg:'bg-green-100',
  },
  green30:{
    title:'30 Green Days',why:'Bir oyda 30 ta yashil kun qayd etganingiz uchun.',
    motivation:'Har kuni yuqori natija — tasodif emas, haqiqiy professionallik!',
    icon:ShieldCheck,iconColor:'text-emerald-700',bg:'bg-emerald-100',
  },
  team_champion:{
    title:'Team Champion',why:'Oy yakunida g‘olib bo‘lgan jamoa a’zosi bo‘lganingiz uchun.',
    motivation:'Birgalikda yutgan g‘alaba har bir a’zoning hissasi bilan yaratiladi!',
    icon:Trophy,iconColor:'text-yellow-700',bg:'bg-yellow-100',
  },
  week_operator:{
    title:'Hafta operatori',why:'Tugallangan haftada qabul natijasi bo‘yicha 1-o‘rinni olganingiz uchun.',
    motivation:'Shu hafta hammaga namuna bo‘ldingiz. Tempni saqlang!',
    icon:Star,iconColor:'text-blue-700',bg:'bg-blue-100',
  },
  month_operator:{
    title:'Oy operatori',why:'Tugallangan oyda qabul natijasi bo‘yicha 1-o‘rinni olganingiz uchun.',
    motivation:'Bir oy davomida yuqori natijani ushlab turish — katta mahorat!',
    icon:Award,iconColor:'text-pink-700',bg:'bg-pink-100',
  },
  sales_machine:{
    title:'Sales Machine',why:'Admin yuqori va barqaror sotuv natijalaringizni e’tirof etgani uchun.',
    motivation:'Har bir suhbatni imkoniyatga aylantirish — sizning kuchli tomoningiz!',
    icon:TrendingUp,iconColor:'text-violet-700',bg:'bg-violet-100',
  },
  rising_star:{
    title:'Rising Star',why:'Admin qisqa vaqtdagi sezilarli o‘sishingizni e’tirof etgani uchun.',
    motivation:'Bugungi o‘sish — ertangi yetakchilikning boshlanishi!',
    icon:Rocket,iconColor:'text-sky-700',bg:'bg-sky-100',
  },
  unstopable:{
    title:'Unstopable',why:'Admin qiyinchiliklarga qaramay natijani saqlaganingizni e’tirof etgani uchun.',
    motivation:'To‘siqlar sizni to‘xtatmaydi — aksincha, yanada kuchli qiladi!',
    icon:Flame,iconColor:'text-red-700',bg:'bg-red-100',
  },
  trust_builder:{
    title:'Trust Builder',why:'Admin mijozlar ishonchini qozonishdagi mahoratingizni e’tirof etgani uchun.',
    motivation:'Ishonch — eng katta kapital. Siz uni har bir suhbatda yaratyapsiz!',
    icon:HeartHandshake,iconColor:'text-green-700',bg:'bg-green-100',
  },
  objection_slayer:{
    title:'Objection Slayer',why:'Admin mijoz e’tirozlariga mohirlik bilan yechim topishingizni e’tirof etgani uchun.',
    motivation:'Har bir e’tiroz — to‘g‘ri savol bilan yangi imkoniyat!',
    icon:MessageSquareQuote,iconColor:'text-purple-700',bg:'bg-purple-100',
  },
  deal_closer:{
    title:'Deal Closer',why:'Admin muzokaralarni muvaffaqiyatli savdo bilan yakunlashingizni e’tirof etgani uchun.',
    motivation:'Mijoz ishonchi va aniq yakun — sizning ustunligingiz!',
    icon:CheckCheck,iconColor:'text-emerald-700',bg:'bg-emerald-100',
  },
  early_bird:{
    title:'Early bird',why:'Admin ishga erta va muntazam tayyor bo‘lishingizni e’tirof etgani uchun.',
    motivation:'Kunini to‘g‘ri boshlagan operator doim bir qadam oldinda!',
    icon:Sun,iconColor:'text-amber-700',bg:'bg-amber-100',
  },
  team_hero:{
    title:'Team hero',why:'Admin jamoaga katta yordam va qo‘llab-quvvatlash berganingizni e’tirof etgani uchun.',
    motivation:'Eng kuchli jamoalar bir-biriga yordam beradigan odamlardan tuziladi!',
    icon:Users,iconColor:'text-blue-700',bg:'bg-blue-100',
  },
  team_lagend:{
    title:'Team lagend',why:'Admin jamoa ichidagi eng kuchli natijangizni e’tirof etgani uchun.',
    motivation:'Sizning natijangiz butun jamoaga marrani balandroq qo‘yadi!',
    icon:Trophy,iconColor:'text-fuchsia-700',bg:'bg-fuchsia-100',
  },
  bull:{
    title:'Bull',why:'Admin eng katta savdo hajmini qayd etganingiz uchun bergan maxsus badge.',
    motivation:'Katta savdo — katta mas’uliyat. Siz eng yuqori marraga intilyapsiz!',
    icon:TrendingUp,iconColor:'text-rose-700',bg:'bg-rose-100',
  },
};
export const isBadgeCode = (s:string):s is BadgeCode =>
  Object.prototype.hasOwnProperty.call(BADGE_CATALOG,s);
