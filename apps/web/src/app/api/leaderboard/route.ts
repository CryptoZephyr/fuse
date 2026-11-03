import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import {
  type LeaderboardActionFilter,
  type LeaderboardSnapshot,
  type LeaderboardSortBy,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_RPC_URL,
  getLeaderboardSnapshot,
} from "@fuse/sdk";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 15_000;
const MIN_REFRESH_INTERVAL_MS = 5_000;
const snapshotCache = new Map<
  string,
  { timestamp: number; data: LeaderboardSnapshot }
>();
const inFlightScans = new Map<string, Promise<LeaderboardSnapshot>>();

const VALID_ACTIONS = new Set<LeaderboardActionFilter>([
  "all",
  "swap",
  "save",
  "lock",
]);
const VALID_SORTS = new Set<LeaderboardSortBy>([
  "volumeUsd",
  "users",
  "feesUsd",
  "actions",
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawAction = (searchParams.get("action") ?? "all").toLowerCase();
    const rawSort = searchParams.get("sort") ?? "users";

    const actionFilter: LeaderboardActionFilter = VALID_ACTIONS.has(
      rawAction as LeaderboardActionFilter,
    )
      ? (rawAction as LeaderboardActionFilter)
      : "all";

    const sortBy: LeaderboardSortBy = VALID_SORTS.has(
      rawSort as LeaderboardSortBy,
    )
      ? (rawSort as LeaderboardSortBy)
      : "users";

    const cacheKey = `${actionFilter}:${sortBy}`;
    const cached = snapshotCache.get(cacheKey);
    const refresh = searchParams.get("refresh") === "true";
    const cacheControl = refresh
      ? "no-store"
      : "public, s-maxage=15, stale-while-revalidate=30";
    const cacheAge = cached ? Date.now() - cached.timestamp : null;
    if (
      cached &&
      cacheAge !== null &&
      cacheAge < CACHE_TTL_MS &&
      (!refresh || cacheAge < MIN_REFRESH_INTERVAL_MS)
    ) {
      return NextResponse.json(
        {
          ...cached.data,
          cached: true,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": cacheControl,
          },
        },
      );
    }

    let scanPromise = inFlightScans.get(cacheKey);
    if (!scanPromise) {
      scanPromise = (async () => {
        const rpcUrl = process.env.NEXT_PUBLIC_MEZO_RPC_URL || MEZO_TESTNET_RPC_URL;
        const publicClient = createPublicClient({
          chain: MEZO_TESTNET_CHAIN,
          transport: http(rpcUrl, { timeout: 25_000 }),
        });
        const snapshot = await getLeaderboardSnapshot({
          publicClient,
          actionFilter,
          sortBy,
        });
        snapshotCache.set(cacheKey, {
          timestamp: Date.now(),
          data: snapshot,
        });
        return snapshot;
      })();
      inFlightScans.set(cacheKey, scanPromise);
    }

    try {
      const snapshot = await scanPromise;
      return NextResponse.json(
        {
          ...snapshot,
          cached: false,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": cacheControl,
          },
        },
      );
    } finally {
      if (inFlightScans.get(cacheKey) === scanPromise) {
        inFlightScans.delete(cacheKey);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load leaderboard snapshot";
    return NextResponse.json(
      {
        error: "LEADERBOARD_INDEXER_ERROR",
        message,
      },
      { status: 500 },
    );
  }
}
