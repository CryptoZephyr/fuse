"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  LeaderboardActionFilter,
  LeaderboardSnapshot,
  LeaderboardSortBy,
} from "@fuse/sdk";

export interface UseLeaderboardOptions {
  initialAction?: LeaderboardActionFilter;
  initialSort?: LeaderboardSortBy;
}

export function useLeaderboard(options?: UseLeaderboardOptions) {
  const [actionFilter, setActionFilter] = useState<LeaderboardActionFilter>(
    options?.initialAction ?? "all",
  );
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>(
    options?.initialSort ?? "users",
  );
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          action: actionFilter,
          sort: sortBy,
        });
        const res = await fetch(`/api/leaderboard?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to load leaderboard");
        }
        setSnapshot(data as LeaderboardSnapshot);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load leaderboard",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [actionFilter, sortBy],
  );

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    actionFilter,
    setActionFilter,
    sortBy,
    setSortBy,
    snapshot,
    isLoading,
    error,
    refresh: () => fetchLeaderboard(),
  };
}
