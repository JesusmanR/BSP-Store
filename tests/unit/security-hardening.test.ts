// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '@/../next.config';
import { config as middlewareConfig, middleware } from '@/middleware';
import { safeJsonLd } from '@/lib/seo';
import { prisma } from '@/server/db/prisma';
import { requireAdminUser } from '@/server/http/admin-guard';
import {
  enforceRateLimit,
  extractClientIp,
  resetRateLimitBuckets,
} from '@/server/http/rate-limit';
import { SESSION_COOKIE_NAME } from '@/server/http/session';
import {
  loginOrRegisterWithGoogle,
  loginWithPassword,
  registerCustomer,
} from '@/server/services/auth.service';
import {
  deleteManagedMediaByUrl,
  detectImageMimeFromMagicBytes,
  MAX_IMAGE_UPLOAD_BYTES,
  saveUploadedImage,
  validateImageUploadBuffer,
} from '@/server/services/media-upload.service';
import { createCheckoutOrder } from '@/server/services/order.service';
import { googleAuthSchema } from '@/server/validation/schemas';

// Route handlers
import { GET as adminCustomersGet, PATCH as adminCustomersPatch } from '@/app/api/v1/admin/customers/route';
import { POST as adminInventoryPost } from '@/app/api/v1/admin/inventory/route';
import {
  DELETE as adminOffersDelete,
  GET as adminOffersGet,
  POST as adminOffersPost,
} from '@/app/api/v1/admin/offers/route';
import { GET as adminOrdersGet, PATCH as adminOrdersPatch } from '@/app/api/v1/admin/orders/route';
import {
  GET as adminProductsGet,
  POST as adminProductsPost,
} from '@/app/api/v1/admin/products/route';
import {
  DELETE as adminProductDelete,
  PATCH as adminProductPatch,
} from '@/app/api/v1/admin/products/[productId]/route';
import { GET as adminReportsGet } from '@/app/api/v1/admin/reports/route';
import { POST as adminUploadsPost } from '@/app/api/v1/admin/uploads/route';
import { POST as addressesPost, GET as addressesGet } from '@/app/api/v1/addresses/route';
import {
  DELETE as addressDelete,
  PATCH as addressPatch,
  PUT as addressPut,
} from '@/app/api/v1/addresses/[addressId]/route';
import { POST as googleAuthPost } from '@/app/api/v1/auth/google/route';
import { GET as googleCallbackGet } from '@/app/api/v1/auth/google/callback/route';
import { POST as cronOffersPost } from '@/app/api/v1/cron/offers/route';
import { POST as loginPost } from '@/app/api/v1/auth/login/route';
import { PATCH as authMePatch } from '@/app/api/v1/auth/me/route';
import { POST as avatarUploadPost } from '@/app/api/v1/auth/me/avatar/route';
import { POST as passwordResetPost } from '@/app/api/v1/auth/password-reset/route';
import { GET as contactGet } from '@/app/api/v1/contact/route';
import { POST as couponsPost } from '@/app/api/v1/coupons/route';
import { GET as mediaGet } from '@/app/api/v1/media/[folder]/[filename]/route';
import {
  GET as orderByNumberGet,
  PATCH as orderByNumberPatch,
  POST as orderByNumberPost,
} from '@/app/api/v1/orders/[orderNumber]/route';
import { DELETE as privacyDelete, GET as privacyGet } from '@/app/api/v1/privacy/me/route';

// Firmas binarias reales mínimas (PNG, JPEG, WebP)
const REAL_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const REAL_JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);
const REAL_WEBP_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

const createdUserIds: string[] = [];
const createdMediaUrls: string[] = [];

async function createTempUser(prefix: string, roleCode: 'CUSTOMER' | 'STAFF' = 'CUSTOMER') {
  const email = `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@bspstore.com.co`;
  const password = 'SecPassword2026*';
  const registered = await registerCustomer({
    name: `Usuario ${prefix}`,
    email,
    password,
    phone: '3028000240',
    acceptTerms: true,
    acceptPrivacyPolicy: true,
  });
  createdUserIds.push(registered.user.id);

  if (roleCode !== 'CUSTOMER') {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    await prisma.user.update({
      where: { id: registered.user.id },
      data: { roleId: role.id },
    });
    const relogin = await loginWithPassword({ email, password });
    return { ...relogin, email, password };
  }
  return { ...registered, email, password };
}

async function loginSeededAdmin() {
  return loginWithPassword({
    email: 'admin@bspstore.com.co',
    password: process.env.SEED_ADMIN_PASSWORD || 'BspAdmin2026*',
  });
}

beforeEach(() => {
  resetRateLimitBuckets();
});

afterEach(() => {
  resetRateLimitBuckets();
  vi.useRealTimers();
});

afterAll(async () => {
  for (const url of createdMediaUrls) {
    await deleteManagedMediaByUrl(url);
  }
  if (createdUserIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
    await prisma.order.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe('Suite de Seguridad Defensiva (AppSec / OWASP Top 10 / RBAC / Media / IDOR / Headers)', () => {
  describe('1. RBAC estricto y ausencia de backdoor demo-admin', () => {
    it('rechaza con 401 a visitantes anónimos en todos los endpoints administrativos', async () => {
      const checks = [
        adminReportsGet(new NextRequest('http://localhost:3000/api/v1/admin/reports')),
        adminProductsGet(new NextRequest('http://localhost:3000/api/v1/admin/products')),
        adminOrdersGet(new NextRequest('http://localhost:3000/api/v1/admin/orders')),
        adminCustomersGet(new NextRequest('http://localhost:3000/api/v1/admin/customers')),
        adminOffersGet(new NextRequest('http://localhost:3000/api/v1/admin/offers')),
        adminInventoryPost(
          new NextRequest('http://localhost:3000/api/v1/admin/inventory', {
            method: 'POST',
            body: JSON.stringify({}),
          })
        ),
        contactGet(new NextRequest('http://localhost:3000/api/v1/contact')),
        couponsPost(
          new NextRequest('http://localhost:3000/api/v1/coupons', {
            method: 'POST',
            body: JSON.stringify({}),
          })
        ),
      ];

      const responses = await Promise.all(checks);
      for (const res of responses) {
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rechaza con 403 a clientes CUSTOMER en endpoints administrativos', async () => {
      const customer = await createTempUser('rbac-cust', 'CUSTOMER');
      const headers = {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${customer.sessionToken}`,
      };

      const resList = await Promise.all([
        adminReportsGet(new NextRequest('http://localhost:3000/api/v1/admin/reports', { headers })),
        adminProductsPost(
          new NextRequest('http://localhost:3000/api/v1/admin/products', {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
          })
        ),
        adminOrdersPatch(
          new NextRequest('http://localhost:3000/api/v1/admin/orders', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({}),
          })
        ),
        adminCustomersPatch(
          new NextRequest('http://localhost:3000/api/v1/admin/customers', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({}),
          })
        ),
        adminOffersPost(
          new NextRequest('http://localhost:3000/api/v1/admin/offers', {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
          })
        ),
        couponsPost(
          new NextRequest('http://localhost:3000/api/v1/coupons', {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
          })
        ),
      ]);

      for (const res of resList) {
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.ok).toBe(false);
      }
    });

    it('impone privilegio mínimo de STAFF frente a operaciones exclusivas de ADMIN', async () => {
      const staff = await createTempUser('rbac-staff', 'STAFF');
      const product = await prisma.product.findFirstOrThrow({ select: { id: true } });
      const headers = {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${staff.sessionToken}`,
      };

      const [custGet, custPatch, prodPost, prodDelete, prodToggle, offersPost, offersDel, coupPost] =
        await Promise.all([
          adminCustomersGet(
            new NextRequest('http://localhost:3000/api/v1/admin/customers', { headers })
          ),
          adminCustomersPatch(
            new NextRequest('http://localhost:3000/api/v1/admin/customers', {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ userId: staff.user.id, role: 'ADMIN' }),
            })
          ),
          adminProductsPost(
            new NextRequest('http://localhost:3000/api/v1/admin/products', {
              method: 'POST',
              headers,
              body: JSON.stringify({}),
            })
          ),
          adminProductDelete(
            new NextRequest(`http://localhost:3000/api/v1/admin/products/${product.id}`, {
              method: 'DELETE',
              headers,
            }),
            { params: Promise.resolve({ productId: product.id }) }
          ),
          adminProductPatch(
            new NextRequest(`http://localhost:3000/api/v1/admin/products/${product.id}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ isActive: false }),
            }),
            { params: Promise.resolve({ productId: product.id }) }
          ),
          adminOffersPost(
            new NextRequest('http://localhost:3000/api/v1/admin/offers', {
              method: 'POST',
              headers,
              body: JSON.stringify({ discountPercent: 50 }),
            })
          ),
          adminOffersDelete(
            new NextRequest('http://localhost:3000/api/v1/admin/offers', {
              method: 'DELETE',
              headers,
              body: JSON.stringify({}),
            })
          ),
          couponsPost(
            new NextRequest('http://localhost:3000/api/v1/coupons', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                code: 'STAFF99',
                description: 'Intento no autorizado',
                type: 'PERCENTAGE',
                value: 50,
              }),
            })
          ),
        ]);

      for (const res of [
        custGet,
        custPatch,
        prodPost,
        prodDelete,
        prodToggle,
        offersPost,
        offersDel,
        coupPost,
      ]) {
        expect(res.status).toBe(403);
      }
    });

    it('verifica ausencia total de backdoor demo-admin en runtime y código fuente', async () => {
      const spoofedReq = new NextRequest('http://localhost:3000/api/v1/admin/customers', {
        headers: {
          cookie: 'bsp_demo_admin=1; bsp_session=demo-admin',
          'x-demo-admin': 'true',
        },
      });
      await expect(requireAdminUser(spoofedReq)).rejects.toMatchObject({ statusCode: 401 });

      const adminPageSrc = await fs.readFile(
        path.join(process.cwd(), 'src', 'app', 'admin', 'page.tsx'),
        'utf8'
      );
      const adminGuardSrc = await fs.readFile(
        path.join(process.cwd(), 'src', 'server', 'http', 'admin-guard.ts'),
        'utf8'
      );
      expect(adminPageSrc).not.toContain('demo-admin');
      expect(adminGuardSrc).not.toContain('demo-admin');

      await expect(
        fs.access(path.join(process.cwd(), 'src', 'app', 'api', 'v1', 'auth', 'demo-admin'))
      ).rejects.toThrow();
    });
  });

  describe('2. Middleware Edge para /admin, /api/v1/admin y defensa CSRF', () => {
    it('redirige /admin sin cookie bsp_session hacia /cuenta con HTTP 307 y cabeceras no-store', () => {
      const res = middleware(new NextRequest('http://localhost:3000/admin?tab=orders'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/cuenta');
      expect(res.headers.get('cache-control')).toContain('no-store');
      expect(res.headers.get('x-robots-tag')).toContain('noindex');
      expect(middlewareConfig.matcher).toContain('/admin');
      expect(middlewareConfig.matcher).toContain('/admin/:path*');
    });

    it('rechaza cookies vacías o malformadas en /admin y permite avanzar con token sintácticamente válido', () => {
      const emptyRes = middleware(
        new NextRequest('http://localhost:3000/admin', {
          headers: { cookie: 'bsp_session=; demo-admin=true' },
        })
      );
      expect(emptyRes.status).toBe(307);

      const shortRes = middleware(
        new NextRequest('http://localhost:3000/admin', {
          headers: { cookie: 'bsp_session=forged-short' },
        })
      );
      expect(shortRes.status).toBe(307);

      const validHexToken = 'a'.repeat(64);
      const okRes = middleware(
        new NextRequest('http://localhost:3000/admin', {
          headers: { cookie: `bsp_session=${validHexToken}` },
        })
      );
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get('x-middleware-next')).toBe('1');
    });

    it('bloquea mutaciones API con cookie desde orígenes cross-site (CSRF)', () => {
      const validHexToken = 'b'.repeat(64);
      const csrfRes = middleware(
        new NextRequest('http://localhost:3000/api/v1/auth/me', {
          method: 'PATCH',
          headers: {
            cookie: `bsp_session=${validHexToken}`,
            origin: 'https://evil-attacker.example',
            'sec-fetch-site': 'cross-site',
          },
        })
      );
      expect(csrfRes.status).toBe(403);
    });
  });

  describe('3. Validación de Magic Bytes en carga de imágenes y límite de 2 MB', () => {
    it('acepta firmas binarias auténticas PNG, JPEG y WebP y guarda con nombre UUID seguro', async () => {
      expect(detectImageMimeFromMagicBytes(REAL_PNG_BYTES)).toBe('image/png');
      expect(detectImageMimeFromMagicBytes(REAL_JPEG_BYTES)).toBe('image/jpeg');
      expect(detectImageMimeFromMagicBytes(REAL_WEBP_BYTES)).toBe('image/webp');

      const saved = await saveUploadedImage('avatars', REAL_PNG_BYTES, 'image/png');
      createdMediaUrls.push(saved.url);
      expect(saved.mimeType).toBe('image/png');
      expect(saved.url).toMatch(/^\/api\/v1\/media\/avatars\/[0-9a-f-]{36}\.png$/);
    });

    it('rechaza SVG, HTML, JS y MIME spoofing (archivo .png con bytes de SVG o EXE)', () => {
      const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const htmlBuf = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>');
      const jsBuf = Buffer.from('console.log(process.env.DATABASE_URL);');
      const exeBuf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff');

      expect(() => validateImageUploadBuffer(svgBuf, 'image/svg+xml')).toThrow(/SVG|no válido/i);
      expect(() => validateImageUploadBuffer(svgBuf, 'image/png')).toThrow(/no válido|firma/i);
      expect(() => validateImageUploadBuffer(htmlBuf, 'image/png')).toThrow(/no válido|firma/i);
      expect(() => validateImageUploadBuffer(jsBuf, 'image/webp')).toThrow(/no válido|firma/i);
      expect(() => validateImageUploadBuffer(exeBuf, 'image/jpeg')).toThrow(/no válido|firma/i);
      expect(() => validateImageUploadBuffer(REAL_PNG_BYTES, 'image/jpeg')).toThrow(/no coincide/i);
    });

    it('respeta exactamente el límite de 2 MB (acepta 2 MB exactos y rechaza 2 MB + 1 byte)', () => {
      const exactMax = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES);
      REAL_PNG_BYTES.copy(exactMax, 0);
      expect(validateImageUploadBuffer(exactMax, 'image/png').mimeType).toBe('image/png');

      const overMax = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1);
      REAL_PNG_BYTES.copy(overMax, 0);
      expect(() => validateImageUploadBuffer(overMax, 'image/png')).toThrow(/2 MB/i);
    });

    it('permite subida multipart segura de avatar y rechaza SVG vía HTTP', async () => {
      const customer = await createTempUser('avatar-upload', 'CUSTOMER');

      const buildMultipartRequest = (
        url: string,
        filename: string,
        contentType: string,
        content: Buffer
      ) => {
        const boundary = '----BspSecurityTestBoundary7MA4YWxkTrZu0gW';
        const headerPart = Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
          'utf8'
        );
        const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
        const body = Buffer.concat([headerPart, content, footerPart]);
        return new NextRequest(url, {
          method: 'POST',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${customer.sessionToken}`,
            'content-type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        });
      };

      const goodRes = await avatarUploadPost(
        buildMultipartRequest(
          'http://localhost:3000/api/v1/auth/me/avatar',
          'foto.webp',
          'image/webp',
          REAL_WEBP_BYTES
        )
      );
      expect(goodRes.status).toBe(201);
      const goodJson = await goodRes.json();
      expect(goodJson.data.avatarUrl).toMatch(/^\/api\/v1\/media\/avatars\/[0-9a-f-]{36}\.webp$/);
      createdMediaUrls.push(goodJson.data.avatarUrl);

      const badRes = await avatarUploadPost(
        buildMultipartRequest(
          'http://localhost:3000/api/v1/auth/me/avatar',
          'evil.png',
          'image/png',
          Buffer.from('<svg onload=alert(1)></svg>', 'utf8')
        )
      );
      expect(badRes.status).toBe(415);

      // Admin upload también bloqueado para clientes CUSTOMER
      const adminUploadRes = await adminUploadsPost(
        buildMultipartRequest(
          'http://localhost:3000/api/v1/admin/uploads',
          'foto.webp',
          'image/webp',
          REAL_WEBP_BYTES
        )
      );
      expect(adminUploadRes.status).toBe(403);
    });
  });

  describe('4. Prevención de Path Traversal en endpoint /api/v1/media/[folder]/[filename]', () => {
    it('bloquea todos los vectores de Path Traversal y sirve archivos válidos con cabeceras sandbox', async () => {
      const vectors = [
        { folder: 'avatars', filename: '../.env' },
        { folder: 'avatars', filename: '../../package.json' },
        { folder: 'avatars', filename: '..%2f..%2f.env' },
        { folder: 'avatars', filename: '..\\..\\prisma\\schema.prisma' },
        { folder: 'avatars', filename: 'foto.png%00.txt' },
        { folder: '../prisma', filename: 'schema.prisma' },
        { folder: 'catalog', filename: 'C:/dev/bsp-store/.env' },
      ];

      for (const v of vectors) {
        const res = await mediaGet(
          new NextRequest(`http://localhost:3000/api/v1/media/${v.folder}/${v.filename}`),
          { params: Promise.resolve(v) }
        );
        expect([400, 403, 404]).toContain(res.status);
        const txt = await res.text();
        expect(txt).not.toContain('DATABASE_URL');
      }

      const saved = await saveUploadedImage('catalog', REAL_JPEG_BYTES, 'image/jpeg');
      createdMediaUrls.push(saved.url);
      const okRes = await mediaGet(
        new NextRequest(`http://localhost:3000${saved.url}`),
        { params: Promise.resolve({ folder: 'catalog', filename: saved.filename }) }
      );
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get('content-type')).toBe('image/jpeg');
      expect(okRes.headers.get('x-content-type-options')).toBe('nosniff');
      expect(okRes.headers.get('content-security-policy')).toContain("default-src 'none'");
    });
  });

  describe('5. Prevención de XSS, esquemas peligrosos, OAuth spoofing y fuga de reset token', () => {
    it('rechaza URIs maliciosas, SVG base64, MIME falsificado y HTML en /api/v1/auth/me y googleAuthSchema', async () => {
      const customer = await createTempUser('xss-profile', 'CUSTOMER');
      const headers = {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${customer.sessionToken}`,
      };

      const badAvatars = [
        'javascript:alert(document.cookie)',
        'vbscript:msgbox(1)',
        'data:text/html,<script>alert(1)</script>',
        `data:image/svg+xml;base64,${Buffer.from('<svg onload=alert(1)></svg>').toString('base64')}`,
        `data:image/png;base64,${Buffer.from('<svg onload=alert(1)></svg>').toString('base64')}`,
        'http://evil.example/avatar.png',
        'https://evil.example/tracker.png',
        '/images/../../.env',
        '/images/%2e%2e/secret.png',
      ];

      for (const badUrl of badAvatars) {
        const res = await authMePatch(
          new NextRequest('http://localhost:3000/api/v1/auth/me', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ avatarUrl: badUrl }),
          })
        );
        expect(res.status).toBe(422);
      }

      // Bloquea HTML en nombre y teléfono
      const xssTextRes = await authMePatch(
        new NextRequest('http://localhost:3000/api/v1/auth/me', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: '<script>alert(1)</script>',
            phone: '<img src=x onerror=alert(1)>',
          }),
        })
      );
      expect(xssTextRes.status).toBe(422);

      // googleAuthSchema bloquea javascript: y acepta Google avatar HTTPS confiable
      expect(
        googleAuthSchema.safeParse({
          email: 'u@example.com',
          name: 'Usuario Valido',
          googleId: 'gid-1234',
          avatarUrl: 'javascript:alert(1)',
        }).success
      ).toBe(false);
      expect(
        googleAuthSchema.safeParse({
          email: 'u@example.com',
          name: 'Usuario Valido',
          googleId: 'gid-1234',
          avatarUrl: 'https://lh3.googleusercontent.com/a/avatar.png',
        }).success
      ).toBe(true);

      // safeJsonLd escapa </script> para prevenir Stored XSS
      const serialized = safeJsonLd({ name: '</script><script>alert(1)</script>' });
      expect(serialized).not.toContain('</script>');
      expect(serialized).toContain('\\u003c/script\\u003e');
    });

    it('impide bypass de Google OAuth HTTP, bloquea auto-vínculo OAuth de ADMIN y nunca expone devResetToken', async () => {
      // 1. POST /api/v1/auth/google sin idToken / sin GOOGLE_CLIENT_ID jamás crea sesión
      const googleBypassRes = await googleAuthPost(
        new NextRequest('http://localhost:3000/api/v1/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@bspstore.com.co',
            name: 'Fake Admin',
            googleId: 'spoofed-admin-gid',
          }),
        })
      );
      expect([400, 401, 503]).toContain(googleBypassRes.status);

      // 2. Servicio loginOrRegisterWithGoogle bloquea vinculación de cuentas ADMIN
      await expect(
        loginOrRegisterWithGoogle({
          email: 'admin@bspstore.com.co',
          name: 'Admin Spoof',
          googleId: `spoof-admin-${Date.now()}`,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_OAUTH_ADMIN_LINK' });

      // 3. POST /api/v1/auth/password-reset jamás expone devResetToken en HTTP
      const resetRes = await passwordResetPost(
        new NextRequest('http://localhost:3000/api/v1/auth/password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@bspstore.com.co' }),
        })
      );
      expect(resetRes.status).toBe(200);
      const resetJson = await resetRes.json();
      expect(resetJson.data.devResetToken).toBeUndefined();
    });
  });

  describe('6. Prevención de IDOR en direcciones, pedidos y privacidad (Ley 1581)', () => {
    it('impide que userB lea, edite o elimine direcciones de userA', async () => {
      const userA = await createTempUser('idor-addr-a', 'CUSTOMER');
      const userB = await createTempUser('idor-addr-b', 'CUSTOMER');

      const createRes = await addressesPost(
        new NextRequest('http://localhost:3000/api/v1/addresses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: `${SESSION_COOKIE_NAME}=${userA.sessionToken}`,
          },
          body: JSON.stringify({
            label: 'Casa A',
            recipientName: 'Titular A',
            phone: '3028000240',
            department: 'Santander',
            city: 'Bucaramanga',
            streetAddress: 'Carrera 33 # 48-20',
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const { id: addressId } = (await createRes.json()).data.address;

      const headersB = {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${userB.sessionToken}`,
      };

      const [putB, patchB, delB, listB] = await Promise.all([
        addressPut(
          new NextRequest(`http://localhost:3000/api/v1/addresses/${addressId}`, {
            method: 'PUT',
            headers: headersB,
            body: JSON.stringify({
              label: 'Hackeada',
              recipientName: 'Atacante',
              phone: '3000000000',
              department: 'Antioquia',
              city: 'Medellín',
              streetAddress: 'Calle Falsa 123',
            }),
          }),
          { params: Promise.resolve({ addressId }) }
        ),
        addressPatch(
          new NextRequest(`http://localhost:3000/api/v1/addresses/${addressId}`, {
            method: 'PATCH',
            headers: headersB,
            body: JSON.stringify({ label: 'Hackeada' }),
          }),
          { params: Promise.resolve({ addressId }) }
        ),
        addressDelete(
          new NextRequest(`http://localhost:3000/api/v1/addresses/${addressId}`, {
            method: 'DELETE',
            headers: headersB,
          }),
          { params: Promise.resolve({ addressId }) }
        ),
        addressesGet(new NextRequest('http://localhost:3000/api/v1/addresses', { headers: headersB })),
      ]);

      expect(putB.status).toBe(404);
      expect(patchB.status).toBe(404);
      expect(delB.status).toBe(404);
      const listBJson = await listB.json();
      expect(listBJson.data.addresses.some((a: { id: string }) => a.id === addressId)).toBe(false);

      const stillIntact = await prisma.address.findUnique({ where: { id: addressId } });
      expect(stillIntact?.label).toBe('Casa A');
    });

    it('oculta PII en rastreo público de pedidos y bloquea IDOR al subir comprobante Bre-B o cancelar', async () => {
      const userA = await createTempUser('idor-ord-a', 'CUSTOMER');
      const userB = await createTempUser('idor-ord-b', 'CUSTOMER');

      const prod = await prisma.product.findFirstOrThrow({
        where: { legacyId: 5 },
        include: { inventory: true },
      });
      const initialReserved = prod.inventory!.quantityReserved;

      const created = await createCheckoutOrder(
        {
          customerName: 'Cliente Secreto A',
          customerEmail: userA.email,
          customerPhone: '3028000240',
          department: 'Santander',
          city: 'Bucaramanga',
          streetAddress: 'Calle Privada 123 # 45-67',
          paymentMethod: 'BREB',
          items: [{ productIdOrLegacyId: 5, quantity: 1 }],
        },
        userA.user.id
      );

      try {
        // 1. Rastreo público anónimo solo devuelve datos de envío sin PII
        const publicGet = await orderByNumberGet(
          new NextRequest(`http://localhost:3000/api/v1/orders/${created.order.orderNumber}`),
          { params: Promise.resolve({ orderNumber: created.order.orderNumber }) }
        );
        expect(publicGet.status).toBe(200);
        const publicJson = await publicGet.json();
        expect(publicJson.data.isPublicTrackingView).toBe(true);
        expect(publicJson.data.order.customerEmail).toBeUndefined();
        expect(publicJson.data.order.customerPhone).toBeUndefined();
        expect(publicJson.data.order.streetAddress).toBeUndefined();

        // 2. Anónimo sin correo y userB no pueden sobrescribir comprobante Bre-B
        const anonReceipt = await orderByNumberPost(
          new NextRequest(`http://localhost:3000/api/v1/orders/${created.order.orderNumber}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transferReceiptRef: 'FAKE-REF-9999' }),
          }),
          { params: Promise.resolve({ orderNumber: created.order.orderNumber }) }
        );
        expect(anonReceipt.status).toBe(403);

        const userBReceipt = await orderByNumberPost(
          new NextRequest(`http://localhost:3000/api/v1/orders/${created.order.orderNumber}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: `${SESSION_COOKIE_NAME}=${userB.sessionToken}`,
            },
            body: JSON.stringify({
              transferReceiptRef: 'FAKE-REF-8888',
              customerEmail: userA.email,
            }),
          }),
          { params: Promise.resolve({ orderNumber: created.order.orderNumber }) }
        );
        expect(userBReceipt.status).toBe(403);

        // 3. userB y anónimo con solo correo no pueden cancelar pedido de userA
        const userBCancel = await orderByNumberPatch(
          new NextRequest(`http://localhost:3000/api/v1/orders/${created.order.orderNumber}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              cookie: `${SESSION_COOKIE_NAME}=${userB.sessionToken}`,
            },
            body: JSON.stringify({ action: 'cancel', customerEmail: userA.email }),
          }),
          { params: Promise.resolve({ orderNumber: created.order.orderNumber }) }
        );
        expect(userBCancel.status).toBe(403);
      } finally {
        await prisma.inventory.update({
          where: { id: prod.inventory!.id },
          data: { quantityReserved: initialReserved },
        });
        await prisma.order.delete({ where: { id: created.order.id } });
      }
    });

    it('impide IDOR en /api/v1/privacy/me y bloquea supresión de cuentas ADMIN', async () => {
      const userA = await createTempUser('priv-a', 'CUSTOMER');
      const userB = await createTempUser('priv-b', 'CUSTOMER');
      const admin = await loginSeededAdmin();

      const unauthGet = await privacyGet(
        new NextRequest('http://localhost:3000/api/v1/privacy/me')
      );
      expect(unauthGet.status).toBe(401);

      const idorGet = await privacyGet(
        new NextRequest(`http://localhost:3000/api/v1/privacy/me?userId=${userA.user.id}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${userB.sessionToken}` },
        })
      );
      expect(idorGet.status).toBe(200);
      const idorJson = await idorGet.json();
      expect(idorJson.data.subject.id).toBe(userB.user.id);

      const adminDel = await privacyDelete(
        new NextRequest('http://localhost:3000/api/v1/privacy/me', {
          method: 'DELETE',
          headers: { cookie: `${SESSION_COOKIE_NAME}=${admin.sessionToken}` },
        })
      );
      expect(adminDel.status).toBe(409);
      expect((await adminDel.json()).error.code).toBe('ADMIN_SUPPRESSION_BLOCKED');
    });
  });

  describe('7. Auto-degradación de admin y validación de ofertas programadas', () => {
    it('bloquea auto-degradación o auto-desactivación de ADMIN y permite mantener estado activo', async () => {
      const admin = await loginSeededAdmin();
      const headers = {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${admin.sessionToken}`,
      };

      for (const payload of [
        { userId: admin.user.id, role: 'CUSTOMER' },
        { userId: admin.user.id, role: 'STAFF' },
        { userId: admin.user.id, isActive: false },
      ]) {
        const res = await adminCustomersPatch(
          new NextRequest('http://localhost:3000/api/v1/admin/customers', {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
          })
        );
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('SELF_DEMOTION_FORBIDDEN');
      }

      const dbAdmin = await prisma.user.findUniqueOrThrow({
        where: { id: admin.user.id },
        include: { role: true },
      });
      expect(dbAdmin.role.code).toBe('ADMIN');
      expect(dbAdmin.isActive).toBe(true);
    });

    it('valida porcentajes y fechas de ofertas programadas sin descontar precios futuros antes de tiempo', async () => {
      const admin = await loginSeededAdmin();
      const product = await prisma.product.findFirstOrThrow({
        where: { legacyId: 1 },
        select: { id: true, price: true, compareAtPrice: true, isOffer: true },
      });
      const headers = {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${admin.sessionToken}`,
      };

      // Porcentaje fuera de rango -> 422
      const badPct = await adminOffersPost(
        new NextRequest('http://localhost:3000/api/v1/admin/offers', {
          method: 'POST',
          headers,
          body: JSON.stringify({ productId: product.id, discountPercent: 95 }),
        })
      );
      expect(badPct.status).toBe(422);

      // Fecha de fin en el pasado -> 400
      const pastEnd = new Date(Date.now() - 86_400_000).toISOString();
      const badPast = await adminOffersPost(
        new NextRequest('http://localhost:3000/api/v1/admin/offers', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            productId: product.id,
            discountPercent: 15,
            expiresAt: pastEnd,
          }),
        })
      );
      expect(badPast.status).toBe(400);

      // Rango invertido (startsAt > expiresAt) -> 400
      const futureStart = new Date(Date.now() + 5 * 86_400_000).toISOString();
      const earlierEnd = new Date(Date.now() + 2 * 86_400_000).toISOString();
      const badRange = await adminOffersPost(
        new NextRequest('http://localhost:3000/api/v1/admin/offers', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            productId: product.id,
            discountPercent: 15,
            startsAt: futureStart,
            expiresAt: earlierEnd,
          }),
        })
      );
      expect(badRange.status).toBe(400);

      // Campaña programada en el futuro -> guarda Discount pero NO altera precio público actual
      const validFutureStart = new Date(Date.now() + 2 * 86_400_000).toISOString();
      const validFutureEnd = new Date(Date.now() + 5 * 86_400_000).toISOString();
      const scheduledRes = await adminOffersPost(
        new NextRequest('http://localhost:3000/api/v1/admin/offers', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            productId: product.id,
            discountPercent: 20,
            campaignName: 'Black Friday Test',
            startsAt: validFutureStart,
            expiresAt: validFutureEnd,
          }),
        })
      );
      expect(scheduledRes.status).toBe(200);
      const scheduledJson = await scheduledRes.json();
      expect(scheduledJson.data.scheduledForFuture).toBe(true);
      expect(scheduledJson.data.campaign?.targetScope).toBe('PRODUCT');

      const afterProd = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterProd.price).toBe(product.price);

      if (scheduledJson.data.campaign?.id) {
        await prisma.discount.delete({ where: { id: scheduledJson.data.campaign.id } });
      }
    });
  });

  describe('8. Cabeceras HTTP de seguridad y Rate Limiting', () => {
    it('configura cabeceras de seguridad completas (CSP, HSTS, X-Frame-Options, nosniff, Permissions-Policy)', async () => {
      expect(nextConfig.poweredByHeader).toBe(false);
      const headerSets = (await nextConfig.headers?.()) ?? [];
      const globalRule = headerSets.find((r) => r.source === '/(.*)');
      expect(globalRule).toBeDefined();

      const headerMap = new Map(globalRule!.headers.map((h) => [h.key.toLowerCase(), h.value]));
      expect(headerMap.get('x-content-type-options')).toBe('nosniff');
      expect(headerMap.get('x-frame-options')).toBe('DENY');
      expect(headerMap.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(headerMap.get('permissions-policy')).toContain('camera=()');
      expect(headerMap.get('strict-transport-security')).toContain('max-age=31536000');

      const csp = headerMap.get('content-security-policy') ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('aplica rate limiting determinista, sanitiza IP y bloquea fuerza bruta en /api/v1/auth/login', async () => {
      expect(extractClientIp('198.51.100.42, 10.0.0.5')).toBe('198.51.100.42');
      expect(extractClientIp(null)).toBe('local');

      vi.useFakeTimers();
      enforceRateLimit('sec:unit', 3, 60_000);
      enforceRateLimit('sec:unit', 3, 60_000);
      enforceRateLimit('sec:unit', 3, 60_000);
      expect(() => enforceRateLimit('sec:unit', 3, 60_000)).toThrow(/demasiadas solicitudes/i);

      vi.advanceTimersByTime(60_001);
      expect(() => enforceRateLimit('sec:unit', 3, 60_000)).not.toThrow();
      vi.useRealTimers();

      // Prueba real contra POST /api/v1/auth/login (12 intentos máx por IP/min)
      for (let i = 0; i < 12; i++) {
        await loginPost(
          new NextRequest('http://localhost:3000/api/v1/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-forwarded-for': '203.0.113.77, 10.0.0.1',
            },
            body: JSON.stringify({
              email: `brute.${i}@example.com`,
              password: 'WrongPassword1',
            }),
          })
        );
      }

      const blockedRes = await loginPost(
        new NextRequest('http://localhost:3000/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.77, 10.0.0.1',
          },
          body: JSON.stringify({
            email: 'brute.13@example.com',
            password: 'WrongPassword1',
          }),
        })
      );
      expect(blockedRes.status).toBe(429);

      const otherIpRes = await loginPost(
        new NextRequest('http://localhost:3000/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.88',
          },
          body: JSON.stringify({
            email: 'other.user@example.com',
            password: 'WrongPassword1',
          }),
        })
      );
      expect(otherIpRes.status).toBe(401);
    });

    it('protege /api/v1/auth/google/callback contra state CSRF inválido y exige CRON_SECRET o ADMIN en /api/v1/cron/offers', async () => {
      const cbRes = await googleCallbackGet(
        new NextRequest(
          'http://localhost:3000/api/v1/auth/google/callback?code=fake-code&state=forged',
          { headers: { cookie: 'bsp_oauth_state=different-state' } }
        )
      );
      expect(cbRes.status).toBe(302);
      expect(cbRes.headers.get('location')).toContain('oauth_error=');

      const unauthCron = await cronOffersPost(
        new NextRequest('http://localhost:3000/api/v1/cron/offers', { method: 'POST' })
      );
      expect(unauthCron.status).toBe(401);

      const admin = await loginSeededAdmin();
      const authCron = await cronOffersPost(
        new NextRequest('http://localhost:3000/api/v1/cron/offers', {
          method: 'POST',
          headers: { cookie: `${SESSION_COOKIE_NAME}=${admin.sessionToken}` },
        })
      );
      expect(authCron.status).toBe(200);
      const cronJson = await authCron.json();
      expect(cronJson.ok).toBe(true);
      expect(typeof cronJson.data.activeCampaignsChecked).toBe('number');
    });
  });
});
