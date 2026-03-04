import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/stores/AuthContext';

function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // SUPER_ADMIN sem organização não pode acessar rotas de org — redirecionar para admin
  if (user?.role === 'SUPER_ADMIN' && !user.organizationId) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
