import { type Address, type Chain, defineChain } from "viem";

export const MEZO_TESTNET_CHAIN_ID = 31611 as const;
export const MEZO_TESTNET_RPC_URL = "https://rpc.test.mezo.org" as const;
export const MEZO_TESTNET_EXPLORER_URL = "https://explorer.test.mezo.org" as const;
export const MEZO_TESTNET_EXPLORER_API_URL = "https://api.explorer.test.mezo.org/api/v2" as const;

export const MAX_FEE_BPS = 50 as const;
export const BPS_DENOMINATOR = 10_000n;
export const MIN_LOCK_DURATION_SECONDS = 604_800; // 1 week (7 days)
export const TESTNET_MAX_LOCK_DURATION_SECONDS = 2_592_000; // 30 days on Mezo Testnet

export const MEZO_TESTNET_CHAIN: Chain = defineChain({
  id: MEZO_TESTNET_CHAIN_ID,
  name: "Mezo Testnet",
  nativeCurrency: {
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [MEZO_TESTNET_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Mezo Testnet Explorer",
      url: MEZO_TESTNET_EXPLORER_URL,
    },
  },
  testnet: true,
});

export interface FuseAddresses {
  fuseRouter: Address;
  fuseRouterDeployBlock: bigint;
  tigrisRouter: Address;
  poolFactory: Address;
  musdBtcPool: Address;
  clSwapRouter: Address;
  musd: Address;
  btc: Address;
  mezoToken: Address;
  savingsVault: Address;
  veBTC: Address;
  skipBtcUsdOracle: Address;
}

export const MEZO_TESTNET_ADDRESSES: FuseAddresses = {
  fuseRouter: "0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1",
  fuseRouterDeployBlock: 16_328_764n,
  tigrisRouter: "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9",
  poolFactory: "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A",
  musdBtcPool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
  clSwapRouter: "0x3112908bB72ce9c26a321Eeb22EC8e051F3b6E6a",
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  btc: "0x7b7C000000000000000000000000000000000000",
  mezoToken: "0x7B7c000000000000000000000000000000000001",
  savingsVault: "0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16",
  veBTC: "0xB63fcCd03521Cf21907627bd7fA465C129479231",
  skipBtcUsdOracle: "0x7b7c000000000000000000000000000000000015",
} as const;

export type MezoTokenSymbol = "BTC" | "MUSD" | "MEZO" | "sMUSD";

export interface MezoTokenMetadata {
  symbol: MezoTokenSymbol;
  name: string;
  address: Address;
  decimals: number;
  supportsPermit: boolean;
}

export const MEZO_TOKENS: Record<MezoTokenSymbol, MezoTokenMetadata> = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin (Mezo Testnet)",
    address: MEZO_TESTNET_ADDRESSES.btc,
    decimals: 18,
    supportsPermit: false,
  },
  MUSD: {
    symbol: "MUSD",
    name: "Mezo USD",
    address: MEZO_TESTNET_ADDRESSES.musd,
    decimals: 18,
    supportsPermit: true,
  },
  MEZO: {
    symbol: "MEZO",
    name: "MEZO Token",
    address: MEZO_TESTNET_ADDRESSES.mezoToken,
    decimals: 18,
    supportsPermit: false,
  },
  sMUSD: {
    symbol: "sMUSD",
    name: "Savings Mezo USD",
    address: MEZO_TESTNET_ADDRESSES.savingsVault,
    decimals: 18,
    supportsPermit: false,
  },
} as const;

export interface LockDurationPreset {
  id: "1w" | "2w" | "3w" | "max30d";
  label: string;
  seconds: number;
  days: number;
}

/**
 * Architectural Decision #1 from T0 Spike:
 * On Mezo Testnet (`31611`), VeBTC `maxLockTime` is 2,592,000s (30 days) and `WEEK` is 604,800s (7 days).
 * Unlock times round down to Thursday 00:00 UTC epochs: `((block.timestamp + duration) / 604800) * 604800`.
 */
export const LOCK_DURATION_PRESETS: readonly LockDurationPreset[] = [
  { id: "1w", label: "1 Week", seconds: 604_800, days: 7 },
  { id: "2w", label: "2 Weeks", seconds: 1_209_600, days: 14 },
  { id: "3w", label: "3 Weeks", seconds: 1_814_400, days: 21 },
  { id: "max30d", label: "Max · 30 Days", seconds: 2_592_000, days: 30 },
] as const;

export const DEFAULT_PAID_BUILDER_TESTNET: Address =
  "0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a";
export const DEFAULT_ZERO_FEE_BUILDER_TESTNET: Address =
  "0x637A41a27e14897E72D3f9e488D4D33090DABEde";

export function getExplorerTxUrl(txHash: string, explorerUrl = MEZO_TESTNET_EXPLORER_URL): string {
  return `${explorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

export function getExplorerAddressUrl(
  address: string,
  explorerUrl = MEZO_TESTNET_EXPLORER_URL,
): string {
  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}
