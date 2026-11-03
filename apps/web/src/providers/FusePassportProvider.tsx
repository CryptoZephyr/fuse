"use client";

import React, { useState } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import {
  PassportProvider,
  getConfig,
  mezoTestnet,
} from "@mezo-org/passport";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "3a8170812b534d0ff9d794f19a901d64";

export const fuseWagmiConfig = getConfig({
  appName: "Fuse — Mezo Builder Router (Testnet)",
  appDescription: "Builder codes and distribution router for Mezo Testnet",
  mezoNetwork: "testnet",
  walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
  ssr: true,
});

export interface FusePassportProviderProps {
  children: React.ReactNode;
}

export function FusePassportProvider({ children }: FusePassportProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={fuseWagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={mezoTestnet}>
          <PassportProvider environment="testnet">{children}</PassportProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
