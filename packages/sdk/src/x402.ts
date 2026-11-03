import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  getAddress,
  maxUint256,
} from "viem";
import { erc20PermitAbi } from "./abis.js";
import {
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN_ID,
  getExplorerTxUrl,
} from "./addresses.js";

export const MEZO_TESTNET_X402_NETWORK = "eip155:31611" as const;
export const MEZO_TESTNET_X402_FACILITATOR_URL = "https://facilitator.vativ.io" as const;
export const PERMIT2_ADDRESS: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const X402_EXACT_PERMIT2_PROXY_ADDRESS: Address =
  "0x402085c248EeA27D92E8b30b2C58ed07f9E20001";
export const DEFAULT_X402_ANALYTICS_PRICE_MUSD = "50000000000000000" as const; // 0.05 MUSD (18 decimals)

export interface X402PaymentRequirements {
  scheme: "exact";
  network: string;
  amount: string;
  asset: Address;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra: {
    name: string;
    version: string;
    assetTransferMethod: "permit2";
  };
}

export interface X402ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}

export interface X402PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: X402ResourceInfo;
  accepts: X402PaymentRequirements[];
  extensions: {
    eip2612GasSponsoring: {
      info: Record<string, unknown>;
      schema: Record<string, unknown>;
    };
  };
}

export interface X402Permit2Authorization {
  from: Address;
  permitted: {
    token: Address;
    amount: string;
  };
  spender: Address;
  nonce: string;
  deadline: string;
  witness: {
    to: Address;
    validAfter: string;
  };
}

export interface X402Eip2612GasSponsoringInfo {
  from: Address;
  asset: Address;
  spender: Address;
  amount: string;
  nonce: string;
  deadline: string;
  signature: Hex;
  version: string;
}

export interface X402PaymentPayload {
  x402Version: 2;
  resource?: X402ResourceInfo;
  accepted: X402PaymentRequirements;
  payload: {
    signature: Hex;
    permit2Authorization: X402Permit2Authorization;
  };
  extensions?: {
    eip2612GasSponsoring?: {
      info: X402Eip2612GasSponsoringInfo;
    };
  };
}

export interface X402VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: Address;
}

export interface X402SettleResponse {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  payer?: Address;
  transaction: string;
  network: string;
  explorerUrl?: string;
}

const PERMIT2_WITNESS_TYPES = {
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "Witness" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  Witness: [
    { name: "to", type: "address" },
    { name: "validAfter", type: "uint256" },
  ],
} as const;

const EIP2612_PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function encodeX402Header(data: unknown): string {
  const json = JSON.stringify(data);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64");
  }
  return btoa(json);
}

export function decodeX402Header<T = unknown>(encoded: string): T {
  const trimmed = encoded.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as T;
  }
  const json =
    typeof Buffer !== "undefined"
      ? Buffer.from(trimmed, "base64").toString("utf8")
      : atob(trimmed);
  return JSON.parse(json) as T;
}

function generateRandom256BitNonce(): bigint {
  const bytes = new Uint8Array(32);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return BigInt(`0x${hex}`);
}

export function buildX402PaymentRequirements(params: {
  payTo: Address;
  amount?: string;
  asset?: Address;
  network?: string;
  maxTimeoutSeconds?: number;
}): X402PaymentRequirements {
  return {
    scheme: "exact",
    network: params?.network ?? MEZO_TESTNET_X402_NETWORK,
    amount: params?.amount ?? DEFAULT_X402_ANALYTICS_PRICE_MUSD,
    asset: getAddress(params?.asset ?? MEZO_TESTNET_ADDRESSES.musd),
    payTo: getAddress(params.payTo),
    maxTimeoutSeconds: params?.maxTimeoutSeconds ?? 600,
    extra: {
      name: "Mezo USD",
      version: "1",
      assetTransferMethod: "permit2",
    },
  };
}

export function buildX402PaymentRequired(params: {
  resourceUrl: string;
  description?: string;
  payTo: Address;
  amount?: string;
  asset?: Address;
  network?: string;
  maxTimeoutSeconds?: number;
}): {
  paymentRequirements: X402PaymentRequirements;
  paymentRequired: X402PaymentRequired;
  headerValue: string;
} {
  const paymentRequirements = buildX402PaymentRequirements({
    payTo: params.payTo,
    amount: params.amount,
    asset: params.asset,
    network: params.network,
    maxTimeoutSeconds: params.maxTimeoutSeconds,
  });

  const paymentRequired: X402PaymentRequired = {
    x402Version: 2,
    error: "MUSD x402 payment is required to unlock full builder analytics",
    resource: {
      url: params.resourceUrl,
      description: params.description ?? "Fuse Paid Builder Analytics Report",
      mimeType: "application/json",
    },
    accepts: [paymentRequirements],
    extensions: {
      eip2612GasSponsoring: {
        info: {},
        schema: {},
      },
    },
  };

  return {
    paymentRequirements,
    paymentRequired,
    headerValue: encodeX402Header(paymentRequired),
  };
}

export interface CreateMusdX402PaymentPayloadParameters {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account?: Account | Address;
  paymentRequired: X402PaymentRequired;
  chainId?: number;
}

/**
 * Signs a Mezo Testnet MUSD x402 v2 payment payload using Permit2 `PermitWitnessTransferFrom`
 * plus optional EIP-2612 `eip2612GasSponsoring` when the payer has not yet approved Permit2.
 */
export async function createMusdX402PaymentPayload({
  publicClient,
  walletClient,
  account,
  paymentRequired,
  chainId = MEZO_TESTNET_CHAIN_ID,
}: CreateMusdX402PaymentPayloadParameters): Promise<{
  paymentPayload: X402PaymentPayload;
  headerValue: string;
}> {
  const signerAccount = account ?? walletClient.account;
  if (!signerAccount) {
    throw new Error("WalletClient account is required to sign an MUSD x402 payment.");
  }
  const payerAddress = getAddress(
    typeof signerAccount === "string" ? signerAccount : signerAccount.address,
  );

  const accepted = paymentRequired.accepts[0];
  if (!accepted) {
    throw new Error("No accepted x402 payment requirements found in 402 response.");
  }

  const tokenAddress = getAddress(accepted.asset);
  const payToAddress = getAddress(accepted.payTo);
  const amountBigInt = BigInt(accepted.amount);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(nowSeconds - 600);
  const deadline = BigInt(nowSeconds + (accepted.maxTimeoutSeconds || 600));
  const permit2Nonce = generateRandom256BitNonce();

  // 1. Sign Permit2 PermitWitnessTransferFrom
  const permit2Signature = await walletClient.signTypedData({
    account: signerAccount,
    domain: {
      name: "Permit2",
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    },
    types: PERMIT2_WITNESS_TYPES,
    primaryType: "PermitWitnessTransferFrom",
    message: {
      permitted: {
        token: tokenAddress,
        amount: amountBigInt,
      },
      spender: X402_EXACT_PERMIT2_PROXY_ADDRESS,
      nonce: permit2Nonce,
      deadline,
      witness: {
        to: payToAddress,
        validAfter,
      },
    },
  });

  // 2. Check if MUSD allowance to Permit2 is already sufficient; if not, sign EIP-2612 gas sponsoring permit
  const permit2Allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20PermitAbi,
    functionName: "allowance",
    args: [payerAddress, PERMIT2_ADDRESS],
  });

  let eip2612GasSponsoring: { info: X402Eip2612GasSponsoringInfo } | undefined;

  if (permit2Allowance < amountBigInt) {
    const eip2612Nonce = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20PermitAbi,
      functionName: "nonces",
      args: [payerAddress],
    });

    const eip2612Signature = await walletClient.signTypedData({
      account: signerAccount,
      domain: {
        name: accepted.extra?.name || "Mezo USD",
        version: accepted.extra?.version || "1",
        chainId,
        verifyingContract: tokenAddress,
      },
      types: EIP2612_PERMIT_TYPES,
      primaryType: "Permit",
      message: {
        owner: payerAddress,
        spender: PERMIT2_ADDRESS,
        value: amountBigInt,
        nonce: eip2612Nonce,
        deadline,
      },
    });

    eip2612GasSponsoring = {
      info: {
        from: payerAddress,
        asset: tokenAddress,
        spender: PERMIT2_ADDRESS,
        amount: amountBigInt.toString(),
        nonce: eip2612Nonce.toString(),
        deadline: deadline.toString(),
        signature: eip2612Signature,
        version: accepted.extra?.version || "1",
      },
    };
  }

  const paymentPayload: X402PaymentPayload = {
    x402Version: 2,
    resource: paymentRequired.resource,
    accepted,
    payload: {
      signature: permit2Signature,
      permit2Authorization: {
        from: payerAddress,
        permitted: {
          token: tokenAddress,
          amount: amountBigInt.toString(),
        },
        spender: X402_EXACT_PERMIT2_PROXY_ADDRESS,
        nonce: permit2Nonce.toString(),
        deadline: deadline.toString(),
        witness: {
          to: payToAddress,
          validAfter: validAfter.toString(),
        },
      },
    },
    ...(eip2612GasSponsoring ? { extensions: { eip2612GasSponsoring } } : {}),
  };

  return {
    paymentPayload,
    headerValue: encodeX402Header(paymentPayload),
  };
}

export interface VerifyAndSettleX402PaymentParameters {
  paymentPayload: X402PaymentPayload;
  paymentRequirements: X402PaymentRequirements;
  facilitatorUrl?: string;
}

export interface VerifyX402PaymentParameters {
  paymentPayload: X402PaymentPayload;
  paymentRequirements: X402PaymentRequirements;
  facilitatorUrl?: string;
}

export interface SettleX402PaymentParameters {
  paymentPayload: X402PaymentPayload;
  paymentRequirements: X402PaymentRequirements;
  facilitatorUrl?: string;
}

function buildX402FacilitatorRequestBody(
  paymentPayload: X402PaymentPayload,
  paymentRequirements: X402PaymentRequirements,
): string {
  return JSON.stringify({
    x402Version: 2,
    paymentPayload,
    paymentRequirements,
  });
}

export async function verifyX402Payment({
  paymentPayload,
  paymentRequirements,
  facilitatorUrl = MEZO_TESTNET_X402_FACILITATOR_URL,
}: VerifyX402PaymentParameters): Promise<X402VerifyResponse> {
  const cleanFacilitator = facilitatorUrl.replace(/\/$/, "");
  const requestBody = buildX402FacilitatorRequestBody(paymentPayload, paymentRequirements);

  const verifyRes = await fetch(`${cleanFacilitator}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });

  if (!verifyRes.ok) {
    const errText = await verifyRes.text().catch(() => "");
    throw new Error(
      `x402 facilitator /verify failed with HTTP ${verifyRes.status}: ${errText}`,
    );
  }

  const verifyResult = (await verifyRes.json()) as X402VerifyResponse;
  if (!verifyResult.isValid) {
    throw new Error(
      `x402 payment verification failed: ${verifyResult.invalidReason ?? "invalid_payment"} (${verifyResult.invalidMessage ?? "no details"})`,
    );
  }

  return verifyResult;
}

export async function settleX402Payment({
  paymentPayload,
  paymentRequirements,
  facilitatorUrl = MEZO_TESTNET_X402_FACILITATOR_URL,
}: SettleX402PaymentParameters): Promise<{
  settleResult: X402SettleResponse;
  paymentResponseHeader: string;
}> {
  const cleanFacilitator = facilitatorUrl.replace(/\/$/, "");
  const requestBody = buildX402FacilitatorRequestBody(paymentPayload, paymentRequirements);
  const settleRes = await fetch(`${cleanFacilitator}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });

  if (!settleRes.ok) {
    const errText = await settleRes.text().catch(() => "");
    throw new Error(
      `x402 facilitator /settle failed with HTTP ${settleRes.status}: ${errText}`,
    );
  }

  const settleResult = (await settleRes.json()) as X402SettleResponse;
  if (!settleResult.success) {
    throw new Error(
      `x402 payment settlement failed: ${settleResult.errorReason ?? "settlement_failed"} (${settleResult.errorMessage ?? "no details"})`,
    );
  }

  if (settleResult.transaction) {
    settleResult.explorerUrl = getExplorerTxUrl(settleResult.transaction);
  }

  return {
    settleResult,
    paymentResponseHeader: encodeX402Header(settleResult),
  };
}

export async function verifyAndSettleX402Payment({
  paymentPayload,
  paymentRequirements,
  facilitatorUrl = MEZO_TESTNET_X402_FACILITATOR_URL,
}: VerifyAndSettleX402PaymentParameters): Promise<{
  verifyResult: X402VerifyResponse;
  settleResult: X402SettleResponse;
  paymentResponseHeader: string;
}> {
  const verifyResult = await verifyX402Payment({
    paymentPayload,
    paymentRequirements,
    facilitatorUrl,
  });
  const settlement = await settleX402Payment({
    paymentPayload,
    paymentRequirements,
    facilitatorUrl,
  });

  return { verifyResult, ...settlement };
}
