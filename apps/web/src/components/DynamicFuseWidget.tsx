"use client";

import dynamic from "next/dynamic";
import type { FuseWidgetProps } from "./FuseWidget";

export const DynamicFuseWidget = dynamic<FuseWidgetProps>(
  () => import("./FuseWidget").then((mod) => mod.FuseWidget),
  {
    ssr: false,
    loading: () => <p data-fuse-state="widget-loading">Loading Fuse Widget (Mezo testnet)...</p>,
  },
);
