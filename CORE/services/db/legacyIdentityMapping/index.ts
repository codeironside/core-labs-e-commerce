import type { OnboardingUserType } from '@core/constants/onboarding';
import type { UserRole } from '@api/AUTH/models/user';

const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  admin_level_1: 'super_admin',
  admin: 'admin',
  user: 'member',
  vendor: 'member',
  logistic: 'member',
  super_admin: 'super_admin',
  editor: 'editor',
  member: 'member',
  viewer: 'viewer',
};

const LEGACY_USER_TYPE_MAP: Record<string, OnboardingUserType> = {
  admin: 'editor',
  vendor: 'vendor',
  buyer: 'buyer',
  logistic: 'buyer',
  editor: 'editor',
};

export const normalizeLegacyRole = (role: unknown): UserRole | undefined => {
  if (typeof role !== 'string' || !role.trim()) {
    return undefined;
  }
  const normalized = role.trim().toLowerCase();
  return LEGACY_ROLE_MAP[normalized] ?? (LEGACY_ROLE_MAP[normalized.replace(/\s+/g, '_')] as UserRole | undefined);
};

export const normalizeLegacyUserType = (userType: unknown): OnboardingUserType | undefined => {
  if (typeof userType !== 'string' || !userType.trim()) {
    return undefined;
  }
  return LEGACY_USER_TYPE_MAP[userType.trim().toLowerCase()];
};

export const normalizeLegacyIdentityFields = (
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...record };
  const mappedRole = normalizeLegacyRole(record.role);
  const mappedUserType = normalizeLegacyUserType(record.userType);

  if (mappedRole) {
    next.role = mappedRole;
  }
  if (mappedUserType) {
    next.userType = mappedUserType;
  }

  return next;
};
