import mongoose, { type Model } from 'mongoose';

type PlatformSettingsDocument = {
  singletonKey?: string;
  livestreamProvider?: 'agora' | 'cloudflare';
};

const platformSettingsSchema = new mongoose.Schema<PlatformSettingsDocument>(
  {
    singletonKey: { type: String, enum: ['platform'], default: 'platform', unique: true },
    livestreamProvider: { type: String, enum: ['agora', 'cloudflare'], default: 'agora' },
  },
  { collection: 'platformsettings' },
);

const PlatformSettings: Model<PlatformSettingsDocument> =
  (mongoose.models.PlatformSettings as Model<PlatformSettingsDocument> | undefined)
  ?? mongoose.model<PlatformSettingsDocument>('PlatformSettings', platformSettingsSchema);

export const getLivestreamProviderSetting = async (): Promise<'agora' | 'cloudflare'> => {
  const settings = await PlatformSettings.findOne({ singletonKey: 'platform' })
    .select('livestreamProvider')
    .lean();

  return settings?.livestreamProvider ?? 'agora';
};
