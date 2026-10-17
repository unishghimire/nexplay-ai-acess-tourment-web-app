export const LEGACY_AUTH_DEPRECATION = {
  success: false,
  code: 'FIREBASE_AUTH_REQUIRED',
  message: 'This legacy authentication endpoint has been retired. Use Firebase Authentication instead.',
} as const;

export const USER_ROLES = ['player', 'organizer', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function isFirebaseUid(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

// R-03: mailbox-name fallback for the platform owners. It must only apply to a
// VERIFIED email claim — Firebase issues ID tokens for unverified password
// sign-ups, so trusting a bare email claim lets anyone who registers an
// unowned super-admin mailbox claim the admin role.
export const SUPER_ADMIN_EMAILS = [
  'nexplayorg@gmail.com',
  'nex.unishghimire@gmail.com',
  'admin@nexplay.gg',
] as readonly string[];

export function resolveRoleFromToken(token: {
  role?: unknown;
  email?: unknown;
  email_verified?: unknown;
}): string {
  if (typeof token.role === 'string' && token.role.trim() !== '') return token.role;
  if (
    token.email_verified === true &&
    typeof token.email === 'string' &&
    SUPER_ADMIN_EMAILS.includes(token.email)
  ) {
    return 'admin';
  }
  return 'player';
}
