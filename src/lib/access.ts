export type Role = 'admin' | 'manager' | 'operator';
export interface AccessProfile {
  role: Role;
  isActive: boolean;
}
export type Area = 'operator' | 'manager' | 'admin';

/** Front-end marshrut tekshiruvi. Ma'lumotga haqiqiy ruxsat Supabase RLS'da. */
export function canAccess(profile: AccessProfile | null | undefined, area: Area): boolean {
  if (!profile?.isActive) return false;
  if (area === 'admin') return profile.role === 'admin';
  if (area === 'manager') return profile.role === 'manager';
  return profile.role === 'operator' || profile.role === 'admin';
}

export function homeFor(profile: AccessProfile | null | undefined): '/login' | '/admin' | '/manager' | '/' {
  if (!profile?.isActive) return '/login';
  if (profile.role === 'admin') return '/admin';
  return profile.role === 'manager' ? '/manager' : '/';
}
