export type UserRoleCode = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export const ROLE_LABELS_ES: Record<UserRoleCode, string> = {
  CUSTOMER: 'Usuario',
  STAFF: 'Empleado',
  ADMIN: 'Admin',
};

export function getRoleLabelEs(role?: string | null): string {
  if (!role) return 'Usuario';
  const upper = role.toUpperCase() as UserRoleCode;
  return ROLE_LABELS_ES[upper] ?? 'Usuario';
}
