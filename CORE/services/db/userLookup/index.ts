import { UserModel, LegacyUserModel, type IUser, type IUserDocument } from '@api/AUTH/models';
import { logger } from '@core/services/logger';
import { normalizeLegacyIdentityFields } from '@core/services/db/legacyIdentityMapping';

const CANONICAL_USER_COLLECTION = 'user' as const;
const LEGACY_USERS_COLLECTION = 'users' as const;

export type UserLookupOptions = {
  select?: string;
};

type UserLookupFilter = Record<string, unknown>;
type LooseUserRecord = Record<string, unknown>;

export const normalizeUserEmail = (email: string): string => email.trim().toLowerCase();

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';

const mergeLegacyIntoCanonical = (
  canonical: LooseUserRecord,
  legacy: LooseUserRecord,
): LooseUserRecord => {
  const merged: LooseUserRecord = { ...legacy, ...canonical };

  Object.keys(legacy).forEach((key) => {
    if (isEmptyValue(canonical[key])) {
      merged[key] = legacy[key];
    }
  });

  if (legacy.vendorProfile && canonical.vendorProfile) {
    merged.vendorProfile = {
      ...(legacy.vendorProfile as Record<string, unknown>),
      ...(canonical.vendorProfile as Record<string, unknown>),
    };
  }

  if (merged.onboardingComplete === undefined) {
    merged.onboardingComplete = true;
  }

  return merged;
};

const applySelect = <TQuery extends { select: (fields: string) => TQuery }>(
  query: TQuery,
  select?: string,
): TQuery => (select ? query.select(select) : query);

const fetchCanonicalUser = async (
  filter: UserLookupFilter,
  options?: UserLookupOptions,
): Promise<IUserDocument | null> =>
  applySelect(UserModel.findOne(filter), options?.select).exec();

const fetchLegacyUser = async (
  filter: UserLookupFilter,
  options?: UserLookupOptions,
): Promise<IUserDocument | null> =>
  applySelect(LegacyUserModel.findOne(filter), options?.select).exec();

const buildLegacyCompletionFilter = (filter: UserLookupFilter): UserLookupFilter => {
  if (!('onboardingComplete' in filter) || filter.onboardingComplete !== true) {
    return filter;
  }

  const { onboardingComplete: _ignored, ...rest } = filter;
  return {
    ...rest,
    $or: [{ onboardingComplete: true }, { onboardingComplete: { $exists: false } }],
  };
};

export const syncLegacyUserToCanonical = async (
  legacyUser: IUserDocument,
  options?: UserLookupOptions,
): Promise<IUserDocument | null> => {
  const legacyObject = legacyUser.toObject() as LooseUserRecord;
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
      onboardingComplete: (normalizedLegacy.onboardingComplete as boolean | undefined) ?? true,
    } as LooseUserRecord;
    delete insertPayload.__v;

    await UserModel.create(insertPayload as unknown as IUser);
    logger.info(
      { userId: String(legacyUser._id), collection: CANONICAL_USER_COLLECTION },
      'Legacy user copied into canonical user collection',
    );
    return fetchCanonicalUser({ _id: legacyUser._id }, options);
  }

  const merged = mergeLegacyIntoCanonical(
    canonicalById.toObject() as unknown as LooseUserRecord,
    normalizedLegacy,
  );
  merged._id = canonicalById._id;
  merged.email = normalizeUserEmail(String(merged.email ?? normalizedEmail));
  delete merged.__v;

  await UserModel.replaceOne({ _id: canonicalById._id }, merged);
  logger.info(
    {
      userId: String(canonicalById._id),
      legacyCollection: LEGACY_USERS_COLLECTION,
      canonicalCollection: CANONICAL_USER_COLLECTION,
    },
    'Legacy user merged into canonical user collection',
  );

  return fetchCanonicalUser({ _id: canonicalById._id }, options);
};

export const findUserOne = async (
  filter: UserLookupFilter,
  options?: UserLookupOptions,
): Promise<IUserDocument | null> => {
  if ('$or' in filter && Array.isArray(filter.$or)) {
    const branches = filter.$or as UserLookupFilter[];
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

export const findUserByEmail = async (
  email: string,
  extraFilter: UserLookupFilter = {},
  options?: UserLookupOptions,
): Promise<IUserDocument | null> =>
  findUserOne({ ...extraFilter, email: normalizeUserEmail(email) }, options);

export const findUserById = async (
  userId: string,
  options?: UserLookupOptions,
): Promise<IUserDocument | null> => findUserOne({ _id: userId }, options);

export const userExistsByEmail = async (
  email: string,
  extraFilter: UserLookupFilter = {},
): Promise<boolean> => {
  const user = await findUserByEmail(email, extraFilter);
  return user !== null;
};

export const purgeIncompleteUsersByEmail = async (email: string): Promise<void> => {
  const normalizedEmail = normalizeUserEmail(email);
  const incompleteFilter = { email: normalizedEmail, onboardingComplete: { $ne: true } };

  await Promise.all([
    UserModel.deleteMany(incompleteFilter),
    LegacyUserModel.deleteMany(incompleteFilter),
  ]);
};
