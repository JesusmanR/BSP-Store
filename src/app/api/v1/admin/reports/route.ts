import type { NextRequest } from 'next/server';
import { requireAdminUser } from '@/server/http/admin-guard';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { getAdminDashboardReport } from '@/server/services/admin.service';

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const report = await getAdminDashboardReport();
    return apiSuccess(report);
  } catch (error) {
    return handleApiError(error);
  }
}
