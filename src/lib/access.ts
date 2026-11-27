/** 'manager' faqat bazadagi tarixiy akkauntlar uchun saqlangan; unga sahifa berilmaydi. */
export type Role = 'admin' | 'operator' | 'manager';
export interface AccessProfile {
  role: Role;
  isActive: boolean;
}
export type Area = 'operator' | 'admin';

/** Faqat faol operator va admin sahifaga kira oladi. Serverda ham RLS himoyasi bor. */
export function canAccess(profile: AccessProfile | null | undefined, area: Area): boolean {
  if (!profile || !profile.isActive) return false;
  return area === 'admin' ? profile.role === 'admin' : profile.role === 'operator';
}

export function homeFor(profile: AccessProfile | null | undefined): '/login' | '/admin' | '/' {
  if (!profile || !profile.isActive) return '/login';
  if (profile.role === 'admin') return '/admin';
  if (profile.role === 'operator') return '/';
  return '/login';
}
