import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '@/server/services/auth.service';
import { sendPasswordResetEmail } from '@/server/services/email.service';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/server/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`auth:reset-request:${ip}`, 8, 60_000);

    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);
    enforceRateLimit(`auth:reset-request:email:${email}`, 5, 15 * 60_000);

    const result = await requestPasswordReset(email);
    if (result.resetToken) {
      await sendPasswordResetEmail({ to: email, resetToken: result.resetToken });
    }

    // Nunca exponer el token de recuperación en la respuesta HTTP (prevención de Account Takeover)
    return apiSuccess({
      message:
        'Si el correo existe en nuestro sistema, hemos enviado las instrucciones para restablecer tu contraseña.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
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
