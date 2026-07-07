import mongoose, { Schema, Document } from "mongoose";

export type LivestreamProvider = "agora" | "cloudflare";

export interface IPlatformSettings extends Document {
  singletonKey: "platform";
  allowContentEditorSignup: boolean;
  allowAdminSignup: boolean;
  allowSuperAdminSignup: boolean;
  livestreamProvider: LivestreamProvider;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
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
  },
  { timestamps: true },
);

export const PlatformSettingsModel =
  mongoose.models.PlatformSettings ||
  mongoose.model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);
