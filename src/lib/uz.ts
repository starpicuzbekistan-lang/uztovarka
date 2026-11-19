import type { ReportStatus } from './kpi';
import type { PaymentStatus } from './payroll';

export const REPORT_STATUS_UZ: Record<ReportStatus, string> = {
  pending: 'Tasdiqlash kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  correction_requested: 'Tuzatish so‘ralgan',
};

export const PAYMENT_STATUS_UZ: Record<PaymentStatus, string> = {
  calculating: 'Hisoblanmoqda',
  pending_approval: 'Tasdiqlash kutilmoqda',
  approved: 'Tasdiqlangan',
  partially_paid: 'Qisman to‘langan',
  paid: 'To‘langan',
};

export const PAYMENT_KIND_UZ = { advance: 'Avans', partial: 'Qisman to‘lov', final: 'Yakuniy to‘lov' } as const;
export const ATTENDANCE_UZ = { absent: 'Kelmagan', leave: 'Tasdiqlangan ta’til', day_off: 'Dam olish kuni' } as const;
export const AVAILABILITY_UZ = { available: 'Mavjud', limited: 'Cheklangan', unavailable: 'Mavjud emas' } as const;
export const PUBLISH_UZ = { draft: 'Qoralama', published: 'Nashr etilgan', archived: 'Arxivlangan' } as const;
export const SCRIPT_CATEGORY_UZ = {
  general: 'Umumiy sotuv skripti',
  sets: 'Naborlar bo‘yicha skriptlar',
  objections: 'E’tirozlar bilan ishlash',
  standards: 'Suhbat standartlari',
} as const;
export const ABSENCE_RULE_UZ = { prorata: 'Oylikni kunlarga taqsimlash (proporsional)', fixed: 'Belgilangan summa', none: 'Kamaytirilmaydi' } as const;
export const LEAVE_POLICY_UZ = { neutral: 'Oylikka ta’sir qilmaydi', same_as_absence: 'Kelmagan kun bilan bir xil' } as const;
export const ROLE_UZ = { admin: 'Administrator', operator: 'Operator' } as const;

export const NOT_PROVIDED = 'Administrator tomonidan kiritilmagan';

/** Foydalanuvchiga ko‘rsatiladigan xabar: texnik matnlar hech qachon ko‘rsatilmaydi. */
export function humanError(e: unknown): string {
  const err = e as { message?: string; code?: string; status?: number } | null;
  const msg = err?.message ?? '';
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return 'Internet aloqasi yo‘q. Aloqani tekshirib, qayta urinib ko‘ring.';
  }
  // Bizning RPC funksiyalarimiz o‘zbekcha xabar bilan istisno tashlaydi
  if (err?.code && ['22023', '42501', '23505', 'P0002'].includes(err.code) && msg) return msg;
  if (/invalid login credentials/i.test(msg)) return 'Email yoki parol noto‘g‘ri.';
  if (/email not confirmed/i.test(msg)) return 'Email hali tasdiqlanmagan. Admin profilingizni tasdiqlagan bo‘lsa, undan «Kirishdagi email xatosini tuzatish» tugmasini bosishni so‘rang. Qayta ro‘yxatdan o‘tmang.';
  if (/banned|user is banned/i.test(msg)) return 'Hisobingiz faol emas. Administratorga murojaat qiling.';
  if (/rate limit|too many|over_email_send_rate_limit|security purposes/i.test(msg)) {
    return 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.';
  }
  if (/same as the old|different from the old/i.test(msg)) return 'Yangi parol eskisidan farq qilishi kerak.';
  if (/password should be|weak password|at least/i.test(msg)) return 'Parol juda oddiy. Kamida 8 ta belgi, bosh va kichik harf hamda raqam ishlating.';
  if (/jwt|session|not authenticated|refresh token/i.test(msg)) return 'Seans tugagan. Qaytadan kiring.';
  if (/row-level security|permission denied/i.test(msg)) return 'Ushbu amalni bajarishga ruxsatingiz yo‘q.';
  if (/duplicate key|already exists/i.test(msg)) return 'Bunday yozuv allaqachon mavjud.';
  if (/foreign key|violates/i.test(msg)) return 'Bu yozuv boshqa ma’lumotlar bilan bog‘langan, shuning uchun o‘zgartirib bo‘lmaydi.';
  return 'Xatolik yuz berdi. Qayta urinib ko‘ring.';
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak.';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return 'Parolda katta va kichik harflar bo‘lishi kerak.';
  if (!/\d/.test(pw)) return 'Parolda kamida bitta raqam bo‘lishi kerak.';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email manzilini kiriting.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email manzili noto‘g‘ri ko‘rinishda.';
  return null;
}
