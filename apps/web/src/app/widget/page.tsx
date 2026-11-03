"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_PAID_BUILDER_TESTNET, type FuseActionType } from "@fuse/sdk";
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

export default function WidgetPage() {
  return (
    <main data-fuse-page="widget">
      <Suspense fallback={<p>Loading Fuse Widget (Mezo testnet)...</p>}>
        <WidgetSurfaceContent />
      </Suspense>
    </main>
  );
}
