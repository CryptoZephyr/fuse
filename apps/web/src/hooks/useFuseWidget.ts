"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Address,
  createPublicClient,
  formatUnits,
  http,
  isAddress,
  parseEventLogs,
  parseUnits,
} from "viem";
import { useConfig, useSwitchChain, useWalletClient } from "wagmi";
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
  FUSE_WIDGET_MESSAGE_SOURCE,
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
  type SubmittedTransaction,
  type SwapQuote,
  decodeFuseError,
  isBitcoinSmartAccountWallet,
  isTaprootAddress,
} from "mezo-fuse";
import {
  calculateBtcGasReserve,
  maxSpendable,
  MIN_BTC_GAS_RESERVE,
} from "../lib/gasReserve";
import { postToHost } from "../lib/hostMessages";

export interface UseFuseWidgetOptions {
  builderAddress?: string | null;
  defaultAction?: FuseActionType;
  initialTx?: string | null;
}

export interface TokenBalances {
  BTC: bigint;
  MUSD: bigint;
  MEZO: bigint;
  sMUSD: bigint;
}

export function useFuseWidget(options: UseFuseWidgetOptions = {}) {
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: MEZO_TESTNET_CHAIN,
        transport: http(MEZO_TESTNET_RPC_URL),
        batch: { multicall: true },
      }),
    [],
  );

  const wagmiConfig = useConfig();
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

  useEffect(() => {
    const address = isConnected && accountAddress ? accountAddress : null;
    postToHost({
      source: FUSE_WIDGET_MESSAGE_SOURCE,
      version: 1,
      type: "account",
      address,
      chainId: address && typeof chainId === "number" ? chainId : null,
    });
  }, [accountAddress, chainId, isConnected]);

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
  const lockQuoteUnlockTimestamp = useRef<number | null>(null);
  const quoteRequestId = useRef(0);

  useEffect(() => {
    setLockWarningAcknowledged(false);
  }, [lockAmountInput, lockDurationSeconds]);

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
  const [btcGasReserve, setBtcGasReserve] = useState(MIN_BTC_GAS_RESERVE);

  // Quote states
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [saveQuote, setSaveQuote] = useState<SaveQuote | null>(null);
  const [lockQuote, setLockQuote] = useState<LockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null);
  const [quoteClock, setQuoteClock] = useState(Date.now());

  // Execution / approval states
  const [approvalPending, setApprovalPending] = useState<boolean>(false);
  const [revokePending, setRevokePending] = useState<boolean>(false);
  const [executionStep, setExecutionStep] = useState<
    ExecutionStep | "refreshing_quote" | null
  >(null);
  const [actionPending, setActionPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ActionExecutionResult | null>(
    null,
  );
  const [lastApprovalTxUrl, setLastApprovalTxUrl] = useState<string | null>(
    null,
  );
  const [pendingTx, setPendingTx] = useState<SubmittedTransaction | null>(null);

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

  // Refresh builder status, oracle price, token balances, and gas price
  const refreshOnChainState = useCallback(async () => {
    const gasPriceRequest = publicClient
      .getGasPrice()
      .catch(() => null)
      .then((gasPrice) => {
        setBtcGasReserve(
          gasPrice === null
            ? MIN_BTC_GAS_RESERVE
            : calculateBtcGasReserve(gasPrice),
        );
        return gasPrice;
      });
    if (!isValidBuilderAddress) {
      setBuilderStatus(null);
      setBuilderLoading(false);
      await gasPriceRequest;
      return;
    }

    try {
      const getBalance = (token: Address) =>
        accountAddress
          ? fuseClient.getTokenBalance(token, accountAddress)
          : Promise.resolve(null);
      const [status, oraclePrice, btcBal, musdBal, mezoBal, smusdBal] =
        await Promise.all([
          fuseClient.getBuilderStatus(builderAddress, accountAddress),
          fuseClient.getBtcUsdPrice(),
          getBalance(MEZO_TESTNET_ADDRESSES.btc),
          getBalance(MEZO_TESTNET_ADDRESSES.musd),
          getBalance(MEZO_TESTNET_ADDRESSES.mezoToken),
          getBalance(MEZO_TESTNET_ADDRESSES.savingsVault),
          gasPriceRequest,
        ]);
      setBuilderStatus(status);
      setBtcUsdPrice(oraclePrice);

      if (btcBal !== null && musdBal !== null && mezoBal !== null && smusdBal !== null) {
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
  }, [
    accountAddress,
    builderAddress,
    fuseClient,
    isValidBuilderAddress,
    publicClient,
  ]);

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

  const latestQuoteInputs = useRef({
    activeTab,
    builderAddress,
    lockDurationSeconds,
    parsedAmountWei,
    slippageBps,
    swapTokenInSymbol,
    swapTokenOutSymbol,
  });
  latestQuoteInputs.current = {
    activeTab,
    builderAddress,
    lockDurationSeconds,
    parsedAmountWei,
    slippageBps,
    swapTokenInSymbol,
    swapTokenOutSymbol,
  };

  const fetchCurrentQuote = useCallback(async () => {
    const requestId = ++quoteRequestId.current;
    setQuoteError(null);

    try {
      if (activeTab === "swap") {
        const tokenIn = MEZO_TOKENS[swapTokenInSymbol].address;
        const tokenOut = MEZO_TOKENS[swapTokenOutSymbol].address;
        if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
          throw new Error("Select two different tokens for Swap.");
        }
        const quote = await fuseClient.getSwapQuote({
          builder: builderAddress,
          tokenIn,
          tokenOut,
          amountIn: parsedAmountWei,
          slippageBps,
        });
        if (requestId === quoteRequestId.current) {
          setSwapQuote(quote);
          setSaveQuote(null);
          setLockQuote(null);
          lockQuoteUnlockTimestamp.current = null;
          setQuoteUpdatedAt(Date.now());
        }
        return quote;
      }

      if (activeTab === "save") {
        const quote = await fuseClient.getSaveQuote({
          builder: builderAddress,
          amountIn: parsedAmountWei,
        });
        if (requestId === quoteRequestId.current) {
          setSwapQuote(null);
          setSaveQuote(quote);
          setLockQuote(null);
          lockQuoteUnlockTimestamp.current = null;
          setQuoteUpdatedAt(Date.now());
        }
        return quote;
      }

      const quote = await fuseClient.getLockQuote({
        builder: builderAddress,
        amountIn: parsedAmountWei,
        lockDurationSeconds,
      });
      if (requestId === quoteRequestId.current) {
        if (
          lockQuoteUnlockTimestamp.current !== null &&
          lockQuoteUnlockTimestamp.current !== quote.unlockTimestamp
        ) {
          setLockWarningAcknowledged(false);
        }
        lockQuoteUnlockTimestamp.current = quote.unlockTimestamp;
        setSwapQuote(null);
        setSaveQuote(null);
        setLockQuote(quote);
        setQuoteUpdatedAt(Date.now());
      }
      return quote;
    } catch (err) {
      if (requestId === quoteRequestId.current) {
        setQuoteError(decodeFuseError(err).message);
        setSwapQuote(null);
        setSaveQuote(null);
        setLockQuote(null);
        lockQuoteUnlockTimestamp.current = null;
        setQuoteUpdatedAt(null);
      }
      throw err;
    }
  }, [
    activeTab,
    builderAddress,
    fuseClient,
    lockDurationSeconds,
    parsedAmountWei,
    slippageBps,
    swapTokenInSymbol,
    swapTokenOutSymbol,
  ]);

  useEffect(() => {
    let cancelled = false;
    setQuoteError(null);
    setQuoteUpdatedAt(null);

    if (!isValidBuilderAddress || parsedAmountWei <= 0n) {
      setSwapQuote(null);
      setSaveQuote(null);
      setLockQuote(null);
      lockQuoteUnlockTimestamp.current = null;
      setQuoteLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setQuoteLoading(true);
      void fetchCurrentQuote()
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      quoteRequestId.current += 1;
      clearTimeout(timer);
    };
  }, [fetchCurrentQuote, isValidBuilderAddress, parsedAmountWei]);

  const activeQuoteShown =
    activeTab === "swap"
      ? Boolean(swapQuote)
      : activeTab === "save"
        ? Boolean(saveQuote)
        : Boolean(lockQuote);

  useEffect(() => {
    if (!activeQuoteShown || !quoteUpdatedAt) return;
    setQuoteClock(Date.now());
    const interval = setInterval(() => setQuoteClock(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [
    activeQuoteShown,
    activeTab,
    lockQuote,
    quoteUpdatedAt,
    saveQuote,
    swapQuote,
  ]);

  const quoteAgeSeconds =
    activeQuoteShown && quoteUpdatedAt
      ? Math.max(0, Math.floor((quoteClock - quoteUpdatedAt) / 1_000))
      : null;

  // Active token balance and insufficient balance check
  const activeInputSymbol: MezoTokenSymbol =
    activeTab === "swap"
      ? swapTokenInSymbol
      : activeTab === "save"
        ? "MUSD"
        : "BTC";

  const activeInputBalance = balances[activeInputSymbol] ?? 0n;
  const maxSpendableInputBalance =
    activeInputSymbol === "BTC"
      ? maxSpendable(activeInputBalance, btcGasReserve)
      : activeInputBalance;
  const activeInputBalanceFormatted = Number(
    formatUnits(activeInputBalance, 18),
  ).toFixed(6);

  const isInsufficientBalance =
    Boolean(isConnected) &&
    Boolean(accountAddress) &&
    parsedAmountWei > 0n &&
    parsedAmountWei > maxSpendableInputBalance;

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
    setPendingTx(null);
    setActionPending(true);
    setExecutionStep("checking_allowance");

    try {
      const latestStatus = await fuseClient.getBuilderStatus(builderAddress, accountAddress);
      if (latestStatus.routerPaused) throw new Error("RouterPaused");
      if (!latestStatus.registered) throw new Error("BuilderNotRegistered");
      if (!latestStatus.active) throw new Error("BuilderNotActive");

      setExecutionStep("refreshing_quote");
      setQuoteLoading(true);
      let freshQuote: SwapQuote | SaveQuote | LockQuote;
      try {
        freshQuote = await fetchCurrentQuote();
      } finally {
        setQuoteLoading(false);
      }
      const latestInputs = latestQuoteInputs.current;
      if (
        latestInputs.activeTab !== activeTab ||
        latestInputs.builderAddress !== builderAddress ||
        latestInputs.lockDurationSeconds !== lockDurationSeconds ||
        latestInputs.parsedAmountWei !== parsedAmountWei ||
        latestInputs.slippageBps !== slippageBps ||
        latestInputs.swapTokenInSymbol !== swapTokenInSymbol ||
        latestInputs.swapTokenOutSymbol !== swapTokenOutSymbol
      ) {
        throw new Error("Your inputs changed. Check the quote and try again.");
      }

      const onTransactionSubmitted = (tx: SubmittedTransaction) => {
        setPendingTx(tx);
        postToHost({
          source: FUSE_WIDGET_MESSAGE_SOURCE,
          version: 1,
          type: "tx_submitted",
          hash: tx.hash,
          kind: tx.kind,
          action: activeTab,
          explorerUrl: tx.explorerUrl,
        });
        if (tx.kind === "action" && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("tx", tx.hash);
          window.history.replaceState(window.history.state, "", url.toString());
        }
      };

      let result: ActionExecutionResult;
      if (activeTab === "swap") {
        const refreshedSwapQuote = freshQuote as SwapQuote;
        if (!swapQuote) {
          throw new Error("Your swap quote is no longer available. Check the new quote and try again.");
        }
        if (refreshedSwapQuote.amountOutMin < swapQuote.amountOutMin) {
          throw new Error("The price moved. Check the new amount and press Swap again.");
        }
        if (latestStatus.needsApproval) throw new Error("BuilderNotApprovedByUser");
        if (latestStatus.needsHigherApproval) throw new Error("FeeAboveUserApproval");
        result = await fuseClient.executeSwap({
          builder: builderAddress,
          amountIn: parsedAmountWei,
          amountOutMin: refreshedSwapQuote.amountOutMin,
          routes: refreshedSwapQuote.routes,
          onStep: (step) => setExecutionStep(step),
          onTransactionSubmitted,
        });
      } else if (activeTab === "save") {
        const refreshedSaveQuote = freshQuote as SaveQuote;
        if (!saveQuote) {
          throw new Error("Your save quote is no longer available. Check the new quote and try again.");
        }
        if (refreshedSaveQuote.feeBps !== saveQuote.feeBps) {
          throw new Error("The builder fee changed. Check the new fee and try again.");
        }
        if (latestStatus.needsApproval) throw new Error("BuilderNotApprovedByUser");
        if (latestStatus.needsHigherApproval) throw new Error("FeeAboveUserApproval");
        result = await fuseClient.executeSave({
          builder: builderAddress,
          amount: parsedAmountWei,
          onStep: (step) => setExecutionStep(step),
          onTransactionSubmitted,
        });
      } else {
        const refreshedLockQuote = freshQuote as LockQuote;
        if (!lockQuote) {
          throw new Error("Your lock quote is no longer available. Check the new quote and try again.");
        }
        if (refreshedLockQuote.unlockTimestamp !== lockQuote.unlockTimestamp) {
          setLockWarningAcknowledged(false);
          throw new Error(
            `The unlock date changed to ${refreshedLockQuote.unlockDateFormatted}. Check it and confirm again.`,
          );
        }
        if (refreshedLockQuote.feeBps !== lockQuote.feeBps) {
          throw new Error("The builder fee changed. Check the new fee and try again.");
        }
        if (latestStatus.needsApproval) throw new Error("BuilderNotApprovedByUser");
        if (latestStatus.needsHigherApproval) throw new Error("FeeAboveUserApproval");
        result = await fuseClient.executeLock({
          builder: builderAddress,
          amount: parsedAmountWei,
          lockDurationSeconds,
          onStep: (step) => setExecutionStep(step),
          onTransactionSubmitted,
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

      postToHost({
        source: FUSE_WIDGET_MESSAGE_SOURCE,
        version: 1,
        type: "tx_confirmed",
        hash: result.txHash,
        kind: "action",
        action: activeTab,
        explorerUrl: result.explorerUrl,
      });
      setLastResult(result);
      setPendingTx(null);
      await refreshOnChainState();
    } catch (err) {
      setErrorMessage(decodeFuseError(err).message);
      setPendingTx(null);
    } finally {
      setQuoteLoading(false);
      setActionPending(false);
      setExecutionStep(null);
    }
  }, [
    activeTab,
    accountAddress,
    builderAddress,
    fetchCurrentQuote,
    fuseClient,
    lockQuote,
    lockDurationSeconds,
    parsedAmountWei,
    refreshOnChainState,
    saveQuote,
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
    maxSpendableInputBalance,
    isInsufficientBalance,
    parsedAmountWei,
    swapQuote,
    saveQuote,
    lockQuote,
    quoteLoading,
    quoteError,
    quoteUpdatedAt,
    quoteAgeSeconds,

    // Approvals & Execution
    approvalPending,
    revokePending,
    actionPending,
    executionStep,
    errorMessage,
    setErrorMessage,
    lastResult,
    lastApprovalTxUrl,
    pendingTx,
    initialTx: options.initialTx ?? null,
    handleApproveBuilder,
    handleRevokeBuilder,
    handleExecuteAction,
    refreshOnChainState,
  };
}
