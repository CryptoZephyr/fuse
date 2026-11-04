import { type Address, type Hash, type PublicClient, parseAbiItem } from "viem";
import {
  type FuseAddresses,
  MEZO_TESTNET_ADDRESSES,
  getExplorerTxUrl,
} from "./addresses.js";

export type FuseActionType = "swap" | "save" | "lock";

export interface RoutedEventRecord {
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
  router: Address;
  builder: Address;
  user: Address;
  action: FuseActionType;
  actionCode: number;
  tokenIn: Address;
  amountIn: bigint;
  fee: bigint;
  tokenOut: Address;
  amountOut: bigint;
  lockId: bigint;
  explorerTxUrl: string;
}

const ROUTED_EVENT = parseAbiItem(
  "event Routed(address indexed builder, address indexed user, uint8 indexed action, address tokenIn, uint256 amountIn, uint256 fee, address tokenOut, uint256 amountOut, uint256 lockId)",
);

export function mapActionCodeToType(actionCode: number): FuseActionType | null {
  if (actionCode === 0) return "swap";
  if (actionCode === 1) return "save";
  if (actionCode === 2) return "lock";
  return null;
}

export interface GetRoutedEventsParameters {
  publicClient: PublicClient;
  fromBlock?: bigint;
  toBlock?: bigint | "latest";
  router?: Address;
  builder?: Address;
  user?: Address;
  addresses?: FuseAddresses;
  chunkSize?: bigint;
}

export async function getRoutedEvents({
  publicClient,
  fromBlock,
  toBlock = "latest",
  router,
  builder,
  user,
  addresses = MEZO_TESTNET_ADDRESSES,
  chunkSize = 9_500n,
}: GetRoutedEventsParameters): Promise<RoutedEventRecord[]> {
  const latestBlock =
    toBlock === "latest" ? await publicClient.getBlockNumber() : toBlock;
  const allLogs: RoutedEventRecord[] = [];
  const maxChunkSize = chunkSize > 10_000n ? 10_000n : chunkSize;
  const deployments = router
    ? [
        addresses.fuseRouterDeployments.find(
          (deployment) => deployment.address.toLowerCase() === router.toLowerCase(),
        ) ?? {
          address: router,
          deployBlock: addresses.fuseRouterDeployBlock,
          label: "current" as const,
        },
      ]
    : addresses.fuseRouterDeployments;

  for (const deployment of deployments) {
    const startBlock =
      fromBlock !== undefined && fromBlock > deployment.deployBlock
        ? fromBlock
        : deployment.deployBlock;
    if (latestBlock < startBlock) continue;

    let cursor = startBlock;

    while (cursor <= latestBlock) {
      const end =
        cursor + maxChunkSize - 1n > latestBlock
          ? latestBlock
          : cursor + maxChunkSize - 1n;

      const logs = await publicClient.getLogs({
        address: deployment.address,
        event: ROUTED_EVENT,
        args: {
          ...(builder ? { builder } : {}),
          ...(user ? { user } : {}),
        },
        fromBlock: cursor,
        toBlock: end,
      });

      for (const log of logs) {
        if (!log.args.builder || !log.args.user || !log.transactionHash) continue;
        const actionCode = Number(log.args.action);
        const action = mapActionCodeToType(actionCode);
        if (!action) continue;
        allLogs.push({
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex ?? 0),
          router: deployment.address,
          builder: log.args.builder,
          user: log.args.user,
          action,
          actionCode,
          tokenIn: log.args.tokenIn!,
          amountIn: log.args.amountIn ?? 0n,
          fee: log.args.fee ?? 0n,
          tokenOut: log.args.tokenOut!,
          amountOut: log.args.amountOut ?? 0n,
          lockId: log.args.lockId ?? 0n,
          explorerTxUrl: getExplorerTxUrl(log.transactionHash),
        });
      }

      cursor = end + 1n;
    }
  }

  return allLogs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber < b.blockNumber ? -1 : 1;
    }
    return a.logIndex - b.logIndex;
  });
}
