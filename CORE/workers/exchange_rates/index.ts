export async function getRatesFromCache(): Promise<{ usdRate: number; solRate: number; ethRate: number }> {
  return { usdRate: 0, solRate: 0, ethRate: 0 };
}

export function startExchangeRateCron(): void {
  // Identity service defers exchange-rate syncing to the payments stack.
}
