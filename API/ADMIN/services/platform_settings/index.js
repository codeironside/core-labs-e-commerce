import mongoose from "mongoose";
import { PlatformSettingsModel } from "@api/ADMIN/model/platform_settings";
export async function getPlatformSettings() {
    return PlatformSettingsModel.findOneAndUpdate({ singletonKey: "platform" }, {
        $setOnInsert: {
            singletonKey: "platform",
            allowContentEditorSignup: true,
            allowAdminSignup: false,
            allowSuperAdminSignup: false,
        },
    }, { new: true, upsert: true, setDefaultsOnInsert: true });
}
export async function getPublicPlatformSignupSettings() {
    const settings = await getPlatformSettings();
    return {
        allowContentEditorSignup: settings.allowContentEditorSignup,
        allowAdminSignup: settings.allowAdminSignup,
        allowSuperAdminSignup: settings.allowSuperAdminSignup,
        livestreamProvider: settings.livestreamProvider ?? "agora",
    };
}
export async function getLivestreamProvider() {
    const settings = await getPlatformSettings();
    return settings.livestreamProvider ?? "agora";
}
export async function updatePlatformSettings({ allowContentEditorSignup, allowAdminSignup, allowSuperAdminSignup, livestreamProvider, updatedBy, }) {
    return PlatformSettingsModel.findOneAndUpdate({ singletonKey: 'platform' }, {
        $set: {
            allowContentEditorSignup,
            allowAdminSignup,
            ...(allowSuperAdminSignup !== undefined ? { allowSuperAdminSignup } : {}),
            ...(livestreamProvider ? { livestreamProvider } : {}),
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
        },
        $setOnInsert: { singletonKey: 'platform' },
    }, { new: true, upsert: true, setDefaultsOnInsert: true });
}
