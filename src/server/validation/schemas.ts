import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.'),
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
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

export const googleAuthSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo de Google inválido.'),
  name: z.string().trim().min(2).max(100),
  googleId: z.string().trim().min(3),
  avatarUrl: z.string().url().optional(),
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
  category: z.string().optional(),
  brand: z.string().optional(),
  q: z.string().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  inStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['relevance', 'asc', 'desc', 'new']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export const addressSchema = z.object({
  label: z.string().trim().min(2).max(40).default('Casa'),
  recipientName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  department: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(60),
  neighborhood: z.string().trim().max(80).optional(),
  streetAddress: z.string().trim().min(5).max(160),
  additionalInfo: z.string().trim().max(200).optional(),
  isDefault: z.boolean().optional().default(false),
});
