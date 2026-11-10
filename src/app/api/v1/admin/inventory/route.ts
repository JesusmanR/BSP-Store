import type { NextRequest } from 'next/server';
import { requireAdminUser } from '@/server/http/admin-guard';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { adjustAdminInventory } from '@/server/services/admin.service';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json();
    const result = await adjustAdminInventory(body, admin.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
