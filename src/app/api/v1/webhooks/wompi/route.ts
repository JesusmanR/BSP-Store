import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { processWompiWebhook } from '@/server/services/order.service';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers: Record<string, string | undefined> = {
      'x-event-checksum': request.headers.get('x-event-checksum') ?? undefined,
    };

    const result = await processWompiWebhook(rawBody, headers);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
