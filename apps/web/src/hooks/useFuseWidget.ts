"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Address,
  createPublicClient,
  formatUnits,
  http,
  isAddress,
  parseEventLogs,
  parseUnits,
} from "viem";
import { useConfig, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import {
  useSubscribeToConnectedToUnsupportedBitcoinAddress,
  useWalletAccount,
} from "@mezo-org/passport";
import {
  type ActionExecutionResult,
  type BtcUsdOraclePrice,
  type BuilderStatus,
  DEFAULT_PAID_BUILDER_TESTNET,
  type ExecutionStep,
  type FuseActionType,
  FuseClient,
  LOCK_DURATION_PRESETS,
  type LockQuote,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_CHAIN_ID,
  MEZO_TESTNET_RPC_URL,
  MEZO_TOKENS,
  fuseRouterAbi,
  type MezoTokenSymbol,
  type SaveQuote,
  type SwapQuote,
  decodeFuseError,
  isBitcoinSmartAccountWallet,
  isTaprootAddress,
} from "mezo-fuse";

export interface UseFuseWidgetOptions {
  builderAddress?: string | null;
  defaultAction?: FuseActionType;
}

export interface TokenBalances {
  BTC: bigint;
  MUSD: bigint;
  MEZO: bigint;
  sMUSD: bigint;
}

export function useFuseWidget(options: UseFuseWidgetOptions = {}) {
  const fallbackPublicClient = useMemo(
    () =>
      createPublicClient({
        chain: MEZO_TESTNET_CHAIN,
        transport: http(MEZO_TESTNET_RPC_URL),
      }),
    [],
  );

  const wagmiConfig = useConfig();
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

  const [taprootUnsupportedTriggered, setTaprootUnsupportedTriggered] = useState(false);

  useSubscribeToConnectedToUnsupportedBitcoinAddress(
    wagmiConfig,
    connector?.id ?? "unisat",
    () => {
      setTaprootUnsupportedTriggered(true);
    },
  );

  const isTaproot =
    taprootUnsupportedTriggered || isTaprootAddress(walletAddress);

  const isWrongNetwork =
    Boolean(isConnected) &&
    typeof chainId === "number" &&
    chainId !== MEZO_TESTNET_CHAIN_ID;

  const isBitcoinWallet = useMemo(
    () =>
      isBitcoinSmartAccountWallet({
        type: connector?.type,
        id: connector?.id,
        networkFamily,
      }),
    [connector?.id, connector?.type, networkFamily],
  );

  // Builder address resolution
  const rawBuilderInput =
    options.builderAddress?.trim() || DEFAULT_PAID_BUILDER_TESTNET;
  const isValidBuilderAddress = isAddress(rawBuilderInput);
  const builderAddress: Address = isValidBuilderAddress
    ? (rawBuilderInput as Address)
    : DEFAULT_PAID_BUILDER_TESTNET;

  // Active tab state
  const [activeTab, setActiveTab] = useState<FuseActionType>(
    options.defaultAction ?? "swap",
  );

  useEffect(() => {
    if (options.defaultAction) {
      setActiveTab(options.defaultAction);
    }
  }, [options.defaultAction]);

  // Swap inputs
  const [swapTokenInSymbol, setSwapTokenInSymbol] =
    useState<MezoTokenSymbol>("BTC");
  const [swapTokenOutSymbol, setSwapTokenOutSymbol] =
    useState<MezoTokenSymbol>("MUSD");
  const [swapAmountInput, setSwapAmountInput] = useState<string>("0.0001");
  const [slippageBps, setSlippageBps] = useState<number>(50); // 0.50%

  // Save inputs
  const [saveAmountInput, setSaveAmountInput] = useState<string>("2.0");

  // Lock inputs
  const [lockAmountInput, setLockAmountInput] = useState<string>("0.0001");
  const [lockDurationSeconds, setLockDurationSeconds] = useState<number>(
    LOCK_DURATION_PRESETS[0].seconds,
  );
  const [lockWarningAcknowledged, setLockWarningAcknowledged] =
    useState<boolean>(false);

  // On-chain read states
  const [builderStatus, setBuilderStatus] = useState<BuilderStatus | null>(null);
  const [builderLoading, setBuilderLoading] = useState<boolean>(true);
  const [btcUsdPrice, setBtcUsdPrice] = useState<BtcUsdOraclePrice | null>(null);
  const [balances, setBalances] = useState<TokenBalances>({
    BTC: 0n,
    MUSD: 0n,
    MEZO: 0n,
    sMUSD: 0n,
  });

  // Quote states
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [saveQuote, setSaveQuote] = useState<SaveQuote | null>(null);
  const [lockQuote, setLockQuote] = useState<LockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Execution / approval states
  const [approvalPending, setApprovalPending] = useState<boolean>(false);
  const [revokePending, setRevokePending] = useState<boolean>(false);
  const [executionStep, setExecutionStep] = useState<ExecutionStep | null>(null);
  const [actionPending, setActionPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ActionExecutionResult | null>(
    null,
  );
  const [lastApprovalTxUrl, setLastApprovalTxUrl] = useState<string | null>(
    null,
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

  // Refresh builder status, oracle price, and user token balances
  const refreshOnChainState = useCallback(async () => {
    if (!isValidBuilderAddress) {
      setBuilderStatus(null);
      setBuilderLoading(false);
      return;
    }

    try {
      const [status, oraclePrice] = await Promise.all([
        fuseClient.getBuilderStatus(builderAddress, accountAddress),
        fuseClient.getBtcUsdPrice(),
      ]);
      setBuilderStatus(status);
      setBtcUsdPrice(oraclePrice);

      if (accountAddress) {
        const [btcBal, musdBal, mezoBal, smusdBal] = await Promise.all([
          fuseClient.getTokenBalance(MEZO_TESTNET_ADDRESSES.btc, accountAddress),
          fuseClient.getTokenBalance(MEZO_TESTNET_ADDRESSES.musd, accountAddress),
          fuseClient.getTokenBalance(
            MEZO_TESTNET_ADDRESSES.mezoToken,
            accountAddress,
          ),
          fuseClient.getTokenBalance(
            MEZO_TESTNET_ADDRESSES.savingsVault,
            accountAddress,
          ),
        ]);
        setBalances({
          BTC: btcBal,
          MUSD: musdBal,
          MEZO: mezoBal,
          sMUSD: smusdBal,
        });
      }
    } catch (err) {
      const decoded = decodeFuseError(err);
      setQuoteError(decoded.message);
    } finally {
      setBuilderLoading(false);
    }
  }, [accountAddress, builderAddress, fuseClient, isValidBuilderAddress]);

  useEffect(() => {
    setBuilderLoading(true);
    void refreshOnChainState();
    const interval = setInterval(() => {
      void refreshOnChainState();
    }, 15_000);
    return () => clearInterval(interval);
  }, [refreshOnChainState]);

  // Parse active input amount in wei
  const parsedAmountWei = useMemo(() => {
    const raw =
      activeTab === "swap"
        ? swapAmountInput
        : activeTab === "save"
          ? saveAmountInput
          : lockAmountInput;
    const trimmed = raw.trim();
    if (!trimmed || Number.isNaN(Number(trimmed)) || Number(trimmed) <= 0) {
      return 0n;
    }
    try {
      return parseUnits(trimmed, 18);
    } catch {
      return 0n;
    }
  }, [activeTab, lockAmountInput, saveAmountInput, swapAmountInput]);

  // Quote calculation effect
  useEffect(() => {
    let cancelled = false;

    async function fetchActiveQuote() {
      setQuoteError(null);
      if (!isValidBuilderAddress || parsedAmountWei <= 0n) {
        setSwapQuote(null);
        setSaveQuote(null);
        setLockQuote(null);
        setQuoteLoading(false);
        return;
      }

      setQuoteLoading(true);
      try {
        if (activeTab === "swap") {
          const tokenIn = MEZO_TOKENS[swapTokenInSymbol].address;
          const tokenOut = MEZO_TOKENS[swapTokenOutSymbol].address;
          if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
            throw new Error("Select two different tokens for Swap.");
          }
          const q = await fuseClient.getSwapQuote({
            builder: builderAddress,
            tokenIn,
            tokenOut,
            amountIn: parsedAmountWei,
            slippageBps,
          });
          if (!cancelled) setSwapQuote(q);
        } else if (activeTab === "save") {
          const q = await fuseClient.getSaveQuote({
            builder: builderAddress,
            amountIn: parsedAmountWei,
          });
          if (!cancelled) setSaveQuote(q);
        } else if (activeTab === "lock") {
          const q = await fuseClient.getLockQuote({
            builder: builderAddress,
            amountIn: parsedAmountWei,
            lockDurationSeconds,
          });
          if (!cancelled) setLockQuote(q);
        }
      } catch (err) {
        if (!cancelled) {
          const decoded = decodeFuseError(err);
          setQuoteError(decoded.message);
          setSwapQuote(null);
          setSaveQuote(null);
          setLockQuote(null);
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }

    const timer = setTimeout(() => {
      void fetchActiveQuote();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeTab,
    builderAddress,
    fuseClient,
    isValidBuilderAddress,
    lockDurationSeconds,
    parsedAmountWei,
    slippageBps,
    swapTokenInSymbol,
    swapTokenOutSymbol,
  ]);

  // Active token balance and insufficient balance check
  const activeInputSymbol: MezoTokenSymbol =
    activeTab === "swap"
      ? swapTokenInSymbol
      : activeTab === "save"
        ? "MUSD"
        : "BTC";

  const activeInputBalance = balances[activeInputSymbol] ?? 0n;
  const activeInputBalanceFormatted = Number(
    formatUnits(activeInputBalance, 18),
  ).toFixed(6);

  const isInsufficientBalance =
    Boolean(isConnected) &&
    Boolean(accountAddress) &&
    parsedAmountWei > 0n &&
    parsedAmountWei > activeInputBalance;

  // Actions
  const handleSwitchToMezoTestnet = useCallback(async () => {
    setErrorMessage(null);
    try {
      await switchChainAsync({ chainId: MEZO_TESTNET_CHAIN_ID });
    } catch (err) {
      setErrorMessage(decodeFuseError(err).message);
    }
  }, [switchChainAsync]);

  const handleApproveBuilder = useCallback(async () => {
    if (!builderStatus) return;
    setErrorMessage(null);
    setLastResult(null);
    setLastApprovalTxUrl(null);
    setApprovalPending(true);
    try {
      const res = await fuseClient.approveBuilder({
        builder: builderAddress,
        maxFeeBps: builderStatus.feeBps,
      });
      setLastApprovalTxUrl(res.explorerUrl);
      await refreshOnChainState();
    } catch (err) {
      setErrorMessage(decodeFuseError(err).message);
    } finally {
      setApprovalPending(false);
    }
  }, [builderAddress, builderStatus, fuseClient, refreshOnChainState]);

  const handleRevokeBuilder = useCallback(async () => {
    setErrorMessage(null);
    setLastResult(null);
    setLastApprovalTxUrl(null);
    setRevokePending(true);
    try {
      const res = await fuseClient.revokeBuilder({
        builder: builderAddress,
      });
      setLastApprovalTxUrl(res.explorerUrl);
      await refreshOnChainState();
    } catch (err) {
      setErrorMessage(decodeFuseError(err).message);
    } finally {
      setRevokePending(false);
    }
  }, [builderAddress, fuseClient, refreshOnChainState]);

  const handleExecuteAction = useCallback(async () => {
    if (parsedAmountWei <= 0n) return;
    setErrorMessage(null);
    setLastResult(null);
    setLastApprovalTxUrl(null);
    setActionPending(true);
    setExecutionStep("checking_allowance");

    try {
      let result: ActionExecutionResult;
      if (activeTab === "swap") {
        if (!swapQuote) {
          throw new Error("Wait for swap quote to load before submitting.");
        }
        result = await fuseClient.executeSwap({
          builder: builderAddress,
          amountIn: parsedAmountWei,
          amountOutMin: swapQuote.amountOutMin,
          routes: swapQuote.routes,
          onStep: (step) => setExecutionStep(step),
        });
      } else if (activeTab === "save") {
        result = await fuseClient.executeSave({
          builder: builderAddress,
          amount: parsedAmountWei,
          onStep: (step) => setExecutionStep(step),
        });
      } else {
        result = await fuseClient.executeLock({
          builder: builderAddress,
          amount: parsedAmountWei,
          lockDurationSeconds,
          onStep: (step) => setExecutionStep(step),
        });
      }

      setExecutionStep("action_tx_confirming");
      const routedLogs = parseEventLogs({
        abi: fuseRouterAbi,
        eventName: "Routed",
        logs: result.receipt.logs,
        strict: false,
      });
      const receiptRouter = result.receipt.to?.toLowerCase();
      const hasMatchingRoutedEvent = routedLogs.some((log) => {
        const args = log.args;
        return Boolean(
          receiptRouter &&
            log.address.toLowerCase() === receiptRouter &&
            args.builder?.toLowerCase() === builderAddress.toLowerCase() &&
            args.user?.toLowerCase() === accountAddress?.toLowerCase(),
        );
      });
      if (!hasMatchingRoutedEvent) {
        throw new Error(
          "The successful receipt did not contain a matching Fuse Routed event. Open the receipt page to verify the transaction.",
        );
      }

      setLastResult(result);
      await refreshOnChainState();
    } catch (err) {
      setErrorMessage(decodeFuseError(err).message);
    } finally {
      setActionPending(false);
      setExecutionStep(null);
    }
  }, [
    activeTab,
    accountAddress,
    builderAddress,
    fuseClient,
    lockDurationSeconds,
    parsedAmountWei,
    refreshOnChainState,
    swapQuote,
  ]);

  const handleFlipSwapPair = useCallback(() => {
    setSwapTokenInSymbol(swapTokenOutSymbol);
    setSwapTokenOutSymbol(swapTokenInSymbol);
  }, [swapTokenInSymbol, swapTokenOutSymbol]);

  return {
    // Wallet & network
    accountAddress,
    walletAddress,
    isConnected: Boolean(isConnected && accountAddress),
    networkFamily,
    isBitcoinWallet,
    isTaproot,
    isWrongNetwork,
    chainId,
    handleSwitchToMezoTestnet,

    // Builder & Oracle
    rawBuilderInput,
    isValidBuilderAddress,
    builderAddress,
    builderStatus,
    builderLoading,
    btcUsdPrice,

    // Tabs & Inputs
    activeTab,
    setActiveTab,
    swapTokenInSymbol,
    setSwapTokenInSymbol,
    swapTokenOutSymbol,
    setSwapTokenOutSymbol,
    handleFlipSwapPair,
    swapAmountInput,
    setSwapAmountInput,
    slippageBps,
    setSlippageBps,
    saveAmountInput,
    setSaveAmountInput,
    lockAmountInput,
    setLockAmountInput,
    lockDurationSeconds,
    setLockDurationSeconds,
    lockWarningAcknowledged,
    setLockWarningAcknowledged,

    // Balances & Quotes
    balances,
    activeInputSymbol,
    activeInputBalance,
    activeInputBalanceFormatted,
    isInsufficientBalance,
    parsedAmountWei,
    swapQuote,
    saveQuote,
    lockQuote,
    quoteLoading,
    quoteError,

    // Approvals & Execution
    approvalPending,
    revokePending,
    actionPending,
    executionStep,
    errorMessage,
    setErrorMessage,
    lastResult,
    lastApprovalTxUrl,
    handleApproveBuilder,
    handleRevokeBuilder,
    handleExecuteAction,
    refreshOnChainState,
  };
}
