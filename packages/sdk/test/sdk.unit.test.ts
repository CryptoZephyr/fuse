import { describe, expect, it, vi } from "vitest";
import { encodeErrorResult, parseUnits } from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  FuseClient,
  LOCK_DURATION_PRESETS,
  MEZO_TESTNET_ADDRESSES,
  MIN_LOCK_DURATION_SECONDS,
  TESTNET_MAX_LOCK_DURATION_SECONDS,
  buildApproveBuilderTx,
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
  fuseRouterAbi,
  isBitcoinSmartAccountWallet,
  isTaprootAddress,
  parseBuilderMetadataURI,
  previewVeBtcUnlockTime,
} from "../src/index.js";

describe("@fuse/sdk unit tests", () => {
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
    expect(emptyMeta.name).toContain("Builder 0x637A");
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

  it("automatically falls back to ERC-20 approve + save when signTypedData throws Unsupported method", async () => {
    const steps: string[] = [];
    const mockPublicClient = {
      readContract: vi.fn().mockImplementation(async ({ functionName }: { functionName: string }) => {
        if (functionName === "allowance") return 0n;
        if (functionName === "nonces") return 0n;
        return 0n;
      }),
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
});
