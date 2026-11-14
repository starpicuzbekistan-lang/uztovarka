import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { canAccess, homeFor, type Area } from '@/lib/access';
import { FullPageSpinner, AccessDenied } from '@/components/ui';

/** Himoyalangan marshrutlar: tizimga kirmaganlar /login ga, noto‘g‘ri rol — ruxsat yo‘q sahifasiga. */
export function RequireAuth({ area }: { area: Area }) {
  const { session, profile, loading, needsPassword } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!session || !profile) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (needsPassword) return <Navigate to="/parol-o-rnatish" replace />;
  if (!canAccess({ role: profile.role, isActive: profile.is_active }, area)) return <AccessDenied />;
  return <Outlet />;
}

/** Login sahifasi kabi ochiq sahifalar: kirgan foydalanuvchi roliga mos bosh sahifaga yo‘naltiriladi. */
export function PublicOnly() {
  const { session, profile, loading, needsPassword } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (session && profile && !needsPassword) {
    return <Navigate to={homeFor({ role: profile.role, isActive: profile.is_active })} replace />;
  }
  return <Outlet />;
}

/** "/" ga kirgan admin — admin panelga yo‘naltiriladi (rolga qarab yo‘naltirish). */
export function RoleHomeRedirect({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
