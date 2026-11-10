import type { NextRequest } from 'next/server';
import { AppError } from '@/server/http/errors';
import { extractSessionToken } from '@/server/http/session';
import { getSessionUser, type AuthenticatedUserDTO } from '@/server/services/auth.service';

/**
 * Verifica que la petición provenga de un usuario autenticado con rol `ADMIN` o `STAFF`.
 * Si `requireStrictAdmin` es `true`, exige rol `ADMIN` exclusivamente.
 */
export async function requireAdminUser(
  request: NextRequest,
  requireStrictAdmin = false
): Promise<AuthenticatedUserDTO> {
  const token = extractSessionToken(request);
  const user = await getSessionUser(token);

  if (!user) {
    throw new AppError(
      'UNAUTHORIZED',
      'Debes iniciar sesión con una cuenta administrativa para acceder a este recurso.',
      401
    );
  }

  const allowedRoles = requireStrictAdmin ? ['ADMIN'] : ['ADMIN', 'STAFF'];
  if (!allowedRoles.includes(user.role)) {
    throw new AppError(
      'FORBIDDEN_ADMIN_ONLY',
      'No tienes permisos administrativos suficientes para ejecutar esta operación.',
      403
    );
  }

  return user;
}
