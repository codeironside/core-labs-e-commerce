import { LivestreamProviderService } from '../../../CORE/services/livestreams/provider/index.js';
import { resolveVendorBroadcastUid } from '../../../CORE/services/livestreams/index.js';
import { LivestreamSession } from '../models/index.js';

type LivestreamHostSource = {
  _id: unknown;
  agoraChannelName: string;
  agoraHostUid?: number;
  hostToken: string;
  hostTokenExpiresAt?: number;
};

export type ResolvedHostBroadcast = {
  hostUid: number;
  hostToken: string;
  expiresAt?: number;
};

export const resolveHostBroadcastCredentials = async (
  livestream: LivestreamHostSource,
): Promise<ResolvedHostBroadcast> => {
  const hostUid = resolveVendorBroadcastUid(livestream.agoraHostUid);
  const needsRefresh = livestream.agoraHostUid !== hostUid;

  if (!needsRefresh) {
    return {
      hostUid,
      hostToken: livestream.hostToken,
      expiresAt: livestream.hostTokenExpiresAt,
    };
  }

  const remaining = (livestream.hostTokenExpiresAt ?? 0) - Math.floor(Date.now() / 1000);
  const expireSeconds = Math.max(remaining, 3600);
  const refreshed = await LivestreamProviderService.createPublisherSession({
    channelName: livestream.agoraChannelName,
    expireSeconds,
  });

  const livestreamId = String(livestream._id);
  await LivestreamSession.findByIdAndUpdate(livestreamId, {
    $set: {
      agoraHostUid: refreshed.uid,
      hostToken: refreshed.hostToken,
      hostTokenExpiresAt: refreshed.expiresAt,
    },
  });

  return {
    hostUid: refreshed.uid ?? hostUid,
    hostToken: refreshed.hostToken,
    expiresAt: refreshed.expiresAt,
  };
};
