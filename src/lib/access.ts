export type Role = 'admin' | 'operator';
export interface AccessProfile {
  role: Role;
  isActive: boolean;
}
export type Area = 'operator' | 'admin';

/** Marshrut himoyasi uchun yagona qoida (UI darajasida; haqiqiy himoya — RLS). */
export function canAccess(profile: AccessProfile | null | undefined, area: Area): boolean {
  if (!profile || !profile.isActive) return false;
  if (area === 'admin') return profile.role === 'admin';
  return true;
}

export function homeFor(profile: AccessProfile | null | undefined): '/login' | '/admin' | '/' {
  if (!profile || !profile.isActive) return '/login';
  return profile.role === 'admin' ? '/admin' : '/';
}
