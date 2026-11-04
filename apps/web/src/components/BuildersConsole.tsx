"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  MAX_FEE_BPS,
  getExplorerAddressUrl,
  resolveTokenSymbol,
  shortenAddress,
} from "@fuse/sdk";
import { useBuilderConsole } from "../hooks/useBuilderConsole";

export interface BuildersConsoleProps {
  initialBuilderAddress?: string | null;
}

export function BuildersConsole({
  initialBuilderAddress,
}: BuildersConsoleProps) {
  const state = useBuilderConsole({ initialBuilderAddress });
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  async function copyToClipboard(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(key);
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div data-fuse-console="builders">
      <section aria-label="Wallet Connection" data-fuse-section="wallet">
        <h2>1. Connect Builder Wallet (Mezo Passport · Testnet 31611)</h2>
        <div data-fuse-passport-connect="builders">
          <ConnectButton label="Connect Builder Wallet" />
        </div>
        {state.isConnected && (
          <p data-fuse-connected-account={state.accountAddress ?? ""}>
            Connected Smart/EVM Account:{" "}
            <code>{state.accountAddress}</code>{" "}
            {state.walletAddress && state.walletAddress !== state.accountAddress
              ? `(Signer: ${state.walletAddress})`
              : ""}
          </p>
        )}
        {state.isWrongNetwork && (
          <div role="alert" data-fuse-alert="wrong-network">
            <p>
              Connected wallet is not on Mezo Testnet (Chain ID 31611).{" "}
              <button
                type="button"
                onClick={() => void state.handleSwitchNetwork()}
              >
                Switch to Mezo Testnet
              </button>
            </p>
          </div>
        )}
      </section>

      <hr />

      <section aria-label="Builder Inspector" data-fuse-section="inspector">
        <h2>2. Inspect or Select Builder Address</h2>
        <div>
          <label htmlFor="fuse-builder-lookup">Builder EVM Address: </label>
          <input
            id="fuse-builder-lookup"
            type="text"
            size={46}
            data-fuse-input="builder-lookup"
            value={state.lookupAddressInput}
            onChange={(e) => state.setLookupAddressInput(e.target.value)}
          />{" "}
          <button
            type="button"
            data-fuse-button="refresh-builder"
            onClick={() => void state.refreshBuilderData()}
            disabled={state.isLoadingStatus}
          >
            {state.isLoadingStatus ? "Loading..." : "Load Builder On-Chain State"}
          </button>
        </div>

        <p>
          Quick Presets:{" "}
          <button
            type="button"
            data-fuse-preset="paid-builder"
            onClick={() =>
              state.setLookupAddressInput(DEFAULT_PAID_BUILDER_TESTNET)
            }
          >
            Paid Builder (15 bps · {shortenAddress(DEFAULT_PAID_BUILDER_TESTNET)})
          </button>{" "}
          <button
            type="button"
            data-fuse-preset="zero-fee-builder"
            onClick={() =>
              state.setLookupAddressInput(DEFAULT_ZERO_FEE_BUILDER_TESTNET)
            }
          >
            Zero-Fee Builder (0 bps ·{" "}
            {shortenAddress(DEFAULT_ZERO_FEE_BUILDER_TESTNET)})
          </button>
          {state.accountAddress && (
            <>
              {" "}
              <button
                type="button"
                data-fuse-preset="connected-wallet"
                onClick={() =>
                  state.setLookupAddressInput(state.accountAddress!)
                }
              >
                My Connected Wallet ({shortenAddress(state.accountAddress)})
              </button>
            </>
          )}
        </p>

        {state.statusError && (
          <p role="alert" data-fuse-error="status">
            <strong>Error:</strong> {state.statusError}
          </p>
        )}

        {state.builderStatus && (
          <dl data-fuse-builder-status={state.targetBuilderAddress}>
            <dt>Builder Address</dt>
            <dd>
              <a
                href={getExplorerAddressUrl(state.targetBuilderAddress)}
                target="_blank"
                rel="noreferrer"
              >
                <code>{state.targetBuilderAddress}</code>
              </a>
            </dd>

            <dt>Builder Name</dt>
            <dd data-fuse-builder-name="true">
              <strong>{state.builderStatus.metadata.name}</strong>{" "}
              <span>(self-reported)</span>
            </dd>

            <dt>On-Chain Registration Status</dt>
            <dd data-fuse-builder-registered={String(state.builderStatus.registered)}>
              {state.builderStatus.registered ? "Registered" : "Not Registered"}
            </dd>

            <dt>Active Status</dt>
            <dd data-fuse-builder-active={String(state.builderStatus.active)}>
              {state.builderStatus.active ? "Active" : "Inactive"}
            </dd>

            <dt>Builder Fee</dt>
            <dd data-fuse-builder-fee-bps={state.builderStatus.feeBps}>
              {state.builderStatus.feePercentFormatted} ({state.builderStatus.feeBps}{" "}
              bps · Protocol Cap: {MAX_FEE_BPS} bps / 0.50%)
            </dd>

            <dt>On-Chain Metadata URI</dt>
            <dd>
              <code>{state.builderStatus.metadataURI || "(empty)"}</code>
            </dd>

            <dt>Recent Routed Actions Indexed</dt>
            <dd>{state.recentEvents.length}</dd>
          </dl>
        )}
      </section>

      <hr />

      <section
        aria-label="Builder Registration and Management"
        data-fuse-section="management"
      >
        <h2>3. On-Chain Builder Registration &amp; Fee Management</h2>
        <p>
          Register your connected wallet on <code>FuseRouter</code> (
          <code>0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4</code>) or update your
          fee (<code>0 &le; feeBps &le; 50</code>), active status, and self-reported
          metadata URI.
        </p>

        <fieldset disabled={!state.isConnected || state.isSubmittingTx}>
          <legend>Builder Parameters (Connected Wallet)</legend>

          <div>
            <label htmlFor="fuse-builder-fee-bps">
              Builder Fee in Basis Points (0 to {MAX_FEE_BPS} bps, where 15 bps =
              0.15%):{" "}
            </label>
            <input
              id="fuse-builder-fee-bps"
              type="number"
              min={0}
              max={MAX_FEE_BPS}
              step={1}
              data-fuse-input="fee-bps"
              value={state.feeBpsInput}
              onChange={(e) => state.setFeeBpsInput(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="fuse-builder-display-name">
              Display Name (self-reported):{" "}
            </label>
            <input
              id="fuse-builder-display-name"
              type="text"
              size={30}
              data-fuse-input="builder-name"
              value={state.builderNameInput}
              onChange={(e) => state.setBuilderNameInput(e.target.value)}
            />{" "}
            <label htmlFor="fuse-builder-url">App URL: </label>
            <input
              id="fuse-builder-url"
              type="url"
              size={30}
              data-fuse-input="builder-url"
              value={state.builderUrlInput}
              onChange={(e) => state.setBuilderUrlInput(e.target.value)}
            />{" "}
            <button
              type="button"
              data-fuse-button="compose-metadata"
              onClick={() => state.composeJsonMetadataURI()}
            >
              Generate JSON metadataURI
            </button>
          </div>

          <div>
            <label htmlFor="fuse-builder-metadata-uri">
              On-Chain <code>metadataURI</code>:{" "}
            </label>
            <input
              id="fuse-builder-metadata-uri"
              type="text"
              size={72}
              data-fuse-input="metadata-uri"
              value={state.metadataURIInput}
              onChange={(e) => state.setMetadataURIInput(e.target.value)}
            />
          </div>

          <div data-fuse-actions="builder-tx">
            <button
              type="button"
              data-fuse-tx="registerBuilder"
              onClick={() => void state.handleRegisterBuilder()}
            >
              registerBuilder(feeBps, metadataURI)
            </button>{" "}
            <button
              type="button"
              data-fuse-tx="setFee"
              onClick={() => void state.handleSetFee()}
            >
              setFee(newFeeBps)
            </button>{" "}
            <button
              type="button"
              data-fuse-tx="setMetadataURI"
              onClick={() => void state.handleSetMetadataURI()}
            >
              setMetadataURI(metadataURI)
            </button>{" "}
            <button
              type="button"
              data-fuse-tx="setActiveTrue"
              onClick={() => void state.handleSetActive(true)}
            >
              setActive(true)
            </button>{" "}
            <button
              type="button"
              data-fuse-tx="setActiveFalse"
              onClick={() => void state.handleSetActive(false)}
            >
              setActive(false)
            </button>
          </div>
        </fieldset>

        {!state.isConnected && (
          <p data-fuse-hint="connect-to-manage">
            <em>
              Connect a wallet above to submit on-chain{" "}
              <code>registerBuilder</code>, <code>setFee</code>,{" "}
              <code>setMetadataURI</code>, or <code>setActive</code> transactions.
            </em>
          </p>
        )}

        {state.txError && (
          <p role="alert" data-fuse-error="builder-tx">
            <strong>Transaction Error:</strong> {state.txError}
          </p>
        )}

        {state.lastTxHash && state.lastTxExplorerUrl && (
          <p role="status" data-fuse-success="builder-tx">
            <strong>Transaction Confirmed:</strong>{" "}
            <a
              href={state.lastTxExplorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              <code>{state.lastTxHash}</code>
            </a>
          </p>
        )}
      </section>

      <hr />

      <section
        aria-label="Integration Snippets"
        data-fuse-section="snippets"
      >
        <h2>
          4. Copy-Paste Integration Snippets for{" "}
          <code>{shortenAddress(state.targetBuilderAddress, 6)}</code>
        </h2>
        <p>
          Preview your live widget directly at{" "}
          <Link href={`/widget?builder=${state.targetBuilderAddress}&tab=save`}>
            /widget?builder={state.targetBuilderAddress}&amp;tab=save
          </Link>
          .
        </p>

        <div>
          <h3>
            A. Drop-In HTML <code>&lt;iframe&gt;</code> Embed
          </h3>
          <button
            type="button"
            data-fuse-copy="iframe"
            onClick={() =>
              void copyToClipboard("iframe", state.snippets.iframeSnippet)
            }
          >
            {copiedSnippet === "iframe" ? "Copied!" : "Copy <iframe> Snippet"}
          </button>
          <pre data-fuse-snippet="iframe">
            <code>{state.snippets.iframeSnippet}</code>
          </pre>
        </div>

        <div>
          <h3>
            B. React <code>&lt;FuseWidget /&gt;</code> Component
          </h3>
          <button
            type="button"
            data-fuse-copy="react"
            onClick={() =>
              void copyToClipboard("react", state.snippets.reactSnippet)
            }
          >
            {copiedSnippet === "react"
              ? "Copied!"
              : "Copy React <FuseWidget /> Snippet"}
          </button>
          <pre data-fuse-snippet="react">
            <code>{state.snippets.reactSnippet}</code>
          </pre>
        </div>

        <div>
          <h3>
            C. Headless TypeScript <code>@fuse/sdk</code> Client
          </h3>
          <button
            type="button"
            data-fuse-copy="sdk"
            onClick={() =>
              void copyToClipboard("sdk", state.snippets.sdkSnippet)
            }
          >
            {copiedSnippet === "sdk" ? "Copied!" : "Copy @fuse/sdk Snippet"}
          </button>
          <pre data-fuse-snippet="sdk">
            <code>{state.snippets.sdkSnippet}</code>
          </pre>
        </div>
      </section>

      <hr />

      <section
        aria-label="Paid Builder Analytics over MUSD x402"
        data-fuse-section="x402-analytics"
      >
        <h2>
          5. Paid Builder Analytics over MUSD x402 (
          <code>/api/analytics/{shortenAddress(state.targetBuilderAddress)}</code>
          )
        </h2>
        <p>
          Fuse exposes per-builder deep analytics gated by an{" "}
          <strong>HTTP 402 Payment Required</strong> challenge settled in{" "}
          <code>0.05 MUSD</code> on Mezo Testnet (<code>eip155:31611</code>) via{" "}
          <code>https://facilitator.vativ.io</code> using Permit2 + EIP-2612 Gas
          Sponsoring.
        </p>

        <div>
          <button
            type="button"
            data-fuse-button="x402-check"
            onClick={() => void state.handleCheckX402Requirement()}
            disabled={state.isX402Loading}
          >
            {state.isX402Loading
              ? "Requesting..."
              : "1. Inspect HTTP 402 Challenge (No Payment Header)"}
          </button>{" "}
          <button
            type="button"
            data-fuse-button="x402-unlock"
            onClick={() => void state.handleUnlockPaidAnalyticsWithX402()}
            disabled={state.isX402Loading || !state.isConnected}
          >
            {state.isX402Loading
              ? "Signing & Settling x402..."
              : "2. Sign & Settle 0.05 MUSD via x402 (Unlock Full Analytics)"}
          </button>
        </div>

        {state.x402Error && (
          <p role="alert" data-fuse-error="x402">
            <strong>x402 Error:</strong> {state.x402Error}
          </p>
        )}

        {state.x402Status && (
          <p data-fuse-x402-status={state.x402Status}>
            Last HTTP Status: <strong>{state.x402Status}</strong>
          </p>
        )}

        {state.x402Settlement && (
          <div role="status" data-fuse-x402-settlement="true">
            <h3>MUSD x402 Payment Settled On-Chain</h3>
            <dl>
              <dt>Amount Paid</dt>
              <dd>{state.x402Settlement.amountMusd} MUSD</dd>
              <dt>Payer</dt>
              <dd>
                <code>{state.x402Settlement.payer}</code>
              </dd>
              <dt>Settlement Transaction</dt>
              <dd>
                {state.x402Settlement.explorerUrl ? (
                  <a
                    href={state.x402Settlement.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <code>{state.x402Settlement.transaction}</code>
                  </a>
                ) : (
                  <code>{state.x402Settlement.transaction}</code>
                )}
              </dd>
            </dl>
          </div>
        )}

        {state.paidAnalytics && (
          <div data-fuse-paid-analytics-report="true">
            <h3>
              Unlocked Builder Analytics Report for {state.paidAnalytics.name}{" "}
              (self-reported)
            </h3>
            <dl>
              <dt>Unique Users</dt>
              <dd>{state.paidAnalytics.summary.uniqueUsers}</dd>
              <dt>Total Routed Actions</dt>
              <dd>{state.paidAnalytics.summary.totalActions}</dd>
              {state.paidAnalytics.summary.totalVolumeUsdFormatted && (
                <>
                  <dt>Total Volume (USD)</dt>
                  <dd>{state.paidAnalytics.summary.totalVolumeUsdFormatted}</dd>
                </>
              )}
              {state.paidAnalytics.summary.totalFeesUsdFormatted && (
                <>
                  <dt>Total Builder Fees Earned (USD)</dt>
                  <dd>{state.paidAnalytics.summary.totalFeesUsdFormatted}</dd>
                </>
              )}
            </dl>
            <pre data-fuse-paid-analytics-json="true">
              {JSON.stringify(state.paidAnalytics, null, 2)}
            </pre>
          </div>
        )}

        {state.x402Requirement && !state.paidAnalytics && (
          <div>
            <h3>HTTP 402 Payment Required Payload</h3>
            <pre data-fuse-x402-requirement-json="true">
              {JSON.stringify(state.x402Requirement, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <hr />

      <section
        aria-label="Recent Routed Events for Builder"
        data-fuse-section="builder-events"
      >
        <h2>
          6. Recent On-Chain <code>Routed</code> Events for{" "}
          <code>{shortenAddress(state.targetBuilderAddress, 6)}</code>
        </h2>
        {state.recentEvents.length === 0 ? (
          <p>No routed transactions found yet for this builder address.</p>
        ) : (
          <table data-fuse-table="builder-events">
            <thead>
              <tr>
                <th>Block</th>
                <th>Action</th>
                <th>User</th>
                <th>Amount In</th>
                <th>Builder Fee</th>
                <th>Amount Out / Lock ID</th>
                <th>Explorer Link</th>
              </tr>
            </thead>
            <tbody>
              {state.recentEvents.map((ev) => {
                const tokenInSym = resolveTokenSymbol(ev.tokenIn);
                const tokenOutSym = resolveTokenSymbol(ev.tokenOut);
                return (
                  <tr key={`${ev.transactionHash}-${ev.logIndex}`}>
                    <td>{ev.blockNumber.toString()}</td>
                    <td>{ev.action.toUpperCase()}</td>
                    <td>
                      <a
                        href={getExplorerAddressUrl(ev.user)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <code>{shortenAddress(ev.user, 6)}</code>
                      </a>
                    </td>
                    <td>
                      {formatUnits(ev.amountIn, 18)} {tokenInSym}
                    </td>
                    <td>
                      {formatUnits(ev.fee, 18)} {tokenInSym}
                    </td>
                    <td>
                      {ev.action === "lock"
                        ? `veBTC Lock #${ev.lockId.toString()} (${formatUnits(ev.amountOut, 18)} BTC)`
                        : `${formatUnits(ev.amountOut, 18)} ${tokenOutSym}`}
                    </td>
                    <td>
                      <a
                        href={ev.explorerTxUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <code>{shortenAddress(ev.transactionHash, 6)}</code>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
