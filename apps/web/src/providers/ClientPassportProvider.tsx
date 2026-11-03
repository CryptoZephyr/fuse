"use client";

import React from "react";
import dynamic from "next/dynamic";

const DynamicFusePassportProvider = dynamic(
  () =>
    import("./FusePassportProvider").then((mod) => mod.FusePassportProvider),
  { ssr: false },
);

export function ClientPassportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DynamicFusePassportProvider>{children}</DynamicFusePassportProvider>;
}
