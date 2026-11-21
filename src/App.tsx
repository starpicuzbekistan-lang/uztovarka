import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAuth, RoleHomeRedirect } from './auth/Guards';
import { OperatorLayout } from './layouts/OperatorLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { FullPageSpinner } from './components/ui';
import { supabaseConfigured } from './lib/supabase';
import { Logo } from './components/Logo';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import SetPassword from './pages/auth/SetPassword';
import Home from './pages/operator/Home';
import ArticleDetail from './pages/operator/ArticleDetail';
import Notifications from './pages/operator/Notifications';
import OperatorSupportChat from './pages/operator/SupportChat';
import Salary from './pages/operator/Salary';
import Catalog from './pages/operator/Catalog';
import ProductDetail from './pages/operator/ProductDetail';
import SetDetail from './pages/operator/SetDetail';
import Scripts from './pages/operator/Scripts';
import ScriptDetail from './pages/operator/ScriptDetail';
import Profile from './pages/operator/Profile';
import OperatorBadgesPage from './pages/operator/Badges';

// Admin qismi alohida bo‘lak (chunk): operatorlar uni yuklab olmaydi.
const Overview = lazy(() => import('./pages/admin/Overview'));
const Operators = lazy(() => import('./pages/admin/Operators'));
const KpiPayroll = lazy(() => import('./pages/admin/KpiPayroll'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminSets = lazy(() => import('./pages/admin/Sets'));
const AdminScripts = lazy(() => import('./pages/admin/Scripts'));
const AdminArticles = lazy(() => import('./pages/admin/Articles'));
const Announcements = lazy(() => import('./pages/admin/Announcements'));
const Payments = lazy(() => import('./pages/admin/Payments'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminSupportChat = lazy(() => import('./pages/admin/AdminSupportChat'));
const ManagerHub = lazy(() => import('./pages/manager/ManagerHub'));
import ManagerErrorBoundary from './components/ManagerErrorBoundary';
const AssignedTasks = lazy(() => import('./pages/operator/AssignedTasks'));

function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-lg space-y-3 rounded-3xl border border-neutral-200 bg-white p-6 shadow-card">
        <Logo />
        <h1 className="text-xl font-bold">Supabase ulanmagan</h1>
        <p className="text-sm text-neutral-600">
          Ilova ma’lumotlar bazasiga ulanmagan, shuning uchun ishga tushmaydi. Loyiha ildizida <code className="rounded bg-neutral-100 px-1">.env</code> fayl yarating
          va <code className="rounded bg-neutral-100 px-1">VITE_SUPABASE_URL</code> hamda <code className="rounded bg-neutral-100 px-1">VITE_SUPABASE_ANON_KEY</code> qiymatlarini kiriting
          (namuna: <code className="rounded bg-neutral-100 px-1">.env.example</code>). Vercelda — Project Settings → Environment Variables.
        </p>
        <p className="text-sm text-neutral-600">Batafsil ko‘rsatma: README.md → "Sozlash".</p>
      </div>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured) return <SetupRequired />;
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/royxatdan-otish" element={<Register />} />
          <Route path="/parolni-tiklash" element={<ForgotPassword />} />
        </Route>
        <Route path="/parol-o-rnatish" element={<SetPassword />} />

        {/* Operator markazi */}
        <Route element={<RequireAuth area="operator" />}>
          <Route element={<OperatorLayout />}>
            <Route index element={<RoleHomeRedirect><Home /></RoleHomeRedirect>} />
            <Route path="maqola/:id" element={<ArticleDetail />} />
            <Route path="bildirishnomalar" element={<Notifications />} />
            <Route path="chat" element={<OperatorSupportChat />} />
            <Route path="oylik" element={<Salary />} />
            <Route path="mahsulotlar" element={<Catalog />} />
            <Route path="mahsulotlar/:id" element={<ProductDetail />} />
            <Route path="naborlar/:id" element={<SetDetail />} />
            <Route path="skriptlar" element={<Scripts />} />
            <Route path="skriptlar/:id" element={<ScriptDetail />} />
            <Route path="profil" element={<Profile />} />
            <Route path="profil/badgelar" element={<OperatorBadgesPage />} />
            <Route path="vazifalar" element={<AssignedTasks />} />
          </Route>
        </Route>

        {/* Menejerning beshta tabli mobil paneli */}
        <Route path="manager" element={<RequireAuth area="manager" />}>
          <Route path="*" element={<ManagerErrorBoundary><ManagerHub /></ManagerErrorBoundary>} />
        </Route>

        {/* Administrator paneli */}
        <Route path="admin" element={<RequireAuth area="admin" />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="operatorlar" element={<Operators />} />
            <Route path="chat" element={<AdminSupportChat />} />
            <Route path="kpi" element={<KpiPayroll />} />
            <Route path="hisobotlar" element={<Reports />} />
            <Route path="mahsulotlar" element={<AdminProducts />} />
            <Route path="naborlar" element={<AdminSets />} />
            <Route path="skriptlar" element={<AdminScripts />} />
            <Route path="maqolalar" element={<AdminArticles />} />
            <Route path="elonlar" element={<Announcements />} />
            <Route path="tolovlar" element={<Payments />} />
            <Route path="tarix" element={<AuditLog />} />
            <Route path="sozlamalar" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
