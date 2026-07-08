import mongoose from 'mongoose';
import { AppError } from '../../handlers/error/index.js';
import { LivestreamParticipant, LivestreamSession } from '../../../API/LIVESTREAMS/models/index.js';

const ACTIVE_STATUSES = ['active'] as const;

export const assertUserCanHostStream = async (hostUserId: string, storeId?: string): Promise<void> => {
  const hostingAsUser = await LivestreamSession.findOne({
    hostUserId: new mongoose.Types.ObjectId(hostUserId),
    status: { $in: ACTIVE_STATUSES },
  })
    .select('_id')
    .lean();

  if (hostingAsUser) {
    throw new AppError('You already have an active livestream. End it before starting another.', 409);
  }

  if (storeId) {
    const hostingOnStore = await LivestreamSession.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      status: { $in: ACTIVE_STATUSES },
    })
      .select('_id')
      .lean();

    if (hostingOnStore) {
      throw new AppError('This store already has an active livestream.', 409);
    }
    return;
  }

  const hostingAsVendor = await LivestreamSession.findOne({
    vendorId: hostUserId,
    status: { $in: ACTIVE_STATUSES },
    $or: [{ storeId: { $exists: false } }, { storeId: null }],
  })
    .select('_id')
    .lean();

  if (hostingAsVendor) {
    throw new AppError('You already have an active livestream. End it before starting another.', 409);
  }
};

/** @deprecated Use assertUserCanHostStream */
export const assertVendorCanHostStream = async (vendorId: string): Promise<void> => {
  await assertUserCanHostStream(vendorId);
};

export const assertUserCanJoinStream = async (
  userId: string,
  livestreamId: string,
  isHost: boolean,
): Promise<void> => {
  if (isHost) {
    const hostingOther = await LivestreamSession.findOne({
      $or: [{ hostUserId: userId }, { vendorId: userId }],
      status: { $in: ACTIVE_STATUSES },
      _id: { $ne: new mongoose.Types.ObjectId(livestreamId) },
    })
      .select('_id')
      .lean();

    if (hostingOther) {
      throw new AppError('Finish your own livestream before joining another.', 409);
    }
    return;
  }

  const activeParticipation = await LivestreamParticipant.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: 'livestreamsessions',
        localField: 'livestreamId',
        foreignField: '_id',
        as: 'session',
      },
    },
    { $unwind: '$session' },
    {
      $match: {
        'session.status': { $in: ACTIVE_STATUSES },
        livestreamId: { $ne: new mongoose.Types.ObjectId(livestreamId) },
      },
    },
    { $limit: 1 },
  ]);

  if (activeParticipation.length > 0) {
    throw new AppError('Leave your current livestream before joining another.', 409);
  }

  const hostingWhileViewing = await LivestreamSession.findOne({
    $or: [{ hostUserId: userId }, { vendorId: userId }],
    status: { $in: ACTIVE_STATUSES },
    _id: { $ne: new mongoose.Types.ObjectId(livestreamId) },
  })
    .select('_id')
    .lean();

  if (hostingWhileViewing) {
    throw new AppError('You cannot join another stream while hosting your own.', 409);
  }
};
