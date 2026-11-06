"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  type LeaderboardActionFilter,
  type LeaderboardSortBy,
  getExplorerAddressUrl,
  shortenAddress,
} from "mezo-fuse";
import { FuseShell } from "../../components/FuseShell";
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
    <FuseShell btcUsdFormatted={snapshot?.btcUsdOracle?.formattedUsd}>
      <main
        data-fuse-page="leaderboard"
        className="fuse-container"
        style={{ paddingTop: "32px", paddingBottom: "48px" }}
      >
        {/* 1. Header & Oracle Context Bar */}
        <header
          data-fuse-header="leaderboard"
          style={{
            borderBottom: "2px solid #141619",
            paddingBottom: "20px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <span className="fuse-eyebrow">
              Mezo Testnet
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <a
                href="/api/leaderboard"
                target="_blank"
                rel="noreferrer"
                className="fuse-mono"
                style={{ fontSize: "12px" }}
              >
                Download JSON ↗
              </a>
            </div>
          </div>

          <h1 className="fuse-display-page">Partner leaderboard</h1>

          <p
            style={{
              marginTop: "8px",
              color: "#4E535A",
              maxWidth: "72ch",
              fontSize: "15px",
            }}
          >
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
              <code>{shortenAddress("0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4", 6)}</code>
            </a>
            ). Self-referrals (<code>user == builder</code>) are excluded from rankings. All builder names are permissionlessly{" "}
            <span className="fuse-tag-self-reported">Self-reported</span>.
          </p>
        </header>

        {/* 2. Protocol Summary Strip */}
        {snapshot && (
          <section
            aria-label="Protocol Summary"
            data-fuse-section="protocol-summary"
            className="fuse-panel"
            style={{ marginBottom: "24px" }}
          >
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderRight: "1px solid #DAD5C9",
                  borderBottom: "1px solid #DAD5C9",
                }}
              >
                <dt className="fuse-eyebrow">Partners</dt>
                <dd
                  data-fuse-summary="registered-builders"
                  className="fuse-num"
                  style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}
                >
                  {snapshot.totals.registeredBuilders}{" "}
                  <span style={{ fontSize: "12px", fontWeight: 400, color: "#4E535A" }}>
                    ({snapshot.totals.activeBuilders} active)
                  </span>
                </dd>
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  borderRight: "1px solid #DAD5C9",
                  borderBottom: "1px solid #DAD5C9",
                }}
              >
                <dt className="fuse-eyebrow">People routed</dt>
                <dd
                  data-fuse-summary="unique-users"
                  className="fuse-num"
                  style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}
                >
                  {snapshot.totals.uniqueUsers}
                </dd>
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  borderRight: "1px solid #DAD5C9",
                  borderBottom: "1px solid #DAD5C9",
                }}
              >
                <dt className="fuse-eyebrow">Actions ({snapshot.actionFilter})</dt>
                <dd
                  data-fuse-summary="total-actions"
                  className="fuse-num"
                  style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}
                >
                  {snapshot.totals.totalActions}
                </dd>
              </div>

              {snapshot.totals.excludedSelfReferralActions > 0 && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRight: "1px solid #DAD5C9",
                    borderBottom: "1px solid #DAD5C9",
                  }}
                >
                  <dt className="fuse-eyebrow">Self-referrals excluded</dt>
                  <dd
                    data-fuse-summary="excluded-self-referral-actions"
                    className="fuse-mono fuse-num"
                    style={{ fontSize: "13px", fontWeight: 700, marginTop: "6px", color: "#4E535A" }}
                  >
                    {snapshot.totals.excludedSelfReferralActions} self-referral{" "}
                    {snapshot.totals.excludedSelfReferralActions === 1
                      ? "action"
                      : "actions"}{" "}
                    excluded
                  </dd>
                </div>
              )}

              {snapshot.btcUsdOracle &&
                snapshot.totals.totalVolumeUsdFormatted && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRight: "1px solid #DAD5C9",
                      borderBottom: "1px solid #DAD5C9",
                    }}
                  >
                    <dt className="fuse-eyebrow">Volume (USD)</dt>
                    <dd
                      data-fuse-summary="total-volume-usd"
                      className="fuse-num"
                      style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}
                    >
                      {snapshot.totals.totalVolumeUsdFormatted}
                    </dd>
                  </div>
                )}

              {snapshot.btcUsdOracle &&
                snapshot.totals.totalFeesUsdFormatted && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRight: "1px solid #DAD5C9",
                      borderBottom: "1px solid #DAD5C9",
                    }}
                  >
                    <dt className="fuse-eyebrow">Partner fees earned (USD)</dt>
                    <dd
                      data-fuse-summary="total-fees-usd"
                      className="fuse-num"
                      style={{
                        fontSize: "20px",
                        fontWeight: 700,
                        marginTop: "4px",
                        color: "#9E3B0E",
                      }}
                    >
                      {snapshot.totals.totalFeesUsdFormatted}
                    </dd>
                  </div>
                )}

              {snapshot.btcUsdOracle && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRight: "1px solid #DAD5C9",
                    borderBottom: "1px solid #DAD5C9",
                  }}
                >
                  <dt className="fuse-eyebrow">BTC price</dt>
                  <dd
                    data-fuse-summary="btc-usd-oracle"
                    className="fuse-mono fuse-num"
                    style={{ fontSize: "13px", fontWeight: 700, marginTop: "6px" }}
                  >
                    {snapshot.btcUsdOracle.formattedUsd}{" "}
                    <span style={{ fontWeight: 400, color: "#4E535A" }}>
                      (Round {snapshot.btcUsdOracle.roundId})
                    </span>
                  </dd>
                </div>
              )}

              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #DAD5C9",
                }}
              >
                <dt className="fuse-eyebrow">Blocks covered</dt>
                <dd
                  data-fuse-summary="block-range"
                  className="fuse-mono fuse-num"
                  style={{ fontSize: "12px", marginTop: "6px", color: "#4E535A" }}
                >
                  {snapshot.fromBlock} -&gt; {snapshot.toBlock}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {/* 3. Filter & Sort Control Bar */}
        <section
          aria-label="Leaderboard Controls"
          data-fuse-section="controls"
          className="fuse-panel"
          style={{
            padding: "12px 16px",
            marginBottom: "24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <fieldset style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
            <legend className="fuse-sr-only">Action Filter</legend>
            <span className="fuse-eyebrow" style={{ marginRight: "6px" }}>
              Action:
            </span>
            {(["all", "swap", "save", "lock"] as LeaderboardActionFilter[]).map(
              (act) => {
                const active = actionFilter === act;
                return (
                  <button
                    key={act}
                    type="button"
                    data-fuse-action-filter={act}
                    aria-pressed={active}
                    onClick={() => setActionFilter(act)}
                    className={`fuse-btn fuse-btn--sm ${
                      active ? "fuse-btn--primary" : "fuse-btn--secondary"
                    }`}
                  >
                    {act === "all"
                      ? "All actions"
                      : act.charAt(0).toUpperCase() + act.slice(1)}
                  </button>
                );
              },
            )}
          </fieldset>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
            <label htmlFor="fuse-leaderboard-sort" className="fuse-eyebrow">
              Sort by:
            </label>
            <select
              id="fuse-leaderboard-sort"
              data-fuse-sort-select="true"
              className="fuse-select"
              style={{ minHeight: "34px", padding: "4px 28px 4px 10px", fontSize: "13px" }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as LeaderboardSortBy)}
            >
              <option value="users">Unique Users</option>
              <option value="volumeUsd">Volume (USD)</option>
              <option value="feesUsd">Partner fees (USD)</option>
              <option value="actions">Number of actions</option>
            </select>

            <button
              type="button"
              data-fuse-refresh="true"
              onClick={() => void refresh()}
              disabled={isLoading}
              className="fuse-btn fuse-btn--secondary fuse-btn--sm"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </section>

        {/* Error State */}
        {error && (
          <section
            role="alert"
            data-fuse-error="leaderboard"
            className="fuse-alert fuse-alert--tripped"
            style={{ marginBottom: "24px" }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <p>
                <strong>Could not load the leaderboard:</strong> {error}
              </p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="fuse-btn fuse-btn--secondary fuse-btn--sm"
              >
                Try again
              </button>
            </div>
          </section>
        )}

        {/* Loading Skeleton Table */}
        {isLoading && !snapshot && (
          <section
            aria-label="Loading Builder Rankings"
            className="fuse-panel"
            style={{ marginBottom: "32px" }}
          >
            <div className="fuse-table-wrap">
              <table className="fuse-table">
                <thead>
                  <tr>
                    <th className="fuse-num">Rank</th>
                    <th>Builder Name</th>
                    <th>Fee</th>
                    <th className="fuse-num">Unique Users</th>
                    <th className="fuse-num">Actions</th>
                    <th className="fuse-num">Volume (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4].map((idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="fuse-skeleton" style={{ height: "18px", width: "28px" }} />
                      </td>
                      <td>
                        <div className="fuse-skeleton" style={{ height: "18px", width: "180px" }} />
                      </td>
                      <td>
                        <div className="fuse-skeleton" style={{ height: "18px", width: "70px" }} />
                      </td>
                      <td>
                        <div className="fuse-skeleton" style={{ height: "18px", width: "40px", marginLeft: "auto" }} />
                      </td>
                      <td>
                        <div className="fuse-skeleton" style={{ height: "18px", width: "60px", marginLeft: "auto" }} />
                      </td>
                      <td>
                        <div className="fuse-skeleton" style={{ height: "18px", width: "80px", marginLeft: "auto" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. Primary Swiss Ruled Rankings Table */}
        {snapshot && (
          <>
            <section
              aria-label="Builder Rankings"
              data-fuse-section="builder-rankings"
              style={{ marginBottom: "32px" }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                <h2 className="fuse-section-title">Ranked partners</h2>
                <span className="fuse-mono" style={{ fontSize: "12px", color: "#4E535A" }}>
                  Select a partner to see their profile
                </span>
              </div>

              {snapshot.builders.length === 0 ? (
                <div className="fuse-panel fuse-panel--padded" style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "15px", marginBottom: "12px" }}>
                    No partners match this filter yet.
                  </p>
                  <Link href="/builders" className="fuse-btn fuse-btn--primary fuse-btn--sm">
                    Become a partner
                  </Link>
                </div>
              ) : (
                <div className="fuse-table-wrap">
                  <table className="fuse-table" data-fuse-table="builders">
                    <thead>
                      <tr>
                        <th className="fuse-num">Rank</th>
                        <th>Partner (self-reported)</th>
                        <th className="fuse-col-hide-mobile">Address</th>
                        <th className="fuse-col-hide-mobile">Status</th>
                        <th className="fuse-num">Fee</th>
                        <th className="fuse-num">Unique Users</th>
                        <th className="fuse-num">Actions</th>
                        {snapshot.btcUsdOracle && <th className="fuse-num">Volume (USD)</th>}
                        <th className="fuse-num fuse-col-hide-mobile">Volume by Token</th>
                        {snapshot.btcUsdOracle && <th className="fuse-num">Fees Earned (USD)</th>}
                        <th className="fuse-num fuse-col-hide-mobile">Fees by Token</th>
                        <th>Analytics</th>
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
                            <td className="fuse-num fuse-mono" style={{ fontWeight: 700 }}>
                              #{row.rank}
                            </td>

                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Link
                                  href={`/builders/${row.builder}`}
                                  style={{
                                    color: "#141619",
                                    fontWeight: 700,
                                    textDecoration: "none",
                                  }}
                                >
                                  <strong>{row.name}</strong>
                                </Link>
                                <span className="fuse-tag-self-reported">
                                  Self-reported
                                </span>
                                {row.isFuseTestBuilder && (
                                  <span
                                    className="fuse-status-chip fuse-status-chip--zero-fee"
                                    style={{ fontSize: "10px", padding: "1px 5px" }}
                                  >
                                    Fuse test wallet
                                  </span>
                                )}
                              </div>
                              {row.metadata.url && (
                                <div style={{ marginTop: "2px" }}>
                                  <small className="fuse-mono" style={{ fontSize: "11px", color: "#4E535A" }}>
                                    URI: <code>{row.metadata.rawMetadataURI}</code>
                                  </small>
                                </div>
                              )}
                            </td>

                            <td className="fuse-col-hide-mobile">
                              <a
                                href={row.explorerAddressUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="fuse-mono"
                                style={{ fontSize: "12px" }}
                              >
                                <code>{shortenAddress(row.builder, 6)}</code> ↗
                              </a>
                            </td>

                            <td className="fuse-col-hide-mobile">
                              <span
                                className={`fuse-status-chip ${
                                  row.active
                                    ? "fuse-status-chip--approved"
                                    : "fuse-status-chip--zero-fee"
                                }`}
                              >
                                {row.active ? "Active" : "Inactive"}
                              </span>
                            </td>

                            <td className="fuse-num fuse-mono">
                              {row.feeBps === 0 ? (
                                <span className="fuse-status-chip fuse-status-chip--zero-fee">
                                  0.00% (0 bps)
                                </span>
                              ) : (
                                <>
                                  {row.feePercentFormatted} ({row.feeBps} bps)
                                </>
                              )}
                            </td>

                            <td
                              className="fuse-num"
                              style={{ fontWeight: 700, fontSize: "15px" }}
                            >
                              {row.uniqueUsers}
                            </td>

                            <td className="fuse-num">
                              <div>
                                <strong>{row.actionCount}</strong>{" "}
                                <span
                                  className="fuse-mono"
                                  style={{ fontSize: "11px", color: "#4E535A" }}
                                >
                                  (S:{row.actionCounts.swap} / V:{row.actionCounts.save} / L:
                                  {row.actionCounts.lock})
                                </span>
                              </div>
                              {row.selfReferralActionCount > 0 && (
                                <div style={{ marginTop: "2px" }}>
                                  <small
                                    className="fuse-mono"
                                    style={{ fontSize: "11px", color: "#4E535A" }}
                                  >
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
                              <td className="fuse-num" style={{ fontWeight: 700 }}>
                                {row.totalVolumeUsdFormatted ?? "N/A"}
                              </td>
                            )}

                            <td className="fuse-num fuse-col-hide-mobile">
                              {volumeTokens.length === 0 ? (
                                <span className="fuse-mono" style={{ color: "#4E535A" }}>
                                  0
                                </span>
                              ) : (
                                <ul
                                  style={{
                                    listStyle: "none",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                    fontSize: "12px",
                                  }}
                                  className="fuse-mono"
                                >
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
                              <td
                                className="fuse-num"
                                style={{ fontWeight: 700, color: "#9E3B0E" }}
                              >
                                {row.totalFeesUsdFormatted ?? "N/A"}
                              </td>
                            )}

                            <td className="fuse-num fuse-col-hide-mobile">
                              {feeTokens.length === 0 ? (
                                <span className="fuse-mono" style={{ color: "#4E535A" }}>
                                  0
                                </span>
                              ) : (
                                <ul
                                  style={{
                                    listStyle: "none",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                    fontSize: "12px",
                                  }}
                                  className="fuse-mono"
                                >
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
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                {row.registeredOnCurrentRouter ? (
                                  <Link
                                    href={`/widget?builder=${row.builder}`}
                                    className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                                  >
                                    Try in widget
                                  </Link>
                                ) : (
                                  <span
                                    className="fuse-status-chip fuse-status-chip--zero-fee"
                                    style={{ fontSize: "11px" }}
                                  >
                                    Previous router only
                                  </span>
                                )}
                                <button
                                  type="button"
                                  data-fuse-x402-inspect={row.builder}
                                  onClick={() =>
                                    void inspectPaidAnalyticsEndpoint(row.builder)
                                  }
                                  className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                                >
                                  Preview analytics
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 5. Paid Analytics x402 Inspector Panel */}
            {selectedBuilder && (
              <section
                aria-label="Paid Builder Analytics x402 Inspector"
                data-fuse-section="x402-inspector"
                className="fuse-panel fuse-panel--strong fuse-panel--padded"
                style={{ marginBottom: "32px" }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <h2 className="fuse-section-title">
                    Paid Builder Analytics over MUSD x402:{" "}
                    <code>/api/analytics/{shortenAddress(selectedBuilder, 6)}</code>
                  </h2>
                  <span className="fuse-status-chip fuse-status-chip--attention">
                    {x402Loading
                      ? "REQUESTING..."
                      : x402Status === 402
                        ? "HTTP 402 PAYMENT REQUIRED · 0.05 MUSD"
                        : `HTTP ${x402Status}`}
                  </span>
                </div>

                <p style={{ fontSize: "13px", color: "#4E535A", marginBottom: "12px" }}>
                  To unlock full per-user and per-action builder analytics, send{" "}
                  <code>0.05 MUSD</code> on Mezo Testnet (<code>eip155:31611</code>)
                  via the <code>PAYMENT-SIGNATURE</code> header, or use the{" "}
                  <Link href={`/builders?builder=${selectedBuilder}`}>
                    Builders Console (/builders)
                  </Link>{" "}
                  1-click x402 unlock button.
                </p>

                {x402Preview && (
                  <pre className="fuse-code-block" data-fuse-x402-json="true">
                    {JSON.stringify(x402Preview, null, 2)}
                  </pre>
                )}
              </section>
            )}

            {/* 6. Recent On-Chain Routed Events */}
            <section
              aria-label="Recent Routed Events"
              data-fuse-section="recent-events"
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                <h2 className="fuse-section-title">Recent On-Chain Routed Events</h2>
                <span className="fuse-eyebrow">
                  CANONICAL ROUTED EVENT STREAM
                </span>
              </div>

              <div className="fuse-table-wrap">
                <table className="fuse-table" data-fuse-table="routed-events">
                  <thead>
                    <tr>
                      <th className="fuse-num">Block</th>
                      <th>Action</th>
                      <th>Builder (self-reported)</th>
                      <th className="fuse-col-hide-mobile">User</th>
                      <th className="fuse-num">Amount In</th>
                      <th className="fuse-num">Builder Fee</th>
                      <th className="fuse-num">Amount Out / Lock ID</th>
                      <th>Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRecentTransactions.map((tx) => (
                      <tr key={`${tx.transactionHash}-${tx.logIndex}`}>
                        <td className="fuse-num fuse-mono">{tx.blockNumber}</td>
                        <td>
                          <span className="fuse-status-chip fuse-status-chip--zero-fee">
                            {tx.action.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/builders/${tx.builder}`}
                            style={{ fontWeight: 700, color: "#141619", textDecoration: "none" }}
                          >
                            {tx.builderName}
                          </Link>{" "}
                          <span className="fuse-tag-self-reported">Self-reported</span>{" "}
                          <code className="fuse-mono" style={{ fontSize: "11px", color: "#4E535A" }}>
                            ({shortenAddress(tx.builder)})
                          </code>
                        </td>
                        <td className="fuse-col-hide-mobile">
                          <a
                            href={getExplorerAddressUrl(tx.user)}
                            target="_blank"
                            rel="noreferrer"
                            className="fuse-mono"
                            style={{ fontSize: "12px" }}
                          >
                            <code>{shortenAddress(tx.user)}</code> ↗
                          </a>
                        </td>
                        <td className="fuse-num fuse-mono">
                          {tx.amountInFormatted} {tx.tokenInSymbol}
                          {tx.amountInUsdFormatted
                            ? ` (~${tx.amountInUsdFormatted})`
                            : ""}
                        </td>
                        <td className="fuse-num fuse-mono" style={{ color: "#9E3B0E" }}>
                          {tx.feeFormatted} {tx.tokenInSymbol}
                          {tx.feeUsdFormatted ? ` (~${tx.feeUsdFormatted})` : ""}
                        </td>
                        <td className="fuse-num fuse-mono">
                          {tx.action === "lock"
                            ? `veBTC Lock #${tx.lockId} (${tx.amountOutFormatted} BTC)`
                            : `${tx.amountOutFormatted} ${tx.tokenOutSymbol}`}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Link
                              href={`/receipt/${tx.transactionHash}`}
                              className="fuse-mono"
                              style={{ fontSize: "12px", fontWeight: 700 }}
                            >
                              Receipt
                            </Link>
                            <a
                              href={tx.explorerTxUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="fuse-mono"
                              style={{ fontSize: "12px" }}
                            >
                              <code>{shortenAddress(tx.transactionHash, 5)}</code> ↗
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </FuseShell>
  );
}
