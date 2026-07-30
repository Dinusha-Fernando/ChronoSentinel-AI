import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

/**
 * Protected route wrapper for admin pages.
 * Redirects to /login if not authenticated or not admin+.
 */
export default function AdminRoute({ children, requireSuperAdmin = false }: AdminRouteProps) {
  const { isAuthenticated, currentUser } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (currentUser.role === 'user') {
    return <Navigate to="/" replace />;
  }

  if (requireSuperAdmin && currentUser.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}
