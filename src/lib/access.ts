export type Role = 'admin' | 'operator' | 'manager';
export interface AccessProfile {
  role: Role;
  isActive: boolean;
}
export type Area = 'operator' | 'admin' | 'manager';

/** Marshrut himoyasi uchun yagona qoida (UI darajasida; haqiqiy himoya — RLS). */
export function canAccess(profile: AccessProfile | null | undefined, area: Area): boolean {
  if (!profile || !profile.isActive) return false;
  if (area === 'admin') return profile.role === 'admin';
  if (area === 'manager') return profile.role === 'manager';
  return profile.role === 'operator';
}

export function homeFor(profile: AccessProfile | null | undefined): '/login' | '/admin' | '/manager' | '/' {
  if (!profile || !profile.isActive) return '/login';
  return profile.role === 'admin' ? '/admin' : profile.role === 'manager' ? '/manager' : '/';
}
