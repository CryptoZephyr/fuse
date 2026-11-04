"use client";

import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";
import {
  type ExecutionStep,
  type FuseActionType,
  LOCK_DURATION_PRESETS,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TOKENS,
  type MezoTokenSymbol,
  formatUsd,
  getExplorerAddressUrl,
  shortenAddress,
} from "mezo-fuse";
import { useFuseWidget } from "../hooks/useFuseWidget";

export interface FuseWidgetProps {
  /** Builder address (`0x...`) credited for routed actions */
  builder?: string | null;
  /** Initial active tab (`swap` | `save` | `lock`) */
  defaultAction?: FuseActionType;
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

function describeExecutionStep(step: ExecutionStep | null): string {
  switch (step) {
    case "checking_allowance":
      return "Checking token allowance...";
    case "permit_signature_pending":
      return "Permit signature pending in wallet (EIP-2612 MUSD permit)...";
    case "permit_fallback_to_approve":
      return "Bitcoin smart account detected — falling back to standard ERC-20 approve + action...";
    case "token_approval_pending":
      return "Token approval pending signature in wallet...";
    case "token_approval_confirming":
      return "Waiting for token approval confirmation on Mezo testnet...";
    case "action_tx_pending":
      return "Action transaction pending signature in wallet...";
    case "action_tx_confirming":
      return "Waiting for transaction confirmation on Mezo testnet...";
    case "confirmed":
      return "Confirmed on Mezo testnet.";
    default:
      return "Submitting...";
  }
}

/**
 * `<FuseWidget />` — Embeddable Mezo Builder Router Widget.
 *
 * NOTE ON VISUAL DESIGN (see `FRONTEND.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`):
 * Visual design belongs exclusively to the project owner. This component intentionally
 * renders plain, unstyled semantic HTML with `data-fuse-*` hooks and accessible attributes
 * so it functions at any iframe width while leaving all visual styling decisions to the owner.
 */
export function FuseWidget({ builder, defaultAction = "swap" }: FuseWidgetProps) {
  const state = useFuseWidget({
    builderAddress: builder,
    defaultAction,
  });

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
    isInsufficientBalance,
    parsedAmountWei,
    swapQuote,
    saveQuote,
    lockQuote,
    quoteLoading,
    quoteError,
    approvalPending,
    revokePending,
    actionPending,
    executionStep,
    errorMessage,
    setErrorMessage,
    lastResult,
    lastApprovalTxUrl,
    handleApproveBuilder,
    handleRevokeBuilder,
    handleExecuteAction,
  } = state;

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
    !actionPending &&
    (activeTab !== "lock" || lockWarningAcknowledged) &&
    (activeTab !== "swap" || Boolean(swapQuote));

  return (
    <section
      aria-label="Fuse Mezo Builder Action Widget"
      data-fuse-surface="widget"
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%",
        overflowWrap: "break-word",
      }}
    >
      {/* 1. Header: Network Badge + Live Skip Oracle Status */}
      <header data-fuse-section="header">
        <div>
          <strong data-fuse-badge="network">Mezo testnet (Chain ID 31611)</strong>
          {" · "}
          <span>Testnet tokens only (not real money)</span>
        </div>
        <div data-fuse-section="oracle">
          {btcUsdPrice ? (
            <span>
              Skip BTC/USD Oracle: <strong>{btcUsdPrice.formattedUsd}</strong>
            </span>
          ) : (
            <span data-fuse-state="oracle-unavailable">
              BTC/USD price feed unavailable (dollar values hidden; actions remain enabled)
            </span>
          )}
        </div>
      </header>

      <hr />

      {/* 2. Wallet Connection (Mezo Passport only) */}
      <section aria-label="Wallet Connection" data-fuse-section="wallet">
        <div data-fuse-component="passport-connect">
          <ConnectButton showBalance={false} />
        </div>

        {!isConnected && (
          <p data-fuse-state="not-connected">
            Status: <strong>Not connected</strong>. Connect a Bitcoin wallet (Xverse, Unisat, OKX) or EVM wallet via Mezo Passport.
          </p>
        )}

        {isConnected && (
          <div data-fuse-state="connected">
            <p>
              Connected ({networkFamily === "bitcoin" ? "Bitcoin Smart Account via OrangeKit Safe" : "EVM Wallet"}):{" "}
              <code>{walletAddress}</code>
              {walletAddress &&
                accountAddress &&
                walletAddress.toLowerCase() !== accountAddress.toLowerCase() && (
                  <>
                    {" "}
                    (Mezo EVM Safe: <code>{shortenAddress(accountAddress, 6)}</code>)
                  </>
                )}
            </p>
          </div>
        )}

        {/* Taproot Address Guard (T0 Spike Architectural Decision #2) */}
        {isTaproot && (
          <div role="alert" data-fuse-state="taproot-unsupported">
            <strong>Unsupported Bitcoin Address Type (Taproot P2TR):</strong> Mezo Passport OrangeKit only supports Native SegWit (<code>tb1q...</code> / <code>bc1q...</code>), Nested SegWit, or Legacy addresses. Please switch your Xverse / Unisat / OKX account from Taproot (<code>tb1p...</code>) to Native SegWit (<code>tb1q...</code>).
          </div>
        )}

        {/* Wrong Network Guard */}
        {isWrongNetwork && (
          <div role="alert" data-fuse-state="wrong-network">
            <p>
              <strong>Wrong network:</strong> Please switch your wallet to Mezo Testnet (Chain ID 31611).
            </p>
            <button type="button" onClick={handleSwitchToMezoTestnet}>
              Switch to Mezo Testnet (31611)
            </button>
          </div>
        )}
      </section>

      <hr />

      {/* 3. Builder Attribution & Per-User Fee Approval Guard */}
      <section aria-label="Builder Attribution and Fee Approval" data-fuse-section="builder">
        {!isValidBuilderAddress && (
          <div role="alert" data-fuse-state="invalid-builder">
            Invalid builder address parameter. Defaulting to testnet builder{" "}
            <code>{builderAddress}</code>.
          </div>
        )}

        {builderLoading ? (
          <p data-fuse-state="builder-loading">Loading builder registration from FuseRouter...</p>
        ) : !builderStatus ? (
          <div role="alert" data-fuse-state="builder-error">
            Unable to read builder status from FuseRouter.
          </div>
        ) : (
          <div>
            <p>
              Builder:{" "}
              <strong data-fuse-field="builder-name">
                {builderStatus.metadata.name}
              </strong>{" "}
              <small data-fuse-label="self-reported">(self-reported name)</small>{" "}
              <a
                href={getExplorerAddressUrl(builderStatus.address)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <code>{shortenAddress(builderStatus.address, 6)}</code>
              </a>
            </p>
            <p>
              Builder Fee:{" "}
              <strong data-fuse-field="builder-fee-percent">
                {builderStatus.feePercentFormatted} ({builderStatus.feeBps} bps)
              </strong>{" "}
              {builderStatus.feeBps === 0 && (
                <span>(Zero-fee attribution mode — 100% of input goes to action)</span>
              )}
            </p>

            {!builderStatus.registered && (
              <div role="alert" data-fuse-state="builder-not-registered">
                <strong>Builder not registered:</strong> Address{" "}
                <code>{builderStatus.address}</code> is not registered in FuseRouter.
              </div>
            )}

            {builderStatus.registered && !builderStatus.active && (
              <div role="alert" data-fuse-state="builder-inactive">
                <strong>Builder inactive:</strong> This builder is currently deactivated and cannot route new actions.
              </div>
            )}

            {builderStatus.routerPaused && (
              <div role="alert" data-fuse-state="router-paused">
                <strong>Router paused:</strong> FuseRouter is currently paused for new actions. You may still revoke your builder fee approval below at any time.
              </div>
            )}

            {isConnected && builderStatus.registered && (
              <div data-fuse-section="user-approval">
                {builderStatus.needsApproval ? (
                  <div role="alert" data-fuse-state="builder-not-approved">
                    <p>
                      <strong>Builder not approved:</strong> You must approve this builder&apos;s maximum fee (
                      {builderStatus.feePercentFormatted}) before routing actions through FuseRouter.
                    </p>
                    <button
                      type="button"
                      disabled={approvalPending || isWrongNetwork}
                      onClick={handleApproveBuilder}
                      data-fuse-action="approve-builder"
                    >
                      {approvalPending
                        ? "Approval pending in wallet..."
                        : `Approve Builder up to ${builderStatus.feePercentFormatted} (${builderStatus.feeBps} bps)`}
                    </button>
                  </div>
                ) : builderStatus.needsHigherApproval ? (
                  <div role="alert" data-fuse-state="fee-above-user-approval">
                    <p>
                      <strong>Builder fee increased:</strong> Builder fee is now{" "}
                      {builderStatus.feePercentFormatted} ({builderStatus.feeBps} bps), which is above your approved maximum of{" "}
                      {builderStatus.userMaxFeePercentFormatted} ({builderStatus.userMaxFeeBps} bps). A fee increase never applies silently.
                    </p>
                    <button
                      type="button"
                      disabled={approvalPending || isWrongNetwork}
                      onClick={handleApproveBuilder}
                      data-fuse-action="approve-higher-fee"
                    >
                      {approvalPending
                        ? "Approval pending in wallet..."
                        : `Approve Updated Fee (${builderStatus.feePercentFormatted})`}
                    </button>{" "}
                    <button
                      type="button"
                      disabled={revokePending || isWrongNetwork}
                      onClick={handleRevokeBuilder}
                      data-fuse-action="revoke-builder"
                    >
                      {revokePending ? "Revoking..." : "Revoke Builder Approval"}
                    </button>
                  </div>
                ) : (
                  <p data-fuse-state="builder-approved">
                    Your Approval: Approved up to{" "}
                    <strong>
                      {builderStatus.userMaxFeePercentFormatted} ({builderStatus.userMaxFeeBps} bps)
                    </strong>{" "}
                    <button
                      type="button"
                      disabled={revokePending || isWrongNetwork}
                      onClick={handleRevokeBuilder}
                      data-fuse-action="revoke-builder"
                    >
                      {revokePending ? "Revoking..." : "Revoke Builder"}
                    </button>
                  </p>
                )}

                {lastApprovalTxUrl && (
                  <p data-fuse-state="approval-tx-confirmed">
                    Builder approval updated:{" "}
                    <a href={lastApprovalTxUrl} target="_blank" rel="noopener noreferrer">
                      View transaction on Mezo Testnet Explorer
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <hr />

      {/* 4. Action Tabs: Swap | Save | Lock */}
      <nav aria-label="Mezo Actions" role="tablist" data-fuse-section="tabs">
        {(["swap", "save", "lock"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            data-fuse-tab={tab}
            onClick={() => {
              setActiveTab(tab);
              setErrorMessage(null);
            }}
          >
            {tab === "swap"
              ? "Swap (Tigris DEX)"
              : tab === "save"
                ? "Save (MUSD → sMUSD)"
                : "Lock (BTC → veBTC)"}
            {activeTab === tab ? " [Active]" : ""}
          </button>
        ))}
      </nav>

      <hr />

      {/* 5A. SWAP TAB */}
      {activeTab === "swap" && (
        <fieldset data-fuse-panel="swap">
          <legend>Swap via Tigris Router</legend>

          <div>
            <label htmlFor="fuse-swap-token-in">From Token: </label>
            <select
              id="fuse-swap-token-in"
              value={swapTokenInSymbol}
              onChange={(e) => {
                const nextIn = e.target.value as MezoTokenSymbol;
                setSwapTokenInSymbol(nextIn);
                if (nextIn === swapTokenOutSymbol) {
                  setSwapTokenOutSymbol(nextIn === "MUSD" ? "BTC" : "MUSD");
                }
              }}
            >
              <option value="BTC">BTC (Mezo Precompile)</option>
              <option value="MUSD">MUSD (Mezo USD)</option>
              <option value="MEZO">MEZO</option>
            </select>{" "}
            <button type="button" onClick={handleFlipSwapPair}>
              Flip Pair (⇄)
            </button>{" "}
            <label htmlFor="fuse-swap-token-out">To Token: </label>
            <select
              id="fuse-swap-token-out"
              value={swapTokenOutSymbol}
              onChange={(e) => setSwapTokenOutSymbol(e.target.value as MezoTokenSymbol)}
            >
              <option value="MUSD">MUSD (Mezo USD)</option>
              <option value="BTC">BTC (Mezo Precompile)</option>
            </select>
          </div>

          <div>
            <label htmlFor="fuse-swap-amount">
              Amount In ({swapTokenInSymbol}):{" "}
            </label>
            <input
              id="fuse-swap-amount"
              type="text"
              inputMode="decimal"
              value={swapAmountInput}
              onChange={(e) => setSwapAmountInput(e.target.value)}
              placeholder="0.0"
            />
            {isConnected && (
              <span>
                {" "}
                Balance: {activeInputBalanceFormatted} {swapTokenInSymbol}{" "}
                <button
                  type="button"
                  onClick={() =>
                    setSwapAmountInput(formatUnits(activeInputBalance, 18))
                  }
                >
                  Max
                </button>
              </span>
            )}
          </div>

          <div>
            <label htmlFor="fuse-swap-slippage">Slippage Tolerance: </label>
            <select
              id="fuse-swap-slippage"
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
            >
              <option value={10}>0.10% (10 bps)</option>
              <option value={50}>0.50% (50 bps)</option>
              <option value={100}>1.00% (100 bps)</option>
            </select>
          </div>

          {quoteLoading && (
            <p data-fuse-state="quote-loading">Loading swap quote from Tigris Router...</p>
          )}

          {swapQuote && (
            <dl data-fuse-section="quote-breakdown">
              <dt>Input Amount:</dt>
              <dd data-fuse-field="amount-in">
                {formatTokenAmount(swapQuote.amountIn, 18)} {swapTokenInSymbol}
                {swapQuote.amountInUsd !== null && ` (${formatUsd(swapQuote.amountInUsd)})`}
              </dd>

              <dt>
                Builder Fee ({swapQuote.feePercentFormatted} to{" "}
                {builderStatus?.metadata.name ?? shortenAddress(builderAddress)}{" "}
                <small>(self-reported)</small>):
              </dt>
              <dd data-fuse-field="fee-amount">
                <strong>
                  {formatTokenAmount(swapQuote.feeAmount, 18)} {swapTokenInSymbol} (
                  {swapQuote.feePercentFormatted})
                </strong>
                {swapQuote.feeUsd !== null && ` (${formatUsd(swapQuote.feeUsd)})`}
              </dd>

              <dt>Net Amount Routed to Tigris:</dt>
              <dd data-fuse-field="net-amount">
                {formatTokenAmount(swapQuote.netAmount, 18)} {swapTokenInSymbol}
                {swapQuote.netAmountUsd !== null && ` (${formatUsd(swapQuote.netAmountUsd)})`}
              </dd>

              <dt>Expected Output:</dt>
              <dd data-fuse-field="expected-out">
                {formatTokenAmount(swapQuote.expectedOut, 18)} {swapTokenOutSymbol}
                {swapQuote.expectedOutUsd !== null && ` (${formatUsd(swapQuote.expectedOutUsd)})`}
              </dd>

              <dt>Minimum Received ({(swapQuote.slippageBps / 100).toFixed(2)}% max slippage):</dt>
              <dd data-fuse-field="min-received">
                <strong>
                  {formatTokenAmount(swapQuote.amountOutMin, 18)} {swapTokenOutSymbol}
                </strong>
                {swapQuote.amountOutMinUsd !== null && ` (${formatUsd(swapQuote.amountOutMinUsd)})`}
              </dd>

              <dt>Approval Method:</dt>
              <dd data-fuse-field="execution-method">
                {swapTokenInSymbol === "MUSD" && !isBitcoinWallet
                  ? "Single-transaction EIP-2612 MUSD Permit (swapWithPermit)"
                  : "Standard ERC-20 Approve + Swap"}
              </dd>
            </dl>
          )}
        </fieldset>
      )}

      {/* 5B. SAVE TAB */}
      {activeTab === "save" && (
        <fieldset data-fuse-panel="save">
          <legend>Save MUSD in Mezo Savings Vault (sMUSD)</legend>

          <div>
            <label htmlFor="fuse-save-amount">Amount to Save (MUSD): </label>
            <input
              id="fuse-save-amount"
              type="text"
              inputMode="decimal"
              value={saveAmountInput}
              onChange={(e) => setSaveAmountInput(e.target.value)}
              placeholder="0.0"
            />
            {isConnected && (
              <span>
                {" "}
                MUSD Balance: {activeInputBalanceFormatted} MUSD (Current sMUSD:{" "}
                {formatTokenAmount(balances.sMUSD, 18)} sMUSD){" "}
                <button
                  type="button"
                  onClick={() =>
                    setSaveAmountInput(formatUnits(activeInputBalance, 18))
                  }
                >
                  Max
                </button>
              </span>
            )}
          </div>

          {quoteLoading && (
            <p data-fuse-state="quote-loading">Calculating MUSD Savings Vault quote...</p>
          )}

          {saveQuote && (
            <dl data-fuse-section="quote-breakdown">
              <dt>Input Amount:</dt>
              <dd data-fuse-field="amount-in">
                {formatTokenAmount(saveQuote.amountIn, 18)} MUSD
                {saveQuote.amountInUsd !== null && ` (${formatUsd(saveQuote.amountInUsd)})`}
              </dd>

              <dt>
                Builder Fee ({saveQuote.feePercentFormatted} to{" "}
                {builderStatus?.metadata.name ?? shortenAddress(builderAddress)}{" "}
                <small>(self-reported)</small>):
              </dt>
              <dd data-fuse-field="fee-amount">
                <strong>
                  {formatTokenAmount(saveQuote.feeAmount, 18)} MUSD (
                  {saveQuote.feePercentFormatted})
                </strong>
                {saveQuote.feeUsd !== null && ` (${formatUsd(saveQuote.feeUsd)})`}
              </dd>

              <dt>Minimum sMUSD Received (transferred directly to your wallet):</dt>
              <dd data-fuse-field="min-received">
                <strong>{formatTokenAmount(saveQuote.sharesOut, 18)} sMUSD</strong>
                {saveQuote.sharesOutUsd !== null && ` (${formatUsd(saveQuote.sharesOutUsd)})`}
              </dd>

              <dt>MUSD Savings Vault Contract:</dt>
              <dd>
                <code>{MEZO_TESTNET_ADDRESSES.savingsVault}</code>
              </dd>

              <dt>Approval Method:</dt>
              <dd data-fuse-field="execution-method">
                {!isBitcoinWallet
                  ? "Single-transaction EIP-2612 MUSD Permit (saveWithPermit)"
                  : "Bitcoin Smart Account: 2-step ERC-20 Approve + Save"}
              </dd>
            </dl>
          )}
        </fieldset>
      )}

      {/* 5C. LOCK TAB */}
      {activeTab === "lock" && (
        <fieldset data-fuse-panel="lock">
          <legend>Lock BTC into Mezo VeBTC (createLockFor)</legend>

          <div>
            <label htmlFor="fuse-lock-amount">BTC Amount to Lock: </label>
            <input
              id="fuse-lock-amount"
              type="text"
              inputMode="decimal"
              value={lockAmountInput}
              onChange={(e) => setLockAmountInput(e.target.value)}
              placeholder="0.0001"
            />
            {isConnected && (
              <span>
                {" "}
                BTC Balance: {activeInputBalanceFormatted} BTC{" "}
                <button
                  type="button"
                  onClick={() =>
                    setLockAmountInput(formatUnits(activeInputBalance, 18))
                  }
                >
                  Max
                </button>
              </span>
            )}
          </div>

          <div data-fuse-section="lock-presets">
            <span>Lock Duration (Mezo Testnet maxLockTime = 30 days, rounded to Thursday 00:00 UTC): </span>
            {LOCK_DURATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-fuse-preset={preset.id}
                aria-pressed={lockDurationSeconds === preset.seconds}
                onClick={() => setLockDurationSeconds(preset.seconds)}
              >
                {preset.label}
                {lockDurationSeconds === preset.seconds ? " [Selected]" : ""}
              </button>
            ))}
          </div>

          {quoteLoading && (
            <p data-fuse-state="quote-loading">Calculating VeBTC lock quote...</p>
          )}

          {lockQuote && (
            <dl data-fuse-section="quote-breakdown">
              <dt>Gross BTC Input:</dt>
              <dd data-fuse-field="amount-in">
                {formatTokenAmount(lockQuote.amountIn, 18)} BTC
                {lockQuote.amountInUsd !== null && ` (${formatUsd(lockQuote.amountInUsd)})`}
              </dd>

              <dt>
                Builder Fee ({lockQuote.feePercentFormatted} to{" "}
                {builderStatus?.metadata.name ?? shortenAddress(builderAddress)}{" "}
                <small>(self-reported)</small>):
              </dt>
              <dd data-fuse-field="fee-amount">
                <strong>
                  {formatTokenAmount(lockQuote.feeAmount, 18)} BTC (
                  {lockQuote.feePercentFormatted})
                </strong>
                {lockQuote.feeUsd !== null && ` (${formatUsd(lockQuote.feeUsd)})`}
              </dd>

              <dt>Net BTC Locked in VeBTC (veBTC NFT minted to you):</dt>
              <dd data-fuse-field="min-received">
                <strong>{formatTokenAmount(lockQuote.netAmount, 18)} BTC</strong>
                {lockQuote.netAmountUsd !== null && ` (${formatUsd(lockQuote.netAmountUsd)})`}
              </dd>

              <dt>Lock Duration &amp; Unlock Date (Thursday 00:00 UTC epoch):</dt>
              <dd data-fuse-field="unlock-date">
                <strong>
                  {Math.round(lockQuote.lockDurationSeconds / 86400)} days — Unlocks{" "}
                  {lockQuote.unlockDateFormatted}
                </strong>
              </dd>

              <dt>Estimated Initial veBTC Voting Power:</dt>
              <dd data-fuse-field="voting-power">
                {lockQuote.estimatedVotingPowerFormatted} veBTC
              </dd>
            </dl>
          )}

          {/* Mandatory Copy Rule from FRONTEND.md: Explain that veBTC cannot be withdrawn before the lock expires, before the user locks */}
          <div role="note" data-fuse-notice="vebtc-lock-warning">
            <p>
              <strong>Important Lock Notice:</strong> Locked BTC is converted into a <code>veBTC</code> NFT and{" "}
              <strong>cannot be withdrawn before the lock expires</strong> ({lockQuote?.unlockDateFormatted ?? "the unlock date"}).
            </p>
            <label htmlFor="fuse-lock-acknowledge">
              <input
                id="fuse-lock-acknowledge"
                type="checkbox"
                checked={lockWarningAcknowledged}
                onChange={(e) => setLockWarningAcknowledged(e.target.checked)}
              />{" "}
              I understand that my locked BTC cannot be withdrawn until the lock expires.
            </label>
          </div>
        </fieldset>
      )}

      {/* 6. Validation, Error, Pending & Submit Controls */}
      <div data-fuse-section="submit-controls">
        {isInsufficientBalance && (
          <div role="alert" data-fuse-state="insufficient-balance">
            <strong>Insufficient balance:</strong> Your {activeInputSymbol} balance (
            {activeInputBalanceFormatted} {activeInputSymbol}) is less than the requested input amount.
          </div>
        )}

        {quoteError && (
          <div role="alert" data-fuse-state="quote-error">
            <strong>Quote notice:</strong> {quoteError}
          </div>
        )}

        {actionPending && (
          <output aria-live="polite" data-fuse-state="action-pending">
            <p>
              <strong>{describeExecutionStep(executionStep)}</strong>
            </p>
          </output>
        )}

        {errorMessage && (
          <div role="alert" data-fuse-state="action-error">
            <p>
              <strong>Error:</strong> {errorMessage}
            </p>
          </div>
        )}

        {lastResult && (
          <output aria-live="polite" data-fuse-state="action-success">
            <p>
              <strong>Mezo Testnet Action Confirmed!</strong> (Testnet transaction — not real money)
            </p>
            <ul>
              <li>
                Routed Transaction:{" "}
                <a
                  href={lastResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <code>{lastResult.txHash}</code> (View on Mezo Testnet Explorer)
                </a>
              </li>
              <li>
                Approval Method Used:{" "}
                {lastResult.usedPermit
                  ? "1-tx EIP-2612 MUSD Permit"
                  : lastResult.approvalTxHash
                    ? `ERC-20 Approve (${shortenAddress(lastResult.approvalTxHash, 6)}) + Routed Action`
                    : "Existing Token Allowance"}
              </li>
            </ul>
          </output>
        )}

        <button
          type="button"
          disabled={!canSubmitAction}
          onClick={handleExecuteAction}
          data-fuse-action="submit"
        >
          {!isConnected
            ? "Connect Wallet via Mezo Passport to Continue"
            : isWrongNetwork
              ? "Switch to Mezo Testnet (31611) Above"
              : builderStatus?.routerPaused
                ? "FuseRouter is Paused"
                : builderStatus?.needsApproval || builderStatus?.needsHigherApproval
                  ? `Approve Builder Fee (${builderStatus.feePercentFormatted}) Above First`
                  : isInsufficientBalance
                    ? `Insufficient ${activeInputSymbol} Balance`
                    : activeTab === "lock" && !lockWarningAcknowledged
                      ? "Acknowledge VeBTC Lock Expiry Notice Above"
                      : actionPending
                        ? describeExecutionStep(executionStep)
                        : activeTab === "swap"
                          ? `Swap ${swapAmountInput || "0"} ${swapTokenInSymbol} → ${swapTokenOutSymbol} (Fee: ${builderStatus?.feePercentFormatted ?? "0%"})`
                          : activeTab === "save"
                            ? `Save ${saveAmountInput || "0"} MUSD → sMUSD (Fee: ${builderStatus?.feePercentFormatted ?? "0%"})`
                            : `Lock ${lockAmountInput || "0"} BTC → veBTC (Fee: ${builderStatus?.feePercentFormatted ?? "0%"})`}
        </button>
      </div>
    </section>
  );
}
