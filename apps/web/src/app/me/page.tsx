"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useWalletAccount } from "@mezo-org/passport";
import { isAddress } from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  MEZO_TESTNET_ADDRESSES,
  getExplorerAddressUrl,
  shortenAddress,
} from "mezo-fuse";
import { FuseShell } from "../../components/FuseShell";
import {
  FuseIntactSchematicSvg,
  FuseWalletControl,
} from "../../components/SwitchgearPrimitives";
import { useLeaderboard } from "../../hooks/useLeaderboard";
import { useUserBuilderCaps } from "../../hooks/useUserBuilderCaps";

export default function UserCapsPage() {
  const { snapshot, isLoading } = useLeaderboard({ initialSort: "users" });
  const buildersList = snapshot?.builders ?? [];
  const { isConnected } = useWalletAccount();
  const builderAddresses = useMemo(
    () => buildersList.map((builder) => builder.builder).filter((builder) => isAddress(builder)),
    [buildersList],
  );
  const {
    statuses,
    isLoading: isLoadingCaps,
    error: capsError,
    actionBuilder,
    action,
    actionError,
    lastActionExplorerUrl,
    approveBuilder,
    revokeBuilder,
  } = useUserBuilderCaps(builderAddresses);

  const getBuilderStatus = (builder: string) => statuses[builder.toLowerCase()];

  return (
    <FuseShell btcUsdFormatted={snapshot?.btcUsdOracle?.formattedUsd}>
      <main
        data-fuse-page="my-caps"
        className="fuse-container"
        style={{ paddingTop: "32px", paddingBottom: "56px" }}
      >
        <header
          style={{
            borderBottom: "2px solid #141619",
            paddingBottom: "20px",
            marginBottom: "24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <div className="fuse-eyebrow">
              Your account
            </div>
            <h1 className="fuse-display-page" style={{ marginTop: "4px" }}>
              My fee caps
            </h1>
            <p
              style={{
                marginTop: "8px",
                color: "#4E535A",
                maxWidth: "68ch",
                fontSize: "15px",
              }}
            >
              Review the most each partner can charge you on{" "}
              <code>FuseRouter</code> (
              <a
                href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.fuseRouter)}
                target="_blank"
                rel="noreferrer"
              >
                <code>{shortenAddress(MEZO_TESTNET_ADDRESSES.fuseRouter, 6)}</code>
              </a>
              ). A partner can never charge more than the cap you approve, and you can revoke any partner at any time.
            </p>
          </div>

          <FuseWalletControl />
        </header>

        <section className="fuse-panel fuse-panel--padded" style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <div className="fuse-eyebrow">How caps protect you</div>
              <p style={{ fontSize: "14px", color: "#4E535A", marginTop: "4px", maxWidth: "64ch" }}>
                If a partner raises their fee above your cap, the transaction is blocked before you sign anything.
              </p>
            </div>
            <span className="fuse-status-chip fuse-status-chip--approved">
              <FuseIntactSchematicSvg color="#1D6340" />
              <span>Enforced on-chain</span>
            </span>
          </div>
        </section>

        {capsError && (
          <div role="alert" className="fuse-alert fuse-alert--tripped" style={{ marginBottom: "16px" }}>
            <strong>Could not read your caps:</strong> {capsError}
          </div>
        )}
        {actionError && (
          <div role="alert" className="fuse-alert fuse-alert--tripped" style={{ marginBottom: "16px" }}>
            <strong>Cap update failed:</strong> {actionError}
          </div>
        )}
        {lastActionExplorerUrl && (
          <div role="status" className="fuse-alert fuse-alert--approved" style={{ marginBottom: "16px" }}>
            Cap update confirmed. {" "}
            <a href={lastActionExplorerUrl} target="_blank" rel="noreferrer">
              View transaction ↗
            </a>
          </div>
        )}

        {/* Builders Cap Table */}
        <section aria-label="Registered Builders and Cap Controls">
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
            <h2 className="fuse-section-title">Partners</h2>
            <span className="fuse-mono" style={{ fontSize: "12px", color: "#4E535A" }}>
              Open a partner to approve, change, or revoke your cap
            </span>
          </div>

          <div className="fuse-table-wrap">
            <table className="fuse-table">
              <thead>
                <tr>
                  <th>Partner (self-reported)</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th className="fuse-num">Fee</th>
                  <th>Your protection</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && buildersList.length === 0 ? (
                  [1, 2].map((idx) => (
                    <tr key={idx}>
                      <td colSpan={6}>
                        <div className="fuse-skeleton" style={{ height: "22px", width: "100%" }} />
                      </td>
                    </tr>
                  ))
                ) : buildersList.length > 0 ? (
                  buildersList.map((b) => {
                    const status = getBuilderStatus(b.builder);
                    const isPending = actionBuilder?.toLowerCase() === b.builder.toLowerCase();
                    const protectionText = !isConnected
                      ? "Connect wallet to read your cap"
                      : isLoadingCaps && !status
                        ? "Reading your on-chain cap..."
                        : !status
                          ? "Cap unavailable"
                          : !status.active
                            ? "Partner inactive. Cap can still be managed."
                          : status.needsHigherApproval
                            ? `Blocked above your ${status.userMaxFeeBps} bps cap`
                            : status.userApproved
                              ? `Approved up to ${status.userMaxFeePercentFormatted}`
                              : "Approval required, including at 0 bps";
                    const statusLabel = !isConnected
                      ? "Connect wallet"
                      : isLoadingCaps && !status
                        ? "Reading..."
                        : !status
                          ? "Unavailable"
                          : !status.active
                            ? "Inactive"
                          : status.needsHigherApproval
                            ? "Blocked"
                            : status.userApproved
                              ? "Approved"
                              : "Approval needed";

                    return (
                    <tr key={b.builder}>
                      <td>
                        <Link
                          href={`/builders/${b.builder}`}
                          style={{ fontWeight: 700, color: "#141619", textDecoration: "none" }}
                        >
                          {b.name}
                        </Link>{" "}
                        <span className="fuse-tag-self-reported">Self-reported</span>
                      </td>
                      <td>
                        <a
                          href={b.explorerAddressUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="fuse-mono"
                          style={{ fontSize: "12px" }}
                        >
                          <code>{shortenAddress(b.builder, 6)}</code> ↗
                        </a>
                      </td>
                      <td>
                        <span
                          className={`fuse-status-chip ${
                            status?.active ?? b.active
                              ? "fuse-status-chip--approved"
                              : "fuse-status-chip--zero-fee"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="fuse-num fuse-mono">
                        {(status?.feeBps ?? b.feeBps) === 0
                          ? "0.00% (free)"
                          : `${status?.feePercentFormatted ?? b.feePercentFormatted} (${status?.feeBps ?? b.feeBps} bps)`}
                      </td>
                      <td style={{ fontSize: "13px", color: "#4E535A" }}>
                        {protectionText}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {status && !status.userApproved && (
                            <button
                              type="button"
                              className="fuse-btn fuse-btn--primary fuse-btn--sm"
                              disabled={isPending}
                              onClick={() => void approveBuilder(status.address, status.feeBps)}
                            >
                              {isPending && action === "approve"
                                ? "Approving..."
                                : `Approve ${status.feePercentFormatted}`}
                            </button>
                          )}
                          {status?.needsHigherApproval && (
                            <button
                              type="button"
                              className="fuse-btn fuse-btn--primary fuse-btn--sm"
                              disabled={isPending}
                              onClick={() => void approveBuilder(status.address, status.feeBps)}
                            >
                              {isPending && action === "approve"
                                ? "Approving..."
                                : `Raise to ${status.feePercentFormatted}`}
                            </button>
                          )}
                          {status?.userApproved && (
                            <button
                              type="button"
                              className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                              disabled={isPending}
                              onClick={() => void revokeBuilder(status.address)}
                            >
                              {isPending && action === "revoke" ? "Revoking..." : "Revoke"}
                            </button>
                          )}
                          <Link
                            href={`/widget?builder=${b.builder}&action=save`}
                            className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                          >
                            Open widget
                          </Link>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#4E535A" }}>
                      No partners found yet. Partners appear here once they register on Fuse.
                    </td>
                  </tr>                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
            <Link
              href={`/widget?builder=${DEFAULT_PAID_BUILDER_TESTNET}&action=save`}
              className="fuse-btn fuse-btn--primary fuse-btn--sm"
            >
              Try the 0.15% fee partner
            </Link>
            <Link
              href={`/widget?builder=${DEFAULT_ZERO_FEE_BUILDER_TESTNET}&action=save`}
              className="fuse-btn fuse-btn--secondary fuse-btn--sm"
            >
              Try the no fee partner
            </Link>
          </div>
        </section>
      </main>
    </FuseShell>
  );
}
