export const MIN_BTC_GAS_RESERVE = 1_000_000_000_000n;

export function calculateBtcGasReserve(gasPrice: bigint): bigint {
  const estimatedReserve = gasPrice * 3_000_000n;
  return estimatedReserve > MIN_BTC_GAS_RESERVE
    ? estimatedReserve
    : MIN_BTC_GAS_RESERVE;
}

export function maxSpendable(balance: bigint, reserve: bigint): bigint {
  return balance > reserve ? balance - reserve : 0n;
}
