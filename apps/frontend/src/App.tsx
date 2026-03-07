import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/stores/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminRoute from '@/components/auth/AdminRoute';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AcceptInvitePage = lazy(() => import('@/pages/AcceptInvitePage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const RolesPage = lazy(() => import('@/pages/RolesPage'));
const OrgUsersPage = lazy(() => import('@/pages/OrgUsersPage'));
const FarmsPage = lazy(() => import('@/pages/FarmsPage'));
const FarmMapPage = lazy(() => import('@/pages/FarmMapPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const AdminOrganizationsPage = lazy(() => import('@/pages/AdminOrganizationsPage'));
const AdminAuditLogsPage = lazy(() => import('@/pages/AdminAuditLogsPage'));
const ProducersPage = lazy(() => import('@/pages/ProducersPage'));
const AnimalsPage = lazy(() => import('@/pages/AnimalsPage'));
const LotsPage = lazy(() => import('@/pages/LotsPage'));
const WeighingSessionPage = lazy(() => import('@/pages/WeighingSessionPage'));
const AnimalDetailPage = lazy(() => import('@/pages/AnimalDetailPage'));

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/organizations" element={<AdminOrganizationsPage />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/users" element={<OrgUsersPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/farms" element={<FarmsPage />} />
                <Route path="/farms/:farmId/map" element={<FarmMapPage />} />
                <Route path="/producers" element={<ProducersPage />} />
                <Route path="/animals" element={<AnimalsPage />} />
                <Route path="/animals/:animalId" element={<AnimalDetailPage />} />
                <Route path="/lots" element={<LotsPage />} />
                <Route path="/weighing-session" element={<WeighingSessionPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
