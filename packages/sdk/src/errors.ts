import { BaseError, ContractFunctionRevertedError, decodeErrorResult, type Hex } from "viem";
import { fuseRouterAbi } from "./abis.js";

export type FuseErrorCode =
  | "USER_REJECTED"
  | "TAPROOT_UNSUPPORTED"
  | "SIGN_TYPED_DATA_UNSUPPORTED"
  | "ROUTER_PAUSED"
  | "BUILDER_NOT_REGISTERED"
  | "BUILDER_NOT_ACTIVE"
  | "BUILDER_NOT_APPROVED"
  | "FEE_ABOVE_USER_APPROVAL"
  | "FEE_ABOVE_MAX_CAP"
  | "INVALID_LOCK_DURATION"
  | "SLIPPAGE_EXCEEDED"
  | "INSUFFICIENT_BALANCE"
  | "TOKEN_NOT_ALLOWED"
  | "ZERO_AMOUNT"
  | "PERMIT_EXPIRED_OR_INVALID"
  | "REVERTED"
  | "UNKNOWN";

export interface DecodedFuseError {
  code: FuseErrorCode;
  message: string;
  rawError: unknown;
}

export function isTaprootAddress(address?: string | null): boolean {
  if (!address) return false;
  const normalized = address.trim().toLowerCase();
  return normalized.startsWith("tb1p") || normalized.startsWith("bc1p");
}

export function isTaprootError(error: unknown): boolean {
  const msg = extractErrorString(error);
  return (
    msg.includes("UnsupportedBitcoinAddressError") ||
    msg.includes("Unsupported Bitcoin address") ||
    msg.includes("Taproot") ||
    msg.includes("tb1p") ||
    msg.includes("bc1p")
  );
}

export function isUnsupportedMethodError(error: unknown): boolean {
  const msg = extractErrorString(error);
  return (
    msg.includes("Unsupported method") ||
    msg.includes("eth_signTypedData") ||
    msg.includes("signTypedData is not supported")
  );
}

export function isUserRejectedError(error: unknown): boolean {
  const msg = extractErrorString(error).toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request") ||
    msg.includes("action_rejected") ||
    msg.includes("cancelled by user")
  );
}

function extractErrorString(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    return `${error.name}: ${error.message} ${(error as { shortMessage?: string }).shortMessage ?? ""}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function decodeFuseError(error: unknown): DecodedFuseError {
  if (isUserRejectedError(error)) {
    return {
      code: "USER_REJECTED",
      message: "Signature or transaction was rejected in your wallet.",
      rawError: error,
    };
  }

  if (isTaprootError(error)) {
    return {
      code: "TAPROOT_UNSUPPORTED",
      message:
        "Taproot (tb1p / bc1p) Bitcoin addresses are not supported by Mezo Passport OrangeKit. Please switch your Bitcoin wallet (Xverse / Unisat / OKX) to a Native SegWit (tb1q / bc1q) account.",
      rawError: error,
    };
  }

  if (isUnsupportedMethodError(error)) {
    return {
      code: "SIGN_TYPED_DATA_UNSUPPORTED",
      message:
        "Your Bitcoin wallet smart account does not support EIP-712 permit signatures; using standard token approval instead.",
      rawError: error,
    };
  }

  // Check Viem ContractFunctionRevertedError or raw revert data
  if (error instanceof BaseError) {
    const revertError = error.walk(
      (err) => err instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;

    if (revertError?.data) {
      const errorName = revertError.data.errorName;
      const args = revertError.data.args ?? [];
      const mapped = mapContractErrorName(errorName, args, error);
      if (mapped) return mapped;
    }
  }

  const msg = extractErrorString(error);

  // Attempt raw hex decoding if present on any Error or BaseError
  const rawHexMatch = msg.match(/0x[0-9a-fA-F]{8,}/);
  if (rawHexMatch) {
    try {
      const decoded = decodeErrorResult({
        abi: fuseRouterAbi,
        data: rawHexMatch[0] as Hex,
      });
      const mapped = mapContractErrorName(decoded.errorName, decoded.args ?? [], error);
      if (mapped) return mapped;
    } catch {
      // Ignore if not a FuseRouter custom error
    }
  }

  if (msg.includes("RouterPaused")) {
    return {
      code: "ROUTER_PAUSED",
      message: "FuseRouter is currently paused for new actions. You can still revoke builder approvals at any time.",
      rawError: error,
    };
  }
  if (msg.includes("BuilderNotApprovedByUser")) {
    return {
      code: "BUILDER_NOT_APPROVED",
      message: "You must approve this builder's maximum fee before routing an action.",
      rawError: error,
    };
  }
  if (msg.includes("FeeAboveUserApproval")) {
    return {
      code: "FEE_ABOVE_USER_APPROVAL",
      message:
        "The builder raised their fee above your approved maximum. Approve the updated fee to continue.",
      rawError: error,
    };
  }
  if (msg.includes("BuilderNotRegistered")) {
    return {
      code: "BUILDER_NOT_REGISTERED",
      message: "This builder address is not registered in FuseRouter.",
      rawError: error,
    };
  }
  if (msg.includes("BuilderNotActive")) {
    return {
      code: "BUILDER_NOT_ACTIVE",
      message: "This builder is currently deactivated and cannot route actions.",
      rawError: error,
    };
  }
  if (msg.includes("FeeAboveMaxCap")) {
    return {
      code: "FEE_ABOVE_MAX_CAP",
      message: "The requested fee exceeds the 0.50% (50 bps) Fuse protocol fee cap.",
      rawError: error,
    };
  }
  if (msg.includes("InvalidLockDuration")) {
    return {
      code: "INVALID_LOCK_DURATION",
      message:
        "Invalid VeBTC lock duration. On Mezo testnet, lock durations must be between 1 week (7 days) and 30 days.",
      rawError: error,
    };
  }
  if (msg.includes("InsufficientOutputAmount") || msg.toLowerCase().includes("insufficient output")) {
    return {
      code: "SLIPPAGE_EXCEEDED",
      message:
        "Swap output fell below your minimum received amount (slippage exceeded). Try increasing slippage tolerance.",
      rawError: error,
    };
  }
  if (msg.toLowerCase().includes("insufficient") && msg.toLowerCase().includes("balance")) {
    return {
      code: "INSUFFICIENT_BALANCE",
      message: "Insufficient token balance for this action.",
      rawError: error,
    };
  }

  return {
    code: "REVERTED",
    message:
      (error as { shortMessage?: string })?.shortMessage ||
      (error instanceof Error ? error.message : "Transaction reverted on Mezo testnet."),
    rawError: error,
  };
}

function mapContractErrorName(
  errorName: string,
  args: readonly unknown[],
  rawError: unknown,
): DecodedFuseError | null {
  switch (errorName) {
    case "RouterPaused":
      return {
        code: "ROUTER_PAUSED",
        message: "FuseRouter is currently paused for new actions. You can still revoke builder approvals at any time.",
        rawError,
      };
    case "BuilderNotRegistered":
      return {
        code: "BUILDER_NOT_REGISTERED",
        message: "This builder address is not registered in FuseRouter.",
        rawError,
      };
    case "BuilderNotActive":
      return {
        code: "BUILDER_NOT_ACTIVE",
        message: "This builder is currently deactivated and cannot route actions.",
        rawError,
      };
    case "BuilderNotApprovedByUser":
      return {
        code: "BUILDER_NOT_APPROVED",
        message: "You have not approved this builder yet. Approve the builder's maximum fee before continuing.",
        rawError,
      };
    case "FeeAboveUserApproval": {
      const builderBps = Number(args[0] ?? 0);
      const userBps = Number(args[1] ?? 0);
      return {
        code: "FEE_ABOVE_USER_APPROVAL",
        message: `Builder fee (${(builderBps / 100).toFixed(2)}%) exceeds your approved maximum (${(userBps / 100).toFixed(2)}%). Approve the higher fee to proceed.`,
        rawError,
      };
    }
    case "FeeAboveMaxCap": {
      const feeBps = Number(args[0] ?? 0);
      const maxCapBps = Number(args[1] ?? 50);
      return {
        code: "FEE_ABOVE_MAX_CAP",
        message: `Fee (${(feeBps / 100).toFixed(2)}%) exceeds the protocol hard cap (${(maxCapBps / 100).toFixed(2)}%).`,
        rawError,
      };
    }
    case "InvalidLockDuration":
      return {
        code: "INVALID_LOCK_DURATION",
        message:
          "Invalid VeBTC lock duration. On Mezo testnet, lock durations must be between 1 week (7 days) and 30 days.",
        rawError,
      };
    case "InsufficientOutputAmount":
      return {
        code: "SLIPPAGE_EXCEEDED",
        message:
          "Swap output was less than your minimum received amount (slippage exceeded).",
        rawError,
      };
    case "TokenNotAllowed":
      return {
        code: "TOKEN_NOT_ALLOWED",
        message: "This input token is not allowlisted on FuseRouter.",
        rawError,
      };
    case "ZeroAmount":
      return {
        code: "ZERO_AMOUNT",
        message: "Amount must be greater than zero.",
        rawError,
      };
    default:
      return null;
  }
}
