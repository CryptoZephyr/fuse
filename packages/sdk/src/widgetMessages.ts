import type { Address, Hash } from "viem";
import type { FuseActionType } from "./events.js";

export const FUSE_WIDGET_MESSAGE_SOURCE = "fuse-widget";

export type FuseWidgetMessage =
  | {
      source: "fuse-widget";
      version: 1;
      type: "account";
      address: Address | null;
      chainId: number | null;
    }
  | {
      source: "fuse-widget";
      version: 1;
      type: "tx_submitted" | "tx_confirmed";
      hash: Hash;
      kind: "token_approval" | "action";
      action: FuseActionType;
      explorerUrl: string;
    }
  | {
      source: "fuse-widget";
      version: 1;
      type: "resize";
      height: number;
    };

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ACTION_TYPES: readonly FuseActionType[] = ["swap", "save", "lock"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

export function parseFuseWidgetMessage(data: unknown): FuseWidgetMessage | null {
  if (
    !isRecord(data) ||
    data.source !== FUSE_WIDGET_MESSAGE_SOURCE ||
    data.version !== 1
  ) {
    return null;
  }

  if (data.type === "account") {
    if (!hasExactKeys(data, ["source", "version", "type", "address", "chainId"])) {
      return null;
    }

    const validAddress =
      data.address === null ||
      (typeof data.address === "string" && ADDRESS_PATTERN.test(data.address));
    const validChainId =
      data.chainId === null ||
      (typeof data.chainId === "number" &&
        Number.isSafeInteger(data.chainId) &&
        data.chainId > 0);

    return validAddress && validChainId ? (data as FuseWidgetMessage) : null;
  }

  if (data.type === "tx_submitted" || data.type === "tx_confirmed") {
    if (
      !hasExactKeys(data, [
        "source",
        "version",
        "type",
        "hash",
        "kind",
        "action",
        "explorerUrl",
      ]) ||
      typeof data.hash !== "string" ||
      !HASH_PATTERN.test(data.hash) ||
      (data.kind !== "token_approval" && data.kind !== "action") ||
      typeof data.action !== "string" ||
      !ACTION_TYPES.includes(data.action as FuseActionType) ||
      typeof data.explorerUrl !== "string" ||
      !data.explorerUrl.startsWith("https://")
    ) {
      return null;
    }

    return data as FuseWidgetMessage;
  }

  if (data.type === "resize") {
    if (
      !hasExactKeys(data, ["source", "version", "type", "height"]) ||
      typeof data.height !== "number" ||
      !Number.isFinite(data.height) ||
      data.height <= 0
    ) {
      return null;
    }

    return data as FuseWidgetMessage;
  }

  return null;
}
