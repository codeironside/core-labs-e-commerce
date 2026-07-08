import { config } from '../../../config/index.js';
import { logger } from '../../logger/index.js';

export const resolveCloudflareRecordingUrl = async (inputId: string): Promise<string | undefined> => {
  const accountId = config.cloudflare.accountId;
  const apiToken = config.cloudflare.streamApiToken;
  if (!accountId || !apiToken || !inputId) return undefined;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${inputId}/videos`,
    { headers: { Authorization: `Bearer ${apiToken}` } },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    result?: Array<{ playback?: { hls?: string }; preview?: string; uid?: string }>;
  };

  if (!response.ok || !payload.success || !payload.result?.length) {
    logger.warn({ inputId, status: response.status }, 'Cloudflare recording not ready yet');
    return undefined;
  }

  const latest = payload.result[0];
  return latest?.playback?.hls ?? latest?.preview;
};

export const deleteCloudflareLiveInput = async (inputId: string): Promise<void> => {
  const accountId = config.cloudflare.accountId;
  const apiToken = config.cloudflare.streamApiToken;
  if (!accountId || !apiToken || !inputId) return;

  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${inputId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiToken}` },
  });
};
