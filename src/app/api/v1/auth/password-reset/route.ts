import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/rate-limit';
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '@/server/services/auth.service';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/server/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    enforceRateLimit(`auth:reset-request:${ip}`, 8, 60_000);

    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const result = await requestPasswordReset(email);

    return apiSuccess({
      message:
        'Si el correo existe en nuestro sistema, hemos generado las instrucciones para restablecer tu contraseña.',
      // En entorno de desarrollo local exponemos el token para poder probar el flujo completo sin servidor SMTP externo
      devResetToken: process.env.NODE_ENV !== 'production' ? result.resetToken : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    enforceRateLimit(`auth:reset-confirm:${ip}`, 8, 60_000);

    const body = await request.json();
    const { token, newPassword } = resetPasswordSchema.parse(body);

    await resetPasswordWithToken(token, newPassword);

    return apiSuccess({
      message: 'Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
