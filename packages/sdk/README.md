# mezo-fuse

TypeScript SDK for [Fuse](https://github.com/CryptoZephyr/fuse), the builder code router on [Mezo testnet](https://fuse.vercel.app/) (chain ID `31611`).

## Install

```sh
npm install mezo-fuse@^0.1.1 viem
```

## Use the SDK

```ts
import { createPublicClient, http, parseUnits } from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  FuseClient,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_RPC_URL,
} from "mezo-fuse";

const publicClient = createPublicClient({
  chain: MEZO_TESTNET_CHAIN,
  transport: http(MEZO_TESTNET_RPC_URL),
});

// walletClient is a viem WalletClient with a connected account on Mezo testnet.
const fuse = new FuseClient({ publicClient, walletClient });

const result = await fuse.executeSave({
  builder: DEFAULT_PAID_BUILDER_TESTNET,
  amount: parseUnits("10", 18),
});
console.log(result.explorerUrl);
```

`FuseClient` also has `executeSwap`, `executeLock`, `approveBuilder`, `revokeBuilder`, quote functions and `getRoutedEvents`.

MUSD swaps and saves use a single EIP-2612 permit transaction where the wallet supports it. Bitcoin wallets that use Mezo Passport smart accounts can't sign typed data, so the SDK falls back to approve, then save or swap.

Quote helpers preflight the current router state before an action. They reject stale fee state, invalid builder configuration, and lock durations outside the deployed testnet limits before asking the wallet to sign.

## Current Mezo testnet addresses

| Contract | Address | Notes |
| :--- | :--- | :--- |
| `FuseRouter` | [`0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4`](https://explorer.test.mezo.org/address/0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4) | Current |
| Paid builder (15 bps) | [`0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283`](https://explorer.test.mezo.org/address/0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283) | Default builder in the SDK and widget |
| Zero-fee builder (0 bps) | [`0x4FdA3C5A0E49B183900d155f7820E7E40BFA8A9F`](https://explorer.test.mezo.org/address/0x4FdA3C5A0E49B183900d155f7820E7E40BFA8A9F) | Attribution only |

## License

MIT
