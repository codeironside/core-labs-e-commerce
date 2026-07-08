export async function initializeFreemiumWallet(workspaceId, _ownerId) {
    return {
        walletId: workspaceId,
        balanceNGN: 0,
        balanceUSD: 0,
        balanceSOL: 0,
        balanceETH: 0,
    };
}
