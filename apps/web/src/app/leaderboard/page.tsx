"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  type LeaderboardActionFilter,
  type LeaderboardSortBy,
  getExplorerAddressUrl,
  shortenAddress,
} from "@fuse/sdk";
import { useLeaderboard } from "../../hooks/useLeaderboard";

export default function LeaderboardPage() {
  const {
    actionFilter,
    setActionFilter,
    sortBy,
    setSortBy,
    snapshot,
    isLoading,
    error,
    refresh,
  } = useLeaderboard({ initialSort: "users" });

  const [selectedBuilder, setSelectedBuilder] = useState<string | null>(null);
  const [x402Preview, setX402Preview] = useState<Record<string, unknown> | null>(null);
  const [x402Status, setX402Status] = useState<number | null>(null);
  const [x402Loading, setX402Loading] = useState<boolean>(false);

  async function inspectPaidAnalyticsEndpoint(builderAddress: string) {
    setSelectedBuilder(builderAddress);
    setX402Loading(true);
    setX402Preview(null);
    setX402Status(null);
    try {
      const res = await fetch(`/api/analytics/${builderAddress}`, {
        cache: "no-store",
      });
      setX402Status(res.status);
      const body = await res.json();
      setX402Preview(body as Record<string, unknown>);
    } catch (err) {
      setX402Preview({
        error: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setX402Loading(false);
    }
  }

  const allRecentTransactions =
    snapshot?.builders
      .flatMap((b) =>
        b.recentTransactions.map((tx) => ({
          ...tx,
          builderName: b.name,
        })),
      )
      .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber)) ?? [];

  return (
    <main data-fuse-page="leaderboard">
      <header data-fuse-header="leaderboard">
        <h1>Fuse Builder Leaderboard (Mezo Testnet · Chain ID 31611)</h1>
        <p>
          Live on-chain attribution rankings indexed directly from{" "}
          <code>FuseRouter</code> (
          <a
            href={
              snapshot
                ? getExplorerAddressUrl(snapshot.routerAddress)
                : "https://explorer.test.mezo.org/address/0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4"
            }
            target="_blank"
            rel="noreferrer"
          >
            0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4
          </a>
          ). All builder names are explicitly labeled{" "}
          <strong>(self-reported)</strong>.
        </p>
        <nav aria-label="Fuse navigation" data-fuse-nav="primary">
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/widget">Widget (/widget)</Link>
            </li>
            <li>
              <Link href="/builders">Builders Console (/builders)</Link>
            </li>
            <li>
              <Link href="/leaderboard">Leaderboard (/leaderboard)</Link>
            </li>
            <li>
              <Link href="/docs">Docs (/docs)</Link>
            </li>
            <li>
              <a href="/api/leaderboard" target="_blank" rel="noreferrer">
                Raw JSON (/api/leaderboard)
              </a>
            </li>
          </ul>
        </nav>
      </header>

      <hr />

      <section aria-label="Leaderboard Controls" data-fuse-section="controls">
        <h2>Filter &amp; Sort</h2>
        <fieldset>
          <legend>Action Filter</legend>
          {(["all", "swap", "save", "lock"] as LeaderboardActionFilter[]).map(
            (act) => (
              <button
                key={act}
                type="button"
                data-fuse-action-filter={act}
                aria-pressed={actionFilter === act}
                onClick={() => setActionFilter(act)}
              >
                {act === "all"
                  ? "All Actions"
                  : act.charAt(0).toUpperCase() + act.slice(1)}{" "}
                {actionFilter === act ? "(Selected)" : ""}
              </button>
            ),
          )}
        </fieldset>

        <div>
          <label htmlFor="fuse-leaderboard-sort">Sort Builders By: </label>
          <select
            id="fuse-leaderboard-sort"
            data-fuse-sort-select="true"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as LeaderboardSortBy)}
          >
            <option value="volumeUsd">Volume (USD)</option>
            <option value="users">Unique Users</option>
            <option value="feesUsd">Builder Fees (USD)</option>
            <option value="actions">Routed Action Count</option>
          </select>{" "}
          <button
            type="button"
            data-fuse-refresh="true"
            onClick={() => void refresh()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh On-Chain Data"}
          </button>
        </div>
      </section>

      {error && (
        <section role="alert" data-fuse-error="leaderboard">
          <p>
            <strong>Error loading leaderboard:</strong> {error}
          </p>
        </section>
      )}

      {snapshot && (
        <>
          <section
            aria-label="Protocol Summary"
            data-fuse-section="protocol-summary"
          >
            <h2>On-Chain Protocol Summary (Testnet)</h2>
            <dl>
              <dt>Registered Builders</dt>
              <dd data-fuse-summary="registered-builders">
                {snapshot.totals.registeredBuilders} ({snapshot.totals.activeBuilders}{" "}
                active)
              </dd>

              <dt>Unique Routed Users</dt>
              <dd data-fuse-summary="unique-users">
                {snapshot.totals.uniqueUsers}
              </dd>

              <dt>Total Routed Actions ({snapshot.actionFilter})</dt>
              <dd data-fuse-summary="total-actions">
                {snapshot.totals.totalActions}
              </dd>

              {snapshot.totals.excludedSelfReferralActions > 0 && (
                <>
                  <dt>Self-Referral Actions Excluded</dt>
                  <dd data-fuse-summary="excluded-self-referral-actions">
                    {snapshot.totals.excludedSelfReferralActions} self-referral{" "}
                    {snapshot.totals.excludedSelfReferralActions === 1
                      ? "action"
                      : "actions"}{" "}
                    excluded
                  </dd>
                </>
              )}

              {snapshot.btcUsdOracle &&
                snapshot.totals.totalVolumeUsdFormatted && (
                  <>
                    <dt>Total Routed Volume (USD)</dt>
                    <dd data-fuse-summary="total-volume-usd">
                      {snapshot.totals.totalVolumeUsdFormatted}
                    </dd>
                  </>
                )}

              {snapshot.btcUsdOracle &&
                snapshot.totals.totalFeesUsdFormatted && (
                  <>
                    <dt>Total Builder Fees Earned (USD)</dt>
                    <dd data-fuse-summary="total-fees-usd">
                      {snapshot.totals.totalFeesUsdFormatted}
                    </dd>
                  </>
                )}

              {snapshot.btcUsdOracle && (
                <>
                  <dt>Skip BTC/USD Oracle Price</dt>
                  <dd data-fuse-summary="btc-usd-oracle">
                    {snapshot.btcUsdOracle.formattedUsd} (Round{" "}
                    {snapshot.btcUsdOracle.roundId})
                  </dd>
                </>
              )}

              <dt>Indexed Block Range</dt>
              <dd data-fuse-summary="block-range">
                {snapshot.fromBlock} &rarr; {snapshot.toBlock}
              </dd>
            </dl>
          </section>

          <section
            aria-label="Builder Rankings"
            data-fuse-section="builder-rankings"
          >
            <h2>Ranked Builders</h2>
            <table data-fuse-table="builders">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Builder Name (self-reported)</th>
                  <th>Builder Address</th>
                  <th>Status</th>
                  <th>Fee</th>
                  <th>Unique Users</th>
                  <th>Actions (All: Swap/Save/Lock)</th>
                  {snapshot.btcUsdOracle && <th>Volume (USD)</th>}
                  <th>Volume by Token</th>
                  {snapshot.btcUsdOracle && <th>Fees Earned (USD)</th>}
                  <th>Fees by Token</th>
                  <th>Paid Analytics (MUSD x402)</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.builders.map((row) => {
                  const volumeTokens = Object.values(row.volumeByToken);
                  const feeTokens = Object.values(row.feesByToken);

                  return (
                    <tr
                      key={row.builder}
                      data-fuse-builder-row={row.builder}
                    >
                      <td>#{row.rank}</td>
                      <td>
                        <strong>{row.name}</strong>{" "}
                        <span>(self-reported)</span>
                        {row.isFuseTestBuilder && (
                          <>
                            {" "}
                            <span>(Fuse test wallet)</span>
                          </>
                        )}
                        {row.metadata.url && (
                          <div>
                            <small>
                              URI: <code>{row.metadata.rawMetadataURI}</code>
                            </small>
                          </div>
                        )}
                      </td>
                      <td>
                        <a
                          href={row.explorerAddressUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <code>{shortenAddress(row.builder, 6)}</code>
                        </a>
                      </td>
                      <td>
                        {row.active ? "Active" : "Inactive"}
                      </td>
                      <td>
                        {row.feePercentFormatted} ({row.feeBps} bps)
                      </td>
                      <td>{row.uniqueUsers}</td>
                      <td>
                        <strong>{row.actionCount}</strong> (Swap:{" "}
                        {row.actionCounts.swap}, Save: {row.actionCounts.save},
                        Lock: {row.actionCounts.lock})
                        {row.selfReferralActionCount > 0 && (
                          <div>
                            <small>
                              {row.selfReferralActionCount} self-referral{" "}
                              {row.selfReferralActionCount === 1
                                ? "action"
                                : "actions"}{" "}
                              excluded
                            </small>
                          </div>
                        )}
                      </td>
                      {snapshot.btcUsdOracle && (
                        <td>{row.totalVolumeUsdFormatted ?? "N/A"}</td>
                      )}
                      <td>
                        {volumeTokens.length === 0 ? (
                          "0"
                        ) : (
                          <ul>
                            {volumeTokens.map((t) => (
                              <li key={t.symbol}>
                                {t.formatted} {t.symbol}
                                {t.usdFormatted ? ` (~${t.usdFormatted})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      {snapshot.btcUsdOracle && (
                        <td>{row.totalFeesUsdFormatted ?? "N/A"}</td>
                      )}
                      <td>
                        {feeTokens.length === 0 ? (
                          "0"
                        ) : (
                          <ul>
                            {feeTokens.map((t) => (
                              <li key={t.symbol}>
                                {t.formatted} {t.symbol}
                                {t.usdFormatted ? ` (~${t.usdFormatted})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/widget?builder=${row.builder}`}
                        >
                          Open in Widget
                        </Link>{" "}
                        |{" "}
                        <button
                          type="button"
                          data-fuse-x402-inspect={row.builder}
                          onClick={() =>
                            void inspectPaidAnalyticsEndpoint(row.builder)
                          }
                        >
                          Inspect x402 API (0.05 MUSD)
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {selectedBuilder && (
            <section
              aria-label="Paid Builder Analytics x402 Inspector"
              data-fuse-section="x402-inspector"
            >
              <h2>
                Paid Builder Analytics over MUSD x402:{" "}
                <code>/api/analytics/{selectedBuilder}</code>
              </h2>
              <p>
                HTTP Status:{" "}
                <strong>
                  {x402Loading
                    ? "Loading..."
                    : x402Status === 402
                      ? "402 Payment Required (MUSD x402 v2 Permit2 + EIP-2612 Gas Sponsoring)"
                      : x402Status}
                </strong>
              </p>
              <p>
                To unlock full per-user and per-action builder analytics, send{" "}
                <code>0.05 MUSD</code> on Mezo Testnet (<code>eip155:31611</code>)
                via the <code>PAYMENT-SIGNATURE</code> header, or use the{" "}
                <Link href="/builders">Builders Console (/builders)</Link>{" "}
                1-click x402 unlock button.
              </p>
              {x402Preview && (
                <pre data-fuse-x402-json="true">
                  {JSON.stringify(x402Preview, null, 2)}
                </pre>
              )}
            </section>
          )}

          <section
            aria-label="Recent Routed Events"
            data-fuse-section="recent-events"
          >
            <h2>Recent On-Chain Routed Events</h2>
            <table data-fuse-table="routed-events">
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Action</th>
                  <th>Builder (self-reported)</th>
                  <th>User</th>
                  <th>Amount In</th>
                  <th>Builder Fee</th>
                  <th>Amount Out / Lock ID</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {allRecentTransactions.map((tx) => (
                  <tr key={`${tx.transactionHash}-${tx.logIndex}`}>
                    <td>{tx.blockNumber}</td>
                    <td>{tx.action.toUpperCase()}</td>
                    <td>
                      {tx.builderName} <span>(self-reported)</span> (
                      <code>{shortenAddress(tx.builder)}</code>)
                    </td>
                    <td>
                      <a
                        href={getExplorerAddressUrl(tx.user)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <code>{shortenAddress(tx.user)}</code>
                      </a>
                    </td>
                    <td>
                      {tx.amountInFormatted} {tx.tokenInSymbol}
                      {tx.amountInUsdFormatted
                        ? ` (~${tx.amountInUsdFormatted})`
                        : ""}
                    </td>
                    <td>
                      {tx.feeFormatted} {tx.tokenInSymbol}
                      {tx.feeUsdFormatted ? ` (~${tx.feeUsdFormatted})` : ""}
                    </td>
                    <td>
                      {tx.action === "lock"
                        ? `veBTC Lock #${tx.lockId} (${tx.amountOutFormatted} BTC)`
                        : `${tx.amountOutFormatted} ${tx.tokenOutSymbol}`}
                    </td>
                    <td>
                      <a
                        href={tx.explorerTxUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <code>{shortenAddress(tx.transactionHash, 6)}</code>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
