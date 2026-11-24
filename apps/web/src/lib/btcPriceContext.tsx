"use client";

import { createContext, useContext } from "react";
import type { BtcUsdOraclePrice } from "mezo-fuse";

/**
 * Lets a widget rendered inside FuseShell share its latest Skip oracle reading with the header,
 * so the page shows one BTC price instead of two readings taken at different times.
 * Outside FuseShell (the standalone /widget route or an iframe) this is a no-op.
 */
export const BtcPriceReportContext = createContext<(price: BtcUsdOraclePrice) => void>(() => {});

export function useReportBtcPrice() {
  return useContext(BtcPriceReportContext);
}
