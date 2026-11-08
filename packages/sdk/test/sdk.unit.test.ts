import { describe, expect, it, vi } from "vitest";
import {
  CallExecutionError,
  encodeErrorResult,
  ExecutionRevertedError,
  getAddress,
  parseUnits,
  RawContractError,
  type Address,
} from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  FUSE_TEST_WALLETS,
  FuseClient,
  FuseSimulationUnavailableError,
  FuseTransactionRevertedError,
  LEGACY_PAID_BUILDER_TESTNET,
  LOCK_DURATION_PRESETS,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MIN_LOCK_DURATION_SECONDS,
  TESTNET_MAX_LOCK_DURATION_SECONDS,
  buildApproveBuilderTx,
  buildDefaultTigrisRoute,
  buildLockTx,
  buildRevokeBuilderTx,
  buildSaveTx,
  buildSaveWithPermitTx,
  buildSwapTx,
  buildSwapWithPermitTx,
  calculateBuilderFee,
  decodeFuseError,
  estimateTokenUsdValue,
  formatFeeBps,
  formatUsd,
  getBuilderAnalytics,
  getLeaderboardSnapshot,
  getRoutedEvents,
  getSaveQuote,
  getSwapQuote,
  mapActionCodeToType,
  fuseRouterAbi,
  tigrisRouterErrorsAbi,
  isBitcoinSmartAccountWallet,
  isTaprootAddress,
  parseBuilderMetadataURI,
  FUSE_WIDGET_MESSAGE_SOURCE,
  parseFuseWidgetMessage,
  previewVeBtcUnlockTime,
  RETIRED_PAID_BUILDER_TESTNET,
  RETIRED_ZERO_FEE_BUILDER_TESTNET,
  buildX402PaymentRequired,
  decodeX402Header,
  encodeX402Header,
  settleX402Payment,
  verifyAndSettleX402Payment,
  verifyX402Payment,
  type X402PaymentPayload,
} from "../src/index.js";

describe("mezo-fuse unit tests", () => {
  it("parses account host messages", () => {
    expect(
      parseFuseWidgetMessage({
        source: FUSE_WIDGET_MESSAGE_SOURCE,
        version: 1,
        type: "account",
        address: "0x0000000000000000000000000000000000000001",
        chainId: 31611,
      }),
    ).toEqual({
      source: FUSE_WIDGET_MESSAGE_SOURCE,
      version: 1,
      type: "account",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 31611,
    });
  });

  it.each(["tx_submitted", "tx_confirmed"] as const)(
    "parses %s host messages",
    (type) => {
      expect(
        parseFuseWidgetMessage({
          source: FUSE_WIDGET_MESSAGE_SOURCE,
          version: 1,
          type,
          hash: `0x${"a".repeat(64)}`,
          kind: "action",
          action: "save",
          explorerUrl: "https://explorer.test.mezo.org/tx/0xabc",
        }),
      ).toEqual({
        source: FUSE_WIDGET_MESSAGE_SOURCE,
        version: 1,
        type,
        hash: `0x${"a".repeat(64)}`,
        kind: "action",
        action: "save",
        explorerUrl: "https://explorer.test.mezo.org/tx/0xabc",
      });
    },
  );

  it("parses resize host messages", () => {
    expect(
      parseFuseWidgetMessage({
        source: FUSE_WIDGET_MESSAGE_SOURCE,
        version: 1,
        type: "resize",
        height: 720,
      }),
    ).toEqual({
      source: FUSE_WIDGET_MESSAGE_SOURCE,
      version: 1,
      type: "resize",
      height: 720,
    });
  });

  it("rejects malformed host messages", () => {
    const validAccount = {
      source: FUSE_WIDGET_MESSAGE_SOURCE,
      version: 1,
      type: "account",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 31611,
    };

    expect(parseFuseWidgetMessage(null)).toBeNull();
    expect(parseFuseWidgetMessage("not an object")).toBeNull();
    expect(
      parseFuseWidgetMessage({ ...validAccount, source: "other-widget" }),
    ).toBeNull();
    expect(parseFuseWidgetMessage({ ...validAccount, version: 2 })).toBeNull();
    expect(
      parseFuseWidgetMessage({
        source: FUSE_WIDGET_MESSAGE_SOURCE,
        version: 1,
        type: "tx_submitted",
        hash: "0x1234",
        kind: "action",
        action: "swap",
        explorerUrl: "https://explorer.test.mezo.org/tx/0x1234",
      }),
    ).toBeNull();
    expect(
      parseFuseWidgetMessage({ ...validAccount, address: "0x1234" }),
    ).toBeNull();
    expect(
      parseFuseWidgetMessage({
        source: FUSE_WIDGET_MESSAGE_SOURCE,
        version: 1,
        type: "resize",
        height: -1,
      }),
    ).toBeNull();
    expect(parseFuseWidgetMessage({ ...validAccount, extra: true })).toBeNull();
  });

  it("uses the replacement demo builders and retains retired wallets for history", () => {
    expect(DEFAULT_PAID_BUILDER_TESTNET).toBe(
      "0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283",
    );
    expect(DEFAULT_ZERO_FEE_BUILDER_TESTNET).toBe(
      "0x4FdA3C5A0E49B183900d155f7820E7E40BFA8A9F",
    );
    expect(FUSE_TEST_WALLETS).toContain(DEFAULT_PAID_BUILDER_TESTNET);
    expect(FUSE_TEST_WALLETS).toContain(DEFAULT_ZERO_FEE_BUILDER_TESTNET);
    expect(FUSE_TEST_WALLETS).toContain(RETIRED_PAID_BUILDER_TESTNET);
    expect(FUSE_TEST_WALLETS).toContain(RETIRED_ZERO_FEE_BUILDER_TESTNET);
  });

  it("calculates builder fees accurately within the 50 bps cap", () => {
    const amount = parseUnits("100", 18);

    const zero = calculateBuilderFee(amount, 0);
    expect(zero.feeAmount).toBe(0n);
    expect(zero.netAmount).toBe(amount);

    const fifteen = calculateBuilderFee(amount, 15);
    expect(fifteen.feeAmount).toBe(parseUnits("0.15", 18));
    expect(fifteen.netAmount).toBe(parseUnits("99.85", 18));

    const maxCap = calculateBuilderFee(amount, 50);
    expect(maxCap.feeAmount).toBe(parseUnits("0.5", 18));
    expect(maxCap.netAmount).toBe(parseUnits("99.5", 18));

    expect(() => calculateBuilderFee(amount, 51)).toThrow(/exceeds protocol cap/);
    expect(formatFeeBps(15)).toBe("0.15%");
    expect(formatFeeBps(0)).toBe("0.00%");
  });

  it("uses the Mezo Multicall3 deployment", () => {
    expect(MEZO_TESTNET_CHAIN.contracts?.multicall3?.address).toBe(
      "0xcA11bde05977b3631167028862bE2a173976CA11",
    );
    expect(MEZO_TESTNET_CHAIN.contracts?.multicall3?.blockCreated).toBe(3328573);
  });

  it("builds direct and two-hop routes for Mezo testnet token pairs", () => {
    const { btc, mezoToken, musd, poolFactory } = MEZO_TESTNET_ADDRESSES;

    expect(buildDefaultTigrisRoute(btc, musd)).toEqual([
      { from: btc, to: musd, stable: false, factory: poolFactory },
    ]);
    expect(buildDefaultTigrisRoute(musd, mezoToken)).toEqual([
      { from: musd, to: mezoToken, stable: false, factory: poolFactory },
    ]);
    expect(buildDefaultTigrisRoute(mezoToken, btc)).toEqual([
      { from: mezoToken, to: musd, stable: false, factory: poolFactory },
      { from: musd, to: btc, stable: false, factory: poolFactory },
    ]);
    expect(buildDefaultTigrisRoute(btc, mezoToken)).toEqual([
      { from: btc, to: musd, stable: false, factory: poolFactory },
      { from: musd, to: mezoToken, stable: false, factory: poolFactory },
    ]);
  });

  it("preflights routed quotes against router state and vault share previews", async () => {
    const amountIn = parseUnits("10", 18);
    const publicClient = {
      readContract: vi.fn().mockImplementation(
        async ({ functionName }: { functionName: string }) => {
          if (functionName === "builders") return [15, true, true, ""];
          if (functionName === "paused") return false;
          if (functionName === "allowedInput") return true;
          if (functionName === "getAmountsOut") return [amountIn, parseUnits("0.0001", 18)];
          if (functionName === "previewDeposit") return parseUnits("9.985", 18);
          if (functionName === "latestRoundData") return [1n, 81_000_00000000n, 0n, 0n, 0n];
          if (functionName === "decimals") return 8;
          throw new Error(`Unexpected read: ${functionName}`);
        },
      ),
    } as any;

    const swapQuote = await getSwapQuote({
      publicClient,
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      tokenIn: MEZO_TESTNET_ADDRESSES.btc,
      tokenOut: MEZO_TESTNET_ADDRESSES.musd,
      amountIn,
    });
    expect(swapQuote.expectedOut).toBe(parseUnits("0.0001", 18));

    const saveQuote = await getSaveQuote({
      publicClient,
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amountIn,
    });
    expect(saveQuote.sharesOut).toBe(parseUnits("9.985", 18));
    expect(saveQuote.sharesOutIsEstimated).toBe(false);
  });

  it("does not quote an action while the router is paused", async () => {
    const publicClient = {
      readContract: vi.fn().mockImplementation(
        async ({ functionName }: { functionName: string }) => {
          if (functionName === "builders") return [15, true, true, ""];
          if (functionName === "paused") return true;
          if (functionName === "allowedInput") return true;
          if (functionName === "latestRoundData") return [1n, 81_000_00000000n, 0n, 0n, 0n];
          if (functionName === "decimals") return 8;
          throw new Error(`Unexpected read: ${functionName}`);
        },
      ),
    } as any;

    await expect(
      getSwapQuote({
        publicClient,
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        tokenIn: MEZO_TESTNET_ADDRESSES.btc,
        tokenOut: MEZO_TESTNET_ADDRESSES.musd,
        amountIn: parseUnits("1", 18),
      }),
    ).rejects.toThrow("RouterPaused");
  });

  it("computes Thursday 00:00 UTC epoch-rounded VeBTC unlock times and enforces testnet presets", () => {
    expect(LOCK_DURATION_PRESETS).toHaveLength(4);
    expect(LOCK_DURATION_PRESETS[0].seconds).toBe(MIN_LOCK_DURATION_SECONDS);
    expect(LOCK_DURATION_PRESETS[3].seconds).toBe(TESTNET_MAX_LOCK_DURATION_SECONDS);

    const now = 1_761_264_000; // sample timestamp
    const unlock = previewVeBtcUnlockTime(MIN_LOCK_DURATION_SECONDS, now);
    expect(unlock % MIN_LOCK_DURATION_SECONDS).toBe(0);
    expect(unlock).toBeLessThanOrEqual(now + MIN_LOCK_DURATION_SECONDS);
    expect(unlock).toBeGreaterThan(now);
  });

  it("parses builder metadata URI and always marks names as self-reported", () => {
    const jsonMeta = parseBuilderMetadataURI(
      JSON.stringify({ name: "SatsPay Wallet", url: "https://satspay.example" }),
      DEFAULT_PAID_BUILDER_TESTNET,
    );
    expect(jsonMeta.name).toBe("SatsPay Wallet");
    expect(jsonMeta.url).toBe("https://satspay.example");
    expect(jsonMeta.selfReported).toBe(true);

    const urlMeta = parseBuilderMetadataURI(
      "https://fuse.mezo.org/builders/demo-paid.json?name=Fuse%20Demo%20Builder",
      DEFAULT_PAID_BUILDER_TESTNET,
    );
    expect(urlMeta.name).toBe("Fuse Demo Builder");
    expect(urlMeta.selfReported).toBe(true);

    const emptyMeta = parseBuilderMetadataURI("", DEFAULT_ZERO_FEE_BUILDER_TESTNET);
    expect(emptyMeta.name).toBe("Builder 0x4FdA...8A9F");
    expect(emptyMeta.selfReported).toBe(true);
  });

  it("detects Bitcoin Smart Account (OrangeKit) and Taproot addresses accurately", () => {
    expect(isBitcoinSmartAccountWallet({ type: "orangekit" })).toBe(true);
    expect(isBitcoinSmartAccountWallet({ networkFamily: "bitcoin" })).toBe(true);
    expect(isBitcoinSmartAccountWallet({ id: "xverseWalletMezoTestnet" })).toBe(true);
    expect(isBitcoinSmartAccountWallet({ type: "injected", networkFamily: "evm" })).toBe(false);

    expect(isTaprootAddress("tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxq92678z")).toBe(
      true,
    );
    expect(isTaprootAddress("bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr")).toBe(
      true,
    );
    expect(isTaprootAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx")).toBe(false);
  });

  it("decodes FuseRouter custom errors and wallet errors into human-readable messages", () => {
    const feeErrorHex = encodeErrorResult({
      abi: fuseRouterAbi,
      errorName: "FeeAboveUserApproval",
      args: [25, 15],
    });
    const decodedFeeErr = decodeFuseError(new Error(`Reverted with ${feeErrorHex}`));
    expect(decodedFeeErr.code).toBe("FEE_ABOVE_USER_APPROVAL");
    expect(decodedFeeErr.message).toContain("exceeds your approved maximum");

    const taprootErr = decodeFuseError(new Error("UnsupportedBitcoinAddressError: tb1p not supported"));
    expect(taprootErr.code).toBe("TAPROOT_UNSUPPORTED");
    expect(taprootErr.message).toContain("Native SegWit");

    const pausedErr = decodeFuseError(new Error("RouterPaused()"));
    expect(pausedErr.code).toBe("ROUTER_PAUSED");
  });

  it("estimates USD values from Skip BTC/USD oracle and formats currency", () => {
    const mockPrice = {
      roundId: 1n,
      priceRaw: 81_000_00000000n,
      decimals: 8,
      priceUsd: 81_000,
      formattedUsd: "$81,000.00",
      updatedAt: 1761264000,
    };

    const btcVal = estimateTokenUsdValue(
      MEZO_TESTNET_ADDRESSES.btc,
      parseUnits("0.01", 18),
      mockPrice,
    );
    expect(btcVal).toBeCloseTo(810, 2);
    expect(formatUsd(btcVal)).toBe("$810.00");

    const musdVal = estimateTokenUsdValue(
      MEZO_TESTNET_ADDRESSES.musd,
      parseUnits("25.5", 18),
      null,
    );
    expect(musdVal).toBeCloseTo(25.5, 2);
    expect(formatUsd(musdVal)).toBe("$25.50");

    // When oracle is unavailable, BTC USD value returns null without throwing
    expect(
      estimateTokenUsdValue(MEZO_TESTNET_ADDRESSES.btc, parseUnits("0.01", 18), null),
    ).toBeNull();
  });

  it("builds valid transaction payloads for all FuseRouter entrypoints", () => {
    const approveTx = buildApproveBuilderTx({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      maxFeeBps: 15,
    });
    expect(approveTx.to).toBe(MEZO_TESTNET_ADDRESSES.fuseRouter);
    expect(approveTx.data.startsWith("0x")).toBe(true);

    const revokeTx = buildRevokeBuilderTx({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
    });
    expect(revokeTx.to).toBe(MEZO_TESTNET_ADDRESSES.fuseRouter);

    const saveTx = buildSaveTx({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amount: parseUnits("10", 18),
    });
    expect(saveTx.to).toBe(MEZO_TESTNET_ADDRESSES.fuseRouter);

    const savePermitTx = buildSaveWithPermitTx({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amount: parseUnits("10", 18),
      permit: {
        deadline: 1800000000n,
        v: 27,
        r: "0x1111111111111111111111111111111111111111111111111111111111111111",
        s: "0x2222222222222222222222222222222222222222222222222222222222222222",
      },
    });
    expect(savePermitTx.to).toBe(MEZO_TESTNET_ADDRESSES.fuseRouter);

    const swapTx = buildSwapTx({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amountIn: parseUnits("10", 18),
      amountOutMin: parseUnits("0.0001", 18),
      routes: [
        {
          from: MEZO_TESTNET_ADDRESSES.musd,
          to: MEZO_TESTNET_ADDRESSES.btc,
          stable: false,
          factory: MEZO_TESTNET_ADDRESSES.poolFactory,
        },
      ],
      deadline: 1800000000n,
    });
    expect(swapTx.to).toBe(MEZO_TESTNET_ADDRESSES.fuseRouter);

    const swapPermitTx = buildSwapWithPermitTx({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amountIn: parseUnits("10", 18),
      amountOutMin: parseUnits("0.0001", 18),
      routes: [
        {
          from: MEZO_TESTNET_ADDRESSES.musd,
          to: MEZO_TESTNET_ADDRESSES.btc,
          stable: false,
          factory: MEZO_TESTNET_ADDRESSES.poolFactory,
        },
      ],
      deadline: 1800000000n,
      permit: {
        deadline: 1800000000n,
        v: 28,
        r: "0x1111111111111111111111111111111111111111111111111111111111111111",
        s: "0x2222222222222222222222222222222222222222222222222222222222222222",
      },
    });
    expect(swapPermitTx.to).toBe(MEZO_TESTNET_ADDRESSES.fuseRouter);

    const lockTx = buildLockTx({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amount: parseUnits("0.0001", 18),
      lockDurationSeconds: MIN_LOCK_DURATION_SECONDS,
    });
    expect(lockTx.to).toBe(MEZO_TESTNET_ADDRESSES.fuseRouter);
  });

  it("uses the deployed router max lock duration before submitting a lock", async () => {
    const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const amount = parseUnits("0.0001", 18);
    const maxLockDurationSeconds = 3_456_000n;
    const readContract = vi.fn().mockImplementation(
      async ({ functionName }: { functionName: string }) => {
        if (functionName === "maxLockDuration") return maxLockDurationSeconds;
        if (functionName === "allowance") return amount;
        return 0n;
      },
    );
    const sendTransaction = vi.fn().mockResolvedValue(txHash);
    const client = new FuseClient({
      publicClient: {
        readContract,
        call: vi.fn().mockResolvedValue({ data: "0x" }),
        estimateGas: vi.fn().mockResolvedValue(100_000n),
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      } as any,
      walletClient: {
        account: { address: "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0" },
        chain: null,
        sendTransaction,
      } as any,
    });

    const result = await client.executeLock({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amount,
      lockDurationSeconds: 3_000_000,
    });

    expect(result.txHash).toBe(txHash);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MEZO_TESTNET_ADDRESSES.fuseRouter,
        functionName: "maxLockDuration",
      }),
    );
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("automatically falls back to ERC-20 approve + save when signTypedData throws Unsupported method", async () => {
    const steps: string[] = [];
    const mockPublicClient = {
      readContract: vi.fn().mockImplementation(async ({ functionName }: { functionName: string }) => {
        if (functionName === "allowance") return 0n;
        if (functionName === "nonces") return 0n;
        return 0n;
      }),
      call: vi.fn().mockResolvedValue({ data: "0x" }),
      estimateGas: vi.fn().mockResolvedValue(200_000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
    } as any;

    const sendTxMock = vi
      .fn()
      .mockResolvedValueOnce("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      .mockResolvedValueOnce("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

    const mockWalletClient = {
      account: { address: "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0" },
      chain: null,
      signTypedData: vi.fn().mockRejectedValue(new Error("Unsupported method")),
      sendTransaction: sendTxMock,
    } as any;

    const client = new FuseClient({
      publicClient: mockPublicClient,
      walletClient: mockWalletClient,
    });

    const result = await client.executeSave({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amount: parseUnits("5", 18),
      onStep: (step) => steps.push(step),
    });

    expect(result.usedPermit).toBe(false);
    expect(result.approvalTxHash).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(result.txHash).toBe(
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    expect(steps).toContain("permit_fallback_to_approve");
    expect(steps).toContain("token_approval_pending");
    expect(steps).toContain("confirmed");
  });

  it("throws FuseTransactionRevertedError when a routed action receipt is reverted", async () => {
    const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const steps: string[] = [];
    const mockPublicClient = {
      readContract: vi.fn().mockResolvedValue(parseUnits("10", 18)),
      call: vi.fn().mockResolvedValue({ data: "0x" }),
      estimateGas: vi.fn().mockResolvedValue(200_000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "reverted" }),
    } as any;
    const mockWalletClient = {
      account: { address: "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0" },
      chain: null,
      sendTransaction: vi.fn().mockResolvedValue(txHash),
    } as any;
    const client = new FuseClient({
      publicClient: mockPublicClient,
      walletClient: mockWalletClient,
    });

    let thrown: unknown;
    try {
      await client.executeSave({
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        amount: parseUnits("5", 18),
        onStep: (step) => steps.push(step),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(FuseTransactionRevertedError);
    expect(thrown).toMatchObject({
      txHash,
      explorerUrl: expect.stringContaining(txHash),
      step: "save",
    });
    expect(decodeFuseError(thrown).message).toContain("Transaction reverted during save");
    expect(steps).not.toContain("confirmed");
  });

  it("uses per-action fallback gas limits as minimums for stale estimates", async () => {
    const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const lowEstimatePublicClient = {
      readContract: vi.fn().mockResolvedValue(parseUnits("10", 18)),
      call: vi.fn().mockResolvedValue({ data: "0x" }),
      estimateGas: vi.fn().mockResolvedValue(100_000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
    } as any;
    const sendTransaction = vi.fn().mockResolvedValue(txHash);
    const walletClient = {
      account: { address: "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0" },
      chain: null,
      sendTransaction,
    } as any;
    const client = new FuseClient({
      publicClient: lowEstimatePublicClient,
      walletClient,
    });

    await client.approveBuilder({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      maxFeeBps: 15,
    });
    await client.executeSave({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amount: parseUnits("5", 18),
    });

    expect(sendTransaction.mock.calls[0][0].gas).toBe(200_000n);
    expect(sendTransaction.mock.calls[1][0].gas).toBe(500_000n);

    const highEstimateClient = new FuseClient({
      publicClient: {
        call: vi.fn().mockResolvedValue({ data: "0x" }),
        estimateGas: vi.fn().mockResolvedValue(1_000_000n),
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      } as any,
      walletClient,
    });
    await highEstimateClient.approveBuilder({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      maxFeeBps: 15,
    });
    expect(sendTransaction.mock.calls[2][0].gas).toBe(1_250_000n);
  });

  it("does not submit a transaction when gas estimation reports an execution revert", async () => {
    const revert = new Error("execution reverted: BuilderNotRegistered");
    const mockPublicClient = {
      call: vi.fn().mockResolvedValue({ data: "0x" }),
      estimateGas: vi.fn().mockRejectedValue(revert),
      waitForTransactionReceipt: vi.fn(),
    } as any;
    const sendTransaction = vi.fn();
    const mockWalletClient = {
      account: { address: "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0" },
      chain: null,
      sendTransaction,
    } as any;
    const client = new FuseClient({
      publicClient: mockPublicClient,
      walletClient: mockWalletClient,
    });

    await expect(
      client.approveBuilder({
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        maxFeeBps: 15,
      }),
    ).rejects.toBe(revert);
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it("simulates before estimating gas and decodes router errors from viem call failures", async () => {
    const account =
      "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0" as Address;
    const revertData = encodeErrorResult({
      abi: fuseRouterAbi,
      errorName: "BuilderNotRegistered",
    });
    const callArguments = {
      account,
      to: MEZO_TESTNET_ADDRESSES.fuseRouter,
      data: "0x1234" as const,
    };
    const rawContractRevert = new CallExecutionError(
      new RawContractError({ data: revertData }),
      callArguments,
    );
    const rpcRevert = new CallExecutionError(
      new ExecutionRevertedError({
        cause: Object.assign(new Error("execution reverted"), {
          data: revertData,
        }) as any,
        message: "execution reverted",
      }),
      callArguments,
    );

    for (const revert of [rawContractRevert, rpcRevert]) {
      const sendTransaction = vi.fn();
      const estimateGas = vi.fn();
      const client = new FuseClient({
        publicClient: {
          call: vi.fn().mockRejectedValue(revert),
          estimateGas,
        } as any,
        walletClient: {
          account: { address: account },
          sendTransaction,
        } as any,
        addresses: MEZO_TESTNET_ADDRESSES,
      });

      await expect(
        client.approveBuilder({
          builder: DEFAULT_PAID_BUILDER_TESTNET,
          maxFeeBps: 15,
        }),
      ).rejects.toBe(revert);
      expect(sendTransaction).not.toHaveBeenCalled();
      expect(estimateGas).not.toHaveBeenCalled();
      expect(decodeFuseError(revert).code).toBe("BUILDER_NOT_REGISTERED");
    }
  });

  it("decodes Tigris no-argument slippage reverts from viem errors", () => {
    const account =
      "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0" as Address;
    const callArguments = {
      account,
      to: MEZO_TESTNET_ADDRESSES.fuseRouter,
      data: "0x1234" as const,
    };
    const tigrisRevertData = "0x42301c23";
    expect(
      encodeErrorResult({
        abi: tigrisRouterErrorsAbi,
        errorName: "InsufficientOutputAmount",
      }),
    ).toBe(tigrisRevertData);

    const tigrisRevert = new CallExecutionError(
      new ExecutionRevertedError({
        cause: Object.assign(new Error("execution reverted"), {
          data: tigrisRevertData,
        }) as any,
        message: "execution reverted",
      }),
      callArguments,
    );
    expect(decodeFuseError(tigrisRevert).code).toBe("SLIPPAGE_EXCEEDED");
  });

  it("decodes the FuseRouter slippage revert selector", () => {
    const account =
      "0xB3d77D3058ee580bD28ba9C4b69281424f7E7F0" as Address;
    const callArguments = {
      account,
      to: MEZO_TESTNET_ADDRESSES.fuseRouter,
      data: "0x1234" as const,
    };
    const fuseRouterRevertData = encodeErrorResult({
      abi: fuseRouterAbi,
      errorName: "InsufficientOutputAmount",
      args: [parseUnits("1", 18), parseUnits("2", 18)],
    });
    expect(fuseRouterRevertData.slice(0, 10)).toBe("0xd28d3eb5");
    const fuseRouterRevert = new CallExecutionError(
      new RawContractError({ data: fuseRouterRevertData }),
      callArguments,
    );
    expect(decodeFuseError(fuseRouterRevert).code).toBe("SLIPPAGE_EXCEEDED");
  });

  it("does not send when transaction simulation is unavailable", async () => {
    const sendTransaction = vi.fn();
    const estimateGas = vi.fn();
    const client = new FuseClient({
      publicClient: {
        call: vi.fn().mockRejectedValue(new Error("RPC unavailable")),
        estimateGas,
      } as any,
      walletClient: {
        account: {
          address: "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0",
        },
        sendTransaction,
      } as any,
      addresses: MEZO_TESTNET_ADDRESSES,
    });

    let thrown: unknown;
    try {
      await client.approveBuilder({
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        maxFeeBps: 15,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(FuseSimulationUnavailableError);
    expect(decodeFuseError(thrown)).toMatchObject({
      code: "SIMULATION_UNAVAILABLE",
      message:
        "We couldn't check this transaction before opening your wallet. Nothing was sent. Try again.",
    });
    expect(sendTransaction).not.toHaveBeenCalled();
    expect(estimateGas).not.toHaveBeenCalled();
  });

  it("uses fallback gas when simulation succeeds but gas estimation fails", async () => {
    const sendTransaction = vi.fn().mockResolvedValue(`0x${"a".repeat(64)}`);
    const client = new FuseClient({
      publicClient: {
        call: vi.fn().mockResolvedValue({ data: "0x" }),
        estimateGas: vi.fn().mockRejectedValue(new Error("RPC unavailable")),
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      } as any,
      walletClient: {
        account: "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0",
        sendTransaction,
      } as any,
      addresses: MEZO_TESTNET_ADDRESSES,
    });

    await client.approveBuilder({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      maxFeeBps: 15,
    });

    expect(sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ gas: 200_000n }),
    );
  });

  it("reports approval and action transaction hashes before waiting for receipts", async () => {
    const approvalHash = `0x${"a".repeat(64)}` as const;
    const actionHash = `0x${"b".repeat(64)}` as const;
    const submitted: Array<{
      hash: string;
      kind: string;
      explorerUrl: string;
    }> = [];
    const submissionKindsAtReceiptWait: string[][] = [];
    let sendCount = 0;
    const client = new FuseClient({
      publicClient: {
        readContract: vi.fn().mockResolvedValue(0n),
        call: vi.fn().mockResolvedValue({ data: "0x" }),
        estimateGas: vi.fn().mockResolvedValue(200_000n),
        waitForTransactionReceipt: vi.fn(async () => {
          submissionKindsAtReceiptWait.push(submitted.map(({ kind }) => kind));
          return { status: "success" };
        }),
      } as any,
      walletClient: {
        account: {
          address: "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0",
        },
        sendTransaction: vi.fn(async () => {
          sendCount += 1;
          return sendCount === 1 ? approvalHash : actionHash;
        }),
      } as any,
      addresses: MEZO_TESTNET_ADDRESSES,
    });

    await client.executeSave({
      builder: DEFAULT_PAID_BUILDER_TESTNET,
      amount: parseUnits("1", 18),
      mode: "approve",
      onTransactionSubmitted: ({ hash, kind, explorerUrl }) =>
        submitted.push({ hash, kind, explorerUrl }),
    });

    expect(submitted).toEqual([
      {
        hash: approvalHash,
        kind: "token_approval",
        explorerUrl: `https://explorer.test.mezo.org/tx/${approvalHash}`,
      },
      {
        hash: actionHash,
        kind: "action",
        explorerUrl: `https://explorer.test.mezo.org/tx/${actionHash}`,
      },
    ]);
    expect(submissionKindsAtReceiptWait).toEqual([
      ["token_approval"],
      ["token_approval", "action"],
    ]);
  });

  it("excludes leaderboard self-referrals and flags Fuse test wallets", async () => {
    const testWallet = "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0";
    const eventLog = (
      builder: string,
      user: string,
      action: number,
      amountIn: bigint,
      fee: bigint,
      logIndex: number,
    ) => ({
      transactionHash: `0x${logIndex.toString(16).padStart(64, "0")}`,
      blockNumber: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
      logIndex,
      args: {
        builder,
        user,
        action,
        tokenIn: MEZO_TESTNET_ADDRESSES.musd,
        amountIn,
        fee,
        tokenOut: MEZO_TESTNET_ADDRESSES.btc,
        amountOut: amountIn,
        lockId: 0n,
      },
    });
    const mockPublicClient = {
      getLogs: vi.fn().mockImplementation(({ event }: { event: { name: string } }) =>
        event.name === "BuilderRegistered"
          ? [
              {
                args: {
                  builder: DEFAULT_PAID_BUILDER_TESTNET,
                  feeBps: 15,
                  metadataURI: "",
                },
              },
              {
                args: { builder: testWallet, feeBps: 0, metadataURI: "" },
              },
            ]
          : [
              eventLog(
                DEFAULT_PAID_BUILDER_TESTNET,
                DEFAULT_ZERO_FEE_BUILDER_TESTNET,
                1,
                parseUnits("10", 18),
                parseUnits("0.1", 18),
                0,
              ),
              eventLog(
                DEFAULT_PAID_BUILDER_TESTNET,
                DEFAULT_PAID_BUILDER_TESTNET,
                0,
                parseUnits("100", 18),
                parseUnits("1", 18),
                1,
              ),
              eventLog(
                testWallet,
                DEFAULT_ZERO_FEE_BUILDER_TESTNET,
                0,
                parseUnits("2", 18),
                0n,
                2,
              ),
              eventLog(
                DEFAULT_PAID_BUILDER_TESTNET,
                DEFAULT_ZERO_FEE_BUILDER_TESTNET,
                7,
                parseUnits("50", 18),
                0n,
                3,
              ),
            ],
      ),
      readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "builders") return [15n, true, true, ""];
        return Promise.reject(new Error("Oracle unavailable"));
      }),
    } as any;

    const snapshot = await getLeaderboardSnapshot({
      publicClient: mockPublicClient,
      router: MEZO_TESTNET_ADDRESSES.fuseRouter,
      fromBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
      toBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
    });

    const paidBuilder = snapshot.builders.find(
      (row) => row.builder.toLowerCase() === DEFAULT_PAID_BUILDER_TESTNET.toLowerCase(),
    );
    const testBuilder = snapshot.builders.find(
      (row) => row.builder.toLowerCase() === testWallet.toLowerCase(),
    );

    expect(snapshot.sortBy).toBe("users");
    expect(snapshot.totals.totalActions).toBe(2);
    expect(snapshot.totals.uniqueUsers).toBe(1);
    expect(snapshot.totals.excludedSelfReferralActions).toBe(1);
    expect(paidBuilder).toMatchObject({
      uniqueUsers: 1,
      actionCount: 1,
      selfReferralActionCount: 1,
      registeredOnCurrentRouter: true,
      isFuseTestBuilder: true,
      actionCounts: { swap: 0, save: 1, lock: 0 },
      volumeByToken: { MUSD: { rawWei: parseUnits("10", 18).toString() } },
      feesByToken: { MUSD: { rawWei: parseUnits("0.1", 18).toString() } },
    });
    expect(testBuilder?.isFuseTestBuilder).toBe(true);
    expect(FUSE_TEST_WALLETS).toContain(DEFAULT_PAID_BUILDER_TESTNET);
  });

  it("skips routed logs with unknown action codes", async () => {
    const mockPublicClient = {
      getLogs: vi.fn().mockResolvedValue([
        {
          transactionHash: `0x${"1".repeat(64)}`,
          blockNumber: 100n,
          logIndex: 0,
          args: {
            builder: DEFAULT_PAID_BUILDER_TESTNET,
            user: DEFAULT_ZERO_FEE_BUILDER_TESTNET,
            action: 8,
            tokenIn: MEZO_TESTNET_ADDRESSES.musd,
            amountIn: 1n,
            fee: 0n,
            tokenOut: MEZO_TESTNET_ADDRESSES.btc,
            amountOut: 1n,
            lockId: 0n,
          },
        },
      ]),
    } as any;

    expect(mapActionCodeToType(8)).toBeNull();
    await expect(
      getRoutedEvents({
        publicClient: mockPublicClient,
        router: MEZO_TESTNET_ADDRESSES.fuseRouter,
        fromBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
        toBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
      }),
    ).resolves.toEqual([]);
  });

  it("merges routed events across deployments, sorts and tags them, and clamps scan starts", async () => {
    const legacyDeployment = MEZO_TESTNET_ADDRESSES.fuseRouterDeployments.find(
      (deployment) => deployment.label === "legacy",
    )!;
    const currentDeployment = MEZO_TESTNET_ADDRESSES.fuseRouterDeployments.find(
      (deployment) => deployment.label === "current",
    )!;
    const addresses = {
      ...MEZO_TESTNET_ADDRESSES,
      fuseRouterDeployBlock: 105n,
      fuseRouterDeployments: [
        { ...legacyDeployment, deployBlock: 100n },
        { ...currentDeployment, deployBlock: 105n },
      ],
    };
    const makeLog = (blockNumber: bigint, logIndex: number) => ({
      transactionHash: `0x${logIndex.toString(16).padStart(64, "0")}`,
      blockNumber,
      logIndex,
      args: {
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        user: DEFAULT_ZERO_FEE_BUILDER_TESTNET,
        action: 1,
        tokenIn: MEZO_TESTNET_ADDRESSES.musd,
        amountIn: 1n,
        fee: 0n,
        tokenOut: MEZO_TESTNET_ADDRESSES.btc,
        amountOut: 1n,
        lockId: 0n,
      },
    });
    const getLogs = vi.fn().mockImplementation(({ address }: { address: string }) =>
      address.toLowerCase() === legacyDeployment.address.toLowerCase()
        ? [makeLog(107n, 1), makeLog(105n, 2)]
        : [makeLog(105n, 1), makeLog(106n, 0)],
    );
    const publicClient = { getLogs } as any;

    const events = await getRoutedEvents({
      publicClient,
      addresses,
      fromBlock: 90n,
      toBlock: 110n,
      chunkSize: 20_000n,
    });

    expect(getLogs).toHaveBeenCalledTimes(2);
    expect(getLogs.mock.calls.map(([params]) => [params.address, params.fromBlock])).toEqual([
      [legacyDeployment.address, 100n],
      [currentDeployment.address, 105n],
    ]);
    expect(
      getLogs.mock.calls.every(
        ([params]) =>
          BigInt(params.toBlock) - BigInt(params.fromBlock) + 1n <= 10_000n,
      ),
    ).toBe(true);
    expect(events.map((event) => [event.blockNumber, event.logIndex, event.router])).toEqual([
      [105n, 1, currentDeployment.address],
      [105n, 2, legacyDeployment.address],
      [106n, 0, currentDeployment.address],
      [107n, 1, legacyDeployment.address],
    ]);

    getLogs.mockClear();
    await getRoutedEvents({
      publicClient,
      addresses,
      router: currentDeployment.address,
      fromBlock: 90n,
      toBlock: 110n,
    });
    expect(getLogs).toHaveBeenCalledTimes(1);
    expect(getLogs.mock.calls[0][0].address).toBe(currentDeployment.address);
  });

  it("uses a legacy builder configuration when the current router has no registration", async () => {
    const legacyDeployment = MEZO_TESTNET_ADDRESSES.fuseRouterDeployments.find(
      (deployment) => deployment.label === "legacy",
    )!;
    const eventLog = {
      transactionHash: `0x${"2".repeat(64)}`,
      blockNumber: legacyDeployment.deployBlock,
      logIndex: 0,
      args: {
        builder: LEGACY_PAID_BUILDER_TESTNET,
        user: DEFAULT_ZERO_FEE_BUILDER_TESTNET,
        action: 1,
        tokenIn: MEZO_TESTNET_ADDRESSES.musd,
        amountIn: parseUnits("1", 18),
        fee: parseUnits("0.015", 18),
        tokenOut: MEZO_TESTNET_ADDRESSES.btc,
        amountOut: 1n,
        lockId: 0n,
      },
    };
    const readContract = vi.fn().mockImplementation(
      ({
        address,
        functionName,
      }: {
        address: string;
        functionName: string;
      }) => {
        if (functionName === "builders") {
          return address.toLowerCase() ===
            MEZO_TESTNET_ADDRESSES.fuseRouter.toLowerCase()
            ? [0n, false, false, ""]
            : [15n, true, true, "ipfs://legacy-builder"];
        }
        if (functionName === "latestRoundData") {
          return [1n, 100_000_000n, 0n, BigInt(Math.floor(Date.now() / 1000))];
        }
        if (functionName === "decimals") return 8;
        return Promise.reject(new Error(`Unexpected read: ${functionName}`));
      },
    );
    const getLogs = vi.fn().mockImplementation(
      ({
        address,
        event,
        fromBlock,
        toBlock,
      }: {
        address: string;
        event: { name: string };
        fromBlock: bigint;
        toBlock: bigint;
      }) => {
        const legacyAddress =
          address.toLowerCase() === legacyDeployment.address.toLowerCase();
        if (
          legacyAddress &&
          event.name !== "BuilderRegistered" &&
          fromBlock <= eventLog.blockNumber &&
          toBlock >= eventLog.blockNumber
        ) {
          return [eventLog];
        }
        if (
          legacyAddress &&
          event.name === "BuilderRegistered" &&
          fromBlock <= legacyDeployment.deployBlock &&
          toBlock >= legacyDeployment.deployBlock
        ) {
          return [{ args: { builder: LEGACY_PAID_BUILDER_TESTNET } }];
        }
        return [];
      },
    );
    const snapshot = await getLeaderboardSnapshot({
      publicClient: {
        getLogs,
        readContract,
        getBlockNumber: vi.fn().mockResolvedValue(
          MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock + 10n,
        ),
      } as any,
      toBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock + 10n,
    });

    const legacyBuilder = snapshot.builders.find(
      (row) => row.builder.toLowerCase() === LEGACY_PAID_BUILDER_TESTNET.toLowerCase(),
    );
    expect(legacyBuilder).toMatchObject({
      registered: true,
      registeredOnCurrentRouter: false,
      active: true,
      feeBps: 15,
    });
    expect(snapshot.routerAddress).toBe(MEZO_TESTNET_ADDRESSES.fuseRouter);
    expect(snapshot.routerDeployments).toEqual(
      MEZO_TESTNET_ADDRESSES.fuseRouterDeployments.map((deployment) => ({
        address: deployment.address,
        deployBlock: deployment.deployBlock.toString(),
        label: deployment.label,
      })),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MEZO_TESTNET_ADDRESSES.fuseRouter,
        functionName: "builders",
      }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: legacyDeployment.address,
        functionName: "builders",
      }),
    );
  });

  it("uses only the selected router for builder configuration and snapshot metadata", async () => {
    const legacyDeployment = MEZO_TESTNET_ADDRESSES.fuseRouterDeployments.find(
      (deployment) => deployment.label === "legacy",
    )!;
    const legacyRouterLowercase = legacyDeployment.address.toLowerCase() as Address;
    const builder = LEGACY_PAID_BUILDER_TESTNET;
    const readContract = vi.fn().mockImplementation(
      ({ address, functionName }: { address: string; functionName: string }) => {
        if (functionName === "builders") {
          return address.toLowerCase() === legacyDeployment.address.toLowerCase()
            ? [15n, true, true, "ipfs://legacy-builder"]
            : [0n, false, false, ""];
        }
        if (functionName === "latestRoundData") {
          return [1n, 100_000_000n, 0n, BigInt(Math.floor(Date.now() / 1000))];
        }
        if (functionName === "decimals") return 8;
        return Promise.reject(new Error(`Unexpected read: ${functionName}`));
      },
    );
    const getLogs = vi.fn().mockImplementation(({ event }: { event: { name: string } }) =>
      event.name === "BuilderRegistered" ? [{ args: { builder } }] : [],
    );
    const publicClient = {
      getLogs,
      readContract,
      getBlockNumber: vi.fn().mockResolvedValue(legacyDeployment.deployBlock),
    } as any;

    const snapshot = await getLeaderboardSnapshot({
      publicClient,
      router: legacyRouterLowercase,
      fromBlock: legacyDeployment.deployBlock,
      toBlock: legacyDeployment.deployBlock,
    });

    expect(snapshot.routerAddress).toBe(getAddress(legacyDeployment.address));
    expect(snapshot.routerDeployments).toEqual([
      {
        address: getAddress(legacyDeployment.address),
        deployBlock: legacyDeployment.deployBlock.toString(),
        label: "legacy",
      },
    ]);
    expect(getLogs.mock.calls.every(([params]) => params.address === legacyDeployment.address)).toBe(
      true,
    );
    expect(snapshot.builders.find((row) => row.builder === builder)).toMatchObject({
      feeBps: 15,
      registeredOnCurrentRouter: false,
    });

    readContract.mockClear();
    await getBuilderAnalytics({
      publicClient,
      builder,
      router: legacyDeployment.address,
      fromBlock: legacyDeployment.deployBlock,
      toBlock: legacyDeployment.deployBlock,
    });
    expect(
      readContract.mock.calls
        .filter(([params]) => params.functionName === "builders")
        .map(([params]) => params.address),
    ).toEqual([legacyDeployment.address]);
  });

  it("uses fromBlock for unlisted explicit routers in event and registration scans", async () => {
    const router = "0x000000000000000000000000000000000000dEaD";
    const fromBlock = 123n;
    const getLogs = vi.fn().mockResolvedValue([]);
    await getRoutedEvents({
      publicClient: { getLogs } as any,
      router,
      toBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
    });
    expect(getLogs.mock.calls[0][0]).toMatchObject({
      address: router,
      fromBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
    });

    const builder = DEFAULT_PAID_BUILDER_TESTNET;
    getLogs.mockImplementation(({ event }: { event: { name: string } }) =>
      event.name === "BuilderRegistered" ? [{ args: { builder } }] : [],
    );
    const readContract = vi.fn().mockImplementation(
      ({ address, functionName }: { address: string; functionName: string }) => {
        if (functionName === "builders") {
          return address.toLowerCase() === router.toLowerCase()
            ? [15n, true, true, "ipfs://custom-router-builder"]
            : [0n, false, false, ""];
        }
        if (functionName === "latestRoundData") {
          return [1n, 100_000_000n, 0n, BigInt(Math.floor(Date.now() / 1000))];
        }
        if (functionName === "decimals") return 8;
        return Promise.reject(new Error(`Unexpected read: ${functionName}`));
      },
    );
    getLogs.mockClear();
    const publicClient = {
      getLogs,
      readContract,
      getBlockNumber: vi.fn().mockResolvedValue(fromBlock + 1n),
    } as any;

    const snapshot = await getLeaderboardSnapshot({
      publicClient,
      router,
      fromBlock,
      toBlock: fromBlock + 1n,
    });

    expect(getLogs).toHaveBeenCalledTimes(2);
    expect(
      getLogs.mock.calls.every(
        ([params]) =>
          params.address === getAddress(router) &&
          params.fromBlock === fromBlock &&
          params.toBlock === fromBlock + 1n,
      ),
    ).toBe(true);
    expect(snapshot.routerAddress).toBe(getAddress(router));
    expect(snapshot.routerDeployments).toEqual([
      {
        address: getAddress(router),
        deployBlock: fromBlock.toString(),
        label: "current",
      },
    ]);

    getLogs.mockClear();
    await getLeaderboardSnapshot({
      publicClient,
      router,
      toBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
    });
    expect(
      getLogs.mock.calls.every(
        ([params]) =>
          params.address === getAddress(router) &&
          params.fromBlock === MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
      ),
    ).toBe(true);
  });

  it("builds and encodes MUSD x402 v2 payment required headers accurately", () => {
    const { paymentRequired, paymentRequirements, headerValue } = buildX402PaymentRequired({
      resourceUrl: "https://fuse.mezo.org/api/analytics/0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a",
      payTo: DEFAULT_PAID_BUILDER_TESTNET,
    });

    expect(paymentRequired.x402Version).toBe(2);
    expect(paymentRequirements.network).toBe("eip155:31611");
    expect(paymentRequirements.asset).toBe(MEZO_TESTNET_ADDRESSES.musd);
    expect(paymentRequirements.extra.assetTransferMethod).toBe("permit2");
    expect(paymentRequired.extensions.eip2612GasSponsoring).toBeDefined();

    const decoded = decodeX402Header<typeof paymentRequired>(headerValue);
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts[0].payTo).toBe(DEFAULT_PAID_BUILDER_TESTNET);
    expect(encodeX402Header(decoded)).toBe(headerValue);
  });

  it("verifies x402 payments separately from settlement using matching facilitator bodies", async () => {
    const { paymentRequirements } = buildX402PaymentRequired({
      resourceUrl: "https://fuse.mezo.org/api/analytics/0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a",
      payTo: DEFAULT_PAID_BUILDER_TESTNET,
    });
    const paymentPayload = {
      x402Version: 2,
      accepted: paymentRequirements,
      payload: {
        signature: "0x",
        permit2Authorization: {},
      },
    } as unknown as X402PaymentPayload;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isValid: true, payer: DEFAULT_ZERO_FEE_BUILDER_TESTNET }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          payer: DEFAULT_ZERO_FEE_BUILDER_TESTNET,
          transaction: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          network: "eip155:31611",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const params = {
      paymentPayload,
      paymentRequirements,
      facilitatorUrl: "https://facilitator.example/",
    };
    const verifyResult = await verifyX402Payment(params);
    expect(verifyResult.isValid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://facilitator.example/verify");

    const settlement = await settleX402Payment(params);
    expect(settlement.settleResult.success).toBe(true);
    expect(settlement.paymentResponseHeader).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://facilitator.example/settle");
    expect(fetchMock.mock.calls[0][1]?.body).toBe(fetchMock.mock.calls[1][1]?.body);

    vi.unstubAllGlobals();
  });

  it("keeps verifyAndSettleX402Payment as a verify-then-settle wrapper", async () => {
    const { paymentRequirements } = buildX402PaymentRequired({
      resourceUrl: "https://fuse.mezo.org/api/analytics/0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a",
      payTo: DEFAULT_PAID_BUILDER_TESTNET,
    });
    const paymentPayload = {
      x402Version: 2,
      accepted: paymentRequirements,
      payload: { signature: "0x", permit2Authorization: {} },
    } as unknown as X402PaymentPayload;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ isValid: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          network: "eip155:31611",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyAndSettleX402Payment({
      paymentPayload,
      paymentRequirements,
      facilitatorUrl: "https://facilitator.example",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.verifyResult.isValid).toBe(true);
    expect(result.settleResult.success).toBe(true);
    expect(result.paymentResponseHeader).toBeTruthy();

    vi.unstubAllGlobals();
  });
});
