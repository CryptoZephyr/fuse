"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPublicClient, http } from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  FuseClient,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_CHAIN_ID,
  MEZO_TESTNET_RPC_URL,
  getExplorerAddressUrl,
  shortenAddress,
} from "mezo-fuse";
import { FuseLogoMark, FuseLogoSilhouette } from "./FuseLogo";
import { FuseWalletControl } from "./SwitchgearPrimitives";

export interface FuseShellProps {
  children: React.ReactNode;
  /** Optional override for live BTC/USD formatted string if already fetched by the page */
  btcUsdFormatted?: string | null;
  /** Hide footer when rendering compact surfaces */
  hideFooter?: boolean;
}

export function FuseShell({
  children,
  btcUsdFormatted,
  hideFooter = false,
}: FuseShellProps) {
  const pathname = usePathname();
  const [fetchedBtcPrice, setFetchedBtcPrice] = useState<string | null>(null);

  useEffect(() => {
    if (btcUsdFormatted !== undefined) return;
    let cancelled = false;

    async function loadOracle() {
      try {
        const publicClient = createPublicClient({
          chain: MEZO_TESTNET_CHAIN,
          transport: http(MEZO_TESTNET_RPC_URL),
        });
        const client = new FuseClient({
          publicClient,
          addresses: MEZO_TESTNET_ADDRESSES,
          chainId: MEZO_TESTNET_CHAIN_ID,
        });
        const price = await client.getBtcUsdPrice();
        if (!cancelled && price) {
          setFetchedBtcPrice(price.formattedUsd);
        }
      } catch {
        // Silent fallback in header
      }
    }

    void loadOracle();
    return () => {
      cancelled = true;
    };
  }, [btcUsdFormatted]);

  const activeBtcPrice = btcUsdFormatted ?? fetchedBtcPrice;

  const navItems = [
    {
      href: `/widget?builder=${DEFAULT_PAID_BUILDER_TESTNET}&action=save`,
      matchPrefix: "/widget",
      label: "Widget",
    },
    {
      href: "/builders",
      matchPrefix: "/builders",
      label: "Builders",
    },
    {
      href: "/leaderboard",
      matchPrefix: "/leaderboard",
      label: "Leaderboard",
    },
    {
      href: "/docs",
      matchPrefix: "/docs",
      label: "Docs",
    },
    {
      href: "/me",
      matchPrefix: "/me",
      label: "My caps",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--fuse-bg-canvas)",
        color: "var(--fuse-text-primary)",
      }}
    >
      <a href="#fuse-main-content" className="fuse-skip-link">
        Skip to main content
      </a>

      {/* 1. Persistent Carbon Ink Testnet Strip (28px tall) */}
      <div className="fuse-testnet-strip" role="region" aria-label="Network environment">
        <div className="fuse-testnet-strip__inner">
          <span>Mezo Testnet. Tokens here have no real value.</span>
          <span className="fuse-col-hide-mobile">
            <a
              href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.fuseRouter)}
              target="_blank"
              rel="noopener noreferrer"
              title={MEZO_TESTNET_ADDRESSES.fuseRouter}
            >
              Verified contract {shortenAddress(MEZO_TESTNET_ADDRESSES.fuseRouter, 4)}
            </a>
          </span>
        </div>
      </div>

      {/* 2. Hub Header (60px tall) */}
      <header className="fuse-hub-header">
        <div className="fuse-hub-header__inner">
          <Link
            href="/"
            className="fuse-hub-brand"
            aria-label="Fuse Home"
          >
            <FuseLogoMark size={28} />
            <span className="fuse-hub-brand__wordmark">FUSE</span>
          </Link>

          <nav
            aria-label="Fuse navigation"
            data-fuse-nav="primary"
            className="fuse-hub-nav"
          >
            {navItems.map((item) => {
              const isActive =
                pathname === item.matchPrefix ||
                (item.matchPrefix !== "/" && pathname?.startsWith(item.matchPrefix));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`fuse-hub-nav__link ${
                    isActive ? "fuse-hub-nav__link--active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="fuse-hub-header__right">
            <div
              className="fuse-oracle-pill"
              data-fuse-header-oracle="true"
              title="Live BTC price from Mezo Skip Oracle"
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  background: activeBtcPrice ? "#1D6340" : "#747980",
                }}
              />
              <span>
                BTC{" "}
                <strong className="fuse-num">
                  {activeBtcPrice ?? "..."}
                </strong>
              </span>
            </div>

            <FuseWalletControl compact />
          </div>
        </div>
      </header>

      {/* 3. Main Page Content */}
      <div id="fuse-main-content" style={{ flex: "1 0 auto" }}>
        {children}
      </div>

      {/* 4. Silhouette Footer (Section 6.6) */}
      {!hideFooter && (
        <footer className="fuse-footer" role="contentinfo">
          <div className="fuse-footer__links">
            <div className="fuse-footer__link-group">
              <Link href="/docs">Docs</Link>
              <Link href="/leaderboard">Leaderboard</Link>
              <Link href="/builders">Builders</Link>
              <Link href="/me">My caps</Link>
              <a
                href="https://github.com/toluwalase1/Fuse"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub ↗
              </a>
            </div>

            <div className="fuse-footer__link-group">
              <span>
                Router:{" "}
                <a
                  href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.fuseRouter)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <code>{shortenAddress(MEZO_TESTNET_ADDRESSES.fuseRouter, 4)}</code>
                </a>
              </span>
              <span>Mezo Testnet</span>
            </div>
          </div>

          <div className="fuse-footer__silhouette-wrap" aria-hidden="true">
            <FuseLogoSilhouette width={680} color="#CFC9BC" />
          </div>
        </footer>
      )}
    </div>
  );
}
