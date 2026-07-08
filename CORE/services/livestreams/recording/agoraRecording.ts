import { config } from '../../../config/index.js';
import { logger } from '../../logger/index.js';

const AGORA_RECORDING_UID = 527_951;

const agoraRegionFromAws = (awsRegion: string): number => {
  const normalized = awsRegion.toLowerCase();
  if (normalized.startsWith('eu-west')) return 4;
  if (normalized.startsWith('eu-central')) return 7;
  if (normalized.startsWith('ap-southeast')) return 8;
  if (normalized.startsWith('ap-northeast')) return 10;
  return 0;
};

const agoraAuthHeader = (): string | undefined => {
  const customerId = config.agora.customerId;
  const customerSecret = config.agora.customerSecret;
  if (!customerId || !customerSecret) return undefined;
  return `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString('base64')}`;
};

export type AgoraRecordingSession = {
  resourceId: string;
  sid: string;
  uid: number;
};

export const startAgoraCloudRecording = async (input: {
  channelName: string;
  hostToken: string;
  hostUid: number;
}): Promise<AgoraRecordingSession | undefined> => {
  const auth = agoraAuthHeader();
  const appId = config.agora.appId;
  if (!auth || !appId) {
    logger.warn('Agora cloud recording skipped — customer credentials missing.');
    return undefined;
  }

  const acquireResponse = await fetch(`https://api.agora.io/v1/apps/${appId}/cloud_recording/acquire`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cname: input.channelName,
      uid: String(AGORA_RECORDING_UID),
      clientRequest: {},
    }),
  });

  const acquirePayload = (await acquireResponse.json().catch(() => ({}))) as { resourceId?: string };
  if (!acquireResponse.ok || !acquirePayload.resourceId) {
    logger.error({ status: acquireResponse.status, acquirePayload }, 'Agora recording acquire failed');
    return undefined;
  }

  const startResponse = await fetch(
    `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${acquirePayload.resourceId}/mode/mix/start`,
    {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cname: input.channelName,
        uid: String(AGORA_RECORDING_UID),
        clientRequest: {
          token: input.hostToken,
          recordingConfig: {
            maxIdleTime: 120,
            streamTypes: 2,
            channelType: 1,
            videoStreamType: 0,
            transcodingConfig: {
              width: 640,
              height: 360,
              fps: 15,
              bitrate: 600,
              mixedVideoLayout: 1,
            },
          },
          storageConfig: {
            vendor: 1,
            region: agoraRegionFromAws(config.aws.region),
            bucket: config.aws.bucket,
            accessKey: config.aws.accessKeyId,
            secretKey: config.aws.secretAccessKey,
            fileNamePrefix: [`livestreams/${input.channelName}`],
          },
        },
      }),
    },
  );

  const startPayload = (await startResponse.json().catch(() => ({}))) as { sid?: string };
  if (!startResponse.ok || !startPayload.sid) {
    logger.error({ status: startResponse.status, startPayload }, 'Agora recording start failed');
    return undefined;
  }

  return {
    resourceId: acquirePayload.resourceId,
    sid: startPayload.sid,
    uid: AGORA_RECORDING_UID,
  };
};

export const stopAgoraCloudRecording = async (input: {
  channelName: string;
  resourceId: string;
  sid: string;
}): Promise<string | undefined> => {
  const auth = agoraAuthHeader();
  const appId = config.agora.appId;
  if (!auth || !appId) return undefined;

  await fetch(
    `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${input.resourceId}/sid/${input.sid}/mode/mix/stop`,
    {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cname: input.channelName,
        uid: String(AGORA_RECORDING_UID),
        clientRequest: {},
      }),
    },
  );

  const queryResponse = await fetch(
    `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${input.resourceId}/sid/${input.sid}/mode/mix/query`,
    { headers: { Authorization: auth } },
  );

  const queryPayload = (await queryResponse.json().catch(() => ({}))) as {
    serverResponse?: { fileList?: Array<{ fileName?: string }> };
  };

  const fileName = queryPayload.serverResponse?.fileList?.[0]?.fileName;
  if (!fileName) return undefined;

  return `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${fileName}`;
};
