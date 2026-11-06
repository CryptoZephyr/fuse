"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  type LeaderboardSnapshot,
} from "mezo-fuse";
import { DynamicFuseWidget } from "../components/DynamicFuseWidget";
import { FuseShell } from "../components/FuseShell";

const SECTION_PAD = "clamp(32px, 5vw, 56px)";

export default function HomePage() {
  const [heroBuilderMode, setHeroBuilderMode] = useState<"paid" | "zero">("paid");
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot | null>(null);
  const [metricsFailed, setMetricsFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadMetrics() {
      try {
        const res = await fetch("/api/leaderboard?action=all&sort=users", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as LeaderboardSnapshot;
        if (!cancelled) setSnapshot(data);
      } catch {
        if (!cancelled) setMetricsFailed(true);
      }
    }
    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeHeroBuilder =
    heroBuilderMode === "paid"
      ? DEFAULT_PAID_BUILDER_TESTNET
      : DEFAULT_ZERO_FEE_BUILDER_TESTNET;

  const stats: { label: string; value: string | null; note: string }[] = [
    {
      label: "Partners",
      value: snapshot ? String(snapshot.totals.registeredBuilders) : null,
      note: snapshot ? `${snapshot.totals.activeBuilders} active` : "Registered on Fuse",
    },
    {
      label: "People routed",
      value: snapshot ? String(snapshot.totals.uniqueUsers) : null,
      note: "Self-referrals excluded",
    },
    {
      label: "Actions",
      value: snapshot ? String(snapshot.totals.totalActions) : null,
      note: "Swaps, saves and locks",
    },
    {
      label: "Volume",
      value: snapshot?.totals.totalVolumeUsdFormatted ?? null,
      note: "Priced with the Mezo BTC/USD feed",
    },
  ];

  return (
    <FuseShell btcUsdFormatted={snapshot?.btcUsdOracle?.formattedUsd}>
      <main data-fuse-page="home">
        <section
          aria-label="Fuse overview and live widget"
          style={{
            borderBottom: "2px solid #141619",
            paddingTop: "clamp(28px, 4vw, 52px)",
            paddingBottom: "clamp(32px, 5vw, 60px)",
          }}
        >
          <div className="fuse-container">
            <div className="fuse-grid-12" style={{ alignItems: "start" }}>
              <div
                className="fuse-col-5"
                style={{ display: "flex", flexDirection: "column", gap: "20px" }}
              >
                <h1 className="fuse-display-hero">
                  Send people to Mezo. Earn a fee you both agreed on.
                </h1>

                <p className="fuse-lead" style={{ maxWidth: "50ch" }}>
                  Add Swap, Save and Lock to your app. Users set the most they will pay, and the contract never lets you charge more.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <Link
                    href={`/widget?builder=${DEFAULT_PAID_BUILDER_TESTNET}&action=save`}
                    className="fuse-btn fuse-btn--primary fuse-btn--lg fuse-btn--hard-shadow"
                    style={{ textDecoration: "none" }}
                  >
                    Try the widget
                  </Link>
                  <Link
                    href="/builders"
                    className="fuse-btn fuse-btn--secondary fuse-btn--lg"
                    style={{ textDecoration: "none" }}
                  >
                    Get your code
                  </Link>
                </div>
              </div>

              <div className="fuse-col-7">
                <section
                  aria-label="Live widget"
                  className="fuse-panel"
                  style={{
                    background: "#ECE8DF",
                    border: "2px solid #141619",
                    padding: "clamp(12px, 2vw, 20px)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      marginBottom: "12px",
                      paddingBottom: "10px",
                      borderBottom: "1px solid #141619",
                    }}
                  >
                    <h2 className="fuse-section-title" style={{ fontSize: "16px" }}>
                      Try it on testnet
                    </h2>

                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setHeroBuilderMode("paid")}
                        aria-pressed={heroBuilderMode === "paid"}
                        className={`fuse-btn fuse-btn--sm ${
                          heroBuilderMode === "paid" ? "fuse-btn--primary" : "fuse-btn--secondary"
                        }`}
                      >
                        0.15% fee
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroBuilderMode("zero")}
                        aria-pressed={heroBuilderMode === "zero"}
                        className={`fuse-btn fuse-btn--sm ${
                          heroBuilderMode === "zero" ? "fuse-btn--primary" : "fuse-btn--secondary"
                        }`}
                      >
                        No fee
                      </button>
                    </div>
                  </div>

                  <div style={{ maxWidth: "440px", marginInline: "auto" }}>
                    <DynamicFuseWidget builder={activeHeroBuilder} defaultAction="save" />
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Live activity"
          style={{ borderBottom: "1px solid #DAD5C9", paddingBlock: SECTION_PAD }}
        >
          <div className="fuse-container">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <h2 className="fuse-section-title">Activity on Mezo Testnet</h2>
              <Link href="/leaderboard" className="fuse-mono" style={{ fontSize: "12px" }}>
                See the leaderboard
              </Link>
            </div>

            {metricsFailed ? (
              <div className="fuse-alert fuse-alert--neutral" role="status">
                Live numbers are unavailable right now. Try again in a moment.
              </div>
            ) : (
              <div
                className="fuse-panel"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                }}
              >
                {stats.map((s, idx) => (
                  <div
                    key={s.label}
                    style={{
                      padding: "16px",
                      borderRight:
                        idx < stats.length - 1 ? "1px solid #DAD5C9" : undefined,
                    }}
                  >
                    <div className="fuse-eyebrow">{s.label}</div>
                    {s.value === null ? (
                      <div
                        className="fuse-skeleton"
                        style={{ height: "34px", width: "80px", marginTop: "4px" }}
                      />
                    ) : (
                      <div
                        className="fuse-num"
                        style={{ fontSize: "28px", fontWeight: 700, marginTop: "4px" }}
                      >
                        {s.value}
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "#4E535A", marginTop: "2px" }}>
                      {s.note}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          aria-label="How it works"
          style={{ borderBottom: "1px solid #DAD5C9", paddingBlock: SECTION_PAD }}
        >
          <div className="fuse-container">
            <h2 className="fuse-section-title" style={{ marginBottom: "20px" }}>
              How the fee cap works
            </h2>

            <div className="fuse-panel">
              {[
                {
                  title: "A partner sets a fee",
                  body: "Any app can register on Fuse and pick a fee from 0% to 0.50%. The contract rejects anything higher.",
                },
                {
                  title: "You set your own cap",
                  body: "Before a partner can take a fee, you approve the most you are willing to pay. If they raise their fee above your cap, the action is blocked before your wallet asks you to sign.",
                },
                {
                  title: "One transaction, split on-chain",
                  body: "Your amount is split in a single transaction. The fee goes to the partner and the rest goes to Mezo. Fuse never holds your funds.",
                },
              ].map((item, idx, arr) => (
                <div
                  key={item.title}
                  style={{
                    padding: "20px",
                    borderBottom: idx < arr.length - 1 ? "1px solid #DAD5C9" : undefined,
                    maxWidth: "72ch",
                  }}
                >
                  <h3 style={{ fontSize: "18px", fontWeight: 700 }}>{item.title}</h3>
                  <p style={{ fontSize: "14px", color: "#4E535A", marginTop: "6px" }}>
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-label="Questions"
          style={{ paddingBlock: SECTION_PAD }}
        >
          <div className="fuse-container">
            <h2 className="fuse-section-title" style={{ marginBottom: "20px" }}>
              Common questions
            </h2>

            <div className="fuse-panel">
              {[
                {
                  q: "Does Fuse hold my money?",
                  a: "No. Each action pulls exactly the amount you enter, sends the fee to the partner, passes the rest to Mezo, and keeps nothing.",
                },
                {
                  q: "Can a partner raise their fee after I approve them?",
                  a: "They can change it, but it will not go through. If the new fee is above your cap, the transaction is blocked and you decide whether to raise your cap.",
                },
                {
                  q: "Which wallets work?",
                  a: "Bitcoin wallets (Xverse, Unisat, OKX) and standard EVM wallets, through Mezo Passport. Taproot Bitcoin addresses are not supported yet.",
                },
                {
                  q: "Can partners fake their ranking?",
                  a: "Actions where the user and the partner are the same wallet are excluded, and the leaderboard ranks by unique users instead of volume.",
                },
              ].map((item, idx, arr) => (
                <details
                  key={item.q}
                  open={idx === 0}
                  style={{
                    padding: "16px 20px",
                    borderBottom: idx < arr.length - 1 ? "1px solid #DAD5C9" : undefined,
                  }}
                >
                  <summary
                    style={{
                      fontWeight: 700,
                      fontSize: "15px",
                      cursor: "pointer",
                      color: "#141619",
                    }}
                  >
                    {item.q}
                  </summary>
                  <p
                    style={{
                      marginTop: "8px",
                      fontSize: "14px",
                      color: "#4E535A",
                      maxWidth: "72ch",
                    }}
                  >
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </FuseShell>
  );
}
