"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type Address,
  type Hash,
  createPublicClient,
  http,
  parseEventLogs,
} from "viem";
import { usePublicClient } from "wagmi";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  fuseRouterAbi,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN_ID,
  MEZO_TESTNET_RPC_URL,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  shortenAddress,
} from "mezo-fuse";
import { FuseShell } from "../../../components/FuseShell";
import {
  FuseIntactSchematicSvg,
  FuseOpenSwitchSchematicSvg,
  FuseTrippedSchematicSvg,
} from "../../../components/SwitchgearPrimitives";

type RoutedAction = "swap" | "save" | "lock";

type ReceiptVerification =
  | { state: "checking"; message: string }
  | { state: "pending"; message: string }
  | { state: "error"; message: string }
  | { state: "verified"; router: Address; action: RoutedAction };

const TRANSACTION_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const ROUTER_ADDRESSES = new Set(
  MEZO_TESTNET_ADDRESSES.fuseRouterDeployments.map(({ address }) => address.toLowerCase()),
);

function isTransactionHash(value: string): value is Hash {
  return TRANSACTION_HASH_PATTERN.test(value);
}

function getRoutedAction(actionCode: number): RoutedAction | null {
  if (actionCode === 0) return "swap";
  if (actionCode === 1) return "save";
  if (actionCode === 2) return "lock";
  return null;
}

function getVerificationLabel(verification: ReceiptVerification): string {
  if (verification.state === "verified") return "Verified on-chain";
  if (verification.state === "checking") return "Checking on-chain";
  if (verification.state === "pending") return "Awaiting confirmation";
  return "Could not verify";
}

export default function ReceiptPage() {
  const params = useParams<{ tx: string }>();
  const rawTx = typeof params?.tx === "string" ? params.tx : "";
  const [copiedLink, setCopiedLink] = useState(false);
  const wagmiPublicClient = usePublicClient({ chainId: MEZO_TESTNET_CHAIN_ID });
  const fallbackPublicClient = useMemo(
    () =>
      createPublicClient({
        chain: MEZO_TESTNET_CHAIN,
        transport: http(MEZO_TESTNET_RPC_URL),
      }),
    [],
  );
  const publicClient = wagmiPublicClient ?? fallbackPublicClient;
  const [verification, setVerification] = useState<ReceiptVerification>({
    state: "checking",
    message: "Checking the transaction receipt on Mezo Testnet...",
  });

  useEffect(() => {
    let cancelled = false;

    async function verifyReceipt() {
      if (!isTransactionHash(rawTx)) {
        setVerification({
          state: "error",
          message: "This link does not contain a valid transaction hash.",
        });
        return;
      }

      setVerification({
        state: "checking",
        message: "Checking the transaction receipt on Mezo Testnet...",
      });

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: rawTx });
        if (cancelled) return;

        if (receipt.status !== "success") {
          setVerification({
            state: "error",
            message: "The transaction was mined but did not succeed.",
          });
          return;
        }

        const receiptRouter = receipt.to?.toLowerCase();
        if (!receiptRouter || !ROUTER_ADDRESSES.has(receiptRouter)) {
          setVerification({
            state: "error",
            message: "This transaction was not sent to a known FuseRouter deployment.",
          });
          return;
        }

        const routedLogs = parseEventLogs({
          abi: fuseRouterAbi,
          eventName: "Routed",
          logs: receipt.logs,
          strict: false,
        });
        const routedLog = routedLogs.find(
          (log) => log.address.toLowerCase() === receiptRouter,
        );
        const action = routedLog ? getRoutedAction(Number(routedLog.args.action)) : null;

        if (!routedLog || !action) {
          setVerification({
            state: "error",
            message: "The successful receipt does not contain a valid Fuse Routed event.",
          });
          return;
        }

        setVerification({
          state: "verified",
          router: routedLog.address,
          action,
        });
      } catch {
        if (!cancelled) {
          setVerification({
            state: "pending",
            message: "The transaction is not mined yet. Refresh this page after confirmation.",
          });
        }
      }
    }

    void verifyReceipt();
    return () => {
      cancelled = true;
    };
  }, [publicClient, rawTx]);

  const displayedRouter =
    verification.state === "verified"
      ? verification.router
      : MEZO_TESTNET_ADDRESSES.fuseRouter;

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

            <span
              className={`fuse-status-chip ${
                verification.state === "verified"
                  ? "fuse-status-chip--approved"
                  : verification.state === "error"
                    ? "fuse-status-chip--tripped"
                    : "fuse-status-chip--attention"
              }`}
            >
              {verification.state === "verified" ? (
                <FuseIntactSchematicSvg color="#1D6340" />
              ) : verification.state === "error" ? (
                <FuseTrippedSchematicSvg color="#A0174A" />
              ) : (
                <FuseOpenSwitchSchematicSvg color="#7C4D07" />
              )}
              <span>{getVerificationLabel(verification)}</span>
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

            {verification.state !== "verified" && (
              <div
                role="status"
                className={`fuse-alert ${
                  verification.state === "error"
                    ? "fuse-alert--tripped"
                    : "fuse-alert--attention"
                }`}
                style={{ marginBottom: "14px" }}
              >
                {verification.message}
              </div>
            )}

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
                    href={getExplorerAddressUrl(displayedRouter)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <code>{shortenAddress(displayedRouter, 6)}</code> ↗
                  </a>
                </dd>
              </div>

              <div className="fuse-receipt__row">
                <dt className="fuse-receipt__term">Event</dt>
                <span className="fuse-receipt__dots" />
                <dd className="fuse-receipt__val">
                  {verification.state === "verified" ? <code>Routed</code> : "Pending verification"}
                </dd>
              </div>

              {verification.state === "verified" && (
                <div className="fuse-receipt__row">
                  <dt className="fuse-receipt__term">Action</dt>
                  <span className="fuse-receipt__dots" />
                  <dd className="fuse-receipt__val">
                    <code>{verification.action}</code>
                  </dd>
                </div>
              )}

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
