import { config } from '../../../config/index.js';
import { AppError } from '../../../handlers/error/index.js';

export type CloudflareStreamResult = {
  streamKey: string;
  playbackUrl: string;
  ingestUrl: string;
  inputId: string;
};

export class CloudflareStreamService {
  static async createLiveInput(channelName: string): Promise<CloudflareStreamResult> {
    const accountId = config.cloudflare.accountId;
    const apiToken = config.cloudflare.streamApiToken;

    if (!accountId || !apiToken) {
      throw new AppError('Cloudflare livestream configuration is invalid.', 500);
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meta: { name: channelName },
          recording: { mode: 'automatic' },
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      result?: {
        uid?: string;
        rtmps?: { url?: string; streamKey?: string };
      };
    };

    if (!response.ok || !payload.success || !payload.result?.uid) {
      throw new AppError('Cloudflare livestream configuration is invalid.', 500);
    }

    return {
      inputId: payload.result.uid,
      streamKey: payload.result.rtmps?.streamKey ?? '',
      ingestUrl: payload.result.rtmps?.url ?? '',
      playbackUrl: `https://customer-${accountId}.cloudflarestream.com/${payload.result.uid}/manifest/video.m3u8`,
    };
  }
}
