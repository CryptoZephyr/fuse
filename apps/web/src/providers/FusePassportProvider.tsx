"use client";

import React, { useState } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import {
  PassportProvider,
  getConfig,
  mezoTestnet,
} from "@mezo-org/passport";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { FUSE_TOKENS } from "../styles/tokens";

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "3a8170812b534d0ff9d794f19a901d64";

export const fuseWagmiConfig = getConfig({
  appName: "Fuse: Mezo Builder Router (Testnet)",
  appDescription: "Builder codes and distribution router for Mezo Testnet",
  mezoNetwork: "testnet",
  walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
  ssr: true,
});

const baseTheme = lightTheme({
  accentColor: FUSE_TOKENS.colors.actionPrimary,
  accentColorForeground: FUSE_TOKENS.colors.textOnAction,
  borderRadius: "small",
  fontStack: "system",
  overlayBlur: "none",
});

export const fuseRainbowKitTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    accentColor: FUSE_TOKENS.colors.actionPrimary,
    accentColorForeground: FUSE_TOKENS.colors.textOnAction,
    actionButtonBorder: FUSE_TOKENS.colors.borderStrong,
    actionButtonBorderMobile: FUSE_TOKENS.colors.borderStrong,
    actionButtonSecondaryBackground: FUSE_TOKENS.colors.bgSubtle,
    closeButton: FUSE_TOKENS.colors.textPrimary,
    closeButtonBackground: FUSE_TOKENS.colors.bgSubtle,
    connectButtonBackground: FUSE_TOKENS.colors.bgSurface,
    connectButtonBackgroundError: FUSE_TOKENS.status.blocked.bg,
    connectButtonInnerBackground: FUSE_TOKENS.colors.bgSubtle,
    connectButtonText: FUSE_TOKENS.colors.textPrimary,
    connectButtonTextError: FUSE_TOKENS.status.blocked.fg,
    error: FUSE_TOKENS.status.blocked.fg,
    generalBorder: FUSE_TOKENS.colors.borderRule,
    generalBorderDim: FUSE_TOKENS.colors.borderRule,
    menuItemBackground: FUSE_TOKENS.colors.bgSubtle,
    modalBackground: FUSE_TOKENS.colors.bgCanvas,
    modalBorder: FUSE_TOKENS.colors.borderStrong,
    modalText: FUSE_TOKENS.colors.textPrimary,
    modalTextDim: FUSE_TOKENS.colors.textSecondary,
    modalTextSecondary: FUSE_TOKENS.colors.textSecondary,
    profileAction: FUSE_TOKENS.colors.bgSurface,
    profileActionHover: FUSE_TOKENS.colors.bgSubtle,
    profileForeground: FUSE_TOKENS.colors.bgCanvas,
    selectedOptionBorder: FUSE_TOKENS.colors.actionPrimary,
    standby: FUSE_TOKENS.status.attention.fg,
  },
  fonts: {
    body: FUSE_TOKENS.fonts.sans,
  },
  radii: {
    actionButton: "4px",
    connectButton: "4px",
    menuButton: "4px",
    modal: "4px",
    modalMobile: "4px",
  },
  shadows: {
    connectButton: "none",
    dialog: FUSE_TOKENS.shadows.hardOffset,
    profileDetailsAction: "none",
    selectedOption: "none",
    selectedWallet: "none",
    walletLogo: "none",
  },
};

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
        <RainbowKitProvider
          initialChain={mezoTestnet}
          theme={fuseRainbowKitTheme}
        >
          <PassportProvider environment="testnet">{children}</PassportProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
