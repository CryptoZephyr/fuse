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

export function mapActionCodeToType(actionCode: number): FuseActionType {
  if (actionCode === 0) return "swap";
  if (actionCode === 1) return "save";
  if (actionCode === 2) return "lock";
  return "swap";
}

export interface GetRoutedEventsParameters {
  publicClient: PublicClient;
  fromBlock?: bigint;
  toBlock?: bigint | "latest";
  builder?: Address;
  user?: Address;
  addresses?: FuseAddresses;
  chunkSize?: bigint;
}

export async function getRoutedEvents({
  publicClient,
  fromBlock,
  toBlock = "latest",
  builder,
  user,
  addresses = MEZO_TESTNET_ADDRESSES,
  chunkSize = 9_500n,
}: GetRoutedEventsParameters): Promise<RoutedEventRecord[]> {
  const startBlock = fromBlock ?? addresses.fuseRouterDeployBlock;
  const latestBlock =
    toBlock === "latest" ? await publicClient.getBlockNumber() : toBlock;

  if (latestBlock < startBlock) {
    return [];
  }

  const allLogs: RoutedEventRecord[] = [];
  let cursor = startBlock;

  while (cursor <= latestBlock) {
    const end = cursor + chunkSize - 1n > latestBlock ? latestBlock : cursor + chunkSize - 1n;

    const logs = await publicClient.getLogs({
      address: addresses.fuseRouter,
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
      const actionCode = Number(log.args.action ?? 0);
      allLogs.push({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber ?? 0n,
        logIndex: Number(log.logIndex ?? 0),
        builder: log.args.builder,
        user: log.args.user,
        action: mapActionCodeToType(actionCode),
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

  return allLogs;
}
