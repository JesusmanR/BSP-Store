import { z } from 'zod';
import { isSafeMediaUrl } from '@/server/services/media-upload.service';

const NO_HTML_REGEX = /^[^<>]*$/;

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.')
    .regex(NO_HTML_REGEX, 'El nombre no puede contener etiquetas HTML.'),
  email: z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido.'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener mínimo 8 caracteres.')
    .max(72, 'La contraseña no puede superar 72 caracteres.')
    .regex(/[A-Za-z]/, 'La contraseña debe incluir letras.')
    .regex(/[0-9]/, 'La contraseña debe incluir al menos un número.'),
  phone: z
    .string()
    .trim()
    .min(7, 'Ingresa un teléfono de contacto válido.')
    .max(20)
    .regex(/^[0-9+\s()-]+$/, 'Ingresa un número de teléfono válido.')
    .optional(),
  acceptTerms: z
    .boolean()
    .default(true)
    .refine((val) => val === true, {
      message: 'Debes aceptar los Términos y Condiciones Comerciales (Ley 1480 de 2011).',
    }),
  acceptPrivacyPolicy: z
    .boolean()
    .default(true)
    .refine((val) => val === true, {
      message:
        'Debes autorizar el Tratamiento de Datos Personales conforme a la Ley 1581 de 2012 (Habeas Data).',
    }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

export const googleAuthSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo de Google inválido.'),
  name: z.string().trim().min(2).max(100).regex(NO_HTML_REGEX, 'Nombre inválido.'),
  googleId: z.string().trim().min(3).max(120),
  avatarUrl: z
    .string()
    .trim()
    .refine(
      (val) => isSafeMediaUrl(val, { allowCatalogSvgPresets: false, allowAnyTrustedHttps: false }),
      { message: 'URL de avatar no permitida.' }
    )
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16, 'Token de recuperación inválido.'),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener mínimo 8 caracteres.')
    .max(72)
    .regex(/[A-Za-z]/, 'La contraseña debe incluir letras.')
    .regex(/[0-9]/, 'La contraseña debe incluir al menos un número.'),
});

export const catalogQuerySchema = z.object({
  category: z.string().max(100).optional(),
  categoryId: z.string().trim().min(1).max(60).optional(),
  brand: z.string().max(100).optional(),
  brandId: z.string().trim().min(1).max(60).optional(),
  productId: z.string().trim().min(1).max(60).optional(),
  q: z.string().max(100).optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  inStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  onlyOffers: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['relevance', 'asc', 'desc', 'new']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

export const addressSchema = z.object({
  label: z.string().trim().min(2).max(40).regex(NO_HTML_REGEX, 'Etiqueta inválida.').default('Casa'),
  recipientName: z.string().trim().min(2).max(100).regex(NO_HTML_REGEX, 'Nombre inválido.'),
  phone: z.string().trim().min(7).max(20).regex(/^[0-9+\s()-]+$/, 'Teléfono inválido.'),
  department: z.string().trim().min(2).max(60).regex(NO_HTML_REGEX),
  city: z.string().trim().min(2).max(60).regex(NO_HTML_REGEX),
  neighborhood: z.string().trim().max(80).regex(NO_HTML_REGEX).optional(),
  streetAddress: z.string().trim().min(5).max(160).regex(NO_HTML_REGEX),
  additionalInfo: z.string().trim().max(200).regex(NO_HTML_REGEX).optional(),
  isDefault: z.boolean().optional().default(false),
});
