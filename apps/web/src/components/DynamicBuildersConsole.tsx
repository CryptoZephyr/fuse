"use client";

import dynamic from "next/dynamic";
import type { BuildersConsoleProps } from "./BuildersConsole";

const BuildersConsoleNoSSR = dynamic(
  () => import("./BuildersConsole").then((mod) => mod.BuildersConsole),
  {
    ssr: false,
    loading: () => (
      <section data-fuse-console-loading="true">
        <p>Loading Fuse Builders Console (Mezo Testnet · Chain ID 31611)...</p>
      </section>
    ),
  },
);

export function DynamicBuildersConsole(props: BuildersConsoleProps) {
  return <BuildersConsoleNoSSR {...props} />;
}
