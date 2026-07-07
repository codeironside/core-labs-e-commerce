import mongoose from 'mongoose';
import { UserModel, AccountModel } from '@api/AUTH/models';
import {
  createPrivySolanaWalletForUser,
  type PrivyWalletProvisionResult,
} from '@core/services/privy';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { logger } from '@core/services/logger';
import { findUserById } from '@core/services/db/userLookup';

export const attachPrivyWalletToUser = async (opts: {
  userId: string;
  email: string;
  name?: string;
}): Promise<PrivyWalletProvisionResult> => {
  const user = await findUserById(opts.userId);
  if (!user) {
    return {};
  }

  if (user.privyUserId && user.solanaUsdcWalletAddress) {
    return {
      privyUserId: user.privyUserId,
      walletAddress: user.solanaUsdcWalletAddress,
    };
  }

  const privyWallet = await createPrivySolanaWalletForUser({
    externalUserId: opts.userId,
    email: opts.email,
    name: opts.name,
  });

  if (!privyWallet.privyUserId && !privyWallet.walletAddress) {
    return {};
  }

  await UserModel.findByIdAndUpdate(opts.userId, {
    ...(privyWallet.privyUserId ? { privyUserId: privyWallet.privyUserId } : {}),
    ...(privyWallet.walletAddress ? { solanaUsdcWalletAddress: privyWallet.walletAddress } : {}),
  });

  if (privyWallet.privyUserId) {
    await AccountModel.findOneAndUpdate(
      { providerId: 'privy', accountId: privyWallet.privyUserId },
      {
        userId: new mongoose.Types.ObjectId(opts.userId),
        providerId: 'privy',
        accountId: privyWallet.privyUserId,
      },
      { upsert: true, new: true },
    );
  }

  if (privyWallet.walletAddress) {
    await publishKafkaEvent(
      KAFKA_TOPICS.WALLET_PROVISIONED,
      {
        userId: opts.userId,
        privyUserId: privyWallet.privyUserId ?? null,
        walletAddress: privyWallet.walletAddress,
      },
      opts.userId,
    );
  }

  logger.info({ userId: opts.userId, privyUserId: privyWallet.privyUserId }, 'Privy wallet attached to user');
  return privyWallet;
};
