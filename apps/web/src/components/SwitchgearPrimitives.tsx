"use client";

import React from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getExplorerAddressUrl, shortenAddress } from "mezo-fuse";

/* ==========================================================================
   1. Inline Schematic SVGs (Crisp 1.5px/2px technical strokes)
   ========================================================================== */

export function FuseIntactSchematicSvg({
  color = "currentColor",
}: {
  color?: string;
}) {
  return (
    <svg
      width="44"
      height="16"
      viewBox="0 0 44 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <line x1="0" y1="8" x2="11" y2="8" stroke={color} strokeWidth="2" />
      <circle cx="2" cy="8" r="2" fill={color} />
      <rect
        x="11"
        y="3"
        width="22"
        height="10"
        stroke={color}
        strokeWidth="1.75"
        fill="none"
      />
      <line x1="11" y1="8" x2="33" y2="8" stroke={color} strokeWidth="2" />
      <rect x="11" y="3" width="3" height="10" fill={color} />
      <rect x="30" y="3" width="3" height="10" fill={color} />
      <line x1="33" y1="8" x2="44" y2="8" stroke={color} strokeWidth="2" />
      <circle cx="42" cy="8" r="2" fill={color} />
    </svg>
  );
}

export function FuseTrippedSchematicSvg({
  color = "#A0174A",
}: {
  color?: string;
}) {
  return (
    <svg
      width="44"
      height="16"
      viewBox="0 0 44 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <line x1="0" y1="8" x2="11" y2="8" stroke={color} strokeWidth="2" />
      <circle cx="2" cy="8" r="2" fill={color} />
      <rect
        x="11"
        y="3"
        width="22"
        height="10"
        stroke={color}
        strokeWidth="1.75"
        fill="none"
      />
      <line x1="11" y1="8" x2="18" y2="8" stroke={color} strokeWidth="2" />
      <line x1="18" y1="8" x2="24" y2="4.5" stroke={color} strokeWidth="2" />
      <line x1="26" y1="8" x2="33" y2="8" stroke={color} strokeWidth="2" />
      <rect x="11" y="3" width="3" height="10" fill={color} />
      <rect x="30" y="3" width="3" height="10" fill={color} />
      <line x1="33" y1="8" x2="44" y2="8" stroke={color} strokeWidth="2" />
      <circle cx="42" cy="8" r="2" fill={color} />
    </svg>
  );
}

export function FuseOpenSwitchSchematicSvg({
  color = "currentColor",
}: {
  color?: string;
}) {
  return (
    <svg
      width="44"
      height="16"
      viewBox="0 0 44 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <line x1="0" y1="10" x2="14" y2="10" stroke={color} strokeWidth="2" />
      <circle cx="14" cy="10" r="2.2" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="15.5" y1="9" x2="28" y2="3" stroke={color} strokeWidth="2" />
      <circle cx="30" cy="10" r="2.2" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="32" y1="10" x2="44" y2="10" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/* ==========================================================================
   2. Switchgear Wallet Connect Control (RainbowKit ConnectButton.Custom)
   ========================================================================== */

export interface FuseWalletControlProps {
  label?: string;
  compact?: boolean;
  fullWidth?: boolean;
  hardShadow?: boolean;
}

export function FuseWalletControl({
  label = "Connect wallet",
  compact = false,
  fullWidth = false,
  hardShadow = false,
}: FuseWalletControlProps) {
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  const sizeClass = compact ? "fuse-btn--sm" : fullWidth ? "fuse-btn--lg fuse-btn--block" : "";
  const shadowClass = hardShadow ? "fuse-btn--hard-shadow" : "";

  if (!hasMounted) {
    return (
      <button
        type="button"
        className={`fuse-btn fuse-btn--primary ${sizeClass} ${shadowClass}`.trim()}
        data-fuse-wallet-trigger="connect"
        style={fullWidth ? { width: "100%" } : undefined}
      >
        <span>{label}</span>
      </button>
    );
  }

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
            style={{
              display: fullWidth ? "flex" : "inline-flex",
              width: fullWidth ? "100%" : undefined,
              alignItems: "center",
              gap: "8px",
            }}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className={`fuse-btn fuse-btn--primary ${sizeClass} ${shadowClass}`.trim()}
                    data-fuse-wallet-trigger="connect"
                    style={fullWidth ? { width: "100%" } : undefined}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <rect
                        x="1"
                        y="2"
                        width="10"
                        height="8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <line
                        x1="7"
                        y1="6"
                        x2="11"
                        y2="6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span>{label}</span>
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className={`fuse-btn fuse-btn--danger ${sizeClass}`.trim()}
                    data-fuse-wallet-trigger="wrong-network"
                    style={fullWidth ? { width: "100%" } : undefined}
                  >
                    <span>Switch to Mezo Testnet</span>
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  onClick={openAccountModal}
                  className={`fuse-btn fuse-btn--secondary ${sizeClass}`.trim()}
                  data-fuse-wallet-trigger="account"
                  title="Manage connected wallet"
                  style={fullWidth ? { width: "100%" } : undefined}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      background: "#1D6340",
                      border: "1px solid #141619",
                    }}
                  />
                  <span className="fuse-mono" style={{ fontWeight: 700 }}>
                    {account.displayName}
                  </span>
                </button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

/* ==========================================================================
   3. Builder Rating Plate
   ========================================================================== */

export interface BuilderRatingPlateProps {
  builderAddress: string;
  builderName: string;
  feeBps: number;
  feePercentFormatted: string;
  registered: boolean;
  active: boolean;
  routerPaused?: boolean;
  isConnected?: boolean;
  userApproved?: boolean;
  userMaxFeeBps?: number;
  userMaxFeePercentFormatted?: string;
  showProfileLink?: boolean;
}

export function BuilderRatingPlate({
  builderAddress,
  builderName,
  feeBps,
  feePercentFormatted,
  registered,
  active,
  routerPaused = false,
  isConnected = false,
  userApproved = false,
  userMaxFeeBps = 0,
  userMaxFeePercentFormatted = "0.00%",
  showProfileLink = true,
}: BuilderRatingPlateProps) {
  const isZeroFee = feeBps === 0 || !registered || !active;
  const isTripped =
    isConnected &&
    registered &&
    active &&
    feeBps > 0 &&
    userApproved &&
    feeBps > userMaxFeeBps;

  let statusChipLabel = "Active partner";
  let statusChipClass = "fuse-status-chip fuse-status-chip--approved";

  if (routerPaused) {
    statusChipLabel = "Router paused";
    statusChipClass = "fuse-status-chip fuse-status-chip--tripped";
  } else if (!registered) {
    statusChipLabel = "Unregistered (0% fee)";
    statusChipClass = "fuse-status-chip fuse-status-chip--zero-fee";
  } else if (!active) {
    statusChipLabel = "Paused partner";
    statusChipClass = "fuse-status-chip fuse-status-chip--zero-fee";
  } else if (feeBps === 0) {
    statusChipLabel = "0% fee";
    statusChipClass = "fuse-status-chip fuse-status-chip--zero-fee";
  } else if (isTripped) {
    statusChipLabel = "Blocked: Above your cap";
    statusChipClass = "fuse-status-chip fuse-status-chip--tripped";
  } else if (isConnected && userApproved) {
    statusChipLabel = "Within your cap";
    statusChipClass = "fuse-status-chip fuse-status-chip--approved";
  }

  let capDisplay = "Connect wallet to view";
  if (isZeroFee) {
    capDisplay = "No cap needed (0%)";
  } else if (isConnected) {
    if (!userApproved) {
      capDisplay = "Not approved yet";
    } else {
      capDisplay = `${userMaxFeePercentFormatted} max (${userMaxFeeBps} bps)`;
    }
  }

  return (
    <div className="fuse-rating-plate" data-fuse-component="rating-plate">
      <div className="fuse-rating-plate__topbar">
        <span>PARTNER ATTRIBUTION</span>
        <span className={statusChipClass} style={{ padding: "1px 6px", fontSize: "11px" }}>
          {statusChipLabel}
        </span>
      </div>

      <div className="fuse-rating-plate__body">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
            <strong
              className="fuse-plate-title"
              data-fuse-field="builder-name"
              style={{ color: "#141619" }}
            >
              {builderName}
            </strong>
            <span
              className="fuse-tag-self-reported"
              data-fuse-label="self-reported"
              title="Partner names are self-reported on-chain via metadataURI"
            >
              Self-reported
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a
              href={getExplorerAddressUrl(builderAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="fuse-mono"
              style={{ fontSize: "12px", fontWeight: 700 }}
              title={`View ${builderAddress} on Mezo Testnet Explorer`}
            >
              <code>{shortenAddress(builderAddress, 6)}</code> ↗
            </a>
            {showProfileLink && (
              <Link
                href={`/builders/${builderAddress}`}
                className="fuse-mono"
                style={{ fontSize: "11px" }}
              >
                Profile
              </Link>
            )}
          </div>
        </div>

        <div className="fuse-rating-plate__metrics">
          <div className="fuse-rating-plate__cell">
            <span className="fuse-eyebrow" style={{ display: "block", marginBottom: "2px" }}>
              PARTNER FEE
            </span>
            <strong
              className="fuse-mono fuse-num"
              data-fuse-field="builder-fee-percent"
              style={{ fontSize: "13px", color: "#141619" }}
            >
              {feeBps === 0
                ? "0.00% (Free)"
                : `${feePercentFormatted} (${feeBps} bps)`}
            </strong>
          </div>

          <div className="fuse-rating-plate__cell">
            <span className="fuse-eyebrow" style={{ display: "block", marginBottom: "2px" }}>
              YOUR FEE CAP
            </span>
            <strong
              className="fuse-mono fuse-num"
              style={{
                fontSize: "13px",
                color: isTripped ? "#A0174A" : "#141619",
              }}
            >
              {capDisplay}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   4. Fuse Strip - User Cap Protection Banner
   ========================================================================== */

export type FuseStripMode =
  | "within-cap"
  | "zero-fee"
  | "needs-approval"
  | "tripped"
  | "router-paused"
  | "builder-inactive"
  | "builder-unregistered";

export interface FuseStripProps {
  mode: FuseStripMode;
  feeBps: number;
  feePercentFormatted: string;
  userMaxFeeBps?: number;
  userMaxFeePercentFormatted?: string;
  builderName?: string;
}

export function FuseStrip({
  mode,
  feeBps,
  feePercentFormatted,
  userMaxFeeBps = 0,
  userMaxFeePercentFormatted = "0.00%",
  builderName = "this partner",
}: FuseStripProps) {
  if (mode === "tripped") {
    return (
      <div
        className="fuse-strip fuse-strip--tripped"
        role="alert"
        data-fuse-component="fuse-strip"
        data-fuse-strip-state="tripped"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FuseTrippedSchematicSvg color="#A0174A" />
          <div>
            <div
              className="fuse-mono"
              style={{ fontWeight: 700, fontSize: "12px" }}
            >
              Blocked: Partner fee exceeds your cap
            </div>
            <div style={{ fontSize: "12px", marginTop: "2px" }}>
              {builderName} charges {feePercentFormatted} ({feeBps} bps), above your {userMaxFeePercentFormatted} ({userMaxFeeBps} bps) cap. Nothing will be signed.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "router-paused") {
    return (
      <div
        className="fuse-strip fuse-strip--tripped"
        role="alert"
        data-fuse-component="fuse-strip"
        data-fuse-strip-state="router-paused"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FuseTrippedSchematicSvg color="#A0174A" />
          <div>
            <div className="fuse-mono" style={{ fontWeight: 700, fontSize: "12px" }}>
              Routing temporarily paused
            </div>
            <div style={{ fontSize: "12px", marginTop: "2px" }}>
              New routed actions are paused. You can still revoke your partner caps at any time.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "needs-approval") {
    return (
      <div
        className="fuse-strip fuse-strip--attention"
        data-fuse-component="fuse-strip"
        data-fuse-strip-state="needs-approval"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FuseOpenSwitchSchematicSvg color="#7C4D07" />
          <div>
            <div className="fuse-mono" style={{ fontWeight: 700, fontSize: "12px" }}>
              One-time fee cap approval required ({feePercentFormatted})
            </div>
            <div style={{ fontSize: "12px", marginTop: "2px" }}>
              Approve {builderName} to charge up to {feePercentFormatted} ({feeBps} bps). You can lower or revoke this cap anytime.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "zero-fee" || mode === "builder-inactive" || mode === "builder-unregistered") {
    const reasonText =
      mode === "builder-unregistered"
        ? "This partner address is not registered in FuseRouter."
        : mode === "builder-inactive"
          ? "This partner is currently paused and cannot route new actions."
          : "100% of your amount goes directly to Mezo with no partner fee.";

    return (
      <div
        className="fuse-strip fuse-strip--zero-fee"
        data-fuse-component="fuse-strip"
        data-fuse-strip-state={mode}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FuseIntactSchematicSvg color="#141619" />
          <div>
            <div className="fuse-mono" style={{ fontWeight: 700, fontSize: "12px" }}>
              {mode === "zero-fee" ? "0% partner fee (No approval needed)" : "Partner unavailable"}
            </div>
            <div style={{ fontSize: "12px", color: "#4E535A", marginTop: "2px" }}>
              {reasonText}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fuse-strip fuse-strip--intact"
      data-fuse-component="fuse-strip"
      data-fuse-strip-state="within-cap"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <FuseIntactSchematicSvg color="#1D6340" />
        <div>
          <div className="fuse-mono" style={{ fontWeight: 700, fontSize: "12px" }}>
            Protected by your {userMaxFeePercentFormatted} fee cap
          </div>
          <div style={{ fontSize: "12px", marginTop: "2px" }}>
            Partner fee {feePercentFormatted} ({feeBps} bps) is within your approved {userMaxFeePercentFormatted} ({userMaxFeeBps} bps) limit.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   5. Fee Split Wiring Diagram
   ========================================================================== */

export interface WiringSplitDiagramProps {
  inputLabel: string;
  netLabel: string;
  builderFeeLabel: string;
  targetProtocolLabel: string;
  feeBps: number;
  blocked?: boolean;
}

export function WiringSplitDiagram({
  inputLabel,
  netLabel,
  builderFeeLabel,
  targetProtocolLabel,
  feeBps,
  blocked = false,
}: WiringSplitDiagramProps) {
  const netPercent = blocked ? 0 : Math.max(0, (10000 - feeBps) / 100);
  const feePercent = blocked ? 0 : Math.min(100, feeBps / 100);
  const isZeroOrBlocked = feeBps === 0 || blocked;

  return (
    <div className="fuse-wiring-diagram" data-fuse-component="wiring-split">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span className="fuse-eyebrow">PAYMENT SPLIT</span>
        <span className="fuse-mono fuse-num" style={{ fontSize: "11px", color: "#4E535A" }}>
          {blocked
            ? "Blocked by your fee cap"
            : `${netPercent.toFixed(2)}% to Mezo / ${feePercent.toFixed(2)}% partner fee`}
        </span>
      </div>

      <svg
        width="100%"
        height="64"
        viewBox="0 0 380 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Payment split: ${inputLabel} splits into ${netLabel} to ${targetProtocolLabel} and ${builderFeeLabel} partner fee`}
      >
        {/* Input terminal node */}
        <rect x="2" y="12" width="8" height="8" fill="#141619" />
        <text
          x="14"
          y="10"
          fill="#141619"
          fontFamily="var(--font-mono), monospace"
          fontSize="10"
          fontWeight="700"
        >
          You send: {inputLabel}
        </text>

        {/* Main Carbon Ink busbar to Mezo target contract */}
        <line
          x1="10"
          y1="16"
          x2="368"
          y2="16"
          stroke={blocked ? "#A0174A" : "#141619"}
          strokeWidth="2.25"
          strokeDasharray={blocked ? "4 3" : undefined}
        />
        <polygon
          points="368,12 376,16 368,20"
          fill={blocked ? "#A0174A" : "#141619"}
        />
        <text
          x="364"
          y="10"
          textAnchor="end"
          fill="#141619"
          fontFamily="var(--font-mono), monospace"
          fontSize="10"
          fontWeight="700"
        >
          {targetProtocolLabel}: {netLabel}
        </text>

        {/* Junction node at x=128 */}
        <circle cx="128" cy="16" r="3.5" fill={isZeroOrBlocked ? "#747980" : "#C24D08"} />

        {/* Copper branch down & right to Partner */}
        <path
          d="M 128 16 L 128 48 L 368 48"
          stroke={blocked ? "#A0174A" : isZeroOrBlocked ? "#747980" : "#C24D08"}
          strokeWidth="2"
          strokeDasharray={isZeroOrBlocked ? "4 3" : undefined}
          fill="none"
        />
        <polygon
          points="368,44 376,48 368,52"
          fill={blocked ? "#A0174A" : isZeroOrBlocked ? "#747980" : "#C24D08"}
        />
        <text
          x="138"
          y="43"
          fill={blocked ? "#A0174A" : isZeroOrBlocked ? "#4E535A" : "#9E3B0E"}
          fontFamily="var(--font-mono), monospace"
          fontSize="10"
          fontWeight="700"
        >
          Partner fee ({feePercent.toFixed(2)}%): {builderFeeLabel}
        </text>
      </svg>
    </div>
  );
}

/* ==========================================================================
   6. Widget 4-Step Strip
   ========================================================================== */

export interface WidgetStepStripProps {
  isConnected: boolean;
  isWrongNetwork: boolean;
  feeBps: number;
  isCapApprovedOrZero: boolean;
  actionLabel: string;
  hasConfirmedReceipt: boolean;
}

export function WidgetStepStrip({
  isConnected,
  isWrongNetwork,
  feeBps,
  isCapApprovedOrZero,
  actionLabel,
  hasConfirmedReceipt,
}: WidgetStepStripProps) {
  const step1Done = isConnected && !isWrongNetwork;
  const step2Done = step1Done && isCapApprovedOrZero;
  const step3Done = step2Done && hasConfirmedReceipt;

  const activeStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;

  const steps = [
    {
      index: 1,
      label: "1. Connect",
      done: step1Done,
    },
    {
      index: 2,
      label: feeBps === 0 ? "2. 0% fee" : "2. Approve cap",
      done: step2Done,
    },
    {
      index: 3,
      label: `3. ${actionLabel}`,
      done: step3Done,
    },
    {
      index: 4,
      label: "4. Receipt",
      done: hasConfirmedReceipt,
    },
  ];

  return (
    <div
      className="fuse-step-strip"
      role="list"
      aria-label="Action progress"
      data-fuse-component="step-strip"
    >
      {steps.map((step) => {
        const isCurrent = activeStep === step.index;
        const itemClass = [
          "fuse-step-strip__item",
          isCurrent ? "fuse-step-strip__item--active" : "",
          step.done ? "fuse-step-strip__item--done" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={step.index}
            role="listitem"
            className={itemClass}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="fuse-step-strip__label">{step.label}</span>
              {step.done && (
                <span
                  className="fuse-mono"
                  style={{ fontSize: "10px", color: "#1D6340", fontWeight: 700 }}
                >
                  Done
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
