import React from "react";
import Link from "next/link";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  MEZO_TESTNET_ADDRESSES,
  getExplorerAddressUrl,
} from "@fuse/sdk";
import { DynamicFuseWidget } from "../components/DynamicFuseWidget";

export default function HomePage() {
  return (
    <main data-fuse-page="home">
      <header>
        <h1>Fuse — Builder Codes &amp; Distribution Router for Mezo (Testnet)</h1>
        <p>
          <strong>Network:</strong> Mezo Testnet (Chain ID 31611) ·{" "}
          <strong>FuseRouter:</strong>{" "}
          <a
            href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.fuseRouter)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>{MEZO_TESTNET_ADDRESSES.fuseRouter}</code>
          </a>
        </p>
        <p>
          <em>
            Plain unstyled functional build per DESIGN_SYSTEM.md and FRONTEND.md — visual design decisions belong to the owner.
          </em>
        </p>
      </header>

      <nav aria-label="Surface Links" data-fuse-nav="primary">
        <ul>
          <li>
            <Link
              href={`/widget?builder=${DEFAULT_PAID_BUILDER_TESTNET}&action=swap`}
            >
              Embeddable Widget (/widget) — Paid Builder (15 bps / 0.15%)
            </Link>
          </li>
          <li>
            <Link
              href={`/widget?builder=${DEFAULT_ZERO_FEE_BUILDER_TESTNET}&action=save`}
            >
              Embeddable Widget (/widget) — Zero-Fee Attribution Builder (0 bps / 0.00%)
            </Link>
          </li>
          <li>
            <Link href="/builders">
              Builders Console (/builders) — Register, Manage Fees, Embed Snippets &amp; x402 Analytics
            </Link>
          </li>
          <li>
            <Link href="/leaderboard">
              Builder Leaderboard (/leaderboard) — Live On-Chain Attribution &amp; Skip BTC/USD Valuation
            </Link>
          </li>
          <li>
            <Link href="/docs">
              Documentation (/docs) — Quickstart, @fuse/sdk Reference &amp; FuseRouter Specs
            </Link>
          </li>
          <li>
            <a href="/api/leaderboard" target="_blank" rel="noopener noreferrer">
              Leaderboard JSON API (/api/leaderboard)
            </a>
          </li>
          <li>
            <a
              href={`/api/analytics/${DEFAULT_PAID_BUILDER_TESTNET}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Paid Analytics x402 API (/api/analytics/{DEFAULT_PAID_BUILDER_TESTNET})
            </a>
          </li>
        </ul>
      </nav>

      <hr />

      <section aria-label="Embedded Widget Preview">
        <h2>Widget Component Preview</h2>
        <DynamicFuseWidget builder={DEFAULT_PAID_BUILDER_TESTNET} defaultAction="swap" />
      </section>
    </main>
  );
}
