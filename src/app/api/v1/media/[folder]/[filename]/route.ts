import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/server/http/errors';
import { readManagedMediaFile } from '@/server/services/media-upload.service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ folder: string; filename: string }> }
) {
  try {
    const { folder, filename } = await context.params;
    const { buffer, mimeType } = await readManagedMediaFile(folder, filename);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
