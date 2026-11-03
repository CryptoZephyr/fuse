import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  hexToSignature,
} from "viem";
import { erc20PermitAbi } from "./abis.js";
import { MEZO_TESTNET_ADDRESSES, MEZO_TESTNET_CHAIN_ID } from "./addresses.js";

export interface PermitSignature {
  v: number;
  r: Hex;
  s: Hex;
  deadline: bigint;
  nonce: bigint;
  signature: Hex;
}

export interface SignMusdPermitParameters {
  publicClient: PublicClient;
  walletClient: WalletClient;
  owner: Address;
  account?: Account | Address;
  spender?: Address;
  value: bigint;
  deadlineSeconds?: number;
  deadline?: bigint;
  chainId?: number;
  musdAddress?: Address;
}

export const MUSD_PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function getMusdPermitDomain(
  chainId: number = MEZO_TESTNET_CHAIN_ID,
  musdAddress: Address = MEZO_TESTNET_ADDRESSES.musd,
) {
  return {
    name: "Mezo USD",
    version: "1",
    chainId,
    verifyingContract: musdAddress,
  } as const;
}

/**
 * Architectural Decision #2 from T0 Spike:
 * In `@mezo-org/passport` / `@mezo-org/orangekit`, Bitcoin wallets map to Gnosis Safe 1.4.1 smart accounts
 * where `connector.type === "orangekit"` (or `networkFamily === "bitcoin"`) and `signTypedData()` throws
 * `Error("Unsupported method")`.
 */
export function isBitcoinSmartAccountWallet(connectorOrInfo?: {
  type?: string;
  id?: string;
  networkFamily?: "bitcoin" | "evm";
} | null): boolean {
  if (!connectorOrInfo) return false;
  if (connectorOrInfo.networkFamily === "bitcoin") return true;
  if (connectorOrInfo.type?.toLowerCase() === "orangekit") return true;
  const id = connectorOrInfo.id?.toLowerCase() ?? "";
  return id.includes("unisat") || id.includes("xverse") || id.includes("orangekit");
}

export function splitSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
  const parsed = hexToSignature(signature);
  const v = Number(parsed.v ?? (parsed.yParity === 0 ? 27 : 28));
  return {
    v: v < 27 ? v + 27 : v,
    r: parsed.r,
    s: parsed.s,
  };
}

/**
 * Signs an EIP-2612 `Permit` message for Mezo USD (`MUSD`) on Mezo Testnet (`31611`).
 */
export async function signMusdPermit({
  publicClient,
  walletClient,
  owner,
  account,
  spender = MEZO_TESTNET_ADDRESSES.fuseRouter,
  value,
  deadlineSeconds = 3600,
  deadline: explicitDeadline,
  chainId = MEZO_TESTNET_CHAIN_ID,
  musdAddress = MEZO_TESTNET_ADDRESSES.musd,
}: SignMusdPermitParameters): Promise<PermitSignature> {
  const nonce = await publicClient.readContract({
    address: musdAddress,
    abi: erc20PermitAbi,
    functionName: "nonces",
    args: [owner],
  });

  const deadline =
    explicitDeadline ?? BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  const signature = await walletClient.signTypedData({
    account: account ?? walletClient.account ?? owner,
    domain: getMusdPermitDomain(chainId, musdAddress),
    types: MUSD_PERMIT_TYPES,
    primaryType: "Permit",
    message: {
      owner,
      spender,
      value,
      nonce,
      deadline,
    },
  });

  const { v, r, s } = splitSignature(signature);

  return {
    v,
    r,
    s,
    deadline,
    nonce,
    signature,
  };
}
