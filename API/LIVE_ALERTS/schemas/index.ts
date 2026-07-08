import { z } from 'zod';

export const liveAlertChannelsSchema = z.object({
  inApp: z.boolean().default(true),
  email: z.boolean().default(false),
  whatsapp: z.boolean().default(false),
  sms: z.boolean().default(false),
});

export const upsertLiveAlertSubscriptionSchema = z
  .object({
    targetType: z.enum(['store', 'vendor', 'product']),
    targetId: z.string().length(24),
    channels: liveAlertChannelsSchema,
    contactPhone: z.string().min(8).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    const hasChannel =
      value.channels.inApp
      || value.channels.email
      || value.channels.whatsapp
      || value.channels.sms;
    if (!hasChannel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['channels'],
        message: 'Select at least one notification channel.',
      });
    }
    if ((value.channels.whatsapp || value.channels.sms) && !value.contactPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactPhone'],
        message: 'Phone number is required for SMS or WhatsApp alerts.',
      });
    }
  });

export const removeLiveAlertSubscriptionSchema = z.object({
  targetType: z.enum(['store', 'vendor', 'product']),
  targetId: z.string().length(24),
});

export const fetchLiveAlertStatusQuerySchema = z.object({
  targetType: z.enum(['store', 'vendor', 'product']),
  targetId: z.string().length(24),
});
