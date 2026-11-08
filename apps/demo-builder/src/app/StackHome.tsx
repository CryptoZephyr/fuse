"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  formatUnits,
  http,
  type Address,
} from "viem";
import {
  FuseClient,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_CHAIN_ID,
  MEZO_TESTNET_RPC_URL,
  erc20PermitAbi,
  type FuseWidgetMessage,
} from "mezo-fuse";
import { acceptWidgetMessage } from "../lib/hostMessages";

const publicClient = createPublicClient({
  chain: MEZO_TESTNET_CHAIN,
  transport: http(MEZO_TESTNET_RPC_URL),
  batch: { multicall: true },
});
const fuseClient = new FuseClient({ publicClient });

type BalanceSnapshot = {
  BTC: bigint | null;
  MUSD: bigint | null;
  sMUSD: bigint | null;
  veBTC: bigint | null;
};

type BuilderStatus =
  | { state: "loading" }
  | { state: "error" }
  | { state: "loaded"; registered: boolean; feeBps: number };

type MulticallOutcome =
  | { status: "success"; result: unknown }
  | { status: "failure"; error: unknown };

type ConfirmedAction = Extract<
  FuseWidgetMessage,
  { type: "tx_submitted" | "tx_confirmed" }
> & { type: "tx_confirmed" };

function toBalance(result: MulticallOutcome): bigint | null {
  return result.status === "success" && typeof result.result === "bigint"
    ? result.result
    : null;
}

function formatTokenAmount(amount: bigint): string {
  const [whole, fraction] = formatUnits(amount, 18).split(".");
  const decimals = fraction?.slice(0, 6).replace(/0+$/, "");
  return `${BigInt(whole).toLocaleString("en-US")}${decimals ? `.${decimals}` : ""}`;
}

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function StackHome({
  builderAddress,
  widgetUrl,
}: {
  builderAddress: Address;
  widgetUrl: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState(720);
  const [accountAddress, setAccountAddress] = useState<Address | null>(null);
  const [accountChainId, setAccountChainId] = useState<number | null>(null);
  const [balances, setBalances] = useState<BalanceSnapshot | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesFailed, setBalancesFailed] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [builderStatus, setBuilderStatus] = useState<BuilderStatus>({
    state: "loading",
  });
  const [activity, setActivity] = useState<ConfirmedAction[]>([]);

  const widgetOrigin = useMemo(() => new URL(widgetUrl).origin, [widgetUrl]);
  const iframeUrl = useMemo(() => {
    const url = new URL(widgetUrl);
    url.searchParams.set("builder", builderAddress);
    url.searchParams.set("action", "save");
    return url.toString();
  }, [builderAddress, widgetUrl]);

  const onWidgetMessage = useCallback(
    (event: MessageEvent) => {
      const message = acceptWidgetMessage(event, {
        widgetOrigin,
        frameWindow: iframeRef.current?.contentWindow ?? null,
      });
      if (!message) return;

      if (message.type === "account") {
        setAccountAddress(message.address);
        setAccountChainId(message.chainId);
      } else if (message.type === "resize") {
        setIframeHeight(message.height);
      } else if (message.type === "tx_confirmed") {
        setRefreshCount((count) => count + 1);
        if (message.kind === "action") {
          const confirmedAction: ConfirmedAction = {
            ...message,
            type: "tx_confirmed",
          };
          setActivity((current) => [
            confirmedAction,
            ...current.filter(
              (item) =>
                item.hash.toLowerCase() !== confirmedAction.hash.toLowerCase(),
            ),
          ]);
        }
      }
    },
    [widgetOrigin],
  );

  useEffect(() => {
    window.addEventListener("message", onWidgetMessage);
    return () => window.removeEventListener("message", onWidgetMessage);
  }, [onWidgetMessage]);

  useEffect(() => {
    let cancelled = false;
    setBuilderStatus({ state: "loading" });

    void fuseClient
      .getBuilderStatus(builderAddress)
      .then((status) => {
        if (!cancelled) {
          setBuilderStatus({
            state: "loaded",
            registered: status.registered,
            feeBps: status.feeBps,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setBuilderStatus({ state: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [builderAddress]);

  useEffect(() => {
    if (!accountAddress) {
      setBalances(null);
      setBalancesLoading(false);
      setBalancesFailed(false);
      return;
    }
    if (accountChainId !== MEZO_TESTNET_CHAIN_ID) {
      setBalances(null);
      setBalancesLoading(false);
      setBalancesFailed(false);
      return;
    }

    let cancelled = false;
    setBalances(null);
    setBalancesLoading(true);
    setBalancesFailed(false);

    void publicClient
      .multicall({
        contracts: [
          {
            address: MEZO_TESTNET_ADDRESSES.btc,
            abi: erc20PermitAbi,
            functionName: "balanceOf",
            args: [accountAddress],
          },
          {
            address: MEZO_TESTNET_ADDRESSES.musd,
            abi: erc20PermitAbi,
            functionName: "balanceOf",
            args: [accountAddress],
          },
          {
            address: MEZO_TESTNET_ADDRESSES.savingsVault,
            abi: erc20PermitAbi,
            functionName: "balanceOf",
            args: [accountAddress],
          },
          {
            address: MEZO_TESTNET_ADDRESSES.veBTC,
            abi: erc20PermitAbi,
            functionName: "balanceOf",
            args: [accountAddress],
          },
        ],
        allowFailure: true,
      })
      .then(([btc, musd, sMUSD, veBTC]) => {
        if (cancelled) return;
        setBalances({
          BTC: toBalance(btc),
          MUSD: toBalance(musd),
          sMUSD: toBalance(sMUSD),
          veBTC: toBalance(veBTC),
        });
      })
      .catch(() => {
        if (!cancelled) setBalancesFailed(true);
      })
      .finally(() => {
        if (!cancelled) setBalancesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountAddress, accountChainId, refreshCount]);

  const feeLabel =
    builderStatus.state === "loaded"
      ? builderStatus.registered
        ? `${builderStatus.feeBps} bps`
        : "Builder not registered"
      : builderStatus.state === "error"
        ? "Builder status unavailable"
        : "Checking builder";

  const balanceRows: { label: string; value: bigint | null; count?: boolean }[] =
    balances
      ? [
          { label: "BTC", value: balances.BTC },
          { label: "MUSD", value: balances.MUSD },
          { label: "sMUSD", value: balances.sMUSD },
          { label: "veBTC locks", value: balances.veBTC, count: true },
        ]
      : [];

  return (
    <main className="stack-page">
      <header className="stack-header">
        <div className="stack-brand">Stack</div>
        <p className="stack-tagline">Save in bitcoin on Mezo</p>
      </header>

      <div className="stack-testnet-strip">MEZO TESTNET · 31611</div>

      <div className="stack-layout">
        <section className="stack-panel" aria-labelledby="stack-balances-title">
          <h1 id="stack-balances-title">Your balances</h1>
          {!accountAddress ? (
            <p className="stack-message">
              Connect a wallet in the Fuse panel to see your balances.
            </p>
          ) : accountChainId !== MEZO_TESTNET_CHAIN_ID ? (
            <p className="stack-message">
              Switch to Mezo Testnet in the Fuse panel to see your balances.
            </p>
          ) : balancesLoading ? (
            <p className="stack-message">Loading balances.</p>
          ) : balancesFailed ? (
            <p className="stack-message">Balances are unavailable right now.</p>
          ) : (
            <dl className="stack-balances">
              {balanceRows.map((row) => (
                <div className="stack-balance-row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>
                    {row.value === null
                      ? "Unavailable"
                      : row.count
                        ? row.value.toString()
                        : formatTokenAmount(row.value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <div className="stack-right-column">
          <section
            className="stack-panel stack-widget-panel"
            aria-label="Fuse widget"
          >
            <div className="stack-powered">
              Powered by Fuse · Builder {shortAddress(builderAddress)} · {feeLabel}
            </div>
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              title="Fuse widget"
              className="stack-widget-frame"
              style={{ height: iframeHeight }}
            />
          </section>

          <section className="stack-panel" aria-labelledby="stack-activity-title">
            <h2 id="stack-activity-title">Activity</h2>
            {activity.length === 0 ? (
              <p className="stack-message">No activity yet.</p>
            ) : (
              <ul className="stack-activity-list">
                {activity.map((item) => (
                  <li key={item.hash}>
                    <span className="stack-activity-action">
                      {item.action[0].toUpperCase() + item.action.slice(1)}
                    </span>
                    <div className="stack-activity-links">
                      <a
                        href={`${widgetOrigin}/receipt/${item.hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Receipt
                      </a>
                      <a
                        href={item.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explorer
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <a
              className="stack-leaderboard-link"
              href={`${widgetOrigin}/leaderboard`}
              target="_blank"
              rel="noreferrer"
            >
              See this builder on the Fuse leaderboard
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
