"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Address,
  createPublicClient,
  getAddress,
  http,
  isAddress,
} from "viem";
import { usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { useWalletAccount } from "@mezo-org/passport";
import {
  type BuilderAnalyticsReport,
  type BuilderStatus,
  DEFAULT_PAID_BUILDER_TESTNET,
  FuseClient,
  MAX_FEE_BPS,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_CHAIN_ID,
  MEZO_TESTNET_RPC_URL,
  type RoutedEventRecord,
  type X402PaymentRequired,
  createMusdX402PaymentPayload,
  decodeFuseError,
  getExplorerTxUrl,
} from "@fuse/sdk";

export interface UseBuilderConsoleOptions {
  initialBuilderAddress?: string | null;
}

export function useBuilderConsole(options: UseBuilderConsoleOptions = {}) {
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
  const { switchChainAsync } = useSwitchChain();

  const {
    accountAddress,
    walletAddress,
    isConnected,
    networkFamily,
    connector,
    chainId,
  } = useWalletAccount();

  const isWrongNetwork =
    isConnected &&
    networkFamily === "evm" &&
    chainId !== undefined &&
    chainId !== MEZO_TESTNET_CHAIN_ID;

  const [lookupAddressInput, setLookupAddressInput] = useState<string>(
    options.initialBuilderAddress && isAddress(options.initialBuilderAddress)
      ? options.initialBuilderAddress
      : DEFAULT_PAID_BUILDER_TESTNET,
  );

  useEffect(() => {
    if (accountAddress && isAddress(accountAddress) && !options.initialBuilderAddress) {
      setLookupAddressInput(accountAddress);
    }
  }, [accountAddress, options.initialBuilderAddress]);

  const targetBuilderAddress: Address = useMemo(() => {
    if (isAddress(lookupAddressInput)) {
      return getAddress(lookupAddressInput);
    }
    if (accountAddress && isAddress(accountAddress)) {
      return getAddress(accountAddress);
    }
    return DEFAULT_PAID_BUILDER_TESTNET;
  }, [lookupAddressInput, accountAddress]);

  const fuseClient = useMemo(
    () =>
      new FuseClient({
        publicClient,
        walletClient: walletClient ?? undefined,
        addresses: MEZO_TESTNET_ADDRESSES,
        chainId: MEZO_TESTNET_CHAIN_ID,
        connectorInfo: connector
          ? {
              type: connector.type,
              id: connector.id,
              networkFamily,
            }
          : null,
      }),
    [publicClient, walletClient, connector, networkFamily],
  );

  const [builderStatus, setBuilderStatus] = useState<BuilderStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<RoutedEventRecord[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Registration & update form states
  const [feeBpsInput, setFeeBpsInput] = useState<string>("15");
  const [builderNameInput, setBuilderNameInput] = useState<string>("My Mezo App");
  const [builderUrlInput, setBuilderUrlInput] = useState<string>("https://example.com");
  const [metadataURIInput, setMetadataURIInput] = useState<string>(
    JSON.stringify({ name: "My Mezo App", url: "https://example.com" }),
  );

  const [isSubmittingTx, setIsSubmittingTx] = useState<boolean>(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastTxExplorerUrl, setLastTxExplorerUrl] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Paid x402 analytics states
  const [x402Status, setX402Status] = useState<number | null>(null);
  const [x402Requirement, setX402Requirement] = useState<X402PaymentRequired | null>(null);
  const [x402Settlement, setX402Settlement] = useState<{
    settled: boolean;
    transaction: string;
    explorerUrl?: string;
    payer?: string;
    amountMusd: string;
  } | null>(null);
  const [paidAnalytics, setPaidAnalytics] = useState<BuilderAnalyticsReport | null>(null);
  const [isX402Loading, setIsX402Loading] = useState<boolean>(false);
  const [x402Error, setX402Error] = useState<string | null>(null);

  const refreshBuilderData = useCallback(async () => {
    setIsLoadingStatus(true);
    setStatusError(null);
    try {
      const [status, events] = await Promise.all([
        fuseClient.getBuilderStatus(
          targetBuilderAddress,
          accountAddress && isAddress(accountAddress) ? accountAddress : undefined,
        ),
        fuseClient.getRoutedEvents({
          builder: targetBuilderAddress,
        }),
      ]);
      setBuilderStatus(status);
      setRecentEvents(
        [...events].sort((a, b) => Number(b.blockNumber - a.blockNumber)).slice(0, 15),
      );
      if (status.registered) {
        setFeeBpsInput(String(status.feeBps));
        if (status.metadataURI) {
          setMetadataURIInput(status.metadataURI);
        }
        if (status.metadata.name) {
          setBuilderNameInput(status.metadata.name);
        }
        if (status.metadata.url) {
          setBuilderUrlInput(status.metadata.url);
        }
      }
    } catch (err) {
      setStatusError(decodeFuseError(err).message);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [fuseClient, targetBuilderAddress, accountAddress]);

  useEffect(() => {
    void refreshBuilderData();
  }, [refreshBuilderData]);

  const composeJsonMetadataURI = useCallback(() => {
    const uri = JSON.stringify({
      name: builderNameInput.trim() || "Mezo Builder",
      ...(builderUrlInput.trim() ? { url: builderUrlInput.trim() } : {}),
    });
    setMetadataURIInput(uri);
    return uri;
  }, [builderNameInput, builderUrlInput]);

  const handleSwitchNetwork = useCallback(async () => {
    if (!switchChainAsync) return;
    await switchChainAsync({ chainId: MEZO_TESTNET_CHAIN_ID });
  }, [switchChainAsync]);

  const handleRegisterBuilder = useCallback(async () => {
    setTxError(null);
    setLastTxHash(null);
    setLastTxExplorerUrl(null);
    const fee = Number(feeBpsInput);
    if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEE_BPS) {
      setTxError(`Fee must be an integer between 0 and ${MAX_FEE_BPS} bps (0.50%).`);
      return;
    }
    setIsSubmittingTx(true);
    try {
      const res = await fuseClient.registerBuilder({
        feeBps: fee,
        metadataURI: metadataURIInput.trim(),
      });
      setLastTxHash(res.txHash);
      setLastTxExplorerUrl(getExplorerTxUrl(res.txHash));
      await refreshBuilderData();
    } catch (err) {
      setTxError(decodeFuseError(err).message);
    } finally {
      setIsSubmittingTx(false);
    }
  }, [feeBpsInput, metadataURIInput, fuseClient, refreshBuilderData]);

  const handleSetFee = useCallback(async () => {
    setTxError(null);
    setLastTxHash(null);
    setLastTxExplorerUrl(null);
    const fee = Number(feeBpsInput);
    if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEE_BPS) {
      setTxError(`Fee must be an integer between 0 and ${MAX_FEE_BPS} bps (0.50%).`);
      return;
    }
    setIsSubmittingTx(true);
    try {
      const res = await fuseClient.setFee({ newFeeBps: fee });
      setLastTxHash(res.txHash);
      setLastTxExplorerUrl(getExplorerTxUrl(res.txHash));
      await refreshBuilderData();
    } catch (err) {
      setTxError(decodeFuseError(err).message);
    } finally {
      setIsSubmittingTx(false);
    }
  }, [feeBpsInput, fuseClient, refreshBuilderData]);

  const handleSetActive = useCallback(
    async (active: boolean) => {
      setTxError(null);
      setLastTxHash(null);
      setLastTxExplorerUrl(null);
      setIsSubmittingTx(true);
      try {
        const res = await fuseClient.setActive({ active });
        setLastTxHash(res.txHash);
        setLastTxExplorerUrl(getExplorerTxUrl(res.txHash));
        await refreshBuilderData();
      } catch (err) {
        setTxError(decodeFuseError(err).message);
      } finally {
        setIsSubmittingTx(false);
      }
    },
    [fuseClient, refreshBuilderData],
  );

  const handleSetMetadataURI = useCallback(async () => {
    setTxError(null);
    setLastTxHash(null);
    setLastTxExplorerUrl(null);
    setIsSubmittingTx(true);
    try {
      const res = await fuseClient.setMetadataURI({
        metadataURI: metadataURIInput.trim(),
      });
      setLastTxHash(res.txHash);
      setLastTxExplorerUrl(getExplorerTxUrl(res.txHash));
      await refreshBuilderData();
    } catch (err) {
      setTxError(decodeFuseError(err).message);
    } finally {
      setIsSubmittingTx(false);
    }
  }, [metadataURIInput, fuseClient, refreshBuilderData]);

  const handleCheckX402Requirement = useCallback(async () => {
    setIsX402Loading(true);
    setX402Error(null);
    try {
      const res = await fetch(`/api/analytics/${targetBuilderAddress}`, {
        cache: "no-store",
      });
      setX402Status(res.status);
      const body = await res.json();
      if (res.status === 402) {
        setX402Requirement(body as X402PaymentRequired);
      }
    } catch (err) {
      setX402Error(err instanceof Error ? err.message : "Failed to query x402 endpoint");
    } finally {
      setIsX402Loading(false);
    }
  }, [targetBuilderAddress]);

  const handleUnlockPaidAnalyticsWithX402 = useCallback(async () => {
    if (!walletClient || !walletClient.account) {
      setX402Error("Connect an EVM wallet on Mezo Testnet to sign the 0.05 MUSD x402 payment.");
      return;
    }
    setIsX402Loading(true);
    setX402Error(null);
    try {
      // Step 1: Request `/api/analytics/[builder]` to obtain fresh 402 payment requirements
      const initRes = await fetch(`/api/analytics/${targetBuilderAddress}`, {
        cache: "no-store",
      });
      setX402Status(initRes.status);
      const initBody = (await initRes.json()) as X402PaymentRequired;
      if (initRes.status !== 402) {
        throw new Error(`Expected HTTP 402 challenge, received ${initRes.status}`);
      }
      setX402Requirement(initBody);

      // Step 2: Sign Permit2 + EIP-2612 Gas Sponsoring payload for 0.05 MUSD
      const { headerValue } = await createMusdX402PaymentPayload({
        publicClient,
        walletClient,
        paymentRequired: initBody,
      });

      // Step 3: Retry `/api/analytics/[builder]` with `PAYMENT-SIGNATURE` header
      const paidRes = await fetch(`/api/analytics/${targetBuilderAddress}`, {
        method: "GET",
        headers: {
          "PAYMENT-SIGNATURE": headerValue,
        },
        cache: "no-store",
      });

      setX402Status(paidRes.status);
      const paidBody = await paidRes.json();
      if (!paidRes.ok) {
        throw new Error(
          paidBody.message || `x402 settlement failed with status ${paidRes.status}`,
        );
      }

      setX402Settlement(paidBody.x402);
      setPaidAnalytics(paidBody.analytics as BuilderAnalyticsReport);
    } catch (err) {
      setX402Error(decodeFuseError(err).message);
    } finally {
      setIsX402Loading(false);
    }
  }, [walletClient, publicClient, targetBuilderAddress]);

  const snippets = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://fuse.mezo.org";
    const iframeSnippet = `<iframe
  src="${origin}/widget?builder=${targetBuilderAddress}&tab=save"
  width="440"
  height="680"
  title="Fuse Mezo DeFi Widget"
  allow="clipboard-write"
></iframe>`;

    const reactSnippet = `import { FusePassportProvider, FuseWidget } from "@fuse/web";

export function MyMezoIntegration() {
  return (
    <FusePassportProvider>
      <FuseWidget
        builder="${targetBuilderAddress}"
        defaultAction="save"
      />
    </FusePassportProvider>
  );
}`;

    const sdkSnippet = `import { createPublicClient, http, parseUnits } from "viem";
import { FuseClient, MEZO_TESTNET_CHAIN, MEZO_TESTNET_RPC_URL } from "@fuse/sdk";

const publicClient = createPublicClient({
  chain: MEZO_TESTNET_CHAIN,
  transport: http(MEZO_TESTNET_RPC_URL),
});

const fuse = new FuseClient({ publicClient, walletClient });

// 1-tx MUSD -> sMUSD Save with automatic EIP-2612 permit or 2-step fallback
const result = await fuse.executeSave({
  builder: "${targetBuilderAddress}",
  amount: parseUnits("10", 18),
});
console.log("Routed Save Tx:", result.explorerUrl);`;

    return {
      iframeSnippet,
      reactSnippet,
      sdkSnippet,
    };
  }, [targetBuilderAddress]);

  return {
    isConnected,
    accountAddress,
    walletAddress,
    networkFamily,
    isWrongNetwork,
    lookupAddressInput,
    setLookupAddressInput,
    targetBuilderAddress,
    builderStatus,
    recentEvents,
    isLoadingStatus,
    statusError,
    refreshBuilderData,
    feeBpsInput,
    setFeeBpsInput,
    builderNameInput,
    setBuilderNameInput,
    builderUrlInput,
    setBuilderUrlInput,
    metadataURIInput,
    setMetadataURIInput,
    composeJsonMetadataURI,
    isSubmittingTx,
    lastTxHash,
    lastTxExplorerUrl,
    txError,
    handleSwitchNetwork,
    handleRegisterBuilder,
    handleSetFee,
    handleSetActive,
    handleSetMetadataURI,
    x402Status,
    x402Requirement,
    x402Settlement,
    paidAnalytics,
    isX402Loading,
    x402Error,
    handleCheckX402Requirement,
    handleUnlockPaidAnalyticsWithX402,
    snippets,
  };
}
