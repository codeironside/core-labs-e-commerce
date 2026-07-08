/**
 * Ensures platform livestream provider is set to Agora (uses local .env.development Agora keys).
 * Run: npm run setup:livestream
 */
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is missing.');
  process.exit(1);
}

const schema = new mongoose.Schema(
  {
    singletonKey: { type: String, enum: ['platform'], default: 'platform', unique: true },
    livestreamProvider: { type: String, enum: ['agora', 'cloudflare'], default: 'agora' },
  },
  { collection: 'platformsettings' },
);

const PlatformSettings =
  mongoose.models.PlatformSettings ?? mongoose.model('PlatformSettings', schema);

async function main() {
  await mongoose.connect(uri);
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

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
