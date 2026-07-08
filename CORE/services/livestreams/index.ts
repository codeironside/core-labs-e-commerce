import agoraToken from 'agora-token';
import { config } from '../../config/index.js';
import { AppError } from '../../handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../utils/constants/index.js';

const { RtcTokenBuilder, RtcRole } = agoraToken;

export type AgoraUserRole = 'publisher' | 'subscriber';

export type AgoraTokenResult = {
  appId: string;
  channelName: string;
  uid: number;
  role: AgoraUserRole;
  token: string;
  expiresAt: number;
};

export const VENDOR_BROADCAST_UID = 1;

export const resolveVendorBroadcastUid = (storedUid?: number | null): number =>
  typeof storedUid === 'number' && storedUid > 0 ? storedUid : VENDOR_BROADCAST_UID;

export const agoraUidFromExternalUserId = (externalUserId: string): number =>
  Math.abs(
    externalUserId.split('').reduce((accumulator, character) => (accumulator * 31 + character.charCodeAt(0)) | 0, 0),
  ) % 100_000_000;

export class AgoraService {
  private static getCredentials(): { appId: string; appCertificate: string } {
    const appId = config.agora.appId;
    const appCertificate = config.agora.appCertificate;
    if (!appId || !appCertificate) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_CONFIG_INVALID, 500);
    }
    return { appId, appCertificate };
  }

  static generateRtcToken(input: {
    channelName: string;
    uid?: number;
    role: AgoraUserRole;
    expireSeconds?: number;
  }): AgoraTokenResult {
    const { appId, appCertificate } = this.getCredentials();
    const agoraRole = input.role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + (input.expireSeconds ?? 86400);
    const uid = input.uid ?? 0;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      input.channelName,
      uid,
      agoraRole,
      privilegeExpireTime,
      privilegeExpireTime,
    );

    return {
      appId,
      channelName: input.channelName,
      uid,
      role: input.role,
      token,
      expiresAt: privilegeExpireTime,
    };
  }
}
