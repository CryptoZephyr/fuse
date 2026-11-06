"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_PAID_BUILDER_TESTNET, type FuseActionType } from "mezo-fuse";
import { DynamicFuseWidget } from "../../components/DynamicFuseWidget";

function WidgetSurfaceContent() {
  const searchParams = useSearchParams();
  const builderParam =
    searchParams.get("builder") || DEFAULT_PAID_BUILDER_TESTNET;
  const actionParam = (
    searchParams.get("action") ||
    searchParams.get("tab") ||
    "swap"
  ).toLowerCase();
  const defaultAction: FuseActionType =
    actionParam === "save" || actionParam === "lock" ? actionParam : "swap";

  return <DynamicFuseWidget builder={builderParam} defaultAction={defaultAction} />;
}

function WidgetSkeletonTicket() {
  return (
    <div
      className="fuse-widget-ticket"
      aria-busy="true"
      aria-label="Loading Fuse Widget"
    >
      <div className="fuse-widget-ticket__topstrip">
        <span>MEZO TESTNET · 31611</span>
        <span>LOADING...</span>
      </div>
      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="fuse-skeleton" style={{ height: "72px", width: "100%" }} />
        <div className="fuse-skeleton" style={{ height: "42px", width: "100%" }} />
        <div className="fuse-skeleton" style={{ height: "96px", width: "100%" }} />
        <div className="fuse-skeleton" style={{ height: "48px", width: "100%" }} />
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <main
      data-fuse-page="widget"
      style={{
        minHeight: "100vh",
        background: "var(--fuse-bg-canvas)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "clamp(4px, 2vw, 24px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>
        <Suspense fallback={<WidgetSkeletonTicket />}>
          <WidgetSurfaceContent />
        </Suspense>
      </div>
    </main>
  );
}
