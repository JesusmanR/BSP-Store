import type { NextRequest, NextResponse } from 'next/server';
import type { RoleCode } from '@prisma/client';
import { AppError } from './errors';
import {
  getSessionUser,
  type AuthenticatedUserDTO,
} from '@/server/services/auth.service';

export const SESSION_COOKIE_NAME = 'bsp_session';
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

/**
 * Extrae el token de sesión desde Cookie HttpOnly (Tienda Web) o
 * desde la cabecera Authorization: Bearer <token> (Futura App Móvil Flutter).
 */
export function extractSessionToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return cookieToken ?? null;
}

export function attachSessionCookie(response: NextResponse, rawToken: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SEVEN_DAYS_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function requireAuth(request: NextRequest): Promise<AuthenticatedUserDTO> {
  const token = extractSessionToken(request);
  const user = await getSessionUser(token);
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Debes iniciar sesión para realizar esta acción.', 401);
  }
  return user;
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: RoleCode[]
): Promise<AuthenticatedUserDTO> {
  const user = await requireAuth(request);
  if (!allowedRoles.includes(user.role)) {
    throw new AppError(
      'FORBIDDEN',
      'No tienes permisos suficientes para acceder a este recurso.',
      403
    );
  }
  return user;
}
