import type { NextRequest } from 'next/server';
import { requireAdminUser } from '@/server/http/admin-guard';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { updateAdminProduct } from '@/server/services/admin.service';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    const admin = await requireAdminUser(request);
    const { productId } = await context.params;
    const body = await request.json();
    if (body?.isActive !== undefined && admin.role !== 'ADMIN') {
      throw new AppError(
        'FORBIDDEN_ADMIN_ONLY',
        'Solo un administrador (ADMIN) puede activar o desactivar productos.',
        403
      );
    }
    const product = await updateAdminProduct(productId, body, admin.id);
    return apiSuccess({ product });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    const admin = await requireAdminUser(request, true);
    const { productId } = await context.params;
    const product = await updateAdminProduct(productId, { isActive: false }, admin.id);
    return apiSuccess({ product, deactivated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
