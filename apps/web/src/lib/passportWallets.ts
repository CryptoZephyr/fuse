import type { WalletList } from "@rainbow-me/rainbowkit";
import { createConnector } from "wagmi";

type CreateWalletFn = WalletList[number]["wallets"][number];

export function withRainbowKitDetails(
  createWallet: CreateWalletFn,
): CreateWalletFn {
  return (params) => {
    const wallet = createWallet(params);

    return {
      ...wallet,
      downloadUrls: {
        ...wallet.downloadUrls,
        browserExtension:
          wallet.downloadUrls?.browserExtension ?? wallet.downloadUrls?.desktop,
      },
      createConnector: (walletDetails) => {
        const connectorFn = wallet.createConnector(walletDetails);
        return createConnector((config) => ({
          ...connectorFn(config),
          ...walletDetails,
        }));
      },
    };
  };
}
