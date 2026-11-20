import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SESSION_COOKIE_NAME } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * Guardia RBAC en Server Component para /admin:
 * Verifica la sesión real contra PostgreSQL antes de servir la interfaz administrativa.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  const user = await getSessionUser(token);

  if (!user) {
    redirect('/cuenta?redirect=/admin');
  }

  if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
    redirect('/cuenta');
  }

  return <>{children}</>;
}
