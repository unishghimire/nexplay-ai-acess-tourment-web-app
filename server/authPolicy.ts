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
