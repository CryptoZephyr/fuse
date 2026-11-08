"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import {
  type ExecutionStep,
  FUSE_WIDGET_MESSAGE_SOURCE,
  type FuseActionType,
  LOCK_DURATION_PRESETS,
  MEZO_TESTNET_ADDRESSES,
  type MezoTokenSymbol,
  formatUsd,
  getExplorerTxUrl,
  shortenAddress,
} from "mezo-fuse";
import { useFuseWidget } from "../hooks/useFuseWidget";
import { postToHost } from "../lib/hostMessages";
import { FuseLogoMark } from "./FuseLogo";
import {
  BuilderRatingPlate,
  FuseIntactSchematicSvg,
  FuseOpenSwitchSchematicSvg,
  FuseStrip,
  type FuseStripMode,
  FuseWalletControl,
  WidgetStepStrip,
  WiringSplitDiagram,
} from "./SwitchgearPrimitives";

export interface FuseWidgetProps {
  /** Builder address (`0x...`) credited for routed actions */
  builder?: string | null;
  /** Initial active tab (`swap` | `save` | `lock`) */
  defaultAction?: FuseActionType;
  /** Initial transaction hash from the widget URL */
  initialTx?: string | null;
}

function formatTokenAmount(wei: bigint, decimals = 18, maxFrac = 6): string {
  const num = Number(formatUnits(wei, decimals));
  if (!Number.isFinite(num)) return "0";
  if (num === 0) return "0";
  if (num < 0.000001) return "<0.000001";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
}

function computeExchangeRate(
  amountInWei: bigint,
  amountOutWei: bigint,
): string | null {
  const inNum = Number(formatUnits(amountInWei, 18));
  const outNum = Number(formatUnits(amountOutWei, 18));
  if (!Number.isFinite(inNum) || !Number.isFinite(outNum) || inNum <= 0) {
    return null;
  }
  const rate = outNum / inNum;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: rate >= 100 ? 2 : 6,
  });
}

function describeExecutionStep(
  step: ExecutionStep | "refreshing_quote" | null,
): string {
  switch (step) {
    case "refreshing_quote":
      return "Checking the latest quote...";
    case "checking_allowance":
      return "Step 1: Checking token allowance...";
    case "permit_signature_pending":
      return "Step 2: Sign one signature in wallet to allow MUSD...";
    case "permit_fallback_to_approve":
      return "Step 2: Bitcoin wallet detected · Switching to 2-step allow + route...";
    case "token_approval_pending":
      return "Step 2: Confirm token allowance in wallet...";
    case "token_approval_confirming":
      return "Step 2: Waiting for token allowance on Mezo Testnet...";
    case "action_tx_pending":
      return "Step 3: Confirm routed action in wallet...";
    case "action_tx_confirming":
      return "Step 3: Confirming routed transaction on Mezo Testnet...";
    case "confirmed":
      return "Confirmed on Mezo Testnet.";
    default:
      return "Submitting transaction...";
  }
}

/**
 * `<FuseWidget />` - Embeddable Switchgear Panel Action Ticket for Mezo.
 *
 * Implements the locked Switchgear Panel design system (`DESIGN_SYSTEM.md`):
 * - Builder Rating Plate with `Big Shoulders Stencil` title & outlined `Self-reported` tag
 * - Intact / Tripped Fuse Strip showing user fee cap protection before any wallet prompt
 * - Single-line electrical wiring split schematic & dotted leader-line receipt
 * - Plain user-facing copy and 320px–440px responsive ticket frame
 */
export function FuseWidget({
  builder,
  defaultAction = "swap",
  initialTx,
}: FuseWidgetProps) {
  const state = useFuseWidget({
    builderAddress: builder,
    defaultAction,
    initialTx,
  });

  const [keptCapNotice, setKeptCapNotice] = useState<boolean>(false);

  useEffect(() => {
    const documentRoot = document.documentElement;
    const documentBody = document.body;
    if (!documentRoot || !documentBody || typeof ResizeObserver === "undefined") {
      return;
    }

    let animationFrame = 0;
    let pendingHeight: number | null = null;
    let lastSentHeight: number | null = null;
    const observer = new ResizeObserver(() => {
      const height = Math.max(
        documentRoot.scrollHeight,
        documentBody.scrollHeight,
      );
      if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
        return;
      }

      pendingHeight = height;
      if (animationFrame !== 0) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        if (
          pendingHeight === null ||
          (lastSentHeight !== null && Math.abs(pendingHeight - lastSentHeight) < 1)
        ) {
          return;
        }

        lastSentHeight = pendingHeight;
        postToHost({
          source: FUSE_WIDGET_MESSAGE_SOURCE,
          version: 1,
          type: "resize",
          height: Math.ceil(pendingHeight),
        });
      });
    });

    observer.observe(documentRoot);
    observer.observe(documentBody);
    return () => {
      observer.disconnect();
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const {
    accountAddress,
    walletAddress,
    isConnected,
    networkFamily,
    isBitcoinWallet,
    isTaproot,
    isWrongNetwork,
    handleSwitchToMezoTestnet,
    isValidBuilderAddress,
    builderAddress,
    builderStatus,
    builderLoading,
    btcUsdPrice,
    activeTab,
    setActiveTab,
    swapTokenInSymbol,
    setSwapTokenInSymbol,
    swapTokenOutSymbol,
    setSwapTokenOutSymbol,
    handleFlipSwapPair,
    swapAmountInput,
    setSwapAmountInput,
    slippageBps,
    setSlippageBps,
    saveAmountInput,
    setSaveAmountInput,
    lockAmountInput,
    setLockAmountInput,
    lockDurationSeconds,
    setLockDurationSeconds,
    lockWarningAcknowledged,
    setLockWarningAcknowledged,
    balances,
    activeInputSymbol,
    activeInputBalance,
    activeInputBalanceFormatted,
    maxSpendableInputBalance,
    isInsufficientBalance,
    parsedAmountWei,
    swapQuote,
    saveQuote,
    lockQuote,
    quoteLoading,
    quoteError,
    quoteUpdatedAt,
    quoteAgeSeconds,
    approvalPending,
    revokePending,
    actionPending,
    executionStep,
    errorMessage,
    setErrorMessage,
    lastResult,
    lastApprovalTxUrl,
    pendingTx,
    initialTx: stateInitialTx,
    handleApproveBuilder,
    handleRevokeBuilder,
    handleExecuteAction,
  } = state;

  const validInitialTx =
    stateInitialTx && /^0x[0-9a-fA-F]{64}$/.test(stateInitialTx)
      ? stateInitialTx
      : null;

  const canSubmitAction =
    isConnected &&
    !isWrongNetwork &&
    !isTaproot &&
    Boolean(builderStatus?.registered) &&
    Boolean(builderStatus?.active) &&
    !builderStatus?.routerPaused &&
    !builderStatus?.needsApproval &&
    !builderStatus?.needsHigherApproval &&
    parsedAmountWei > 0n &&
    !isInsufficientBalance &&
    !quoteLoading &&
    Boolean(quoteUpdatedAt) &&
    !actionPending &&
    (activeTab !== "lock" || lockWarningAcknowledged) &&
    (activeTab === "swap" ? Boolean(swapQuote) : activeTab === "save" ? Boolean(saveQuote) : Boolean(lockQuote));

  const feeBps = builderStatus?.feeBps ?? 0;
  const isCapApproved = Boolean(
    builderStatus &&
      !builderStatus.needsApproval &&
      !builderStatus.needsHigherApproval,
  );

  // Determine FuseStrip mode
  let fuseStripMode: FuseStripMode = "within-cap";
  if (builderStatus) {
    if (builderStatus.routerPaused) {
      fuseStripMode = "router-paused";
    } else if (!builderStatus.registered) {
      fuseStripMode = "builder-unregistered";
    } else if (!builderStatus.active) {
      fuseStripMode = "builder-inactive";
    } else if (builderStatus.needsHigherApproval) {
      fuseStripMode = "tripped";
    } else if (builderStatus.needsApproval) {
      fuseStripMode = "needs-approval";
    } else if (builderStatus.feeBps === 0) {
      fuseStripMode = "zero-fee";
    } else {
      fuseStripMode = "within-cap";
    }
  }

  const isCapActionBlocking = Boolean(
    isConnected &&
      builderStatus?.registered &&
      builderStatus?.active &&
      (builderStatus.needsApproval || builderStatus.needsHigherApproval),
  );

  const actionStepLabel =
    activeTab === "swap" ? "Swap" : activeTab === "save" ? "Save" : "Lock";

  const swapExchangeRate = swapQuote
    ? computeExchangeRate(swapQuote.netAmount, swapQuote.expectedOut)
    : null;

  return (
    <section
      aria-label="Fuse Mezo Builder Action Widget"
      data-fuse-surface="widget"
      className="fuse-widget-ticket"
    >
      {/* 1. Compact Top Status Strip */}
      <header data-fuse-section="header" className="fuse-widget-ticket__topstrip">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <FuseLogoMark size={16} />
          <strong data-fuse-badge="network">Mezo Testnet</strong>
        </div>

        <div data-fuse-section="oracle">
          {btcUsdPrice ? (
            <span>
              BTC price: <strong className="fuse-num">{btcUsdPrice.formattedUsd}</strong>
            </span>
          ) : (
            <span data-fuse-state="oracle-unavailable">
              BTC price unavailable · token amounts shown
            </span>
          )}
        </div>
      </header>

      {/* 2. 4-Step Progress Strip */}
      <WidgetStepStrip
        isConnected={isConnected}
        isWrongNetwork={isWrongNetwork}
        feeBps={feeBps}
        isCapApprovedOrZero={isCapApproved}
        actionLabel={actionStepLabel}
        hasConfirmedReceipt={Boolean(lastResult)}
      />

      {/* 3. Builder Rating Plate & Fuse Strip (Per-User Cap Guard) */}
      <section
        aria-label="Builder Attribution and Fee Approval"
        data-fuse-section="builder"
        className="fuse-widget-ticket__section"
      >
        {!isValidBuilderAddress && (
          <div
            role="alert"
            data-fuse-state="invalid-builder"
            className="fuse-alert fuse-alert--attention"
            style={{ marginBottom: "8px" }}
          >
            The partner address in this link is invalid. Showing the default partner{" "}
            <code>{shortenAddress(builderAddress, 6)}</code>.
          </div>
        )}

        {builderLoading ? (
          <div data-fuse-state="builder-loading" style={{ padding: "8px 0" }}>
            <div className="fuse-skeleton" style={{ height: "64px", width: "100%" }} />
            <p className="fuse-mono" style={{ fontSize: "11px", color: "#4E535A", marginTop: "6px" }}>
              Loading partner details...
            </p>
          </div>
        ) : !builderStatus ? (
          <div
            role="alert"
            data-fuse-state="builder-error"
            className="fuse-alert fuse-alert--tripped"
          >
            Could not load partner details. Refresh to try again.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <BuilderRatingPlate
              builderAddress={builderStatus.address}
              builderName={builderStatus.metadata.name}
              feeBps={builderStatus.feeBps}
              feePercentFormatted={builderStatus.feePercentFormatted}
              registered={builderStatus.registered}
              active={builderStatus.active}
              routerPaused={builderStatus.routerPaused}
              isConnected={isConnected}
              userApproved={builderStatus.userApproved}
              userMaxFeeBps={builderStatus.userMaxFeeBps}
              userMaxFeePercentFormatted={builderStatus.userMaxFeePercentFormatted}
            />

            {/* Schematic Fuse Strip */}
            <FuseStrip
              mode={fuseStripMode}
              feeBps={builderStatus.feeBps}
              feePercentFormatted={builderStatus.feePercentFormatted}
              userMaxFeeBps={builderStatus.userMaxFeeBps}
              userMaxFeePercentFormatted={builderStatus.userMaxFeePercentFormatted}
              builderName={builderStatus.metadata.name}
            />

            {!builderStatus.registered && (
              <div
                role="alert"
                data-fuse-state="builder-not-registered"
                className="fuse-alert fuse-alert--neutral"
              >
                <strong>Partner not registered:</strong> Address{" "}
                <code>{shortenAddress(builderStatus.address, 6)}</code> is not registered, so no fee applies.
              </div>
            )}

            {builderStatus.registered && !builderStatus.active && (
              <div
                role="alert"
                data-fuse-state="builder-inactive"
                className="fuse-alert fuse-alert--neutral"
              >
                <strong>Partner paused:</strong> This partner is paused and cannot route new actions.
              </div>
            )}

            {builderStatus.routerPaused && (
              <div
                role="alert"
                data-fuse-state="router-paused"
                className="fuse-alert fuse-alert--tripped"
              >
                <strong>Routing paused:</strong> New actions are paused. You can still revoke your partner cap at any time.
              </div>
            )}

            {isConnected && builderStatus.registered && (
              <div data-fuse-section="user-approval">
                {builderStatus.needsApproval ? (
                  <div
                    role="alert"
                    data-fuse-state="builder-not-approved"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      marginTop: "2px",
                    }}
                  >
                    <p style={{ fontSize: "12px", color: "#4E535A" }}>
                      Approve <strong>{builderStatus.metadata.name}</strong> to take up to{" "}
                      <strong>
                        {builderStatus.feePercentFormatted} ({builderStatus.feeBps} bps)
                      </strong>{" "}
                      on routed actions. Change or revoke anytime.
                    </p>
                    <button
                      type="button"
                      disabled={approvalPending || isWrongNetwork}
                      onClick={handleApproveBuilder}
                      data-fuse-action="approve-builder"
                      className="fuse-btn fuse-btn--primary fuse-btn--block fuse-btn--hard-shadow"
                    >
                      {approvalPending
                        ? "Approval pending in wallet..."
                        : `Approve up to ${builderStatus.feePercentFormatted} fee`}
                    </button>
                  </div>
                ) : builderStatus.needsHigherApproval ? (
                  <div
                    role="alert"
                    data-fuse-state="fee-above-user-approval"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      marginTop: "2px",
                    }}
                  >
                    <p style={{ fontSize: "12px", color: "#A0174A", fontWeight: 700 }}>
                      Blocked: {builderStatus.feeBps} bps is above your {builderStatus.userMaxFeeBps} bps cap. Nothing will be signed.
                    </p>
                    {keptCapNotice && (
                      <p style={{ fontSize: "12px", color: "#1D6340", fontWeight: 700 }}>
                        Your {builderStatus.userMaxFeeBps} bps cap remains enforced. Routing through this builder stays blocked until they lower their fee or you raise your cap.
                      </p>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setKeptCapNotice(true)}
                        className="fuse-btn fuse-btn--primary fuse-btn--sm"
                      >
                        Keep my {builderStatus.userMaxFeeBps} bps cap
                      </button>
                      <button
                        type="button"
                        disabled={approvalPending || isWrongNetwork}
                        onClick={handleApproveBuilder}
                        data-fuse-action="approve-higher-fee"
                        className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                      >
                        {approvalPending
                          ? "Approval pending in wallet..."
                          : `Approve ${builderStatus.feeBps} bps instead`}
                      </button>
                      <button
                        type="button"
                        disabled={revokePending || isWrongNetwork}
                        onClick={handleRevokeBuilder}
                        data-fuse-action="revoke-builder"
                        className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                      >
                        {revokePending ? "Revoking..." : "Revoke partner"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    data-fuse-state="builder-approved"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      fontSize: "12px",
                      paddingTop: "2px",
                    }}
                  >
                    <span style={{ color: "#4E535A" }}>
                      {builderStatus.feeBps === 0 ? (
                        <>No partner fee. Your approval is active.</>
                      ) : (
                        <>
                          Your cap:{" "}
                          <strong className="fuse-mono fuse-num" style={{ color: "#141619" }}>
                            {builderStatus.userMaxFeePercentFormatted} ({builderStatus.userMaxFeeBps} bps)
                          </strong>
                        </>
                      )}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Link
                        href="/me"
                        className="fuse-mono"
                        style={{ fontSize: "11px" }}
                      >
                        Manage all caps
                      </Link>
                      {builderStatus.userApproved && (
                        <button
                          type="button"
                          disabled={revokePending || isWrongNetwork}
                          onClick={handleRevokeBuilder}
                          data-fuse-action="revoke-builder"
                          className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                          style={{ minHeight: "26px", padding: "2px 8px" }}
                        >
                          {revokePending ? "Revoking..." : "Revoke partner"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {lastApprovalTxUrl && (
                  <p
                    data-fuse-state="approval-tx-confirmed"
                    className="fuse-mono"
                    style={{ fontSize: "11px", marginTop: "6px", color: "#1D6340" }}
                  >
                    Cap updated on-chain:{" "}
                    <a href={lastApprovalTxUrl} target="_blank" rel="noopener noreferrer">
                      View transaction ↗
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. Wallet Connection Strip */}
      <section
        aria-label="Wallet Connection"
        data-fuse-section="wallet"
        className="fuse-widget-ticket__section"
        style={{ background: "#F6F4EE" }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div data-fuse-component="passport-connect">
            <FuseWalletControl compact />
          </div>

          {!isConnected && (
            <p
              data-fuse-state="not-connected"
              style={{ fontSize: "12px", color: "#4E535A" }}
            >
              Connect a Bitcoin or EVM wallet to continue.
            </p>
          )}

          {isConnected && (
            <div
              data-fuse-state="connected"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <span className="fuse-status-chip fuse-status-chip--env">
                {networkFamily === "bitcoin" ? "Bitcoin wallet" : "EVM wallet"}
              </span>
              <code className="fuse-mono" style={{ fontSize: "12px" }}>
                {shortenAddress(walletAddress ?? accountAddress ?? "", 5)}
              </code>
              {walletAddress &&
                accountAddress &&
                walletAddress.toLowerCase() !== accountAddress.toLowerCase() && (
                  <span className="fuse-mono" style={{ fontSize: "11px", color: "#4E535A" }}>
                    (Account: <code>{shortenAddress(accountAddress, 4)}</code>)
                  </span>
                )}
            </div>
          )}
        </div>

        {/* Taproot Address Guard */}
        {isTaproot && (
          <div
            role="alert"
            data-fuse-state="taproot-unsupported"
            className="fuse-alert fuse-alert--attention"
            style={{ marginTop: "8px" }}
          >
            <div className="fuse-alert__title">
              <span>Taproot addresses are not supported</span>
            </div>
            <p style={{ fontSize: "12px" }}>
              Bitcoin wallets on Mezo support Native SegWit (<code>tb1q...</code> / <code>bc1q...</code>), Nested SegWit, or Legacy addresses. Switch your Xverse, Unisat, or OKX account from Taproot (<code>tb1p...</code>) to Native SegWit (<code>tb1q...</code>).
            </p>
          </div>
        )}

        {/* Wrong Network Guard */}
        {isWrongNetwork && (
          <div
            role="alert"
            data-fuse-state="wrong-network"
            className="fuse-alert fuse-alert--attention"
            style={{ marginTop: "8px" }}
          >
            <div className="fuse-alert__title">
              <FuseOpenSwitchSchematicSvg color="#7C4D07" />
              <span>Wrong network</span>
            </div>
            <p style={{ fontSize: "12px", marginBottom: "8px" }}>
              Your wallet is on a different network. Switch to Mezo Testnet to continue.
            </p>
            <button
              type="button"
              onClick={handleSwitchToMezoTestnet}
              className="fuse-btn fuse-btn--primary fuse-btn--sm"
            >
              Switch to Mezo Testnet
            </button>
          </div>
        )}
      </section>

      {/* 5. Action Tabs: Swap | Save | Lock */}
      <nav
        aria-label="Mezo Actions"
        role="tablist"
        data-fuse-section="tabs"
        className="fuse-tabs"
      >
        {(["swap", "save", "lock"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            data-fuse-tab={tab}
            className="fuse-tab"
            onClick={() => {
              setActiveTab(tab);
              setErrorMessage(null);
            }}
          >
            {tab === "swap"
              ? "Swap"
              : tab === "save"
                ? "Save"
                : "Lock"}
          </button>
        ))}
      </nav>

      {/* 6A. SWAP TAB */}
      {activeTab === "swap" && (
        <fieldset data-fuse-panel="swap" className="fuse-widget-ticket__section">
          <legend className="fuse-eyebrow" style={{ marginBottom: "8px" }}>
            Swap
          </legend>

          {/* Token Pair Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: "8px",
              alignItems: "end",
              marginBottom: "10px",
            }}
          >
            <div>
              <label
                htmlFor="fuse-swap-token-in"
                className="fuse-eyebrow"
                style={{ display: "block", marginBottom: "4px" }}
              >
                FROM
              </label>
              <select
                id="fuse-swap-token-in"
                className="fuse-select"
                style={{ width: "100%" }}
                value={swapTokenInSymbol}
                onChange={(e) => {
                  const nextIn = e.target.value as MezoTokenSymbol;
                  setSwapTokenInSymbol(nextIn);
                  if (nextIn === swapTokenOutSymbol) {
                    setSwapTokenOutSymbol(nextIn === "MUSD" ? "BTC" : "MUSD");
                  }
                }}
              >
                <option value="BTC">BTC</option>
                <option value="MUSD">MUSD</option>
                <option value="MEZO">MEZO</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleFlipSwapPair}
              className="fuse-btn fuse-btn--secondary fuse-btn--sm"
              title="Flip token pair"
              aria-label="Flip swap token pair"
            >
              ⇄
            </button>

            <div>
              <label
                htmlFor="fuse-swap-token-out"
                className="fuse-eyebrow"
                style={{ display: "block", marginBottom: "4px" }}
              >
                TO
              </label>
              <select
                id="fuse-swap-token-out"
                className="fuse-select"
                style={{ width: "100%" }}
                value={swapTokenOutSymbol}
                onChange={(e) => setSwapTokenOutSymbol(e.target.value as MezoTokenSymbol)}
              >
                <option value="MUSD">MUSD</option>
                <option value="BTC">BTC</option>
                <option value="MEZO">MEZO</option>
              </select>
            </div>
          </div>

          {/* Recessed Input Well */}
          <div
            className="fuse-input-well"
            style={{
              borderColor: isInsufficientBalance ? "#A0174A" : undefined,
              marginBottom: "10px",
            }}
          >
            <div className="fuse-input-well__header">
              <label htmlFor="fuse-swap-amount" className="fuse-eyebrow">
                AMOUNT IN ({swapTokenInSymbol})
              </label>
              {isConnected && (
                <span className="fuse-mono fuse-num" style={{ fontSize: "11px", color: "#4E535A" }}>
                  Balance: {activeInputBalanceFormatted} {swapTokenInSymbol}{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setSwapAmountInput(formatUnits(maxSpendableInputBalance, 18))
                    }
                    className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                    style={{
                      minHeight: "20px",
                      padding: "0 6px",
                      marginLeft: "4px",
                      border: "1px solid #747980",
                    }}
                  >
                    MAX
                  </button>
                  {swapTokenInSymbol === "BTC" && (
                    <span style={{ marginLeft: "4px" }}>
                      Leaves a little BTC for network fees
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="fuse-input-well__row">
              <input
                id="fuse-swap-amount"
                type="text"
                inputMode="decimal"
                value={swapAmountInput}
                onChange={(e) => setSwapAmountInput(e.target.value)}
                placeholder="0.0"
                className="fuse-amount-input"
              />
              <span className="fuse-mono" style={{ fontWeight: 700, fontSize: "14px" }}>
                {swapTokenInSymbol}
              </span>
            </div>
          </div>

          {/* Slippage Tolerance Control */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <div>
              <label
                htmlFor="fuse-swap-slippage"
                className="fuse-eyebrow"
                style={{ display: "block" }}
              >
                MAX SLIPPAGE
              </label>
              <span style={{ fontSize: "11px", color: "#4E535A" }}>
                If the price moves more than {(slippageBps / 100).toFixed(1)}%, the swap cancels.
              </span>
            </div>
            <select
              id="fuse-swap-slippage"
              className="fuse-select"
              style={{ minHeight: "32px", padding: "4px 28px 4px 8px", fontSize: "12px" }}
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
            >
              <option value={10}>0.1%</option>
              <option value={50}>0.5%</option>
              <option value={100}>1.0%</option>
            </select>
          </div>

          {quoteLoading && (
            <p
              data-fuse-state="quote-loading"
              className="fuse-mono"
              style={{ fontSize: "12px", color: "#4E535A", padding: "8px 0" }}
            >
              Getting your quote...
            </p>
          )}

          {swapQuote && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {quoteAgeSeconds !== null && (
                <div className="fuse-mono" style={{ fontSize: "11px", color: "#4E535A" }}>
                  Quoted {quoteAgeSeconds}s ago
                </div>
              )}
              {/* Outcome Headline Card */}
              <div
                style={{
                  border: "1px solid #141619",
                  background: "#F6F4EE",
                  padding: "10px 12px",
                }}
              >
                <div className="fuse-eyebrow">YOU GET AT LEAST</div>
                <div
                  className="fuse-num"
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#141619",
                    marginTop: "2px",
                  }}
                >
                  {formatTokenAmount(swapQuote.amountOutMin, 18)} {swapTokenOutSymbol}
                  {swapQuote.amountOutMinUsd !== null && (
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 400,
                        color: "#4E535A",
                        marginLeft: "6px",
                      }}
                    >
                      ({formatUsd(swapQuote.amountOutMinUsd)})
                    </span>
                  )}
                </div>
                {swapExchangeRate && (
                  <div
                    className="fuse-mono fuse-num"
                    style={{ fontSize: "11px", color: "#4E535A", marginTop: "2px" }}
                  >
                    Rate: 1 {swapTokenInSymbol} = {swapExchangeRate} {swapTokenOutSymbol}
                  </div>
                )}
              </div>

              {/* Wiring Split Schematic */}
              <WiringSplitDiagram
                inputLabel={`${formatTokenAmount(swapQuote.amountIn, 18)} ${swapTokenInSymbol}`}
                netLabel={`${formatTokenAmount(swapQuote.netAmount, 18)} ${swapTokenInSymbol}`}
                builderFeeLabel={`${formatTokenAmount(swapQuote.feeAmount, 18)} ${swapTokenInSymbol}`}
                targetProtocolLabel="TIGRIS DEX"
                feeBps={swapQuote.feeBps}
                blocked={Boolean(builderStatus?.needsHigherApproval)}
              />

              {/* Dotted Leader-Line Receipt */}
              <dl className="fuse-receipt" data-fuse-section="quote-breakdown">
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">You get at least ({(swapQuote.slippageBps / 100).toFixed(1)}% max slippage)</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="min-received">
                    <strong>
                      {formatTokenAmount(swapQuote.amountOutMin, 18)} {swapTokenOutSymbol}
                    </strong>
                    {swapQuote.amountOutMinUsd !== null && ` (${formatUsd(swapQuote.amountOutMinUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Expected output</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="expected-out">
                    {formatTokenAmount(swapQuote.expectedOut, 18)} {swapTokenOutSymbol}
                    {swapQuote.expectedOutUsd !== null && ` (${formatUsd(swapQuote.expectedOutUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Input amount</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="amount-in">
                    {formatTokenAmount(swapQuote.amountIn, 18)} {swapTokenInSymbol}
                    {swapQuote.amountInUsd !== null && ` (${formatUsd(swapQuote.amountInUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">
                    Partner fee ({swapQuote.feePercentFormatted} · Self-reported)
                  </dt>
                  <span className="fuse-receipt__dots" />
                  <dd
                    className="fuse-receipt__val"
                    data-fuse-field="fee-amount"
                    style={{ color: swapQuote.feeBps > 0 ? "#9E3B0E" : "#141619" }}
                  >
                    <strong>
                      {formatTokenAmount(swapQuote.feeAmount, 18)} {swapTokenInSymbol} (
                      {swapQuote.feePercentFormatted})
                    </strong>
                    {swapQuote.feeUsd !== null && ` (${formatUsd(swapQuote.feeUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Swapped amount after fee</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="net-amount">
                    {formatTokenAmount(swapQuote.netAmount, 18)} {swapTokenInSymbol}
                    {swapQuote.netAmountUsd !== null && ` (${formatUsd(swapQuote.netAmountUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Signing mode</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="execution-method">
                    {swapTokenInSymbol === "MUSD" && !isBitcoinWallet
                      ? "One signature · Permit + Swap"
                      : `2-step allow ${swapTokenInSymbol} + Swap`}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </fieldset>
      )}

      {/* 6B. SAVE TAB */}
      {activeTab === "save" && (
        <fieldset data-fuse-panel="save" className="fuse-widget-ticket__section">
          <legend className="fuse-eyebrow" style={{ marginBottom: "8px" }}>
            Save MUSD
          </legend>

          <div
            className="fuse-input-well"
            style={{
              borderColor: isInsufficientBalance ? "#A0174A" : undefined,
              marginBottom: "10px",
            }}
          >
            <div className="fuse-input-well__header">
              <label htmlFor="fuse-save-amount" className="fuse-eyebrow">
                AMOUNT TO SAVE (MUSD)
              </label>
              {isConnected && (
                <span className="fuse-mono fuse-num" style={{ fontSize: "11px", color: "#4E535A" }}>
                  Balance: {activeInputBalanceFormatted} MUSD · Shares:{" "}
                  {formatTokenAmount(balances.sMUSD, 18)} sMUSD{" "}
                  <button
                    type="button"
                    onClick={() => setSaveAmountInput(formatUnits(activeInputBalance, 18))}
                    className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                    style={{
                      minHeight: "20px",
                      padding: "0 6px",
                      marginLeft: "4px",
                      border: "1px solid #747980",
                    }}
                  >
                    MAX
                  </button>
                </span>
              )}
            </div>

            <div className="fuse-input-well__row">
              <input
                id="fuse-save-amount"
                type="text"
                inputMode="decimal"
                value={saveAmountInput}
                onChange={(e) => setSaveAmountInput(e.target.value)}
                placeholder="0.0"
                className="fuse-amount-input"
              />
              <span className="fuse-mono" style={{ fontWeight: 700, fontSize: "14px" }}>
                MUSD
              </span>
            </div>
          </div>

          {quoteLoading && (
            <p
              data-fuse-state="quote-loading"
              className="fuse-mono"
              style={{ fontSize: "12px", color: "#4E535A", padding: "8px 0" }}
            >
              Getting your quote...
            </p>
          )}

          {saveQuote && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {quoteAgeSeconds !== null && (
                <div className="fuse-mono" style={{ fontSize: "11px", color: "#4E535A" }}>
                  Quoted {quoteAgeSeconds}s ago
                </div>
              )}
              {/* Outcome Headline Card */}
              <div
                style={{
                  border: "1px solid #141619",
                  background: "#F6F4EE",
                  padding: "10px 12px",
                }}
              >
                <div className="fuse-eyebrow">
                  {saveQuote.sharesOutIsEstimated
                    ? "ESTIMATED SAVINGS SHARES"
                    : "SAVINGS SHARES RECEIVED"}
                </div>
                <div
                  className="fuse-num"
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#141619",
                    marginTop: "2px",
                  }}
                >
                  {formatTokenAmount(saveQuote.sharesOut, 18)} sMUSD
                  {saveQuote.sharesOutUsd !== null && (
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 400,
                        color: "#4E535A",
                        marginLeft: "6px",
                      }}
                    >
                      ({formatUsd(saveQuote.sharesOutUsd)})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "11px", color: "#4E535A", marginTop: "2px" }}>
                  Minted directly to your wallet from the Mezo MUSD Savings Vault.
                </div>
              </div>

              <WiringSplitDiagram
                inputLabel={`${formatTokenAmount(saveQuote.amountIn, 18)} MUSD`}
                netLabel={`${formatTokenAmount(saveQuote.netAmount, 18)} MUSD`}
                builderFeeLabel={`${formatTokenAmount(saveQuote.feeAmount, 18)} MUSD`}
                targetProtocolLabel="MUSD VAULT"
                feeBps={saveQuote.feeBps}
                blocked={Boolean(builderStatus?.needsHigherApproval)}
              />

              <dl className="fuse-receipt" data-fuse-section="quote-breakdown">
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">
                    {saveQuote.sharesOutIsEstimated
                      ? "Estimated savings shares"
                      : "Savings shares received"}
                  </dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="min-received">
                    <strong>{formatTokenAmount(saveQuote.sharesOut, 18)} sMUSD</strong>
                    {saveQuote.sharesOutUsd !== null && ` (${formatUsd(saveQuote.sharesOutUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Input amount</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="amount-in">
                    {formatTokenAmount(saveQuote.amountIn, 18)} MUSD
                    {saveQuote.amountInUsd !== null && ` (${formatUsd(saveQuote.amountInUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">
                    Partner fee ({saveQuote.feePercentFormatted} · Self-reported)
                  </dt>
                  <span className="fuse-receipt__dots" />
                  <dd
                    className="fuse-receipt__val"
                    data-fuse-field="fee-amount"
                    style={{ color: saveQuote.feeBps > 0 ? "#9E3B0E" : "#141619" }}
                  >
                    <strong>
                      {formatTokenAmount(saveQuote.feeAmount, 18)} MUSD (
                      {saveQuote.feePercentFormatted})
                    </strong>
                    {saveQuote.feeUsd !== null && ` (${formatUsd(saveQuote.feeUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Savings vault</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">
                    <code>{shortenAddress(MEZO_TESTNET_ADDRESSES.savingsVault, 6)}</code>
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Signing mode</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="execution-method">
                    {!isBitcoinWallet
                      ? "One signature · Permit + Save"
                      : "Bitcoin wallet: 2-step allow MUSD + Save"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </fieldset>
      )}

      {/* 6C. LOCK TAB */}
      {activeTab === "lock" && (
        <fieldset data-fuse-panel="lock" className="fuse-widget-ticket__section">
          <legend className="fuse-eyebrow" style={{ marginBottom: "8px" }}>
            Lock BTC
          </legend>

          <div
            className="fuse-input-well"
            style={{
              borderColor: isInsufficientBalance ? "#A0174A" : undefined,
              marginBottom: "10px",
            }}
          >
            <div className="fuse-input-well__header">
              <label htmlFor="fuse-lock-amount" className="fuse-eyebrow">
                BTC AMOUNT TO LOCK
              </label>
              {isConnected && (
                <span className="fuse-mono fuse-num" style={{ fontSize: "11px", color: "#4E535A" }}>
                  Balance: {activeInputBalanceFormatted} BTC{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setLockAmountInput(formatUnits(maxSpendableInputBalance, 18))
                    }
                    className="fuse-btn fuse-btn--quiet fuse-btn--sm"
                    style={{
                      minHeight: "20px",
                      padding: "0 6px",
                      marginLeft: "4px",
                      border: "1px solid #747980",
                    }}
                  >
                    MAX
                  </button>
                  <span style={{ marginLeft: "4px" }}>
                    Leaves a little BTC for network fees
                  </span>
                </span>
              )}
            </div>

            <div className="fuse-input-well__row">
              <input
                id="fuse-lock-amount"
                type="text"
                inputMode="decimal"
                value={lockAmountInput}
                onChange={(e) => setLockAmountInput(e.target.value)}
                placeholder="0.0001"
                className="fuse-amount-input"
              />
              <span className="fuse-mono" style={{ fontWeight: 700, fontSize: "14px" }}>
                BTC
              </span>
            </div>
          </div>

          <div data-fuse-section="lock-presets" style={{ marginBottom: "10px" }}>
            <div className="fuse-eyebrow" style={{ marginBottom: "6px" }}>
              LOCK DURATION (MAX 30 DAYS ON TESTNET)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
              {LOCK_DURATION_PRESETS.map((preset) => {
                const selected = lockDurationSeconds === preset.seconds;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-fuse-preset={preset.id}
                    aria-pressed={selected}
                    onClick={() => setLockDurationSeconds(preset.seconds)}
                    className={`fuse-btn fuse-btn--sm ${
                      selected ? "fuse-btn--primary" : "fuse-btn--secondary"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {quoteLoading && (
            <p
              data-fuse-state="quote-loading"
              className="fuse-mono"
              style={{ fontSize: "12px", color: "#4E535A", padding: "8px 0" }}
            >
              Getting your quote...
            </p>
          )}

          {lockQuote && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
              {quoteAgeSeconds !== null && (
                <div className="fuse-mono" style={{ fontSize: "11px", color: "#4E535A" }}>
                  Quoted {quoteAgeSeconds}s ago
                </div>
              )}
              {/* Outcome Headline Card: Lead with real unlock date */}
              <div
                style={{
                  border: "1px solid #141619",
                  background: "#F6F4EE",
                  padding: "10px 12px",
                }}
              >
                <div className="fuse-eyebrow">UNLOCK DATE</div>
                <div
                  className="fuse-num"
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#141619",
                    marginTop: "2px",
                  }}
                >
                  Unlocks {lockQuote.unlockDateFormatted}
                </div>
                <div
                  className="fuse-mono fuse-num"
                  style={{ fontSize: "11px", color: "#4E535A", marginTop: "2px" }}
                >
                  {Math.round(lockQuote.lockDurationSeconds / 86400)} days · Estimated{" "}
                  {lockQuote.estimatedVotingPowerFormatted} veBTC voting power
                </div>
              </div>

              <WiringSplitDiagram
                inputLabel={`${formatTokenAmount(lockQuote.amountIn, 18)} BTC`}
                netLabel={`${formatTokenAmount(lockQuote.netAmount, 18)} BTC`}
                builderFeeLabel={`${formatTokenAmount(lockQuote.feeAmount, 18)} BTC`}
                targetProtocolLabel="MEZO VEBTC"
                feeBps={lockQuote.feeBps}
                blocked={Boolean(builderStatus?.needsHigherApproval)}
              />

              <dl className="fuse-receipt" data-fuse-section="quote-breakdown">
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Unlock date</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="unlock-date">
                    <strong>
                      {Math.round(lockQuote.lockDurationSeconds / 86400)} days · Unlocks{" "}
                      {lockQuote.unlockDateFormatted}
                    </strong>
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">BTC locked after fee</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="min-received">
                    <strong>{formatTokenAmount(lockQuote.netAmount, 18)} BTC</strong>
                    {lockQuote.netAmountUsd !== null && ` (${formatUsd(lockQuote.netAmountUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">BTC you send</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="amount-in">
                    {formatTokenAmount(lockQuote.amountIn, 18)} BTC
                    {lockQuote.amountInUsd !== null && ` (${formatUsd(lockQuote.amountInUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">
                    Partner fee ({lockQuote.feePercentFormatted} · Self-reported)
                  </dt>
                  <span className="fuse-receipt__dots" />
                  <dd
                    className="fuse-receipt__val"
                    data-fuse-field="fee-amount"
                    style={{ color: lockQuote.feeBps > 0 ? "#9E3B0E" : "#141619" }}
                  >
                    <strong>
                      {formatTokenAmount(lockQuote.feeAmount, 18)} BTC (
                      {lockQuote.feePercentFormatted})
                    </strong>
                    {lockQuote.feeUsd !== null && ` (${formatUsd(lockQuote.feeUsd)})`}
                  </dd>
                </div>

                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Estimated voting power</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val" data-fuse-field="voting-power">
                    {lockQuote.estimatedVotingPowerFormatted} veBTC
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Mandatory Lock Notice in plain copy */}
          <div
            role="note"
            data-fuse-notice="vebtc-lock-warning"
            className="fuse-alert fuse-alert--attention"
          >
            <p style={{ fontSize: "12px", marginBottom: "8px" }}>
              Locked BTC becomes a <code>veBTC</code> position you can&apos;t withdraw until the unlock date (
              <strong>{lockQuote?.unlockDateFormatted ?? "the unlock date"}</strong>).
            </p>
            <label
              htmlFor="fuse-lock-acknowledge"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <input
                id="fuse-lock-acknowledge"
                type="checkbox"
                checked={lockWarningAcknowledged}
                onChange={(e) => setLockWarningAcknowledged(e.target.checked)}
                style={{ marginTop: "2px", accentColor: "#141619" }}
              />
              <span>
                I can&apos;t withdraw this BTC before{" "}
                {lockQuote?.unlockDateFormatted ?? "the unlock date"}.
              </span>
            </label>
          </div>
        </fieldset>
      )}

      {/* 7. Validation, Error, Pending, Confirmed Receipt & Submit Controls */}
      <div
        data-fuse-section="submit-controls"
        className="fuse-widget-ticket__section"
        style={{ display: "flex", flexDirection: "column", gap: "8px" }}
      >
        {validInitialTx && (
          <div
            data-fuse-state="last-transaction"
            className="fuse-alert fuse-alert--attention"
          >
            <div className="fuse-alert__title">Your last transaction</div>
            <div style={{ fontSize: "12px", display: "flex", gap: "10px" }}>
              <Link href={`/receipt/${validInitialTx}`}>View receipt</Link>
              <a
                href={getExplorerTxUrl(validInitialTx)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Explorer ↗
              </a>
            </div>
          </div>
        )}

        {isInsufficientBalance && (
          <div
            role="alert"
            data-fuse-state="insufficient-balance"
            className="fuse-alert fuse-alert--tripped"
          >
            <strong>Insufficient balance:</strong> Balance: {activeInputBalanceFormatted}{" "}
            {activeInputSymbol}.{" "}
            {activeInputSymbol === "BTC"
              ? "Enter a smaller amount so you have BTC left for network fees."
              : "Enter a smaller amount."}
          </div>
        )}

        {quoteError && (
          <div
            role="alert"
            data-fuse-state="quote-error"
            className="fuse-alert fuse-alert--attention"
          >
            <strong>Quote notice:</strong> {quoteError}
          </div>
        )}

        {actionPending && (
          <output
            aria-live="polite"
            data-fuse-state="action-pending"
            className="fuse-alert fuse-alert--attention"
          >
            <div className="fuse-alert__title">
              <FuseOpenSwitchSchematicSvg color="#7C4D07" />
              <span>In progress</span>
            </div>
            <p style={{ fontSize: "12px", fontWeight: 700 }}>
              {describeExecutionStep(executionStep)}
            </p>
            {pendingTx && (
              <p style={{ fontSize: "12px" }}>
                {pendingTx.kind === "token_approval" ? "Token approval" : "Action"}:{" "}
                <a
                  href={pendingTx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fuse-mono"
                >
                  {shortenAddress(pendingTx.hash, 8)} (Explorer ↗)
                </a>
              </p>
            )}
          </output>
        )}

        {errorMessage && (
          <div
            role="alert"
            data-fuse-state="action-error"
            className="fuse-alert fuse-alert--tripped"
          >
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {lastResult && (
          <output
            aria-live="polite"
            data-fuse-state="action-success"
            className="fuse-alert fuse-alert--approved"
          >
            <div className="fuse-alert__title">
              <FuseIntactSchematicSvg color="#1D6340" />
              <span>Done. Confirmed on Mezo Testnet</span>
            </div>
            <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div>
                Transaction:{" "}
                <a
                  href={lastResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fuse-mono"
                >
                  <code>{shortenAddress(lastResult.txHash, 8)}</code> (Explorer ↗)
                </a>
              </div>
              <div>
                Signed with:{" "}
                <strong className="fuse-mono">
                  {lastResult.usedPermit
                    ? "One signature · Permit + Action"
                    : lastResult.approvalTxHash
                      ? `2-step allow (${shortenAddress(lastResult.approvalTxHash, 6)}) + Action`
                      : "Existing token allowance"}
                </strong>
              </div>
              <div style={{ marginTop: "4px" }}>
                <Link
                  href={`/receipt/${lastResult.txHash}`}
                  className="fuse-btn fuse-btn--secondary fuse-btn--sm"
                >
                  View receipt
                </Link>
              </div>
            </div>
          </output>
        )}

        <button
          type="button"
          disabled={!canSubmitAction}
          onClick={handleExecuteAction}
          data-fuse-action="submit"
          className={`fuse-btn fuse-btn--block ${
            isCapActionBlocking
              ? "fuse-btn--secondary"
              : "fuse-btn--primary fuse-btn--lg fuse-btn--hard-shadow"
          }`}
        >
          {!isConnected
            ? "Connect wallet to continue"
            : isWrongNetwork
              ? "Switch network above"
              : builderStatus?.routerPaused
                ? "Routing is paused"
                : builderStatus?.needsHigherApproval
                  ? `Blocked: fee is above your ${builderStatus.userMaxFeeBps} bps cap`
                  : builderStatus?.needsApproval
                    ? `Approve the fee cap above first`
                    : isInsufficientBalance
                      ? `Insufficient ${activeInputSymbol} Balance`
                      : activeTab === "lock" && !lockWarningAcknowledged
                        ? "Tick the box above to continue"
                        : actionPending
                          ? describeExecutionStep(executionStep)
                          : activeTab === "swap"
                            ? `Swap ${swapAmountInput || "0"} ${swapTokenInSymbol} for ${swapTokenOutSymbol}`
                            : activeTab === "save"
                              ? `Save ${saveAmountInput || "0"} MUSD`
                              : `Lock ${lockAmountInput || "0"} BTC`}
        </button>
      </div>
    </section>
  );
}
