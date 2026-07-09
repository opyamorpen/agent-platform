import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTeamContext } from '@/layouts/app-layout';

export function AdminRouteGuard({
  children,
}: {
  children: ReactNode;
}) {
  const { isAdmin, isAccessLoading, role } = useTeamContext();

  if (isAccessLoading || role === null) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/forbidden?reason=admin_only" replace />;
  }

  return <>{children}</>;
}
