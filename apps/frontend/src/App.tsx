import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/stores/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const RolesPage = lazy(() => import('@/pages/RolesPage'));
const FarmsPage = lazy(() => import('@/pages/FarmsPage'));
const FarmMapPage = lazy(() => import('@/pages/FarmMapPage'));

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/farms" element={<FarmsPage />} />
                <Route path="/farms/:farmId/map" element={<FarmMapPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
