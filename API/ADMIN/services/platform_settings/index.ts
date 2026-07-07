import mongoose from "mongoose";
import { PlatformSettingsModel, type IPlatformSettings } from "@api/ADMIN/model/platform_settings";

export type PublicPlatformSignupSettings = Pick<
  IPlatformSettings,
  "allowContentEditorSignup" | "allowAdminSignup" | "allowSuperAdminSignup" | "livestreamProvider"
>;

export async function getPlatformSettings(): Promise<IPlatformSettings> {
  return PlatformSettingsModel.findOneAndUpdate(
    { singletonKey: "platform" },
    {
      $setOnInsert: {
        singletonKey: "platform",
        allowContentEditorSignup: true,
        allowAdminSignup: false,
        allowSuperAdminSignup: false,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function getPublicPlatformSignupSettings(): Promise<PublicPlatformSignupSettings> {
  const settings = await getPlatformSettings();
  return {
    allowContentEditorSignup: settings.allowContentEditorSignup,
    allowAdminSignup: settings.allowAdminSignup,
    allowSuperAdminSignup: settings.allowSuperAdminSignup,
    livestreamProvider: settings.livestreamProvider ?? "agora",
  };
}

export async function getLivestreamProvider(): Promise<"agora" | "cloudflare"> {
  const settings = await getPlatformSettings();
  return settings.livestreamProvider ?? "agora";
}

export async function updatePlatformSettings({
  allowContentEditorSignup,
  allowAdminSignup,
  allowSuperAdminSignup,
  livestreamProvider,
  updatedBy,
}: {
  allowContentEditorSignup: boolean;
  allowAdminSignup: boolean;
  allowSuperAdminSignup?: boolean;
  livestreamProvider?: 'agora' | 'cloudflare';
  updatedBy: string;
}): Promise<IPlatformSettings> {
  return PlatformSettingsModel.findOneAndUpdate(
    { singletonKey: 'platform' },
    {
      $set: {
        allowContentEditorSignup,
        allowAdminSignup,
        ...(allowSuperAdminSignup !== undefined ? { allowSuperAdminSignup } : {}),
        ...(livestreamProvider ? { livestreamProvider } : {}),
        updatedBy: new mongoose.Types.ObjectId(updatedBy),
      },
      $setOnInsert: { singletonKey: 'platform' },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}
