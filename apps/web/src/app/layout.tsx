import React from "react";
import type { Metadata } from "next";
import { ClientPassportProvider } from "../providers/ClientPassportProvider";

export const metadata: Metadata = {
  title: "Fuse — Mezo Builder Codes & Action Router (Testnet)",
  description:
    "Non-custodial builder code registry, per-user fee approval guard, and action router for Mezo Testnet (Swap, Save, Lock).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: "8px", boxSizing: "border-box" }}>
        <ClientPassportProvider>{children}</ClientPassportProvider>
      </body>
    </html>
  );
}
