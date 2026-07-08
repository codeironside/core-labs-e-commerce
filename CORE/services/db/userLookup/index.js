import { UserModel, LegacyUserModel } from '@api/AUTH/models';
import { logger } from '@core/services/logger';
import { normalizeLegacyIdentityFields } from '@core/services/db/legacyIdentityMapping';
const CANONICAL_USER_COLLECTION = 'user';
const LEGACY_USERS_COLLECTION = 'users';
export const normalizeUserEmail = (email) => email.trim().toLowerCase();
const isEmptyValue = (value) => value === undefined || value === null || value === '';
const mergeLegacyIntoCanonical = (canonical, legacy) => {
    const merged = { ...legacy, ...canonical };
    Object.keys(legacy).forEach((key) => {
        if (isEmptyValue(canonical[key])) {
            merged[key] = legacy[key];
        }
    });
    if (legacy.vendorProfile && canonical.vendorProfile) {
        merged.vendorProfile = {
            ...legacy.vendorProfile,
            ...canonical.vendorProfile,
        };
    }
    if (merged.onboardingComplete === undefined) {
        merged.onboardingComplete = true;
    }
    return merged;
};
const applySelect = (query, select) => (select ? query.select(select) : query);
const fetchCanonicalUser = async (filter, options) => applySelect(UserModel.findOne(filter), options?.select).exec();
const fetchLegacyUser = async (filter, options) => applySelect(LegacyUserModel.findOne(filter), options?.select).exec();
const buildLegacyCompletionFilter = (filter) => {
    if (!('onboardingComplete' in filter) || filter.onboardingComplete !== true) {
        return filter;
    }
    const { onboardingComplete: _ignored, ...rest } = filter;
    return {
        ...rest,
        $or: [{ onboardingComplete: true }, { onboardingComplete: { $exists: false } }],
    };
};
export const syncLegacyUserToCanonical = async (legacyUser, options) => {
    const legacyObject = legacyUser.toObject();
    const normalizedLegacy = normalizeLegacyIdentityFields(legacyObject);
    const normalizedEmail = normalizeUserEmail(String(normalizedLegacy.email ?? ''));
    const canonicalByEmail = normalizedEmail
        ? await UserModel.findOne({ email: normalizedEmail }).exec()
        : null;
    const canonicalById = canonicalByEmail ?? (await UserModel.findById(legacyUser._id).exec());
    if (!canonicalById) {
        const insertPayload = {
            ...normalizedLegacy,
            email: normalizedEmail || String(normalizedLegacy.email ?? ''),
            onboardingComplete: normalizedLegacy.onboardingComplete ?? true,
        };
        delete insertPayload.__v;
        await UserModel.create(insertPayload);
        logger.info({ userId: String(legacyUser._id), collection: CANONICAL_USER_COLLECTION }, 'Legacy user copied into canonical user collection');
        return fetchCanonicalUser({ _id: legacyUser._id }, options);
    }
    const merged = mergeLegacyIntoCanonical(canonicalById.toObject(), normalizedLegacy);
    merged._id = canonicalById._id;
    merged.email = normalizeUserEmail(String(merged.email ?? normalizedEmail));
    delete merged.__v;
    await UserModel.replaceOne({ _id: canonicalById._id }, merged);
    logger.info({
        userId: String(canonicalById._id),
        legacyCollection: LEGACY_USERS_COLLECTION,
        canonicalCollection: CANONICAL_USER_COLLECTION,
    }, 'Legacy user merged into canonical user collection');
    return fetchCanonicalUser({ _id: canonicalById._id }, options);
};
export const findUserOne = async (filter, options) => {
    if ('$or' in filter && Array.isArray(filter.$or)) {
        const branches = filter.$or;
        for (const branch of branches) {
            const matchedUser = await findUserOne(branch, options);
            if (matchedUser) {
                return matchedUser;
            }
        }
        return null;
    }
    const canonical = await fetchCanonicalUser(filter, options);
    if (canonical) {
        return canonical;
    }
    const legacy = await fetchLegacyUser(buildLegacyCompletionFilter(filter), options);
    if (!legacy) {
        return null;
    }
    return syncLegacyUserToCanonical(legacy, options);
};
export const findUserByEmail = async (email, extraFilter = {}, options) => findUserOne({ ...extraFilter, email: normalizeUserEmail(email) }, options);
export const findUserById = async (userId, options) => findUserOne({ _id: userId }, options);
export const userExistsByEmail = async (email, extraFilter = {}) => {
    const user = await findUserByEmail(email, extraFilter);
    return user !== null;
};
export const purgeIncompleteUsersByEmail = async (email) => {
    const normalizedEmail = normalizeUserEmail(email);
    const incompleteFilter = { email: normalizedEmail, onboardingComplete: { $ne: true } };
    await Promise.all([
        UserModel.deleteMany(incompleteFilter),
        LegacyUserModel.deleteMany(incompleteFilter),
    ]);
};
