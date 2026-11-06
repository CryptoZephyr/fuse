"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { shortenAddress } from "mezo-fuse";
import { DynamicBuildersConsole } from "../../components/DynamicBuildersConsole";
import { FuseShell } from "../../components/FuseShell";

function BuildersPageInner() {
  const searchParams = useSearchParams();
  const builderParam = searchParams.get("builder");

  return (
    <FuseShell>
      <main
        data-fuse-page="builders"
        className="fuse-container"
        style={{ paddingTop: "32px", paddingBottom: "48px" }}
      >
        <header
          data-fuse-header="builders"
          style={{
            borderBottom: "2px solid #141619",
            paddingBottom: "20px",
            marginBottom: "28px",
          }}
        >
          <div className="fuse-eyebrow" style={{ marginBottom: "6px" }}>
            For partners
          </div>
          <h1 className="fuse-display-page">Partner console</h1>
          <p
            style={{
              marginTop: "8px",
              color: "#4E535A",
              maxWidth: "70ch",
              fontSize: "15px",
            }}
          >
            Register your builder address on <code>FuseRouter</code> (
            <a
              href="https://explorer.test.mezo.org/address/0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4"
              target="_blank"
              rel="noreferrer"
            >
              <code>{shortenAddress("0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4", 6)}</code>
            </a>
            ), configure your fee up to the 50 bps (0.50%) protocol cap, copy{" "}
            <code>&lt;iframe&gt;</code>, React, and <code>mezo-fuse</code>{" "}
            integration snippets, and unlock paid MUSD x402 analytics.
          </p>
        </header>

        <DynamicBuildersConsole initialBuilderAddress={builderParam} />
      </main>
    </FuseShell>
  );
}

export default function BuildersPage() {
  return (
    <Suspense
      fallback={
        <FuseShell>
          <main
            data-fuse-page="builders-loading"
            className="fuse-container"
            style={{ paddingTop: "32px", paddingBottom: "48px" }}
          >
            <div className="fuse-skeleton" style={{ height: "48px", width: "320px", marginBottom: "24px" }} />
            <div className="fuse-grid-12">
              <div className="fuse-col-5">
                <div className="fuse-skeleton" style={{ height: "380px", width: "100%" }} />
              </div>
              <div className="fuse-col-7">
                <div className="fuse-skeleton" style={{ height: "380px", width: "100%" }} />
              </div>
            </div>
          </main>
        </FuseShell>
      }
    >
      <BuildersPageInner />
    </Suspense>
  );
}
