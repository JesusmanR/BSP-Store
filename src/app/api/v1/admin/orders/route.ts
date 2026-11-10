import type { NextRequest } from 'next/server';
import { requireAdminUser } from '@/server/http/admin-guard';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { listAdminOrders, updateAdminOrder } from '@/server/services/admin.service';

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const from = request.nextUrl.searchParams.get('from') ?? undefined;
    const to = request.nextUrl.searchParams.get('to') ?? undefined;
    const search = request.nextUrl.searchParams.get('search') ?? undefined;

    const result = await listAdminOrders({ status, from, to, search });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json();
    const order = await updateAdminOrder(body, admin.id);
    return apiSuccess({ order });
  } catch (error) {
    return handleApiError(error);
  }
}
