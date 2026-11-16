import type { NextRequest } from 'next/server';
import { requireAdminUser } from '@/server/http/admin-guard';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import {
  bulkUpsertAdminProducts,
  createAdminBrand,
  createAdminCategory,
  createAdminProduct,
  listAdminCatalog,
  updateAdminCategory,
} from '@/server/services/admin.service';

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const catalog = await listAdminCatalog();
    return apiSuccess(catalog);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json();

    if (body?.entityType === 'CATEGORY') {
      const category = await createAdminCategory(body, admin.id);
      return apiSuccess({ category }, 201);
    }

    if (body?.entityType === 'UPDATE_CATEGORY') {
      const category = await updateAdminCategory(body, admin.id);
      return apiSuccess({ category });
    }

    if (body?.entityType === 'BRAND') {
      const brand = await createAdminBrand(body, admin.id);
      return apiSuccess({ brand }, 201);
    }

    if (body?.entityType === 'BULK_EXCEL') {
      const summary = await bulkUpsertAdminProducts(body, admin.id);
      return apiSuccess(summary, 201);
    }

    const product = await createAdminProduct(body, admin.id);
    return apiSuccess({ product }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json();
    const category = await updateAdminCategory(body, admin.id);
    return apiSuccess({ category });
  } catch (error) {
    return handleApiError(error);
  }
}
