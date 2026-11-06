"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type Address,
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
} from "viem";
import {
  type BuilderStatus,
  DEFAULT_PAID_BUILDER_TESTNET,
  FuseClient,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_CHAIN_ID,
  MEZO_TESTNET_RPC_URL,
  type RoutedEventRecord,
  getExplorerAddressUrl,
  resolveTokenSymbol,
  shortenAddress,
} from "mezo-fuse";
import { FuseShell } from "../../../components/FuseShell";
import { BuilderRatingPlate } from "../../../components/SwitchgearPrimitives";

export default function BuilderProfilePage() {
  const params = useParams<{ address: string }>();
  const rawAddress = typeof params?.address === "string" ? params.address : "";
  const targetBuilderAddress: Address = useMemo(() => {
    if (rawAddress && isAddress(rawAddress)) {
      return getAddress(rawAddress);
    }
    return DEFAULT_PAID_BUILDER_TESTNET;
  }, [rawAddress]);

  const [builderStatus, setBuilderStatus] = useState<BuilderStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<RoutedEventRecord[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const publicClient = createPublicClient({
          chain: MEZO_TESTNET_CHAIN,
          transport: http(MEZO_TESTNET_RPC_URL),
        });
        const client = new FuseClient({
          publicClient,
          addresses: MEZO_TESTNET_ADDRESSES,
          chainId: MEZO_TESTNET_CHAIN_ID,
        });
        const [status, events] = await Promise.all([
          client.getBuilderStatus(targetBuilderAddress),
          client.getRoutedEvents({ builder: targetBuilderAddress }),
        ]);
        if (!cancelled) {
          setBuilderStatus(status);
          setRecentEvents(
            [...events]
              .sort((a, b) => Number(b.blockNumber - a.blockNumber))
              .slice(0, 15),
          );
        }
      } catch {
        // Fallback state
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [targetBuilderAddress]);

  const iframeSnippet = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `<iframe
  src="${origin}/widget?builder=${targetBuilderAddress}&tab=save"
  width="440"
  height="680"
  title="Fuse Mezo DeFi Widget"
  allow="clipboard-write"
></iframe>`;
  }, [targetBuilderAddress]);

  async function handleCopy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <FuseShell>
      <main
        data-fuse-page="builder-profile"
        className="fuse-container"
        style={{ paddingTop: "32px", paddingBottom: "56px" }}
      >
        <header
          style={{
            borderBottom: "2px solid #141619",
            paddingBottom: "20px",
            marginBottom: "28px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <div className="fuse-eyebrow">
              Partner profile
            </div>
            <h1 className="fuse-display-page" style={{ marginTop: "4px" }}>
              {builderStatus?.metadata.name ?? shortenAddress(targetBuilderAddress, 6)}
            </h1>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px",
                marginTop: "6px",
              }}
            >
              <span className="fuse-tag-self-reported">Self-reported</span>
              <a
                href={getExplorerAddressUrl(targetBuilderAddress)}
                target="_blank"
                rel="noreferrer"
                className="fuse-mono"
                style={{ fontSize: "12px" }}
              >
                <code>{shortenAddress(targetBuilderAddress, 6)}</code> ↗
              </a>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link
              href={`/widget?builder=${targetBuilderAddress}&action=save`}
              className="fuse-btn fuse-btn--primary fuse-btn--hard-shadow"
            >
              Try in widget
            </Link>
            <Link
              href={`/builders?builder=${targetBuilderAddress}`}
              className="fuse-btn fuse-btn--secondary"
            >
              Open in console
            </Link>
          </div>
        </header>

        <div className="fuse-grid-12" style={{ alignItems: "start" }}>
          {/* Left 5 Columns: Builder Rating Plate & Embed Snippets */}
          <div
            className="fuse-col-5"
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {builderStatus ? (
              <BuilderRatingPlate
                builderAddress={targetBuilderAddress}
                builderName={builderStatus.metadata.name}
                feeBps={builderStatus.feeBps}
                feePercentFormatted={builderStatus.feePercentFormatted}
                registered={builderStatus.registered}
                active={builderStatus.active}
                routerPaused={builderStatus.routerPaused}
                showProfileLink={false}
              />
            ) : (
              <div className="fuse-skeleton" style={{ height: "110px", width: "100%" }} />
            )}

            <section className="fuse-panel fuse-panel--padded">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <div className="fuse-eyebrow">Embed with an iframe</div>
                <button
                  type="button"
                  onClick={() => void handleCopy("iframe", iframeSnippet)}
                  className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                >
                  {copiedKey === "iframe" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="fuse-code-block">
                <code>{iframeSnippet}</code>
              </pre>
            </section>
          </div>

          {/* Right 7 Columns: Recent On-Chain Routed Events */}
          <div className="fuse-col-7">
            <section className="fuse-panel fuse-panel--padded">
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
                <div>
                  <div className="fuse-eyebrow">Activity</div>
                  <h2 className="fuse-section-title" style={{ marginTop: "2px" }}>
                    Recent actions ({recentEvents.length})
                  </h2>
                </div>
                <Link href="/leaderboard" className="fuse-mono" style={{ fontSize: "12px" }}>
                  See the leaderboard
                </Link>
              </div>

              {recentEvents.length === 0 ? (
                <p style={{ fontSize: "14px", color: "#4E535A", padding: "12px 0" }}>
                  No actions yet for this partner.
                </p>
              ) : (
                <div className="fuse-table-wrap">
                  <table className="fuse-table">
                    <thead>
                      <tr>
                        <th className="fuse-num">Block</th>
                        <th>Action</th>
                        <th>User</th>
                        <th className="fuse-num">Amount In</th>
                        <th className="fuse-num">Fee</th>
                        <th className="fuse-num">Output</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEvents.map((ev) => {
                        const tokenInSym = resolveTokenSymbol(ev.tokenIn);
                        const tokenOutSym = resolveTokenSymbol(ev.tokenOut);
                        return (
                          <tr key={`${ev.transactionHash}-${ev.logIndex}`}>
                            <td className="fuse-num fuse-mono">{ev.blockNumber.toString()}</td>
                            <td>
                              <span className="fuse-status-chip fuse-status-chip--zero-fee">
                                {ev.action.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <a
                                href={getExplorerAddressUrl(ev.user)}
                                target="_blank"
                                rel="noreferrer"
                                className="fuse-mono"
                                style={{ fontSize: "12px" }}
                              >
                                <code>{shortenAddress(ev.user, 6)}</code> ↗
                              </a>
                            </td>
                            <td className="fuse-num fuse-mono">
                              {formatUnits(ev.amountIn, 18)} {tokenInSym}
                            </td>
                            <td className="fuse-num fuse-mono" style={{ color: "#9E3B0E" }}>
                              {formatUnits(ev.fee, 18)} {tokenInSym}
                            </td>
                            <td className="fuse-num fuse-mono">
                              {ev.action === "lock"
                                ? `Lock #${ev.lockId.toString()}`
                                : `${formatUnits(ev.amountOut, 18)} ${tokenOutSym}`}
                            </td>
                            <td>
                              <Link
                                href={`/receipt/${ev.transactionHash}`}
                                className="fuse-mono"
                                style={{ fontSize: "12px", fontWeight: 700 }}
                              >
                                Receipt
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </FuseShell>
  );
}
