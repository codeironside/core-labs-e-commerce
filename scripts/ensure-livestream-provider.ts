/**
 * Ensures platform livestream provider is set to Agora (uses local .env.development Agora keys).
 * Run: npm run setup:livestream
 */
import mongoose, { type Model } from 'mongoose';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
loadEnv();

const rawUri = process.env.MONGODB_URI;
if (!rawUri) {
  console.error('MONGODB_URI is missing.');
  process.exit(1);
}
const mongoUri = rawUri;

type PlatformSettingsDoc = {
  singletonKey?: string;
  livestreamProvider?: 'agora' | 'cloudflare';
};

const schema = new mongoose.Schema<PlatformSettingsDoc>(
  {
    singletonKey: { type: String, enum: ['platform'], default: 'platform', unique: true },
    livestreamProvider: { type: String, enum: ['agora', 'cloudflare'], default: 'agora' },
  },
  { collection: 'platformsettings' },
);

const PlatformSettings: Model<PlatformSettingsDoc> =
  (mongoose.models.PlatformSettings as Model<PlatformSettingsDoc> | undefined)
  ?? mongoose.model<PlatformSettingsDoc>('PlatformSettings', schema);

async function main(): Promise<void> {
  await mongoose.connect(mongoUri);
  const result = await PlatformSettings.findOneAndUpdate(
    { singletonKey: 'platform' },
    { $set: { livestreamProvider: 'agora' } },
    { upsert: true, new: true },
  ).lean();

  console.log('Platform livestream provider:', result?.livestreamProvider ?? 'agora');
  console.log('Agora app id configured:', Boolean(process.env.AGORA_APP_ID));
  console.log('Agora certificate configured:', Boolean(process.env.AGORA_APP_CERTIFICATE));
  await mongoose.disconnect();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
