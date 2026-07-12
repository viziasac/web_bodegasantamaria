import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getModuleByPath, canAccessModule } from '../config/moduleRegistry';

interface ProtectedModuleRouteProps {
  path: string;
}

export const ProtectedModuleRoute: React.FC<ProtectedModuleRouteProps> = ({ path }) => {
  const { user } = useAuth();
  const mod = getModuleByPath(path);
  if (mod && !canAccessModule(user?.role, mod, { accesoVentas: user?.accesoVentas })) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};
