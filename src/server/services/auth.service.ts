import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { RoleCode } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { AppError } from '@/server/http/errors';
import type { z } from 'zod';
import type {
  googleAuthSchema,
  loginSchema,
  registerSchema,
} from '@/server/validation/schemas';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export type AuthenticatedUserDTO = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: RoleCode;
  permissions: string[];
};

async function ensureCustomerRole() {
  return prisma.role.upsert({
    where: { code: RoleCode.CUSTOMER },
    update: {},
    create: {
      code: RoleCode.CUSTOMER,
      name: 'Cliente',
      permissions: ['catalog:read', 'cart:manage', 'orders:own', 'profile:own'],
    },
  });
}

async function createSessionForUser(
  userId: string,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<string> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
      expiresAt,
    },
  });

  return rawToken;
}

export async function registerCustomer(
  input: z.infer<typeof registerSchema>,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ user: AuthenticatedUserDTO; sessionToken: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new AppError(
      'EMAIL_ALREADY_REGISTERED',
      'Ya existe una cuenta registrada con este correo electrónico.',
      409
    );
  }

  const customerRole = await ensureCustomerRole();
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone ?? null,
      roleId: customerRole.id,
      isActive: true,
    },
    include: { role: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'AUTH_REGISTER',
      entity: 'User',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
    },
  });

  const sessionToken = await createSessionForUser(user.id, meta);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role.code,
      permissions: Array.isArray(user.role.permissions)
        ? (user.role.permissions as string[])
        : [],
    },
    sessionToken,
  };
}

export async function loginWithPassword(
  input: z.infer<typeof loginSchema>,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ user: AuthenticatedUserDTO; sessionToken: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true },
  });

  if (!user || !user.passwordHash) {
    throw new AppError(
      'INVALID_CREDENTIALS',
      'Correo electrónico o contraseña incorrectos.',
      401
    );
  }

  if (!user.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 'Esta cuenta se encuentra desactivada.', 403);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(
      'INVALID_CREDENTIALS',
      'Correo electrónico o contraseña incorrectos.',
      401
    );
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'AUTH_LOGIN_PASSWORD',
      entity: 'User',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
    },
  });

  const sessionToken = await createSessionForUser(user.id, meta);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role.code,
      permissions: Array.isArray(user.role.permissions)
        ? (user.role.permissions as string[])
        : [],
    },
    sessionToken,
  };
}

export async function loginOrRegisterWithGoogle(
  input: z.infer<typeof googleAuthSchema>,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ user: AuthenticatedUserDTO; sessionToken: string }> {
  const customerRole = await ensureCustomerRole();

  let user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
        emailVerified: new Date(),
        roleId: customerRole.id,
        isActive: true,
      },
      include: { role: true },
    });
  } else if (!user.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 'Esta cuenta se encuentra desactivada.', 403);
  }

  await prisma.oAuthAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'google',
        providerAccountId: input.googleId,
      },
    },
    update: {
      userId: user.id,
    },
    create: {
      userId: user.id,
      provider: 'google',
      providerAccountId: input.googleId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'AUTH_LOGIN_GOOGLE',
      entity: 'User',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
    },
  });

  const sessionToken = await createSessionForUser(user.id, meta);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role.code,
      permissions: Array.isArray(user.role.permissions)
        ? (user.role.permissions as string[])
        : [],
    },
    sessionToken,
  };
}

export async function requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    // Respuesta uniforme para prevenir enumeración de usuarios
    return {};
  }

  const rawResetToken = generateRawToken();
  const tokenHash = hashToken(rawResetToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'AUTH_PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user.id,
    },
  });

  return { resetToken: rawResetToken };
}

export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string
): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(
      'INVALID_OR_EXPIRED_TOKEN',
      'El enlace de recuperación es inválido o ha expirado.',
      400
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({
      where: { userId: record.userId },
    }),
    prisma.auditLog.create({
      data: {
        actorId: record.userId,
        action: 'AUTH_PASSWORD_RESET_COMPLETED',
        entity: 'User',
        entityId: record.userId,
      },
    }),
  ]);
}

export async function getSessionUser(
  rawToken?: string | null
): Promise<AuthenticatedUserDTO | null> {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: { role: true },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date() || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    phone: session.user.phone,
    avatarUrl: session.user.avatarUrl,
    role: session.user.role.code,
    permissions: Array.isArray(session.user.role.permissions)
      ? (session.user.role.permissions as string[])
      : [],
  };
}

export async function logoutSession(rawToken?: string | null): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.session.deleteMany({ where: { tokenHash } });
}
