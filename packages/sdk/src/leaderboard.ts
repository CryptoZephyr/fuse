import {
  type Address,
  type Hash,
  type PublicClient,
  formatUnits,
  getAddress,
  parseAbiItem,
} from "viem";
import { fuseRouterAbi } from "./abis.js";
import {
  type FuseAddresses,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TOKENS,
  FUSE_TEST_WALLETS,
  getExplorerAddressUrl,
} from "./addresses.js";
import {
  type ParsedBuilderMetadata,
  formatFeeBps,
  parseBuilderMetadataURI,
} from "./builders.js";
import {
  type FuseActionType,
  type RoutedEventRecord,
  getRoutedEvents,
  resolveRouterDeployments,
} from "./events.js";
import {
  type BtcUsdOraclePrice,
  estimateTokenUsdValue,
  formatUsd,
  getBtcUsdPrice,
} from "./oracle.js";

export type LeaderboardActionFilter = "all" | FuseActionType;
export type LeaderboardSortBy = "volumeUsd" | "users" | "feesUsd" | "actions";

export interface TokenAmountSummary {
  symbol: string;
  tokenAddress: Address;
  rawWei: string;
  formatted: string;
  usdValue: number | null;
  usdFormatted: string | null;
}

export interface SerializedRoutedEventRecord {
  transactionHash: Hash;
  blockNumber: string;
  logIndex: number;
  router: Address;
  builder: Address;
  user: Address;
  action: FuseActionType;
  actionCode: number;
  tokenIn: Address;
  tokenInSymbol: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: number | null;
  amountInUsdFormatted: string | null;
  fee: string;
  feeFormatted: string;
  feeUsd: number | null;
  feeUsdFormatted: string | null;
  tokenOut: Address;
  tokenOutSymbol: string;
  amountOut: string;
  amountOutFormatted: string;
  lockId: string;
  explorerTxUrl: string;
}

export interface LeaderboardBuilderRow {
  rank: number;
  builder: Address;
  explorerAddressUrl: string;
  name: string;
  selfReported: true;
  metadata: ParsedBuilderMetadata;
  registered: boolean;
  registeredOnCurrentRouter: boolean;
  active: boolean;
  feeBps: number;
  feePercentFormatted: string;
  uniqueUsers: number;
  actionCount: number;
  selfReferralActionCount: number;
  isFuseTestBuilder: boolean;
  actionCounts: {
    swap: number;
    save: number;
    lock: number;
  };
  volumeByToken: Record<string, TokenAmountSummary>;
  feesByToken: Record<string, TokenAmountSummary>;
  totalVolumeUsd: number | null;
  totalVolumeUsdFormatted: string | null;
  totalFeesUsd: number | null;
  totalFeesUsdFormatted: string | null;
  recentTransactions: SerializedRoutedEventRecord[];
}

export interface SerializedBtcUsdOraclePrice {
  roundId: string;
  priceRaw: string;
  decimals: number;
  priceUsd: number;
  formattedUsd: string;
  updatedAt: number;
}

export interface LeaderboardSnapshot {
  chainId: number;
  routerAddress: Address;
  routerDeployments: {
    address: Address;
    deployBlock: string;
    label: "current" | "legacy";
  }[];
  fromBlock: string;
  toBlock: string;
  actionFilter: LeaderboardActionFilter;
  sortBy: LeaderboardSortBy;
  generatedAt: string;
  btcUsdOracle: SerializedBtcUsdOraclePrice | null;
  totals: {
    registeredBuilders: number;
    activeBuilders: number;
    uniqueUsers: number;
    totalActions: number;
    excludedSelfReferralActions: number;
    totalVolumeUsd: number | null;
    totalVolumeUsdFormatted: string | null;
    totalFeesUsd: number | null;
    totalFeesUsdFormatted: string | null;
  };
  builders: LeaderboardBuilderRow[];
}

export interface BuilderAnalyticsActionBreakdown {
  action: FuseActionType;
  count: number;
  uniqueUsers: number;
  volumeUsd: number | null;
  volumeUsdFormatted: string | null;
  feesUsd: number | null;
  feesUsdFormatted: string | null;
}

export interface BuilderAnalyticsUserSummary {
  user: Address;
  explorerAddressUrl: string;
  actionCount: number;
  volumeUsd: number | null;
  volumeUsdFormatted: string | null;
  feesUsd: number | null;
  feesUsdFormatted: string | null;
  lastBlockNumber: string;
}

export interface BuilderAnalyticsReport {
  builder: Address;
  explorerAddressUrl: string;
  name: string;
  selfReported: true;
  metadata: ParsedBuilderMetadata;
  registered: boolean;
  active: boolean;
  feeBps: number;
  feePercentFormatted: string;
  generatedAt: string;
  fromBlock: string;
  toBlock: string;
  btcUsdOracle: SerializedBtcUsdOraclePrice | null;
  summary: {
    uniqueUsers: number;
    totalActions: number;
    totalVolumeUsd: number | null;
    totalVolumeUsdFormatted: string | null;
    totalFeesUsd: number | null;
    totalFeesUsdFormatted: string | null;
  };
  actionBreakdown: Record<FuseActionType, BuilderAnalyticsActionBreakdown>;
  volumeByToken: Record<string, TokenAmountSummary>;
  feesByToken: Record<string, TokenAmountSummary>;
  users: BuilderAnalyticsUserSummary[];
  events: SerializedRoutedEventRecord[];
}

const BUILDER_REGISTERED_EVENT = parseAbiItem(
  "event BuilderRegistered(address indexed builder, uint16 feeBps, string metadataURI)",
);

export function resolveTokenSymbol(
  tokenAddress: Address,
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): string {
  const lower = tokenAddress.toLowerCase();
  if (lower === addresses.btc.toLowerCase()) return MEZO_TOKENS.BTC.symbol;
  if (lower === addresses.musd.toLowerCase()) return MEZO_TOKENS.MUSD.symbol;
  if (lower === addresses.mezoToken.toLowerCase()) return MEZO_TOKENS.MEZO.symbol;
  if (lower === addresses.savingsVault.toLowerCase()) return MEZO_TOKENS.sMUSD.symbol;
  if (lower === addresses.veBTC.toLowerCase()) return "veBTC";
  return `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
}

export function serializeOraclePrice(
  oracle: BtcUsdOraclePrice | null,
): SerializedBtcUsdOraclePrice | null {
  if (!oracle) return null;
  return {
    roundId: oracle.roundId.toString(),
    priceRaw: oracle.priceRaw.toString(),
    decimals: oracle.decimals,
    priceUsd: oracle.priceUsd,
    formattedUsd: oracle.formattedUsd,
    updatedAt: oracle.updatedAt,
  };
}

export function serializeRoutedEvent(
  event: RoutedEventRecord,
  btcUsdOracle: BtcUsdOraclePrice | null,
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): SerializedRoutedEventRecord {
  const tokenInSymbol = resolveTokenSymbol(event.tokenIn, addresses);
  const tokenOutSymbol = resolveTokenSymbol(event.tokenOut, addresses);
  const amountInUsd = estimateTokenUsdValue(event.tokenIn, event.amountIn, btcUsdOracle, addresses);
  const feeUsd = estimateTokenUsdValue(event.tokenIn, event.fee, btcUsdOracle, addresses);

  return {
    transactionHash: event.transactionHash,
    blockNumber: event.blockNumber.toString(),
    logIndex: event.logIndex,
    router: getAddress(event.router),
    builder: getAddress(event.builder),
    user: getAddress(event.user),
    action: event.action,
    actionCode: event.actionCode,
    tokenIn: getAddress(event.tokenIn),
    tokenInSymbol,
    amountIn: event.amountIn.toString(),
    amountInFormatted: formatUnits(event.amountIn, 18),
    amountInUsd,
    amountInUsdFormatted: formatUsd(amountInUsd),
    fee: event.fee.toString(),
    feeFormatted: formatUnits(event.fee, 18),
    feeUsd,
    feeUsdFormatted: formatUsd(feeUsd),
    tokenOut: getAddress(event.tokenOut),
    tokenOutSymbol,
    amountOut: event.amountOut.toString(),
    amountOutFormatted: formatUnits(event.amountOut, 18),
    lockId: event.lockId.toString(),
    explorerTxUrl: event.explorerTxUrl,
  };
}

async function getRegisteredBuilderAddresses(params: {
  publicClient: PublicClient;
  fromBlock: bigint;
  toBlock: bigint;
  router?: Address;
  addresses: FuseAddresses;
  chunkSize?: bigint;
}): Promise<Address[]> {
  const {
    publicClient,
    fromBlock,
    toBlock,
    router,
    addresses,
    chunkSize = 9_500n,
  } = params;
  if (toBlock < fromBlock) return [];

  const discovered = new Set<string>();
  const deployments = resolveRouterDeployments({ addresses, router, fromBlock });
  const maxChunkSize = chunkSize > 10_000n ? 10_000n : chunkSize;

  for (const deployment of deployments) {
    const startBlock =
      fromBlock > deployment.deployBlock ? fromBlock : deployment.deployBlock;
    let cursor = startBlock;

    while (cursor <= toBlock) {
      const end =
        cursor + maxChunkSize - 1n > toBlock
          ? toBlock
          : cursor + maxChunkSize - 1n;
      const logs = await publicClient.getLogs({
        address: deployment.address,
        event: BUILDER_REGISTERED_EVENT,
        fromBlock: cursor,
        toBlock: end,
      });
      for (const log of logs) {
        if (log.args.builder) {
          discovered.add(getAddress(log.args.builder));
        }
      }
      cursor = end + 1n;
    }
  }

  return Array.from(discovered) as Address[];
}

function getDefaultScanStartBlock(addresses: FuseAddresses, router?: Address): bigint {
  if (router) {
    return (
      addresses.fuseRouterDeployments.find(
        (deployment) => deployment.address.toLowerCase() === router.toLowerCase(),
      )?.deployBlock ?? addresses.fuseRouterDeployBlock
    );
  }

  return addresses.fuseRouterDeployments.reduce(
    (startBlock, deployment) =>
      deployment.deployBlock < startBlock ? deployment.deployBlock : startBlock,
    addresses.fuseRouterDeployBlock,
  );
}

async function readBuilderConfiguration(
  publicClient: PublicClient,
  builder: Address,
  addresses: FuseAddresses,
  router?: Address,
) {
  const readConfiguration = (router: Address) =>
    publicClient.readContract({
      address: router,
      abi: fuseRouterAbi,
      functionName: "builders",
      args: [builder],
    });

  if (router) return readConfiguration(router);

  const currentConfiguration = await readConfiguration(addresses.fuseRouter);
  if (currentConfiguration[2]) return currentConfiguration;

  for (const deployment of addresses.fuseRouterDeployments) {
    if (
      deployment.label !== "legacy" ||
      deployment.address.toLowerCase() === addresses.fuseRouter.toLowerCase()
    ) {
      continue;
    }
    const legacyConfiguration = await readConfiguration(deployment.address);
    if (legacyConfiguration[2]) return legacyConfiguration;
  }

  return currentConfiguration;
}

function buildTokenSummaryMap(
  rawMap: Map<string, { tokenAddress: Address; amountWei: bigint }>,
  btcUsdOracle: BtcUsdOraclePrice | null,
  addresses: FuseAddresses,
): {
  summaryBySymbol: Record<string, TokenAmountSummary>;
  totalUsd: number | null;
} {
  const summaryBySymbol: Record<string, TokenAmountSummary> = {};
  let totalUsd = 0;
  let hasUnpricedToken = false;

  for (const [, entry] of rawMap.entries()) {
    const symbol = resolveTokenSymbol(entry.tokenAddress, addresses);
    const usdValue = estimateTokenUsdValue(
      entry.tokenAddress,
      entry.amountWei,
      btcUsdOracle,
      addresses,
    );
    if (usdValue === null && entry.amountWei > 0n) {
      hasUnpricedToken = true;
    } else if (usdValue !== null) {
      totalUsd += usdValue;
    }

    summaryBySymbol[symbol] = {
      symbol,
      tokenAddress: getAddress(entry.tokenAddress),
      rawWei: entry.amountWei.toString(),
      formatted: formatUnits(entry.amountWei, 18),
      usdValue,
      usdFormatted: formatUsd(usdValue),
    };
  }

  const finalTotalUsd =
    rawMap.size === 0 ? 0 : hasUnpricedToken && totalUsd === 0 ? null : totalUsd;

  return {
    summaryBySymbol,
    totalUsd: finalTotalUsd,
  };
}

export interface GetLeaderboardSnapshotParameters {
  publicClient: PublicClient;
  router?: Address;
  actionFilter?: LeaderboardActionFilter;
  sortBy?: LeaderboardSortBy;
  fromBlock?: bigint;
  toBlock?: bigint | "latest";
  addresses?: FuseAddresses;
  chainId?: number;
}

export async function getLeaderboardSnapshot({
  publicClient,
  router,
  actionFilter = "all",
  sortBy = "users",
  fromBlock,
  toBlock = "latest",
  addresses = MEZO_TESTNET_ADDRESSES,
  chainId = 31611,
}: GetLeaderboardSnapshotParameters): Promise<LeaderboardSnapshot> {
  const startBlock = fromBlock ?? getDefaultScanStartBlock(addresses, router);
  const latestBlock =
    toBlock === "latest" ? await publicClient.getBlockNumber() : toBlock;

  const [registeredAddresses, allRoutedEvents, btcUsdOracle] = await Promise.all([
    getRegisteredBuilderAddresses({
      publicClient,
      fromBlock: startBlock,
      toBlock: latestBlock,
      router,
      addresses,
    }),
    getRoutedEvents({
      publicClient,
      fromBlock: startBlock,
      toBlock: latestBlock,
      router,
      addresses,
    }),
    getBtcUsdPrice(publicClient, addresses.skipBtcUsdOracle),
  ]);

  const builderSet = new Set<Address>();
  for (const addr of registeredAddresses) {
    builderSet.add(getAddress(addr));
  }
  for (const ev of allRoutedEvents) {
    builderSet.add(getAddress(ev.builder));
  }

  const builderAddresses = Array.from(builderSet);

  const builderConfigs = await Promise.all(
    builderAddresses.map(async (builderAddr) => {
      const tuple = await readBuilderConfiguration(
        publicClient,
        builderAddr,
        addresses,
        router,
      );
      const currentConfiguration =
        router?.toLowerCase() === addresses.fuseRouter.toLowerCase()
          ? tuple
          : await readBuilderConfiguration(
              publicClient,
              builderAddr,
              addresses,
              addresses.fuseRouter,
            );
      const [rawFeeBps, active, registered, metadataURI] = tuple;
      return {
        address: builderAddr,
        feeBps: Number(rawFeeBps),
        active,
        registered,
        registeredOnCurrentRouter: currentConfiguration[2],
        metadataURI,
        metadata: parseBuilderMetadataURI(metadataURI, builderAddr),
      };
    }),
  );

  const selfReferralEvents = allRoutedEvents.filter(
    (ev) => ev.user.toLowerCase() === ev.builder.toLowerCase(),
  );
  const nonSelfReferralEvents = allRoutedEvents.filter(
    (ev) => ev.user.toLowerCase() !== ev.builder.toLowerCase(),
  );
  const filteredEvents =
    actionFilter === "all"
      ? nonSelfReferralEvents
      : nonSelfReferralEvents.filter((ev) => ev.action === actionFilter);
  const excludedSelfReferralEvents =
    actionFilter === "all"
      ? selfReferralEvents
      : selfReferralEvents.filter((ev) => ev.action === actionFilter);

  const globalUsers = new Set<string>();
  let globalVolumeUsd = 0;
  let globalFeesUsd = 0;

  const rows: LeaderboardBuilderRow[] = builderConfigs.map((cfg) => {
    const builderAllEvents = nonSelfReferralEvents.filter(
      (ev) => ev.builder.toLowerCase() === cfg.address.toLowerCase(),
    );
    const builderFilteredEvents = filteredEvents.filter(
      (ev) => ev.builder.toLowerCase() === cfg.address.toLowerCase(),
    );

    const uniqueUserSet = new Set<string>();
    const volumeMap = new Map<string, { tokenAddress: Address; amountWei: bigint }>();
    const feeMap = new Map<string, { tokenAddress: Address; amountWei: bigint }>();

    for (const ev of builderFilteredEvents) {
      const userKey = ev.user.toLowerCase();
      uniqueUserSet.add(userKey);
      globalUsers.add(userKey);

      const tokenKey = ev.tokenIn.toLowerCase();
      const prevVol = volumeMap.get(tokenKey)?.amountWei ?? 0n;
      volumeMap.set(tokenKey, {
        tokenAddress: getAddress(ev.tokenIn),
        amountWei: prevVol + ev.amountIn,
      });

      const prevFee = feeMap.get(tokenKey)?.amountWei ?? 0n;
      feeMap.set(tokenKey, {
        tokenAddress: getAddress(ev.tokenIn),
        amountWei: prevFee + ev.fee,
      });
    }

    const actionCounts = {
      swap: builderAllEvents.filter((e) => e.action === "swap").length,
      save: builderAllEvents.filter((e) => e.action === "save").length,
      lock: builderAllEvents.filter((e) => e.action === "lock").length,
    };

    const { summaryBySymbol: volumeByToken, totalUsd: totalVolumeUsd } =
      buildTokenSummaryMap(volumeMap, btcUsdOracle, addresses);
    const { summaryBySymbol: feesByToken, totalUsd: totalFeesUsd } =
      buildTokenSummaryMap(feeMap, btcUsdOracle, addresses);

    if (totalVolumeUsd !== null) globalVolumeUsd += totalVolumeUsd;
    if (totalFeesUsd !== null) globalFeesUsd += totalFeesUsd;

    const sortedRecent = [...builderFilteredEvents]
      .sort((a, b) => {
        if (b.blockNumber !== a.blockNumber) {
          return b.blockNumber > a.blockNumber ? 1 : -1;
        }
        return b.logIndex - a.logIndex;
      })
      .slice(0, 10)
      .map((ev) => serializeRoutedEvent(ev, btcUsdOracle, addresses));

    return {
      rank: 0,
      builder: cfg.address,
      explorerAddressUrl: getExplorerAddressUrl(cfg.address),
      name: cfg.metadata.name,
      selfReported: true,
      metadata: cfg.metadata,
      registered: cfg.registered,
      registeredOnCurrentRouter: cfg.registeredOnCurrentRouter,
      active: cfg.active,
      feeBps: cfg.feeBps,
      feePercentFormatted: formatFeeBps(cfg.feeBps),
      uniqueUsers: uniqueUserSet.size,
      actionCount: builderFilteredEvents.length,
      selfReferralActionCount: excludedSelfReferralEvents.filter(
        (ev) => ev.builder.toLowerCase() === cfg.address.toLowerCase(),
      ).length,
      isFuseTestBuilder: FUSE_TEST_WALLETS.some(
        (wallet) => wallet.toLowerCase() === cfg.address.toLowerCase(),
      ),
      actionCounts,
      volumeByToken,
      feesByToken,
      totalVolumeUsd,
      totalVolumeUsdFormatted: formatUsd(totalVolumeUsd),
      totalFeesUsd,
      totalFeesUsdFormatted: formatUsd(totalFeesUsd),
      recentTransactions: sortedRecent,
    };
  });

  rows.sort((a, b) => {
    if (sortBy === "users") {
      if (b.uniqueUsers !== a.uniqueUsers) return b.uniqueUsers - a.uniqueUsers;
    } else if (sortBy === "feesUsd") {
      const feeA = a.totalFeesUsd ?? -1;
      const feeB = b.totalFeesUsd ?? -1;
      if (feeB !== feeA) return feeB - feeA;
    } else if (sortBy === "actions") {
      if (b.actionCount !== a.actionCount) return b.actionCount - a.actionCount;
    }
    const volA = a.totalVolumeUsd ?? -1;
    const volB = b.totalVolumeUsd ?? -1;
    if (volB !== volA) return volB - volA;
    if (b.actionCount !== a.actionCount) return b.actionCount - a.actionCount;
    return a.builder.localeCompare(b.builder);
  });

  rows.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  return {
    chainId,
    routerAddress: getAddress(router ?? addresses.fuseRouter),
    routerDeployments: resolveRouterDeployments({
      addresses,
      router,
      fromBlock,
    }).map((deployment) => ({
      address: getAddress(deployment.address),
      deployBlock: deployment.deployBlock.toString(),
      label: deployment.label,
    })),
    fromBlock: startBlock.toString(),
    toBlock: latestBlock.toString(),
    actionFilter,
    sortBy,
    generatedAt: new Date().toISOString(),
    btcUsdOracle: serializeOraclePrice(btcUsdOracle),
    totals: {
      registeredBuilders: builderConfigs.filter((b) => b.registered).length,
      activeBuilders: builderConfigs.filter((b) => b.active).length,
      uniqueUsers: globalUsers.size,
      totalActions: filteredEvents.length,
      excludedSelfReferralActions: excludedSelfReferralEvents.length,
      totalVolumeUsd: globalVolumeUsd,
      totalVolumeUsdFormatted: formatUsd(globalVolumeUsd),
      totalFeesUsd: globalFeesUsd,
      totalFeesUsdFormatted: formatUsd(globalFeesUsd),
    },
    builders: rows,
  };
}

export interface GetBuilderAnalyticsParameters {
  publicClient: PublicClient;
  builder: Address;
  router?: Address;
  fromBlock?: bigint;
  toBlock?: bigint | "latest";
  addresses?: FuseAddresses;
}

export async function getBuilderAnalytics({
  publicClient,
  builder,
  router,
  fromBlock,
  toBlock = "latest",
  addresses = MEZO_TESTNET_ADDRESSES,
}: GetBuilderAnalyticsParameters): Promise<BuilderAnalyticsReport> {
  const normalizedBuilder = getAddress(builder);
  const startBlock = fromBlock ?? getDefaultScanStartBlock(addresses, router);
  const latestBlock =
    toBlock === "latest" ? await publicClient.getBlockNumber() : toBlock;

  const [builderTuple, routedEvents, btcUsdOracle] = await Promise.all([
    readBuilderConfiguration(publicClient, normalizedBuilder, addresses, router),
    getRoutedEvents({
      publicClient,
      fromBlock: startBlock,
      toBlock: latestBlock,
      router,
      builder: normalizedBuilder,
      addresses,
    }),
    getBtcUsdPrice(publicClient, addresses.skipBtcUsdOracle),
  ]);

  const [rawFeeBps, active, registered, metadataURI] = builderTuple;
  const feeBps = Number(rawFeeBps);
  const metadata = parseBuilderMetadataURI(metadataURI, normalizedBuilder);

  const volumeMap = new Map<string, { tokenAddress: Address; amountWei: bigint }>();
  const feeMap = new Map<string, { tokenAddress: Address; amountWei: bigint }>();
  const userStatsMap = new Map<
    string,
    {
      user: Address;
      actionCount: number;
      volumeUsd: number;
      feesUsd: number;
      lastBlockNumber: bigint;
    }
  >();

  const actionTypes: FuseActionType[] = ["swap", "save", "lock"];
  const actionBreakdown = {} as Record<FuseActionType, BuilderAnalyticsActionBreakdown>;

  for (const act of actionTypes) {
    const actEvents = routedEvents.filter((e) => e.action === act);
    const actUsers = new Set(actEvents.map((e) => e.user.toLowerCase()));
    let actVolUsd = 0;
    let actFeeUsd = 0;
    for (const ev of actEvents) {
      const vUsd = estimateTokenUsdValue(ev.tokenIn, ev.amountIn, btcUsdOracle, addresses);
      const fUsd = estimateTokenUsdValue(ev.tokenIn, ev.fee, btcUsdOracle, addresses);
      if (vUsd !== null) actVolUsd += vUsd;
      if (fUsd !== null) actFeeUsd += fUsd;
    }
    actionBreakdown[act] = {
      action: act,
      count: actEvents.length,
      uniqueUsers: actUsers.size,
      volumeUsd: actVolUsd,
      volumeUsdFormatted: formatUsd(actVolUsd),
      feesUsd: actFeeUsd,
      feesUsdFormatted: formatUsd(actFeeUsd),
    };
  }

  for (const ev of routedEvents) {
    const tokenKey = ev.tokenIn.toLowerCase();
    volumeMap.set(tokenKey, {
      tokenAddress: getAddress(ev.tokenIn),
      amountWei: (volumeMap.get(tokenKey)?.amountWei ?? 0n) + ev.amountIn,
    });
    feeMap.set(tokenKey, {
      tokenAddress: getAddress(ev.tokenIn),
      amountWei: (feeMap.get(tokenKey)?.amountWei ?? 0n) + ev.fee,
    });

    const userKey = ev.user.toLowerCase();
    const vUsd = estimateTokenUsdValue(ev.tokenIn, ev.amountIn, btcUsdOracle, addresses) ?? 0;
    const fUsd = estimateTokenUsdValue(ev.tokenIn, ev.fee, btcUsdOracle, addresses) ?? 0;
    const existingUser = userStatsMap.get(userKey);
    if (existingUser) {
      existingUser.actionCount += 1;
      existingUser.volumeUsd += vUsd;
      existingUser.feesUsd += fUsd;
      if (ev.blockNumber > existingUser.lastBlockNumber) {
        existingUser.lastBlockNumber = ev.blockNumber;
      }
    } else {
      userStatsMap.set(userKey, {
        user: getAddress(ev.user),
        actionCount: 1,
        volumeUsd: vUsd,
        feesUsd: fUsd,
        lastBlockNumber: ev.blockNumber,
      });
    }
  }

  const { summaryBySymbol: volumeByToken, totalUsd: totalVolumeUsd } =
    buildTokenSummaryMap(volumeMap, btcUsdOracle, addresses);
  const { summaryBySymbol: feesByToken, totalUsd: totalFeesUsd } =
    buildTokenSummaryMap(feeMap, btcUsdOracle, addresses);

  const users: BuilderAnalyticsUserSummary[] = Array.from(userStatsMap.values())
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .map((u) => ({
      user: u.user,
      explorerAddressUrl: getExplorerAddressUrl(u.user),
      actionCount: u.actionCount,
      volumeUsd: u.volumeUsd,
      volumeUsdFormatted: formatUsd(u.volumeUsd),
      feesUsd: u.feesUsd,
      feesUsdFormatted: formatUsd(u.feesUsd),
      lastBlockNumber: u.lastBlockNumber.toString(),
    }));

  const serializedEvents = [...routedEvents]
    .sort((a, b) => {
      if (b.blockNumber !== a.blockNumber) {
        return b.blockNumber > a.blockNumber ? 1 : -1;
      }
      return b.logIndex - a.logIndex;
    })
    .map((ev) => serializeRoutedEvent(ev, btcUsdOracle, addresses));

  return {
    builder: normalizedBuilder,
    explorerAddressUrl: getExplorerAddressUrl(normalizedBuilder),
    name: metadata.name,
    selfReported: true,
    metadata,
    registered,
    active,
    feeBps,
    feePercentFormatted: formatFeeBps(feeBps),
    generatedAt: new Date().toISOString(),
    fromBlock: startBlock.toString(),
    toBlock: latestBlock.toString(),
    btcUsdOracle: serializeOraclePrice(btcUsdOracle),
    summary: {
      uniqueUsers: users.length,
      totalActions: routedEvents.length,
      totalVolumeUsd,
      totalVolumeUsdFormatted: formatUsd(totalVolumeUsd),
      totalFeesUsd,
      totalFeesUsdFormatted: formatUsd(totalFeesUsd),
    },
    actionBreakdown,
    volumeByToken,
    feesByToken,
    users,
    events: serializedEvents,
  };
}
