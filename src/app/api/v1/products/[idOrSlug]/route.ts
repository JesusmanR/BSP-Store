import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { getProductDetail } from '@/server/services/catalog.service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> }
) {
  try {
    const { idOrSlug } = await context.params;
    const result = await getProductDetail(idOrSlug);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
