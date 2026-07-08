import mongoose from 'mongoose';

type PlatformSettingsDocument = {
  livestreamProvider?: 'agora' | 'cloudflare';
};

const platformSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, enum: ['platform'], default: 'platform', unique: true },
    livestreamProvider: { type: String, enum: ['agora', 'cloudflare'], default: 'agora' },
  },
  { collection: 'platformsettings' },
);

const PlatformSettings =
  mongoose.models.PlatformSettings
  ?? mongoose.model('PlatformSettings', platformSettingsSchema);

export const getLivestreamProviderSetting = async (): Promise<'agora' | 'cloudflare'> => {
  const settings = await PlatformSettings.findOne({ singletonKey: 'platform' })
    .select('livestreamProvider')
    .lean<PlatformSettingsDocument>();

  return settings?.livestreamProvider ?? 'agora';
};
