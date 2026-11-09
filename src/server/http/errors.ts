import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status }
  );
}

/**
 * Manejador centralizado de errores para la API REST (/api/v1/*).
 * Garantiza respuestas uniformes sin exponer trazas ni detalles sensibles en producción.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Los datos enviados no cumplen con el formato requerido.',
          issues: error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      },
      { status: 422 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  console.error('[BSP-Store API Error]:', error);

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error interno al procesar la solicitud.',
      },
    },
    { status: 500 }
  );
}
