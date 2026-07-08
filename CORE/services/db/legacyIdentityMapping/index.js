const LEGACY_ROLE_MAP = {
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
const LEGACY_USER_TYPE_MAP = {
    admin: 'editor',
    vendor: 'vendor',
    buyer: 'buyer',
    logistic: 'buyer',
    editor: 'editor',
};
export const normalizeLegacyRole = (role) => {
    if (typeof role !== 'string' || !role.trim()) {
        return undefined;
    }
    const normalized = role.trim().toLowerCase();
    return LEGACY_ROLE_MAP[normalized] ?? LEGACY_ROLE_MAP[normalized.replace(/\s+/g, '_')];
};
export const normalizeLegacyUserType = (userType) => {
    if (typeof userType !== 'string' || !userType.trim()) {
        return undefined;
    }
    return LEGACY_USER_TYPE_MAP[userType.trim().toLowerCase()];
};
export const normalizeLegacyIdentityFields = (record) => {
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
