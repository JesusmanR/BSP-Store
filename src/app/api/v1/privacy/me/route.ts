import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { extractSessionToken } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';

/**
 * Endpoint de Derechos Habeas Data / ARCO (Ley 1581 de 2012 y Decreto 1377 de 2013 - Colombia):
 * - GET: Portabilidad y consulta integral de datos personales almacenados.
 * - DELETE: Solicitud de supresión/anonimización de datos personales cuando no existan pedidos en curso.
 */
export async function GET(request: NextRequest) {
  try {
    const token = extractSessionToken(request);
    const sessionUser = await getSessionUser(token);
    if (!sessionUser) {
      throw new AppError('UNAUTHORIZED', 'Debes iniciar sesión para consultar tus datos.', 401);
    }

    const fullProfile = await prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        documentType: true,
        documentNumber: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { code: true, name: true } },
        addresses: true,
        orders: {
          select: {
            orderNumber: true,
            totalCop: true,
            status: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: sessionUser.id,
        action: 'HABEAS_DATA_EXPORT_REQUESTED',
        entity: 'User',
        entityId: sessionUser.id,
        metadata: { regulation: 'Ley 1581 de 2012 (Colombia)' },
      },
    });

    return apiSuccess({
      regulation: 'Ley Estatutaria 1581 de 2012 y Decreto 1377 de 2013 (Habeas Data Colombia)',
      exportedAt: new Date().toISOString(),
      subject: fullProfile,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = extractSessionToken(request);
    const sessionUser = await getSessionUser(token);
    if (!sessionUser) {
      throw new AppError('UNAUTHORIZED', 'Debes iniciar sesión para solicitar supresión.', 401);
    }

    if (sessionUser.role === 'ADMIN') {
      throw new AppError(
        'ADMIN_SUPPRESSION_BLOCKED',
        'Las cuentas administrativas activas no pueden anonimizarse desde el autoservicio.',
        409
      );
    }

    const activeOrdersCount = await prisma.order.count({
      where: {
        userId: sessionUser.id,
        status: {
          in: ['PENDING_PAYMENT', 'PENDING_BREB_VERIFICATION', 'PAID', 'PROCESSING', 'SHIPPED'],
        },
      },
    });

    if (activeOrdersCount > 0) {
      throw new AppError(
        'ACTIVE_ORDERS_PENDING',
        'No es posible suprimir los datos mientras existan pedidos en curso de despacho o verificación.',
        409
      );
    }

    const anonymizedEmail = `anonimizado.${sessionUser.id}@privacy.bspstore.com.co`;

    await prisma.$transaction(async (tx) => {
      await tx.address.deleteMany({ where: { userId: sessionUser.id } });
      await tx.session.deleteMany({ where: { userId: sessionUser.id } });
      await tx.user.update({
        where: { id: sessionUser.id },
        data: {
          name: 'Titular Anonimizado (Ley 1581)',
          email: anonymizedEmail,
          phone: null,
          documentNumber: null,
          passwordHash: null,
          isActive: false,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'HABEAS_DATA_ACCOUNT_ANONYMIZED',
          entity: 'User',
          entityId: sessionUser.id,
          metadata: { regulation: 'Ley 1581 de 2012 Art. 8' },
        },
      });
    });

    return apiSuccess({
      anonymized: true,
      message:
        'Tus datos personales han sido anonimizados y tus sesiones revocadas conforme a la Ley 1581 de 2012.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
