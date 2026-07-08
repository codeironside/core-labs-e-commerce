import { AgoraService, agoraUidFromExternalUserId, VENDOR_BROADCAST_UID, type AgoraTokenResult } from '../index.js';
import { AppError } from '../../../handlers/error/index.js';
import { CloudflareStreamService } from './cloudflare.js';
import { getLivestreamProviderSetting } from './settings.js';

export type LivestreamPublisherCredentials = {
  provider: 'agora' | 'cloudflare';
  appId?: string;
  channelName: string;
  hostToken: string;
  uid?: number;
  expiresAt?: number;
  playbackUrl?: string;
  ingestUrl?: string;
  cloudflareInputId?: string;
};

export const LivestreamProviderService = {
  async createPublisherSession(input: {
    channelName: string;
    expireSeconds?: number;
  }): Promise<LivestreamPublisherCredentials> {
    const provider = await getLivestreamProviderSetting();

    if (provider === 'cloudflare') {
      try {
        const cloudflare = await CloudflareStreamService.createLiveInput(input.channelName);
        return {
          provider: 'cloudflare',
          channelName: input.channelName,
          hostToken: cloudflare.streamKey,
          playbackUrl: cloudflare.playbackUrl,
          ingestUrl: cloudflare.ingestUrl,
          cloudflareInputId: cloudflare.inputId,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          `Cloudflare Stream is unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
          500,
        );
      }
    }

    const agora: AgoraTokenResult = AgoraService.generateRtcToken({
      channelName: input.channelName,
      uid: VENDOR_BROADCAST_UID,
      role: 'publisher',
      expireSeconds: input.expireSeconds,
    });

    return {
      provider: 'agora',
      appId: agora.appId,
      channelName: agora.channelName,
      hostToken: agora.token,
      uid: agora.uid,
      expiresAt: agora.expiresAt,
    };
  },

  async createViewerSession(input: {
    channelName: string;
    externalUserId: string;
    expireSeconds?: number;
  }): Promise<LivestreamPublisherCredentials> {
    const provider = await getLivestreamProviderSetting();

    if (provider === 'cloudflare') {
      return {
        provider: 'cloudflare',
        channelName: input.channelName,
        hostToken: '',
        playbackUrl: `https://watch.cloudflarestream.com/${input.channelName}`,
      };
    }

    const viewerUid = agoraUidFromExternalUserId(input.externalUserId);
    const agora: AgoraTokenResult = AgoraService.generateRtcToken({
      channelName: input.channelName,
      uid: viewerUid,
      role: 'subscriber',
      expireSeconds: input.expireSeconds,
    });

    return {
      provider: 'agora',
      appId: agora.appId,
      channelName: agora.channelName,
      hostToken: agora.token,
      uid: agora.uid,
      expiresAt: agora.expiresAt,
    };
  },

  async createShareCameraSession(input: {
    channelName: string;
    externalUserId: string;
    expireSeconds?: number;
  }): Promise<LivestreamPublisherCredentials> {
    const provider = await getLivestreamProviderSetting();

    if (provider === 'cloudflare') {
      throw new Error('Share camera is not supported for Cloudflare streams.');
    }

    const viewerUid = agoraUidFromExternalUserId(input.externalUserId);
    const agora: AgoraTokenResult = AgoraService.generateRtcToken({
      channelName: input.channelName,
      uid: viewerUid,
      role: 'publisher',
      expireSeconds: input.expireSeconds,
    });

    return {
      provider: 'agora',
      appId: agora.appId,
      channelName: agora.channelName,
      hostToken: agora.token,
      uid: agora.uid,
      expiresAt: agora.expiresAt,
    };
  },
};
