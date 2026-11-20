import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'bsp_session';
const HEX_TOKEN_REGEX = /^[a-f0-9]{32,128}$/i;

function hasSyntacticallyValidToken(token: string | undefined | null): boolean {
  if (!token) return false;
  return HEX_TOKEN_REGEX.test(token.trim());
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

function isMutatingMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function applySecurityHeaders(response: NextResponse, sensitive: boolean): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (sensitive) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const bearerToken = extractBearerToken(request.headers.get('authorization'));

  // 1. Protección Edge del panel administrativo (/admin y subrutas) antes de servir HTML/JS
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!hasSyntacticallyValidToken(sessionCookie)) {
      const loginUrl = new URL('/cuenta', request.url);
      loginUrl.searchParams.set('redirect', `${pathname}${search}`);
      const redirectRes = NextResponse.redirect(loginUrl, 307);
      return applySecurityHeaders(redirectRes, true);
    }
    const nextRes = NextResponse.next();
    return applySecurityHeaders(nextRes, true);
  }

  // 2. Protección preventiva de endpoints /api/v1/admin/*
  if (pathname.startsWith('/api/v1/admin')) {
    const hasCookie = hasSyntacticallyValidToken(sessionCookie);
    const hasBearer = hasSyntacticallyValidToken(bearerToken);
    if (!hasCookie && !hasBearer) {
      const unauth = NextResponse.json(
        {
          ok: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Debes iniciar sesión como administrador para acceder a este recurso.',
          },
        },
        { status: 401 }
      );
      return applySecurityHeaders(unauth, true);
    }
  }

  // 3. Defensa CSRF (Origin / Sec-Fetch-Site) en mutaciones API con cookie de sesión
  if (
    pathname.startsWith('/api/v1/') &&
    !pathname.startsWith('/api/v1/webhooks/') &&
    isMutatingMethod(request.method) &&
    sessionCookie
  ) {
    const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
    if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'same-site' && secFetchSite !== 'none') {
      const csrfErr = NextResponse.json(
        {
          ok: false,
          error: {
            code: 'CSRF_ORIGIN_MISMATCH',
            message: 'Solicitud bloqueada por política de seguridad de origen.',
          },
        },
        { status: 403 }
      );
      return applySecurityHeaders(csrfErr, true);
    }

    const origin = request.headers.get('origin');
    if (origin) {
      try {
        const originHost = new URL(origin).host.toLowerCase();
        const requestHost = (request.headers.get('host') || request.nextUrl.host).toLowerCase();
        const appUrlHost = process.env.NEXT_PUBLIC_APP_URL
          ? new URL(process.env.NEXT_PUBLIC_APP_URL).host.toLowerCase()
          : requestHost;

        if (originHost !== requestHost && originHost !== appUrlHost) {
          const csrfErr = NextResponse.json(
            {
              ok: false,
              error: {
                code: 'CSRF_ORIGIN_MISMATCH',
                message: 'El origen de la solicitud no está autorizado.',
              },
            },
            { status: 403 }
          );
          return applySecurityHeaders(csrfErr, true);
        }
      } catch {
        const csrfErr = NextResponse.json(
          {
            ok: false,
            error: {
              code: 'CSRF_ORIGIN_MISMATCH',
              message: 'Encabezado Origin inválido.',
            },
          },
          { status: 403 }
        );
        return applySecurityHeaders(csrfErr, true);
      }
    }
  }

  const isSensitiveApi =
    pathname.startsWith('/api/v1/admin') ||
    pathname.startsWith('/api/v1/auth') ||
    pathname.startsWith('/api/v1/privacy') ||
    pathname.startsWith('/api/v1/orders');

  return applySecurityHeaders(NextResponse.next(), isSensitiveApi);
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/v1/:path*'],
};
