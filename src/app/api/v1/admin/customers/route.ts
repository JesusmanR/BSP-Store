import type { NextRequest } from 'next/server';
import { requireAdminUser } from '@/server/http/admin-guard';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { listAdminCustomers, updateAdminCustomer } from '@/server/services/admin.service';

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const customers = await listAdminCustomers();
    return apiSuccess({ customers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminUser(request, true);
    const body = await request.json();
    const customer = await updateAdminCustomer(body, admin.id);
    return apiSuccess({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}
