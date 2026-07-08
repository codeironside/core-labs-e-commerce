import mongoose from 'mongoose';
import { logger } from '../../logger/index.js';
import { LivestreamSession } from '../../../../API/LIVESTREAMS/models/index.js';
import { startAgoraCloudRecording, stopAgoraCloudRecording } from './agoraRecording.js';
import { resolveCloudflareRecordingUrl } from './cloudflareRecording.js';

type RecordingMetadata = {
  agoraRecordingResourceId?: string;
  agoraRecordingSid?: string;
  agoraRecordingUid?: number;
  cloudflareInputId?: string;
};

const readMetadata = (metadata: Record<string, unknown> | undefined): RecordingMetadata => ({
  agoraRecordingResourceId:
    typeof metadata?.agoraRecordingResourceId === 'string' ? metadata.agoraRecordingResourceId : undefined,
  agoraRecordingSid: typeof metadata?.agoraRecordingSid === 'string' ? metadata.agoraRecordingSid : undefined,
  agoraRecordingUid:
    typeof metadata?.agoraRecordingUid === 'number' ? metadata.agoraRecordingUid : undefined,
  cloudflareInputId: typeof metadata?.cloudflareInputId === 'string' ? metadata.cloudflareInputId : undefined,
});

export const LivestreamRecordingService = {
  async startRecording(input: {
    livestreamId: mongoose.Types.ObjectId | string;
    provider: 'agora' | 'cloudflare';
    channelName: string;
    hostToken: string;
    hostUid: number;
    cloudflareInputId?: string;
  }): Promise<void> {
    const metadataUpdate: RecordingMetadata = {};

    if (input.provider === 'cloudflare' && input.cloudflareInputId) {
      metadataUpdate.cloudflareInputId = input.cloudflareInputId;
    }

    if (input.provider === 'agora') {
      const session = await startAgoraCloudRecording({
        channelName: input.channelName,
        hostToken: input.hostToken,
        hostUid: input.hostUid,
      });
      if (session) {
        metadataUpdate.agoraRecordingResourceId = session.resourceId;
        metadataUpdate.agoraRecordingSid = session.sid;
        metadataUpdate.agoraRecordingUid = session.uid;
      }
    }

    if (Object.keys(metadataUpdate).length === 0) return;

    await LivestreamSession.findByIdAndUpdate(input.livestreamId, {
      $set: Object.fromEntries(
        Object.entries(metadataUpdate).map(([key, value]) => [`metadata.${key}`, value]),
      ),
    });

    logger.info({ livestreamId: String(input.livestreamId), provider: input.provider }, 'Cloud recording started');
  },

  async stopAndResolveUrl(livestream: {
    _id: mongoose.Types.ObjectId | string;
    agoraChannelName: string;
    streamProvider?: string;
    playbackUrl?: string;
    metadata?: Record<string, unknown>;
    highlights?: Array<{ url: string; isPublic: boolean }>;
    recordingUrl?: string;
  }): Promise<string | undefined> {
    const meta = readMetadata(livestream.metadata);
    const provider =
      livestream.streamProvider ??
      (meta.cloudflareInputId ? 'cloudflare' : 'agora');

    if (provider === 'agora' && meta.agoraRecordingResourceId && meta.agoraRecordingSid) {
      const url = await stopAgoraCloudRecording({
        channelName: livestream.agoraChannelName,
        resourceId: meta.agoraRecordingResourceId,
        sid: meta.agoraRecordingSid,
      });
      if (url) return url;
    }

    if (provider === 'cloudflare' && meta.cloudflareInputId) {
      const url = await resolveCloudflareRecordingUrl(meta.cloudflareInputId);
      if (url) return url;
      if (livestream.playbackUrl) return livestream.playbackUrl;
    }

    const publicHighlight = livestream.highlights?.find((clip) => clip.isPublic);
    return publicHighlight?.url ?? livestream.highlights?.[0]?.url ?? livestream.recordingUrl;
  },
};
