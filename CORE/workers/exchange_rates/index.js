export async function getRatesFromCache() {
    return { usdRate: 0, solRate: 0, ethRate: 0 };
}
export function startExchangeRateCron() {
    // Identity service defers exchange-rate syncing to the payments stack.
}
