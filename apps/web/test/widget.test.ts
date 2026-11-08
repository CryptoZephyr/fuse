import { describe, expect, it } from "vitest";
import type { WalletDetailsParams, WalletList } from "@rainbow-me/rainbowkit";
import type { CreateConnectorFn } from "wagmi";
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
import { withRainbowKitDetails } from "../src/lib/passportWallets";

type CreateWalletFn = WalletList[number]["wallets"][number];

const unisatWalletFactory: CreateWalletFn = () => ({
  id: "orangekit-unisat",
  name: "OrangeKit Unisat",
  iconUrl: "data:image/svg+xml,",
  iconBackground: "#1E1E1E",
  installed: !!(window as Window & { unisat?: object }).unisat,
  downloadUrls: {
    desktop: "https://example.com/unisat",
  },
  createConnector: () => (_config) =>
    ({} as ReturnType<CreateConnectorFn>),
});

function createUnisatConnector(unisat: object | undefined) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: unisat ? { unisat } : {},
  });

  try {
    const wallet = withRainbowKitDetails(unisatWalletFactory)({
      appName: "Fuse",
      projectId: "test-project",
    });
    const walletDetails: WalletDetailsParams = {
      rkDetails: {
        ...wallet,
        groupName: "Bitcoin",
        index: 0,
        groupIndex: 0,
        isRainbowKitConnector: true,
      },
    };
    const config = {} as Parameters<
      ReturnType<typeof wallet.createConnector>
    >[0];

    return wallet.createConnector(walletDetails)(config);
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

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

  it("preserves RainbowKit Bitcoin wallet details and installed state", () => {
    const uninstalled = createUnisatConnector(undefined);
    expect(uninstalled).toMatchObject({
      rkDetails: {
        installed: false,
        groupName: "Bitcoin",
        isRainbowKitConnector: true,
      },
    });

    const installed = createUnisatConnector({});
    expect(installed).toMatchObject({
      rkDetails: {
        installed: true,
        groupName: "Bitcoin",
        isRainbowKitConnector: true,
      },
    });
  });
});
