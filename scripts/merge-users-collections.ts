/**
 * Merges legacy `users` collection documents into canonical `user` collection.
 *
 * Run: NODE_ENV=development npx tsx scripts/merge-users-collections.ts
 * Add --execute to apply writes. Default is dry-run.
 */
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error('MONGODB_URI is required');
}

type LooseUserDoc = Record<string, unknown> & {
  _id: mongoose.Types.ObjectId;
  email?: string;
};

const mergeDocuments = (canonical: LooseUserDoc, legacy: LooseUserDoc): LooseUserDoc => {
  const merged: LooseUserDoc = { ...legacy, ...canonical };

  for (const key of Object.keys(legacy)) {
    const legacyValue = legacy[key];
    const canonicalValue = canonical[key];
    if (canonicalValue === undefined || canonicalValue === null || canonicalValue === '') {
      merged[key] = legacyValue;
    }
  }

  if (legacy.vendorProfile && canonical.vendorProfile) {
    merged.vendorProfile = {
      ...(legacy.vendorProfile as Record<string, unknown>),
      ...(canonical.vendorProfile as Record<string, unknown>),
    };
  }

  return merged;
};

const run = async (): Promise<void> => {
  const execute = process.argv.includes('--execute');
  await mongoose.connect(mongoUri);

  const userCollection = mongoose.connection.collection('user');
  const usersCollection = mongoose.connection.collection('users');

  const [userCount, usersCount] = await Promise.all([
    userCollection.countDocuments(),
    usersCollection.countDocuments(),
  ]);

  console.log({ userCount, usersCount, mode: execute ? 'execute' : 'dry-run' });

  const legacyUsers = (await usersCollection.find({}).toArray()) as LooseUserDoc[];
  let inserted = 0;
  let merged = 0;
  let skipped = 0;

  for (const legacyDoc of legacyUsers) {
    const email = String(legacyDoc.email ?? '').trim().toLowerCase();
    const canonical = email
      ? ((await userCollection.findOne({ email })) as LooseUserDoc | null)
      : ((await userCollection.findOne({ _id: legacyDoc._id })) as LooseUserDoc | null);

    if (!canonical) {
      if (execute) {
        await userCollection.insertOne(legacyDoc);
      }
      inserted += 1;
      continue;
    }

    const nextDoc = mergeDocuments(canonical, legacyDoc);
    const hasChanges = JSON.stringify(canonical) !== JSON.stringify(nextDoc);
    if (!hasChanges) {
      skipped += 1;
      continue;
    }

    if (execute) {
      await userCollection.replaceOne({ _id: canonical._id }, nextDoc);
    }
    merged += 1;
  }

  console.log({ inserted, merged, skipped });

  if (execute && usersCount > 0) {
    const remaining = await usersCollection.countDocuments();
    if (remaining === 0) {
      console.log('users collection is empty after merge.');
    } else {
      console.log(`users collection still has ${remaining} documents — review before dropping.`);
    }
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
