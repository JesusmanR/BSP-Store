import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startedAt;

    return NextResponse.json(
      {
        ok: true,
        data: {
          service: 'bsp-store-api',
          version: 'v1',
          environment: process.env.NODE_ENV ?? 'development',
          database: {
            status: 'connected',
            engine: 'PostgreSQL',
            latencyMs,
          },
          payments: {
            defaultGateway: process.env.PAYMENT_DEFAULT_GATEWAY ?? 'WOMPI',
            brebTransferKey: process.env.NEXT_PUBLIC_BREB_KEY ?? '@bbbsp',
            supportedGateways: ['WOMPI', 'BOLD', 'MERCADO_PAGO'],
          },
          mobileReady: true,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'No fue posible establecer conexión con PostgreSQL.',
          details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
        },
      },
      { status: 503 }
    );
  }
}
