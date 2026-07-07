export interface FreemiumWalletResult {
  walletId: string;
  balanceNGN: number;
  balanceUSD: number;
  balanceSOL: number;
  balanceETH: number;
}

export async function initializeFreemiumWallet(
  workspaceId: string,
  _ownerId: string,
): Promise<FreemiumWalletResult> {
  return {
    walletId: workspaceId,
    balanceNGN: 0,
    balanceUSD: 0,
    balanceSOL: 0,
    balanceETH: 0,
  };
}
