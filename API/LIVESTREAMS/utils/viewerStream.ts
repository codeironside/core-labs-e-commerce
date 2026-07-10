import { resolveVendorBroadcastUid } from '../../../CORE/services/livestreams/index.js';
import { LivestreamProviderService } from '../../../CORE/services/livestreams/provider/index.js';
import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';

type LivestreamStreamSource = {
  agoraChannelName: string;
  agoraAppId: string;
  hostTokenExpiresAt?: number;
  agoraHostUid?: number;
  streamProvider?: string;
  playbackUrl?: string;
  vendorId: unknown;
};

export const resolveGuestViewerKey = (context: Context): string => {
  const headerValue = context.req.header('x-guest-viewer-id')?.trim();
  if (headerValue && headerValue.length <= 64) {
    return `guest_${headerValue}`;
  }
  return `guest_${randomUUID()}`;
};

export const buildViewerStreamPayload = async (
  livestream: LivestreamStreamSource,
  externalUserId: string,
) => {
  const remaining = (livestream.hostTokenExpiresAt ?? 0) - Math.floor(Date.now() / 1000);
  const expireSeconds = Math.max(remaining, 3600);
  const provider = (livestream.streamProvider === 'cloudflare' ? 'cloudflare' : 'agora') as
    | 'agora'
    | 'cloudflare';

  const viewerSession = await LivestreamProviderService.createViewerSession({
    channelName: livestream.agoraChannelName,
    externalUserId,
    expireSeconds,
    provider,
    playbackUrl: livestream.playbackUrl,
  });

  return {
    provider,
    appId: viewerSession.appId ?? livestream.agoraAppId,
    channelName: viewerSession.channelName,
    token: viewerSession.hostToken,
    uid: viewerSession.uid,
    hostUid: resolveVendorBroadcastUid(livestream.agoraHostUid),
    role: 'audience' as const,
    expiresAt: viewerSession.expiresAt,
    playbackUrl: livestream.playbackUrl ?? viewerSession.playbackUrl ?? null,
  };
};
