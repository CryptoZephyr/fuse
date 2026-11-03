import { type Address, type PublicClient, formatUnits } from "viem";
import { skipOracleAbi } from "./abis.js";
import { MEZO_TESTNET_ADDRESSES } from "./addresses.js";

export interface BtcUsdOraclePrice {
  roundId: bigint;
  priceRaw: bigint;
  decimals: number;
  priceUsd: number;
  formattedUsd: string;
  updatedAt: number;
}

export function formatUsd(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  if (value > 0 && value < 0.01) {
    return `<$0.01`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Reads the live BTC/USD price from Mezo's Skip oracle (`0x7b7c000000000000000000000000000000000015`).
 * Per FRONTEND.md and Build.md: if the Skip oracle read fails, returns `null` so callers hide dollar values
 * without ever blocking user actions.
 */
export async function getBtcUsdPrice(
  publicClient: PublicClient,
  oracleAddress: Address = MEZO_TESTNET_ADDRESSES.skipBtcUsdOracle,
): Promise<BtcUsdOraclePrice | null> {
  try {
    const [roundData, decimalsResult] = await Promise.all([
      publicClient.readContract({
        address: oracleAddress,
        abi: skipOracleAbi,
        functionName: "latestRoundData",
      }),
      publicClient
        .readContract({
          address: oracleAddress,
          abi: skipOracleAbi,
          functionName: "decimals",
        })
        .catch(() => 8),
    ]);

    const [roundId, answer, , updatedAt] = roundData;
    if (answer <= 0n) {
      return null;
    }

    const decimals = Number(decimalsResult);
    const priceUsd = Number(formatUnits(answer, decimals));
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return null;
    }

    return {
      roundId,
      priceRaw: answer,
      decimals,
      priceUsd,
      formattedUsd:
        formatUsd(priceUsd) ??
        `$${priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      updatedAt: Number(updatedAt),
    };
  } catch {
    return null;
  }
}

/**
 * Estimates the USD value of a token amount on Mezo Testnet using the Skip BTC/USD oracle.
 * - MUSD and sMUSD (Savings Vault) are valued at $1.00 per token.
 * - BTC and VeBTC locks are valued using the live Skip BTC/USD oracle price.
 * - Returns `null` if the oracle price is unavailable for BTC or if the token has no live USD feed (e.g., MEZO).
 */
export function estimateTokenUsdValue(
  tokenAddress: Address,
  amountWei: bigint,
  btcUsdPrice: BtcUsdOraclePrice | null,
  addresses = MEZO_TESTNET_ADDRESSES,
): number | null {
  const normalized = tokenAddress.toLowerCase();
  const amountFloat = Number(formatUnits(amountWei, 18));
  if (!Number.isFinite(amountFloat)) return null;

  if (
    normalized === addresses.musd.toLowerCase() ||
    normalized === addresses.savingsVault.toLowerCase()
  ) {
    return amountFloat;
  }

  if (
    normalized === addresses.btc.toLowerCase() ||
    normalized === addresses.veBTC.toLowerCase()
  ) {
    if (!btcUsdPrice) return null;
    return amountFloat * btcUsdPrice.priceUsd;
  }

  return null;
}
