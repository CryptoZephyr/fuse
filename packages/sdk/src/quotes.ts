import { type Address, type PublicClient, formatUnits } from "viem";
import { fuseRouterAbi, musdSavingsVaultAbi, tigrisRouterAbi } from "./abis.js";
import {
  BPS_DENOMINATOR,
  type FuseAddresses,
  MAX_FEE_BPS,
  MEZO_TESTNET_ADDRESSES,
  MIN_LOCK_DURATION_SECONDS,
  TESTNET_MAX_LOCK_DURATION_SECONDS,
} from "./addresses.js";
import { formatFeeBps } from "./builders.js";
import { type BtcUsdOraclePrice, estimateTokenUsdValue, getBtcUsdPrice } from "./oracle.js";

export interface TigrisRoute {
  from: Address;
  to: Address;
  stable: boolean;
  factory: Address;
}

export interface FeeBreakdown {
  amountIn: bigint;
  feeBps: number;
  feePercentFormatted: string;
  feeAmount: bigint;
  netAmount: bigint;
  amountInUsd: number | null;
  feeUsd: number | null;
  netAmountUsd: number | null;
}

export interface SwapQuote extends FeeBreakdown {
  tokenIn: Address;
  tokenOut: Address;
  routes: TigrisRoute[];
  expectedOut: bigint;
  amountOutMin: bigint;
  slippageBps: number;
  expectedOutUsd: number | null;
  amountOutMinUsd: number | null;
  btcUsdPrice: BtcUsdOraclePrice | null;
}

export interface SaveQuote extends FeeBreakdown {
  tokenIn: Address;
  tokenOut: Address;
  sharesOut: bigint;
  sharesOutIsEstimated: boolean;
  sharesOutUsd: number | null;
  btcUsdPrice: BtcUsdOraclePrice | null;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function assertPositiveAmount(amountIn: bigint): void {
  if (amountIn <= 0n) throw new Error("ZeroAmount");
}

function assertBuilderCanRoute(
  builderTuple: readonly [number, boolean, boolean, string],
  routerPaused: boolean,
): void {
  if (routerPaused) throw new Error("RouterPaused");
  const [, active, registered] = builderTuple;
  if (!registered) throw new Error("BuilderNotRegistered");
  if (!active) throw new Error("BuilderNotActive");
}

function validateSwapRoutes(
  routes: readonly TigrisRoute[],
  tokenIn: Address,
  poolFactory: Address,
): void {
  if (routes.length === 0) throw new Error("EmptyRoutes");
  if (routes[0].from.toLowerCase() !== tokenIn.toLowerCase()) {
    throw new Error("InvalidRouteStart");
  }

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    const expectedFrom = index === 0 ? tokenIn : routes[index - 1].to;
    if (route.from.toLowerCase() !== expectedFrom.toLowerCase()) {
      throw new Error("InvalidRouteContinuity");
    }
    if (
      route.factory.toLowerCase() !== ZERO_ADDRESS &&
      route.factory.toLowerCase() !== poolFactory.toLowerCase()
    ) {
      throw new Error("InvalidRouteFactory");
    }
  }
}

export interface LockQuote extends FeeBreakdown {
  tokenIn: Address;
  veBtcAddress: Address;
  lockDurationSeconds: number;
  unlockTimestamp: number;
  unlockDateIso: string;
  unlockDateFormatted: string;
  estimatedVotingPower: bigint;
  estimatedVotingPowerFormatted: string;
  maxLockDurationSeconds: number;
  btcUsdPrice: BtcUsdOraclePrice | null;
}

export function calculateBuilderFee(
  amountIn: bigint,
  feeBps: number,
): { feeAmount: bigint; netAmount: bigint } {
  if (amountIn <= 0n) {
    return { feeAmount: 0n, netAmount: 0n };
  }
  if (feeBps < 0 || feeBps > MAX_FEE_BPS) {
    throw new Error(`Fee (${feeBps} bps) exceeds protocol cap (${MAX_FEE_BPS} bps)`);
  }
  const feeAmount = (amountIn * BigInt(feeBps)) / BPS_DENOMINATOR;
  const netAmount = amountIn - feeAmount;
  return { feeAmount, netAmount };
}

/**
 * Computes the Thursday 00:00 UTC epoch-rounded unlock timestamp used by Mezo's VeBTC contract:
 * `unlockTime = ((nowSeconds + lockDurationSeconds) / 604800) * 604800`
 */
export function previewVeBtcUnlockTime(
  lockDurationSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): number {
  return (
    Math.floor((nowSeconds + lockDurationSeconds) / MIN_LOCK_DURATION_SECONDS) *
    MIN_LOCK_DURATION_SECONDS
  );
}

export function formatUnlockDateUtc(unlockTimestampSeconds: number): string {
  const date = new Date(unlockTimestampSeconds * 1000);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }) + " 00:00 UTC";
}

export function buildDefaultTigrisRoute(
  tokenIn: Address,
  tokenOut: Address,
  poolFactory: Address = MEZO_TESTNET_ADDRESSES.poolFactory,
  stable = false,
): TigrisRoute[] {
  const normalizedIn = tokenIn.toLowerCase();
  const normalizedOut = tokenOut.toLowerCase();
  const btcAddr = MEZO_TESTNET_ADDRESSES.btc.toLowerCase();
  const musdAddr = MEZO_TESTNET_ADDRESSES.musd.toLowerCase();
  const mezoAddr = MEZO_TESTNET_ADDRESSES.mezoToken.toLowerCase();

  if (
    (normalizedIn === btcAddr && normalizedOut === musdAddr) ||
    (normalizedIn === musdAddr && normalizedOut === btcAddr) ||
    (normalizedIn === musdAddr && normalizedOut === mezoAddr) ||
    (normalizedIn === mezoAddr && normalizedOut === musdAddr)
  ) {
    return [
      {
        from: tokenIn,
        to: tokenOut,
        stable,
        factory: poolFactory,
      },
    ];
  }

  if (
    (normalizedIn === btcAddr && normalizedOut === mezoAddr) ||
    (normalizedIn === mezoAddr && normalizedOut === btcAddr)
  ) {
    return [
      {
        from: tokenIn,
        to: MEZO_TESTNET_ADDRESSES.musd,
        stable,
        factory: poolFactory,
      },
      {
        from: MEZO_TESTNET_ADDRESSES.musd,
        to: tokenOut,
        stable,
        factory: poolFactory,
      },
    ];
  }

  return [
    {
      from: tokenIn,
      to: tokenOut,
      stable,
      factory: poolFactory,
    },
  ];
}

export interface GetSwapQuoteParameters {
  publicClient: PublicClient;
  builder: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  slippageBps?: number;
  routes?: TigrisRoute[];
  addresses?: FuseAddresses;
}

export async function getSwapQuote({
  publicClient,
  builder,
  tokenIn,
  tokenOut,
  amountIn,
  slippageBps = 50, // default 0.50% slippage tolerance
  routes,
  addresses = MEZO_TESTNET_ADDRESSES,
}: GetSwapQuoteParameters): Promise<SwapQuote> {
  assertPositiveAmount(amountIn);
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    throw new Error("SameToken");
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("InvalidSlippage");
  }

  const resolvedRoutes =
    routes && routes.length > 0
      ? routes
      : buildDefaultTigrisRoute(tokenIn, tokenOut, addresses.poolFactory);
  validateSwapRoutes(resolvedRoutes, tokenIn, addresses.poolFactory);

  const [builderTuple, routerPaused, tokenAllowed, btcUsdPrice] = await Promise.all([
    publicClient.readContract({
      address: addresses.fuseRouter,
      abi: fuseRouterAbi,
      functionName: "builders",
      args: [builder],
    }),
    publicClient.readContract({
      address: addresses.fuseRouter,
      abi: fuseRouterAbi,
      functionName: "paused",
    }),
    publicClient.readContract({
      address: addresses.fuseRouter,
      abi: fuseRouterAbi,
      functionName: "allowedInput",
      args: [tokenIn],
    }),
    getBtcUsdPrice(publicClient, addresses.skipBtcUsdOracle),
  ]);

  assertBuilderCanRoute(builderTuple, routerPaused);
  if (!tokenAllowed) throw new Error("TokenNotAllowed");

  const [rawFeeBps] = builderTuple;
  const feeBps = Number(rawFeeBps);
  const { feeAmount, netAmount } = calculateBuilderFee(amountIn, feeBps);

  let expectedOut = 0n;
  if (netAmount > 0n) {
    const amounts = await publicClient.readContract({
      address: addresses.tigrisRouter,
      abi: tigrisRouterAbi,
      functionName: "getAmountsOut",
      args: [netAmount, resolvedRoutes],
    });
    expectedOut = amounts[amounts.length - 1] ?? 0n;
  }

  const amountOutMin =
    (expectedOut * (BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR;

  return {
    tokenIn,
    tokenOut,
    routes: resolvedRoutes,
    amountIn,
    feeBps,
    feePercentFormatted: formatFeeBps(feeBps),
    feeAmount,
    netAmount,
    expectedOut,
    amountOutMin,
    slippageBps,
    amountInUsd: estimateTokenUsdValue(tokenIn, amountIn, btcUsdPrice, addresses),
    feeUsd: estimateTokenUsdValue(tokenIn, feeAmount, btcUsdPrice, addresses),
    netAmountUsd: estimateTokenUsdValue(tokenIn, netAmount, btcUsdPrice, addresses),
    expectedOutUsd: estimateTokenUsdValue(tokenOut, expectedOut, btcUsdPrice, addresses),
    amountOutMinUsd: estimateTokenUsdValue(tokenOut, amountOutMin, btcUsdPrice, addresses),
    btcUsdPrice,
  };
}

export interface GetSaveQuoteParameters {
  publicClient: PublicClient;
  builder: Address;
  amountIn: bigint;
  addresses?: FuseAddresses;
}

export async function getSaveQuote({
  publicClient,
  builder,
  amountIn,
  addresses = MEZO_TESTNET_ADDRESSES,
}: GetSaveQuoteParameters): Promise<SaveQuote> {
  assertPositiveAmount(amountIn);

  const [builderTuple, routerPaused, btcUsdPrice] = await Promise.all([
    publicClient.readContract({
      address: addresses.fuseRouter,
      abi: fuseRouterAbi,
      functionName: "builders",
      args: [builder],
    }),
    publicClient.readContract({
      address: addresses.fuseRouter,
      abi: fuseRouterAbi,
      functionName: "paused",
    }),
    getBtcUsdPrice(publicClient, addresses.skipBtcUsdOracle),
  ]);

  assertBuilderCanRoute(builderTuple, routerPaused);

  const [rawFeeBps] = builderTuple;
  const feeBps = Number(rawFeeBps);
  const { feeAmount, netAmount } = calculateBuilderFee(amountIn, feeBps);

  const previewedShares = await publicClient
    .readContract({
      address: addresses.savingsVault,
      abi: musdSavingsVaultAbi,
      functionName: "previewDeposit",
      args: [netAmount],
    })
    .catch(() => null);
  const sharesOut = previewedShares ?? netAmount;

  return {
    tokenIn: addresses.musd,
    tokenOut: addresses.savingsVault,
    amountIn,
    feeBps,
    feePercentFormatted: formatFeeBps(feeBps),
    feeAmount,
    netAmount,
    sharesOut,
    sharesOutIsEstimated: previewedShares === null,
    amountInUsd: estimateTokenUsdValue(addresses.musd, amountIn, btcUsdPrice, addresses),
    feeUsd: estimateTokenUsdValue(addresses.musd, feeAmount, btcUsdPrice, addresses),
    netAmountUsd: estimateTokenUsdValue(addresses.musd, netAmount, btcUsdPrice, addresses),
    sharesOutUsd: estimateTokenUsdValue(addresses.savingsVault, sharesOut, btcUsdPrice, addresses),
    btcUsdPrice,
  };
}

export interface GetLockQuoteParameters {
  publicClient: PublicClient;
  builder: Address;
  amountIn: bigint;
  lockDurationSeconds: number;
  addresses?: FuseAddresses;
}

export async function getLockQuote({
  publicClient,
  builder,
  amountIn,
  lockDurationSeconds,
  addresses = MEZO_TESTNET_ADDRESSES,
}: GetLockQuoteParameters): Promise<LockQuote> {
  assertPositiveAmount(amountIn);

  const [builderTuple, routerPaused, maxLockDurationOnChain, previewedUnlockOnChain, btcUsdPrice] =
    await Promise.all([
      publicClient.readContract({
        address: addresses.fuseRouter,
        abi: fuseRouterAbi,
        functionName: "builders",
        args: [builder],
      }),
      publicClient.readContract({
        address: addresses.fuseRouter,
        abi: fuseRouterAbi,
        functionName: "paused",
      }),
      publicClient
        .readContract({
          address: addresses.fuseRouter,
          abi: fuseRouterAbi,
          functionName: "maxLockDuration",
        })
        .catch(() => BigInt(TESTNET_MAX_LOCK_DURATION_SECONDS)),
      publicClient
        .readContract({
          address: addresses.fuseRouter,
          abi: fuseRouterAbi,
          functionName: "previewUnlockTime",
          args: [BigInt(lockDurationSeconds)],
        })
        .catch(() => BigInt(previewVeBtcUnlockTime(lockDurationSeconds))),
      getBtcUsdPrice(publicClient, addresses.skipBtcUsdOracle),
    ]);

  const maxLockDurationSeconds = Number(maxLockDurationOnChain);
  if (
    lockDurationSeconds < MIN_LOCK_DURATION_SECONDS ||
    lockDurationSeconds > maxLockDurationSeconds
  ) {
    throw new Error(
      `InvalidLockDuration: Lock duration (${lockDurationSeconds}s) must be between ${MIN_LOCK_DURATION_SECONDS}s (7 days) and ${maxLockDurationSeconds}s (${Math.round(maxLockDurationSeconds / 86400)} days).`,
    );
  }

  assertBuilderCanRoute(builderTuple, routerPaused);

  const [rawFeeBps] = builderTuple;
  const feeBps = Number(rawFeeBps);
  const { feeAmount, netAmount } = calculateBuilderFee(amountIn, feeBps);

  const unlockTimestamp = Number(previewedUnlockOnChain);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const effectiveLockSeconds = Math.max(0, unlockTimestamp - nowSeconds);

  const estimatedVotingPower =
    maxLockDurationSeconds > 0
      ? (netAmount * BigInt(Math.min(effectiveLockSeconds, maxLockDurationSeconds))) /
        BigInt(maxLockDurationSeconds)
      : 0n;

  return {
    tokenIn: addresses.btc,
    veBtcAddress: addresses.veBTC,
    amountIn,
    feeBps,
    feePercentFormatted: formatFeeBps(feeBps),
    feeAmount,
    netAmount,
    lockDurationSeconds,
    unlockTimestamp,
    unlockDateIso: new Date(unlockTimestamp * 1000).toISOString(),
    unlockDateFormatted: formatUnlockDateUtc(unlockTimestamp),
    estimatedVotingPower,
    estimatedVotingPowerFormatted: Number(formatUnits(estimatedVotingPower, 18)).toFixed(6),
    maxLockDurationSeconds,
    amountInUsd: estimateTokenUsdValue(addresses.btc, amountIn, btcUsdPrice, addresses),
    feeUsd: estimateTokenUsdValue(addresses.btc, feeAmount, btcUsdPrice, addresses),
    netAmountUsd: estimateTokenUsdValue(addresses.btc, netAmount, btcUsdPrice, addresses),
    btcUsdPrice,
  };
}
