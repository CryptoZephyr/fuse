import React from "react";
import type { Metadata } from "next";
import {
  B612,
  B612_Mono,
  Big_Shoulders_Stencil_Display,
} from "next/font/google";
import "./globals.css";
import { ClientPassportProvider } from "../providers/ClientPassportProvider";

const bigShouldersStencil = Big_Shoulders_Stencil_Display({
  subsets: ["latin"],
  weight: ["800"],
  display: "swap",
  variable: "--font-big-shoulders-stencil",
});

const b612 = B612({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-b612",
});

const b612Mono = B612_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-b612-mono",
});

export const metadata: Metadata = {
  title: "Fuse: Builder Codes & Action Router for Mezo Testnet",
  description:
    "Non-custodial builder code registry, per-user fee cap guard, and action router for Mezo Testnet (Swap, Save, Lock).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bigShouldersStencil.variable} ${b612.variable} ${b612Mono.variable}`}
    >
      <body>
        <ClientPassportProvider>{children}</ClientPassportProvider>
      </body>
    </html>
  );
}
