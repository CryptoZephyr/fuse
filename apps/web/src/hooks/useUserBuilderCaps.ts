"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Address,
  createPublicClient,
  getAddress,
  http,
  isAddress,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useWalletAccount } from "@mezo-org/passport";
import {
  type BuilderStatus,
  FuseClient,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_CHAIN_ID,
  MEZO_TESTNET_RPC_URL,
  decodeFuseError,
} from "mezo-fuse";

export type UserBuilderCapAction = "approve" | "revoke";

export interface UseUserBuilderCapsResult {
  statuses: Record<string, BuilderStatus>;
  isLoading: boolean;
  error: string | null;
  actionBuilder: Address | null;
  action: UserBuilderCapAction | null;
  actionError: string | null;
  lastActionExplorerUrl: string | null;
  approveBuilder: (builder: Address, maxFeeBps: number) => Promise<void>;
  revokeBuilder: (builder: Address) => Promise<void>;
}

export function useUserBuilderCaps(
  builders: readonly Address[],
): UseUserBuilderCapsResult {
  const fallbackPublicClient = useMemo(
    () =>
      createPublicClient({
        chain: MEZO_TESTNET_CHAIN,
        transport: http(MEZO_TESTNET_RPC_URL),
      }),
    [],
  );
  const wagmiPublicClient = usePublicClient({ chainId: MEZO_TESTNET_CHAIN_ID });
  const publicClient = wagmiPublicClient ?? fallbackPublicClient;
  const { data: walletClient } = useWalletClient();
  const { accountAddress, isConnected, networkFamily, connector, chainId } =
    useWalletAccount();

  const account =
    accountAddress && isAddress(accountAddress)
      ? getAddress(accountAddress)
      : undefined;
  const isWrongNetwork =
    Boolean(isConnected) &&
    networkFamily === "evm" &&
    chainId !== undefined &&
    chainId !== MEZO_TESTNET_CHAIN_ID;
  const normalizedBuilders = useMemo(
    () =>
      builders
        .filter((builder): builder is Address => isAddress(builder))
        .map((builder) => getAddress(builder)),
    [builders],
  );

  const fuseClient = useMemo(
    () =>
      new FuseClient({
        publicClient,
        walletClient: walletClient ?? undefined,
        addresses: MEZO_TESTNET_ADDRESSES,
        chainId: MEZO_TESTNET_CHAIN_ID,
        connectorInfo: {
          type: connector?.type,
          id: connector?.id,
          networkFamily,
        },
      }),
    [connector?.id, connector?.type, networkFamily, publicClient, walletClient],
  );

  const [statuses, setStatuses] = useState<Record<string, BuilderStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBuilder, setActionBuilder] = useState<Address | null>(null);
  const [action, setAction] = useState<UserBuilderCapAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastActionExplorerUrl, setLastActionExplorerUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account || normalizedBuilders.length === 0) {
      setStatuses({});
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        normalizedBuilders.map(async (builder) => {
          const status = await fuseClient.getBuilderStatus(builder, account);
          return [builder.toLowerCase(), status] as const;
        }),
      );
      setStatuses(Object.fromEntries(entries));
    } catch (err) {
      setError(decodeFuseError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [account, fuseClient, normalizedBuilders]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (
      builder: Address,
      nextAction: UserBuilderCapAction,
      callback: () => Promise<{ explorerUrl: string }>,
    ) => {
      if (!account || isWrongNetwork) return;
      setActionBuilder(builder);
      setAction(nextAction);
      setActionError(null);
      setLastActionExplorerUrl(null);
      try {
        const result = await callback();
        setLastActionExplorerUrl(result.explorerUrl);
        await refresh();
      } catch (err) {
        setActionError(decodeFuseError(err).message);
      } finally {
        setActionBuilder(null);
        setAction(null);
      }
    },
    [account, isWrongNetwork, refresh],
  );

  const approveBuilder = useCallback(
    async (builder: Address, maxFeeBps: number) => {
      await runAction(builder, "approve", () =>
        fuseClient.approveBuilder({ builder, maxFeeBps }),
      );
    },
    [fuseClient, runAction],
  );

  const revokeBuilder = useCallback(
    async (builder: Address) => {
      await runAction(builder, "revoke", () =>
        fuseClient.revokeBuilder({ builder }),
      );
    },
    [fuseClient, runAction],
  );

  return {
    statuses,
    isLoading,
    error,
    actionBuilder,
    action,
    actionError,
    lastActionExplorerUrl,
    approveBuilder,
    revokeBuilder,
  };
}
