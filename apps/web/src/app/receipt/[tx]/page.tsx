"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  MEZO_TESTNET_ADDRESSES,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  shortenAddress,
} from "mezo-fuse";
import { FuseShell } from "../../../components/FuseShell";
import { FuseIntactSchematicSvg } from "../../../components/SwitchgearPrimitives";

export default function ReceiptPage() {
  const params = useParams<{ tx: string }>();
  const rawTx = typeof params?.tx === "string" ? params.tx : "";
  const [copiedLink, setCopiedLink] = useState(false);

  async function handleCopyReceiptUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <FuseShell>
      <main
        data-fuse-page="receipt"
        className="fuse-container"
        style={{ paddingTop: "32px", paddingBottom: "56px" }}
      >
        <div style={{ maxWidth: "680px", marginInline: "auto" }}>
          <header
            style={{
              borderBottom: "2px solid #141619",
              paddingBottom: "16px",
              marginBottom: "24px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div>
              <div className="fuse-eyebrow">
                Mezo Testnet
              </div>
              <h1 className="fuse-display-page" style={{ marginTop: "4px" }}>
                Transaction receipt
              </h1>
            </div>

            <span className="fuse-status-chip fuse-status-chip--approved">
              <FuseIntactSchematicSvg color="#1D6340" />
              <span>Confirmed on-chain</span>
            </span>
          </header>

          <section
            aria-label="Transaction Receipt Details"
            className="fuse-panel fuse-panel--strong fuse-panel--padded"
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                paddingBottom: "12px",
                marginBottom: "14px",
                borderBottom: "1px solid #DAD5C9",
              }}
            >
              <div>
                <div className="fuse-eyebrow">Transaction</div>
                <code className="fuse-mono" style={{ fontSize: "13px", fontWeight: 700 }}>
                  {rawTx ? shortenAddress(rawTx, 6) : ""}
                </code>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void handleCopyReceiptUrl()}
                  className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                >
                  {copiedLink ? "Link copied" : "Copy link"}
                </button>
                {rawTx && (
                  <a
                    href={getExplorerTxUrl(rawTx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fuse-btn fuse-btn--primary fuse-btn--sm"
                  >
                    View on explorer ↗
                  </a>
                )}
              </div>
            </div>

            {/* Dotted Leader-Line Receipt */}
            <dl className="fuse-receipt">
              <div className="fuse-receipt__row">
                <dt className="fuse-receipt__term">Transaction hash</dt>
                <span className="fuse-receipt__dots" />
                <dd className="fuse-receipt__val">
                  {rawTx ? (
                    <a
                      href={getExplorerTxUrl(rawTx)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <code>{shortenAddress(rawTx, 6)}</code> ↗
                    </a>
                  ) : (
                    "N/A"
                  )}
                </dd>
              </div>

              <div className="fuse-receipt__row">
                <dt className="fuse-receipt__term">Network</dt>
                <span className="fuse-receipt__dots" />
                <dd className="fuse-receipt__val">Mezo Testnet</dd>
              </div>

              <div className="fuse-receipt__row">
                <dt className="fuse-receipt__term">Fuse contract</dt>
                <span className="fuse-receipt__dots" />
                <dd className="fuse-receipt__val">
                  <a
                    href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.fuseRouter)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <code>{shortenAddress(MEZO_TESTNET_ADDRESSES.fuseRouter, 6)}</code> ↗
                  </a>
                </dd>
              </div>

              <div className="fuse-receipt__row">
                <dt className="fuse-receipt__term">Event</dt>
                <span className="fuse-receipt__dots" />
                <dd className="fuse-receipt__val">
                  <code>Routed</code>
                </dd>
              </div>

              <div className="fuse-receipt__row">
                <dt className="fuse-receipt__term">Custody</dt>
                <span className="fuse-receipt__dots" />
                <dd className="fuse-receipt__val">Fuse keeps no funds</dd>
              </div>
            </dl>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: "1px solid #DAD5C9",
              }}
            >
              <Link
                href={`/widget?builder=${DEFAULT_PAID_BUILDER_TESTNET}&action=save`}
                className="fuse-btn fuse-btn--secondary fuse-btn--sm"
              >
                Make another transaction
              </Link>
              <Link href="/leaderboard" className="fuse-mono" style={{ fontSize: "12px" }}>
                See the leaderboard
              </Link>
            </div>
          </section>
        </div>
      </main>
    </FuseShell>
  );
}
