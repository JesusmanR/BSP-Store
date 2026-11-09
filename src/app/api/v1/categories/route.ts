import { apiSuccess, handleApiError } from '@/server/http/errors';
import { listCategoriesAndBrands } from '@/server/services/catalog.service';

export async function GET() {
  try {
    const result = await listCategoriesAndBrands();
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
