"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  MAX_FEE_BPS,
  getExplorerAddressUrl,
  resolveTokenSymbol,
  shortenAddress,
} from "mezo-fuse";
import { useBuilderConsole } from "../hooks/useBuilderConsole";
import {
  BuilderRatingPlate,
  FuseIntactSchematicSvg,
  FuseOpenSwitchSchematicSvg,
  FuseWalletControl,
} from "./SwitchgearPrimitives";

export interface BuildersConsoleProps {
  initialBuilderAddress?: string | null;
}

export function BuildersConsole({
  initialBuilderAddress,
}: BuildersConsoleProps) {
  const state = useBuilderConsole({ initialBuilderAddress });
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<"iframe" | "react" | "sdk">("iframe");

  async function copyToClipboard(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(key);
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch {
      // Fallback
    }
  }

  const isViewingOtherBuilder = Boolean(
    state.isConnected &&
      state.accountAddress &&
      state.targetBuilderAddress.toLowerCase() !== state.accountAddress.toLowerCase(),
  );

  return (
    <div data-fuse-console="builders" className="fuse-grid-12" style={{ alignItems: "start" }}>
      {/* LEFT 5 COLUMNS: Wallet, Registration/Fee Management, and Builder Inspector */}
      <div
        className="fuse-col-5"
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        {/* Stage 01: Connect your wallet */}
        <section
          aria-label="Wallet Connection"
          data-fuse-section="wallet"
          className="fuse-panel fuse-panel--padded"
        >
          <div className="fuse-eyebrow" style={{ color: "#9E3B0E", marginBottom: "4px" }}>
            Wallet
          </div>
          <h2 className="fuse-section-title" style={{ marginBottom: "10px" }}>
            Connect your wallet
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div data-fuse-passport-connect="builders">
              <FuseWalletControl label="Connect your wallet" />
            </div>

            {state.isConnected && (
              <span className="fuse-status-chip fuse-status-chip--approved">
                Connected
              </span>
            )}
          </div>

          {state.isConnected && (
            <p
              data-fuse-connected-account={state.accountAddress ?? ""}
              className="fuse-mono"
              style={{ fontSize: "12px", color: "#4E535A", marginTop: "10px" }}
            >
              Account: <code>{state.accountAddress}</code>
              {state.walletAddress && state.walletAddress !== state.accountAddress
                ? ` (Signer: ${shortenAddress(state.walletAddress, 6)})`
                : ""}
            </p>
          )}

          {state.isWrongNetwork && (
            <div
              role="alert"
              data-fuse-alert="wrong-network"
              className="fuse-alert fuse-alert--attention"
              style={{ marginTop: "10px" }}
            >
              <div className="fuse-alert__title">
                <FuseOpenSwitchSchematicSvg color="#7C4D07" />
                <span>Wrong network</span>
              </div>
              <p style={{ fontSize: "12px", marginBottom: "8px" }}>
                Your wallet is on a different network.
              </p>
              <button
                type="button"
                onClick={() => void state.handleSwitchNetwork()}
                className="fuse-btn fuse-btn--primary fuse-btn--sm"
              >
                Switch to Mezo Testnet
              </button>
            </div>
          )}
        </section>

        {/* Stage 02: Register or Update Your Builder (Placed first for new wallets per Section 18) */}
        <section
          aria-label="Builder Registration and Management"
          data-fuse-section="management"
          className="fuse-panel fuse-panel--strong fuse-panel--padded"
        >
          <div className="fuse-eyebrow" style={{ color: "#9E3B0E", marginBottom: "4px" }}>
            Registration
          </div>
          <h2 className="fuse-section-title" style={{ marginBottom: "6px" }}>
            Register or update your partner code
          </h2>
          <p style={{ fontSize: "13px", color: "#4E535A", marginBottom: "14px" }}>
            Register your connected wallet as a partner, or update your fee (0% to 0.50%), status, and{" "}
            <span className="fuse-tag-self-reported">self-reported</span> display name.
          </p>

          <fieldset
            disabled={!state.isConnected || state.isSubmittingTx}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <legend className="fuse-sr-only">Builder Parameters (Connected Wallet)</legend>

            <div>
              <label
                htmlFor="fuse-builder-fee-bps"
                className="fuse-eyebrow"
                style={{ display: "block", marginBottom: "4px" }}
              >
                Fee in basis points (0 to {MAX_FEE_BPS}. 15 bps = 0.15%)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  id="fuse-builder-fee-bps"
                  type="number"
                  min={0}
                  max={MAX_FEE_BPS}
                  step={1}
                  data-fuse-input="fee-bps"
                  className="fuse-input fuse-mono fuse-num"
                  style={{ maxWidth: "140px", fontWeight: 700 }}
                  value={state.feeBpsInput}
                  onChange={(e) => state.setFeeBpsInput(e.target.value)}
                />
                <span className="fuse-mono fuse-num" style={{ fontSize: "12px", color: "#4E535A" }}>
                  ={" "}
                  {Number.isFinite(Number(state.feeBpsInput))
                    ? `${(Number(state.feeBpsInput) / 100).toFixed(2)}%`
                    : "0.00%"}
                  {Number(state.feeBpsInput) === 0 ? " (no fee)" : ""}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <label
                  htmlFor="fuse-builder-display-name"
                  className="fuse-eyebrow"
                  style={{ display: "block", marginBottom: "4px" }}
                >
                  Display name (self-reported)
                </label>
                <input
                  id="fuse-builder-display-name"
                  type="text"
                  data-fuse-input="builder-name"
                  className="fuse-input"
                  value={state.builderNameInput}
                  onChange={(e) => {
                    state.setBuilderNameInput(e.target.value);
                    const nextUri = JSON.stringify({
                      name: e.target.value.trim() || "Mezo Builder",
                      ...(state.builderUrlInput.trim()
                        ? { url: state.builderUrlInput.trim() }
                        : {}),
                    });
                    state.setMetadataURIInput(nextUri);
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="fuse-builder-url"
                  className="fuse-eyebrow"
                  style={{ display: "block", marginBottom: "4px" }}
                >
                  App URL
                </label>
                <input
                  id="fuse-builder-url"
                  type="url"
                  data-fuse-input="builder-url"
                  className="fuse-input"
                  value={state.builderUrlInput}
                  onChange={(e) => {
                    state.setBuilderUrlInput(e.target.value);
                    const nextUri = JSON.stringify({
                      name: state.builderNameInput.trim() || "Mezo Builder",
                      ...(e.target.value.trim() ? { url: e.target.value.trim() } : {}),
                    });
                    state.setMetadataURIInput(nextUri);
                  }}
                />
              </div>
            </div>

            {/* Collapsible Raw metadataURI inspector */}
            <details
              style={{
                border: "1px solid #DAD5C9",
                background: "#F6F4EE",
                padding: "8px 10px",
              }}
            >
              <summary
                className="fuse-mono"
                style={{ fontSize: "11px", cursor: "pointer", fontWeight: 700 }}
              >
                Advanced: raw metadata
              </summary>
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="fuse-builder-metadata-uri" className="fuse-eyebrow">
                    Metadata URI
                  </label>
                  <button
                    type="button"
                    data-fuse-button="compose-metadata"
                    onClick={() => state.composeJsonMetadataURI()}
                    className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                    style={{ minHeight: "24px", padding: "2px 8px" }}
                  >
                    Rebuild from name and URL
                  </button>
                </div>
                <input
                  id="fuse-builder-metadata-uri"
                  type="text"
                  data-fuse-input="metadata-uri"
                  className="fuse-input fuse-mono"
                  style={{ fontSize: "12px" }}
                  value={state.metadataURIInput}
                  onChange={(e) => state.setMetadataURIInput(e.target.value)}
                />
              </div>
            </details>

            {/* Plain User-Facing Action Buttons */}
            <div
              data-fuse-actions="builder-tx"
              style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}
            >
              <button
                type="button"
                data-fuse-tx="registerBuilder"
                onClick={() => void state.handleRegisterBuilder()}
                className="fuse-btn fuse-btn--primary fuse-btn--block fuse-btn--hard-shadow"
              >
                {state.isSubmittingTx ? "Submitting transaction..." : "Register builder"}
              </button>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "6px",
                }}
              >
                <button
                  type="button"
                  data-fuse-tx="setFee"
                  onClick={() => void state.handleSetFee()}
                  className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                >
                  Update fee
                </button>
                <button
                  type="button"
                  data-fuse-tx="setMetadataURI"
                  onClick={() => void state.handleSetMetadataURI()}
                  className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                >
                  Update name and URL
                </button>
                <button
                  type="button"
                  data-fuse-tx="setActiveTrue"
                  onClick={() => void state.handleSetActive(true)}
                  className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                >
                  Activate builder
                </button>
                <button
                  type="button"
                  data-fuse-tx="setActiveFalse"
                  onClick={() => void state.handleSetActive(false)}
                  className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                >
                  Pause builder
                </button>
              </div>
            </div>
          </fieldset>

          {!state.isConnected && (
            <p
              data-fuse-hint="connect-to-manage"
              style={{
                fontSize: "12px",
                color: "#4E535A",
                marginTop: "10px",
                borderTop: "1px solid #DAD5C9",
                paddingTop: "8px",
              }}
            >
              Connect your wallet above to register or update your partner settings.
            </p>
          )}

          {state.txError && (
            <div
              role="alert"
              data-fuse-error="builder-tx"
              className="fuse-alert fuse-alert--tripped"
              style={{ marginTop: "10px" }}
            >
              <strong>Transaction failed:</strong> {state.txError}
            </div>
          )}

          {state.lastTxHash && state.lastTxExplorerUrl && (
            <div
              role="status"
              data-fuse-success="builder-tx"
              className="fuse-alert fuse-alert--approved"
              style={{ marginTop: "10px" }}
            >
              <div className="fuse-alert__title">
                <FuseIntactSchematicSvg color="#1D6340" />
                <span>Confirmed</span>
              </div>
              <a
                href={state.lastTxExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="fuse-mono"
                style={{ fontSize: "12px" }}
              >
                <code>{shortenAddress(state.lastTxHash, 8)}</code> (Explorer ↗)
              </a>
            </div>
          )}
        </section>

        {/* Builder Inspector & Preset Switcher */}
        <section
          aria-label="Builder Inspector"
          data-fuse-section="inspector"
          className="fuse-panel fuse-panel--padded"
        >
          <div className="fuse-eyebrow" style={{ marginBottom: "4px" }}>
            Look up a partner
          </div>
          <h2 className="fuse-section-title" style={{ marginBottom: "10px" }}>
            Check any partner address
          </h2>

          {/* Separate "viewing another builder" banner per Section 18 */}
          {isViewingOtherBuilder && (
            <div
              role="status"
              className="fuse-alert fuse-alert--attention"
              style={{ marginBottom: "12px" }}
            >
              <div className="fuse-alert__title">
                <span>
                  VIEWING {shortenAddress(state.targetBuilderAddress, 6)} (NOT YOUR WALLET)
                </span>
              </div>
              <p style={{ fontSize: "12px" }}>
                You are inspecting another builder&apos;s rating plate and snippets. Edits in the registration form apply only to your connected wallet (
                <code>{shortenAddress(state.accountAddress ?? "", 4)}</code>).
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            <label htmlFor="fuse-builder-lookup" className="fuse-sr-only">
              Partner address
            </label>
            <input
              id="fuse-builder-lookup"
              type="text"
              data-fuse-input="builder-lookup"
              className="fuse-input fuse-mono"
              style={{ fontSize: "12px" }}
              value={state.lookupAddressInput}
              onChange={(e) => state.setLookupAddressInput(e.target.value)}
            />
            <button
              type="button"
              data-fuse-button="refresh-builder"
              onClick={() => void state.refreshBuilderData()}
              disabled={state.isLoadingStatus}
              className="fuse-btn fuse-btn--secondary fuse-btn--sm"
              style={{ flexShrink: 0 }}
            >
              {state.isLoadingStatus ? "Loading..." : "Look up"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "12px",
            }}
          >
            <button
              type="button"
              data-fuse-preset="paid-builder"
              onClick={() =>
                state.setLookupAddressInput(DEFAULT_PAID_BUILDER_TESTNET)
              }
              className="fuse-btn fuse-btn--quiet fuse-btn--sm"
              style={{ border: "1px solid #DAD5C9" }}
            >
              0.15% example ({shortenAddress(DEFAULT_PAID_BUILDER_TESTNET, 4)})
            </button>
            <button
              type="button"
              data-fuse-preset="zero-fee-builder"
              onClick={() =>
                state.setLookupAddressInput(DEFAULT_ZERO_FEE_BUILDER_TESTNET)
              }
              className="fuse-btn fuse-btn--quiet fuse-btn--sm"
              style={{ border: "1px solid #DAD5C9" }}
            >
              No fee example ({shortenAddress(DEFAULT_ZERO_FEE_BUILDER_TESTNET, 4)})
            </button>
            {state.accountAddress && (
              <button
                type="button"
                data-fuse-preset="connected-wallet"
                onClick={() => state.setLookupAddressInput(state.accountAddress!)}
                className="fuse-btn fuse-btn--secondary fuse-btn--sm"
              >
                My Wallet ({shortenAddress(state.accountAddress, 4)})
              </button>
            )}
          </div>

          {state.statusError && (
            <div
              role="alert"
              data-fuse-error="status"
              className="fuse-alert fuse-alert--tripped"
              style={{ marginBottom: "10px" }}
            >
              <strong>Error:</strong> {state.statusError}
            </div>
          )}

          {state.builderStatus && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <BuilderRatingPlate
                builderAddress={state.targetBuilderAddress}
                builderName={state.builderStatus.metadata.name}
                feeBps={state.builderStatus.feeBps}
                feePercentFormatted={state.builderStatus.feePercentFormatted}
                registered={state.builderStatus.registered}
                active={state.builderStatus.active}
                routerPaused={state.builderStatus.routerPaused}
                isConnected={state.isConnected}
                userApproved={state.builderStatus.userApproved}
                userMaxFeeBps={state.builderStatus.userMaxFeeBps}
                userMaxFeePercentFormatted={state.builderStatus.userMaxFeePercentFormatted}
              />

              <dl
                className="fuse-receipt"
                data-fuse-builder-status={state.targetBuilderAddress}
              >
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Address</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">
                    <a
                      href={getExplorerAddressUrl(state.targetBuilderAddress)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <code>{shortenAddress(state.targetBuilderAddress, 6)}</code> ↗
                    </a>
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Name</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-builder-name="true">
                    <strong>{state.builderStatus.metadata.name}</strong>{" "}
                    <span className="fuse-tag-self-reported">Self-reported</span>
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Registration</dt>
                  <span className="fuse-receipt__dots" />
                  <dd
                    className="fuse-receipt__val"
                    data-fuse-builder-registered={String(state.builderStatus.registered)}
                  >
                    {state.builderStatus.registered ? "Registered" : "Not Registered"}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Status</dt>
                  <span className="fuse-receipt__dots" />
                  <dd
                    className="fuse-receipt__val"
                    data-fuse-builder-active={String(state.builderStatus.active)}
                  >
                    {state.builderStatus.active ? "Active" : "Inactive"}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Fee</dt>
                  <span className="fuse-receipt__dots" />
                  <dd
                    className="fuse-receipt__val"
                    data-fuse-builder-fee-bps={state.builderStatus.feeBps}
                  >
                    {state.builderStatus.feePercentFormatted} ({state.builderStatus.feeBps} bps · Cap:{" "}
                    {MAX_FEE_BPS} bps)
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Actions so far</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">{state.recentEvents.length}</dd>
                </div>
              </dl>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Link
                  href={`/builders/${state.targetBuilderAddress}`}
                  className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                >
                  Public profile
                </Link>
                <Link
                  href={`/widget?builder=${state.targetBuilderAddress}&tab=save`}
                  className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                >
                  Preview in widget
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* RIGHT 7 COLUMNS: Integration Snippets, Paid MUSD x402 Analytics & Routed Events */}
      <div
        className="fuse-col-7"
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        {/* Stage 03: Copy Integration Snippets */}
        <section
          aria-label="Integration Snippets"
          data-fuse-section="snippets"
          className="fuse-panel fuse-panel--padded"
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
            <div>
              <div className="fuse-eyebrow" style={{ color: "#9E3B0E" }}>
                Embed
              </div>
              <h2 className="fuse-section-title" style={{ marginTop: "2px" }}>
                Embed Fuse for partner{" "}
                <code>{shortenAddress(state.targetBuilderAddress, 6)}</code>
              </h2>
            </div>

            <Link
              href={`/widget?builder=${state.targetBuilderAddress}&tab=save`}
              className="fuse-btn fuse-btn--secondary fuse-btn--sm"
            >
              Open live widget
            </Link>
          </div>

          <p style={{ fontSize: "13px", color: "#4E535A", marginBottom: "12px" }}>
            Drop the widget into any web app via <code>&lt;iframe&gt;</code>, mount{" "}
            <code>&lt;FuseWidget /&gt;</code> in React, or call <code>mezo-fuse</code>{" "}
            headlessly in TypeScript.
          </p>

          {/* Format selector tabs */}
          <div className="fuse-tabs" style={{ border: "1px solid #DAD5C9", marginBottom: "12px" }}>
            <button
              type="button"
              className="fuse-tab"
              aria-selected={activeSnippetTab === "iframe"}
              onClick={() => setActiveSnippetTab("iframe")}
            >
              HTML iframe
            </button>
            <button
              type="button"
              className="fuse-tab"
              aria-selected={activeSnippetTab === "react"}
              onClick={() => setActiveSnippetTab("react")}
            >
              React
            </button>
            <button
              type="button"
              className="fuse-tab"
              aria-selected={activeSnippetTab === "sdk"}
              onClick={() => setActiveSnippetTab("sdk")}
            >
              TypeScript
            </button>
          </div>

          {/* All 3 snippets remain mounted in DOM for instant copy and test selectors */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: activeSnippetTab === "iframe" ? "block" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <h3 className="fuse-eyebrow">
                  HTML iframe
                </h3>
                <button
                  type="button"
                  data-fuse-copy="iframe"
                  onClick={() =>
                    void copyToClipboard("iframe", state.snippets.iframeSnippet)
                  }
                  className="fuse-btn fuse-btn--primary fuse-btn--sm"
                >
                  {copiedSnippet === "iframe" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="fuse-code-block" data-fuse-snippet="iframe">
                <code>{state.snippets.iframeSnippet}</code>
              </pre>
            </div>

            <div
              style={{
                display: activeSnippetTab === "react" ? "block" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <h3 className="fuse-eyebrow">
                  React component
                </h3>
                <button
                  type="button"
                  data-fuse-copy="react"
                  onClick={() =>
                    void copyToClipboard("react", state.snippets.reactSnippet)
                  }
                  className="fuse-btn fuse-btn--primary fuse-btn--sm"
                >
                  {copiedSnippet === "react"
                    ? "Copied!"
                    : "Copy"}
                </button>
              </div>
              <pre className="fuse-code-block" data-fuse-snippet="react">
                <code>{state.snippets.reactSnippet}</code>
              </pre>
            </div>

            <div
              style={{
                display: activeSnippetTab === "sdk" ? "block" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <h3 className="fuse-eyebrow">
                  TypeScript client
                </h3>
                <button
                  type="button"
                  data-fuse-copy="sdk"
                  onClick={() =>
                    void copyToClipboard("sdk", state.snippets.sdkSnippet)
                  }
                  className="fuse-btn fuse-btn--primary fuse-btn--sm"
                >
                  {copiedSnippet === "sdk" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="fuse-code-block" data-fuse-snippet="sdk">
                <code>{state.snippets.sdkSnippet}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Stage 04: Paid Builder Analytics over MUSD x402 */}
        <section
          aria-label="Paid Builder Analytics over MUSD x402"
          data-fuse-section="x402-analytics"
          className="fuse-panel fuse-panel--padded"
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
            <div>
              <div className="fuse-eyebrow" style={{ color: "#9E3B0E" }}>
                Analytics
              </div>
              <h2 className="fuse-section-title" style={{ marginTop: "2px" }}>
                Partner analytics (
                <code>/api/analytics/{shortenAddress(state.targetBuilderAddress, 4)}</code>
                )
              </h2>
            </div>

            <span className="fuse-status-chip fuse-status-chip--env">
              0.05 MUSD per report
            </span>
          </div>

          <p style={{ fontSize: "13px", color: "#4E535A", marginBottom: "12px" }}>
            Per-builder deep analytics gated by an{" "}
            <strong>HTTP 402 Payment Required</strong> challenge settled in{" "}
            <code>0.05 MUSD</code> on Mezo Testnet (<code>eip155:31611</code>) via{" "}
            <code>https://facilitator.vativ.io</code>.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            <button
              type="button"
              data-fuse-button="x402-check"
              onClick={() => void state.handleCheckX402Requirement()}
              disabled={state.isX402Loading}
              className="fuse-btn fuse-btn--secondary fuse-btn--sm"
            >
              {state.isX402Loading
                ? "Requesting..."
                : "See payment request"}
            </button>
            <button
              type="button"
              data-fuse-button="x402-unlock"
              onClick={() => void state.handleUnlockPaidAnalyticsWithX402()}
              disabled={state.isX402Loading || !state.isConnected}
              className="fuse-btn fuse-btn--primary fuse-btn--sm"
            >
              {state.isX402Loading
                ? "Waiting for payment..."
                : "Pay 0.05 MUSD and unlock"}
            </button>
          </div>

          {state.x402Error && (
            <div
              role="alert"
              data-fuse-error="x402"
              className="fuse-alert fuse-alert--tripped"
              style={{ marginBottom: "10px" }}
            >
              <strong>Payment failed:</strong> {state.x402Error}
            </div>
          )}

          {state.x402Status && (
            <p
              data-fuse-x402-status={state.x402Status}
              className="fuse-mono"
              style={{ fontSize: "12px", marginBottom: "10px" }}
            >
              Status code: <strong>{state.x402Status}</strong>
            </p>
          )}

          {state.x402Settlement && (
            <div
              role="status"
              data-fuse-x402-settlement="true"
              className="fuse-alert fuse-alert--approved"
              style={{ marginBottom: "12px" }}
            >
              <div className="fuse-alert__title">
                <FuseIntactSchematicSvg color="#1D6340" />
                <span>Payment confirmed</span>
              </div>
              <dl className="fuse-receipt" style={{ marginTop: "6px" }}>
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Amount paid</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">{state.x402Settlement.amountMusd} MUSD</dd>
                </div>
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Payer</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">
                    <code>{state.x402Settlement.payer}</code>
                  </dd>
                </div>
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Settlement transaction</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">
                    {state.x402Settlement.explorerUrl ? (
                      <a
                        href={state.x402Settlement.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <code>{shortenAddress(state.x402Settlement.transaction, 8)}</code> ↗
                      </a>
                    ) : (
                      <code>{state.x402Settlement.transaction}</code>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {state.paidAnalytics && (
            <div data-fuse-paid-analytics-report="true" style={{ marginTop: "10px" }}>
              <h3 className="fuse-eyebrow" style={{ marginBottom: "6px" }}>
                Analytics report: {state.paidAnalytics.name} (SELF-REPORTED)
              </h3>
              <dl className="fuse-receipt" style={{ marginBottom: "10px" }}>
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Unique users</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">{state.paidAnalytics.summary.uniqueUsers}</dd>
                </div>
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Total routed actions</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">{state.paidAnalytics.summary.totalActions}</dd>
                </div>
                {state.paidAnalytics.summary.totalVolumeUsdFormatted && (
                  <div className="fuse-receipt__row">
                    <dt className="fuse-receipt__term">Total volume (USD)</dt>
                    <span className="fuse-receipt__dots" />
                    <dd className="fuse-receipt__val">
                      {state.paidAnalytics.summary.totalVolumeUsdFormatted}
                    </dd>
                  </div>
                )}
                {state.paidAnalytics.summary.totalFeesUsdFormatted && (
                  <div className="fuse-receipt__row">
                    <dt className="fuse-receipt__term">Total builder fees earned (USD)</dt>
                    <span className="fuse-receipt__dots" />
                    <dd className="fuse-receipt__val">
                      {state.paidAnalytics.summary.totalFeesUsdFormatted}
                    </dd>
                  </div>
                )}
              </dl>
              <pre className="fuse-code-block" data-fuse-paid-analytics-json="true">
                {JSON.stringify(state.paidAnalytics, null, 2)}
              </pre>
            </div>
          )}

          {state.x402Requirement && !state.paidAnalytics && (
            <div style={{ marginTop: "10px" }}>
              <h3 className="fuse-eyebrow" style={{ marginBottom: "6px" }}>
                Payment request details
              </h3>
              <pre className="fuse-code-block" data-fuse-x402-requirement-json="true">
                {JSON.stringify(state.x402Requirement, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* Recent Routed Events Table for Target Builder */}
        <section
          aria-label="Recent Routed Events for Builder"
          data-fuse-section="builder-events"
          className="fuse-panel fuse-panel--padded"
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <div>
              <div className="fuse-eyebrow">Activity</div>
              <h2 className="fuse-section-title" style={{ marginTop: "2px" }}>
                Recent <code>Routed</code> Events for{" "}
                <code>{shortenAddress(state.targetBuilderAddress, 6)}</code>
              </h2>
            </div>
            <Link
              href={`/builders/${state.targetBuilderAddress}`}
              className="fuse-mono"
              style={{ fontSize: "12px" }}
            >
              Public profile
            </Link>
          </div>

          {state.recentEvents.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#4E535A", padding: "12px 0" }}>
              No actions yet for this partner.
            </p>
          ) : (
            <div className="fuse-table-wrap">
              <table className="fuse-table" data-fuse-table="builder-events">
                <thead>
                  <tr>
                    <th className="fuse-num">Block</th>
                    <th>Action</th>
                    <th className="fuse-col-hide-mobile">User</th>
                    <th className="fuse-num">Amount In</th>
                    <th className="fuse-num">Fee</th>
                    <th className="fuse-num">Received</th>
                    <th>Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {state.recentEvents.map((ev) => {
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
                        <td className="fuse-col-hide-mobile">
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
                            ? `veBTC Lock #${ev.lockId.toString()} (${formatUnits(ev.amountOut, 18)} BTC)`
                            : `${formatUnits(ev.amountOut, 18)} ${tokenOutSym}`}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Link
                              href={`/receipt/${ev.transactionHash}`}
                              className="fuse-mono"
                              style={{ fontSize: "12px", fontWeight: 700 }}
                            >
                              Receipt
                            </Link>
                            <a
                              href={ev.explorerTxUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="fuse-mono"
                              style={{ fontSize: "12px" }}
                            >
                              <code>{shortenAddress(ev.transactionHash, 5)}</code> ↗
                            </a>
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
      </div>
    </div>
  );
}
