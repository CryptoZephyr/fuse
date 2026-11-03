import { type Address, type PublicClient } from "viem";
import { fuseRouterAbi } from "./abis.js";
import { type FuseAddresses, MEZO_TESTNET_ADDRESSES } from "./addresses.js";

export interface ParsedBuilderMetadata {
  /** Self-reported builder display name */
  name: string;
  /** Optional builder website or app URL */
  url?: string;
  /** Optional builder description */
  description?: string;
  /** Raw metadataURI stored onchain in FuseRouter */
  rawMetadataURI: string;
  /** Always true per DESIGN_SYSTEM.md & FRONTEND.md: builder names are self-reported */
  selfReported: true;
}

export interface BuilderStatus {
  address: Address;
  registered: boolean;
  active: boolean;
  feeBps: number;
  feePercentFormatted: string;
  metadataURI: string;
  metadata: ParsedBuilderMetadata;
  routerPaused: boolean;
  userApproved: boolean;
  userMaxFeeBps: number;
  userMaxFeePercentFormatted: string;
  needsApproval: boolean;
  needsHigherApproval: boolean;
}

export function formatFeeBps(feeBps: number): string {
  return `${(feeBps / 100).toFixed(2)}%`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Parses a builder's on-chain `metadataURI` string into display metadata.
 * Per DESIGN_SYSTEM.md and FRONTEND.md, all builder names are explicitly tagged `selfReported: true`.
 */
export function parseBuilderMetadataURI(
  metadataURI: string,
  builderAddress?: string,
): ParsedBuilderMetadata {
  const fallbackName = builderAddress ? `Builder ${shortenAddress(builderAddress)}` : "Unnamed Builder";
  const trimmed = (metadataURI ?? "").trim();

  if (!trimmed) {
    return {
      name: fallbackName,
      rawMetadataURI: "",
      selfReported: true,
    };
  }

  // Handle data:application/json;base64,... or data:application/json,...
  if (trimmed.startsWith("data:application/json")) {
    try {
      const commaIdx = trimmed.indexOf(",");
      if (commaIdx !== -1) {
        const header = trimmed.slice(0, commaIdx);
        const payload = trimmed.slice(commaIdx + 1);
        const jsonText = header.includes(";base64")
          ? Buffer.from(payload, "base64").toString("utf8")
          : decodeURIComponent(payload);
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        return {
          name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallbackName,
          url: typeof parsed.url === "string" ? parsed.url : undefined,
          description: typeof parsed.description === "string" ? parsed.description : undefined,
          rawMetadataURI: trimmed,
          selfReported: true,
        };
      }
    } catch {
      // Fall through
    }
  }

  // Handle inline JSON string
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return {
        name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallbackName,
        url: typeof parsed.url === "string" ? parsed.url : undefined,
        description: typeof parsed.description === "string" ? parsed.description : undefined,
        rawMetadataURI: trimmed,
        selfReported: true,
      };
    } catch {
      // Fall through
    }
  }

  // Handle ipfs:// or https:// URLs that may contain a name fragment or hostname
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("ipfs://")) {
    try {
      if (trimmed.startsWith("ipfs://")) {
        const pathPart = trimmed.replace("ipfs://", "").split("/").filter(Boolean).pop();
        return {
          name: pathPart ? pathPart.replace(/\.(json|md)$/i, "") : fallbackName,
          url: trimmed,
          rawMetadataURI: trimmed,
          selfReported: true,
        };
      }
      const url = new URL(trimmed);
      const nameParam = url.searchParams.get("name") || url.hash.replace(/^#/, "");
      return {
        name: nameParam ? decodeURIComponent(nameParam) : url.hostname,
        url: trimmed,
        rawMetadataURI: trimmed,
        selfReported: true,
      };
    } catch {
      // Fall through
    }
  }

  return {
    name: trimmed,
    rawMetadataURI: trimmed,
    selfReported: true,
  };
}

export interface GetBuilderStatusParameters {
  publicClient: PublicClient;
  builder: Address;
  user?: Address;
  addresses?: FuseAddresses;
}

export async function getBuilderStatus({
  publicClient,
  builder,
  user,
  addresses = MEZO_TESTNET_ADDRESSES,
}: GetBuilderStatusParameters): Promise<BuilderStatus> {
  const [builderTuple, routerPaused, approvalTuple] = await Promise.all([
    publicClient.readContract({
      address: addresses.fuseRouter,
      abi: fuseRouterAbi,
      functionName: "builders",
      args: [builder],
    }),
    publicClient.readContract({
      address: addresses.fuseRouter,
      abi: fuseRouterAbi,
      functionName: "paused",
    }),
    user
      ? publicClient.readContract({
          address: addresses.fuseRouter,
          abi: fuseRouterAbi,
          functionName: "isBuilderApproved",
          args: [user, builder],
        })
      : Promise.resolve([false, 0] as const),
  ]);

  const [rawFeeBps, active, registered, metadataURI] = builderTuple;
  const [userApproved, rawUserMaxFeeBps] = approvalTuple;
  const feeBps = Number(rawFeeBps);
  const userMaxFeeBps = Number(rawUserMaxFeeBps);

  const needsApproval = !userApproved;
  const needsHigherApproval = userApproved && feeBps > userMaxFeeBps;

  return {
    address: builder,
    registered,
    active,
    feeBps,
    feePercentFormatted: formatFeeBps(feeBps),
    metadataURI,
    metadata: parseBuilderMetadataURI(metadataURI, builder),
    routerPaused,
    userApproved,
    userMaxFeeBps,
    userMaxFeePercentFormatted: formatFeeBps(userMaxFeeBps),
    needsApproval,
    needsHigherApproval,
  };
}
