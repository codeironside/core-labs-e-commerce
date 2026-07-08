import mongoose, { Schema } from "mongoose";
const PlatformSettingsSchema = new Schema({
    singletonKey: {
        type: String,
        enum: ["platform"],
        default: "platform",
        unique: true,
        required: true,
    },
    allowContentEditorSignup: { type: Boolean, default: true },
    allowAdminSignup: { type: Boolean, default: false },
    allowSuperAdminSignup: { type: Boolean, default: false },
    livestreamProvider: {
        type: String,
        enum: ["agora", "cloudflare"],
        default: "agora",
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
export const PlatformSettingsModel = mongoose.models.PlatformSettings ||
    mongoose.model("PlatformSettings", PlatformSettingsSchema);
