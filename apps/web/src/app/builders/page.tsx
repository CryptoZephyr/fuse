"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DynamicBuildersConsole } from "../../components/DynamicBuildersConsole";

function BuildersPageInner() {
  const searchParams = useSearchParams();
  const builderParam = searchParams.get("builder");

  return (
    <main data-fuse-page="builders">
      <header data-fuse-header="builders">
        <h1>Fuse Builders Console (Mezo Testnet · Chain ID 31611)</h1>
        <p>
          Register your builder address on <code>FuseRouter</code> (
          <a
            href="https://explorer.test.mezo.org/address/0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4"
            target="_blank"
            rel="noreferrer"
          >
            0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4
          </a>
          ), configure your fee up to the 50 bps (0.50%) protocol cap, copy
          embed snippets, and unlock paid MUSD x402 analytics.
        </p>
        <nav aria-label="Fuse navigation" data-fuse-nav="primary">
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/widget">Widget (/widget)</Link>
            </li>
            <li>
              <Link href="/builders">Builders Console (/builders)</Link>
            </li>
            <li>
              <Link href="/leaderboard">Leaderboard (/leaderboard)</Link>
            </li>
            <li>
              <Link href="/docs">Docs (/docs)</Link>
            </li>
          </ul>
        </nav>
      </header>
      <hr />
      <DynamicBuildersConsole initialBuilderAddress={builderParam} />
    </main>
  );
}

export default function BuildersPage() {
  return (
    <Suspense
      fallback={
        <main data-fuse-page="builders-loading">
          <p>Loading Fuse Builders Console...</p>
        </main>
      }
    >
      <BuildersPageInner />
    </Suspense>
  );
}
