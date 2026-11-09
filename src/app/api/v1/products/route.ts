import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { listCatalogProducts } from '@/server/services/catalog.service';
import { catalogQuerySchema } from '@/server/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = catalogQuerySchema.parse(searchParams);

    const result = await listCatalogProducts(filters);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
