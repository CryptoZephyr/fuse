import { describe, expect, it } from "vitest";
import { createPublicClient, http, parseUnits } from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  FuseClient,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_RPC_URL,
  MIN_LOCK_DURATION_SECONDS,
  getBuilderAnalytics,
  getLeaderboardSnapshot,
} from "../src/index.js";

describe("@fuse/sdk live Mezo Testnet integration tests", () => {
  const publicClient = createPublicClient({
    chain: MEZO_TESTNET_CHAIN,
    transport: http(MEZO_TESTNET_RPC_URL, { timeout: 20_000 }),
  });

  const fuse = new FuseClient({ publicClient });

  it("reads live Skip BTC/USD oracle price on Mezo Testnet (31611)", async () => {
    const price = await fuse.getBtcUsdPrice();
    expect(price).not.toBeNull();
    expect([8, 18]).toContain(price!.decimals);
    expect(price!.priceUsd).toBeGreaterThan(10_000);
    expect(price!.formattedUsd).toMatch(/^\$/);
  }, 20_000);

  it("reads live builder statuses for paid (15 bps) and zero-fee (0 bps) builders", async () => {
    const [paidStatus, zeroStatus] = await Promise.all([
      fuse.getBuilderStatus(
        DEFAULT_PAID_BUILDER_TESTNET,
        "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0",
      ),
      fuse.getBuilderStatus(
        DEFAULT_ZERO_FEE_BUILDER_TESTNET,
        "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0",
      ),
    ]);

    expect(paidStatus.registered).toBe(true);
    expect(paidStatus.active).toBe(true);
    expect(paidStatus.feeBps).toBe(15);
    expect(paidStatus.feePercentFormatted).toBe("0.15%");
    expect(paidStatus.metadata.selfReported).toBe(true);

    expect(zeroStatus.registered).toBe(true);
    expect(zeroStatus.active).toBe(true);
    expect(zeroStatus.feeBps).toBe(0);
    expect(zeroStatus.feePercentFormatted).toBe("0.00%");
    expect(zeroStatus.userApproved).toBe(true);
  }, 20_000);

  it("computes live swap, save, and lock quotes with Skip BTC/USD dollar estimates", async () => {
    const [swapQuote, saveQuote, lockQuote] = await Promise.all([
      fuse.getSwapQuote({
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        tokenIn: MEZO_TESTNET_ADDRESSES.btc,
        tokenOut: MEZO_TESTNET_ADDRESSES.musd,
        amountIn: parseUnits("0.001", 18),
        slippageBps: 50,
      }),
      fuse.getSaveQuote({
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        amountIn: parseUnits("10", 18),
      }),
      fuse.getLockQuote({
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        amountIn: parseUnits("0.0001", 18),
        lockDurationSeconds: MIN_LOCK_DURATION_SECONDS,
      }),
    ]);

    expect(swapQuote.feeBps).toBe(15);
    expect(swapQuote.expectedOut).toBeGreaterThan(0n);
    expect(swapQuote.amountOutMin).toBeLessThan(swapQuote.expectedOut);
    expect(swapQuote.amountInUsd).toBeGreaterThan(10);

    expect(saveQuote.feeBps).toBe(15);
    expect(saveQuote.sharesOut).toBe(parseUnits("9.985", 18));
    expect(saveQuote.amountInUsd).toBeCloseTo(10, 2);

    expect(lockQuote.feeBps).toBe(15);
    expect(lockQuote.unlockTimestamp % MIN_LOCK_DURATION_SECONDS).toBe(0);
    expect(lockQuote.maxLockDurationSeconds).toBe(2_592_000);
    expect(lockQuote.estimatedVotingPower).toBeGreaterThan(0n);
  }, 25_000);

  it("queries real on-chain Routed events emitted by FuseRouter since deploy block 16328764", async () => {
    const events = await fuse.getRoutedEvents({
      fromBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
      toBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock + 600n,
    });

    expect(events.length).toBeGreaterThanOrEqual(6);
    const actions = new Set(events.map((e) => e.action));
    expect(actions.has("swap")).toBe(true);
    expect(actions.has("save")).toBe(true);
    expect(actions.has("lock")).toBe(true);
  }, 25_000);

  it("aggregates live leaderboard snapshot and per-builder analytics with Skip BTC/USD valuation", async () => {
    const [leaderboard, analytics] = await Promise.all([
      getLeaderboardSnapshot({
        publicClient,
        fromBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
        toBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock + 1000n,
      }),
      getBuilderAnalytics({
        publicClient,
        builder: DEFAULT_PAID_BUILDER_TESTNET,
        fromBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock,
        toBlock: MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock + 1000n,
      }),
    ]);

    expect(leaderboard.builders.length).toBeGreaterThanOrEqual(2);
    expect(leaderboard.totals.totalActions).toBeGreaterThanOrEqual(6);
    expect(leaderboard.btcUsdOracle).not.toBeNull();
    expect(leaderboard.builders[0].selfReported).toBe(true);

    expect(analytics.builder).toBe(DEFAULT_PAID_BUILDER_TESTNET);
    expect(analytics.registered).toBe(true);
    expect(analytics.feeBps).toBe(15);
    expect(analytics.summary.totalActions).toBeGreaterThanOrEqual(5);
    expect(analytics.events.length).toBeGreaterThanOrEqual(5);
  }, 30_000);
});
