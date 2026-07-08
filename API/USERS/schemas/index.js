import { z } from 'zod';
export const UpdateProfileSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
});
export const AvatarMetadataSchema = z.object({
    profileImage: z.string().url(),
    cloudinaryPublicId: z.string().min(1).max(500),
});
export const UpdatePushTokenSchema = z.object({
    fcmToken: z.string().min(1).max(4096),
    platform: z.enum(['ios', 'android']).optional(),
});
