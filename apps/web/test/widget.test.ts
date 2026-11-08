import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  LOCK_DURATION_PRESETS,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN_ID,
  calculateBuilderFee,
  decodeFuseError,
  formatFeeBps,
  isBitcoinSmartAccountWallet,
  isTaprootAddress,
  parseBuilderMetadataURI,
} from "mezo-fuse";
import { maxSpendable } from "../src/lib/gasReserve";

describe("@fuse/web widget contract & constraint verification", () => {
  it("keeps BTC max spendable above the gas reserve", () => {
    expect(maxSpendable(100n, 101n)).toBe(0n);
    expect(maxSpendable(500n, 100n)).toBe(400n);
  });

  it("enforces DESIGN_SYSTEM.md and FRONTEND.md builder self-reported metadata constraint", () => {
    const meta = parseBuilderMetadataURI(
      "https://fuse.mezo.org/builders/demo-paid.json",
      DEFAULT_PAID_BUILDER_TESTNET,
    );
    expect(meta.selfReported).toBe(true);
    expect(formatFeeBps(15)).toBe("0.15%");
    expect(formatFeeBps(0)).toBe("0.00%");
  });

  it("enforces Mezo Testnet (31611) lock duration presets (1w to 30d)", () => {
    expect(MEZO_TESTNET_CHAIN_ID).toBe(31611);
    expect(LOCK_DURATION_PRESETS.map((p) => p.days)).toEqual([7, 14, 21, 30]);
    expect(MEZO_TESTNET_ADDRESSES.fuseRouter).toBe(
      "0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4",
    );
    expect(DEFAULT_ZERO_FEE_BUILDER_TESTNET).toBe(
      "0x4FdA3C5A0E49B183900d155f7820E7E40BFA8A9F",
    );
    expect(DEFAULT_PAID_BUILDER_TESTNET).toBe(
      "0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283",
    );
  });

  it("detects Taproot P2TR addresses and OrangeKit Bitcoin smart accounts", () => {
    expect(isTaprootAddress("tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c")).toBe(
      true,
    );
    expect(isBitcoinSmartAccountWallet({ type: "orangekit", networkFamily: "bitcoin" })).toBe(
      true,
    );
    const fee = calculateBuilderFee(10_000_000_000_000_000_000n, 15);
    expect(fee.feeAmount).toBe(15_000_000_000_000_000n);
    expect(decodeFuseError(new Error("RouterPaused()")).code).toBe("ROUTER_PAUSED");
  });
});
