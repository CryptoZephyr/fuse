# Fuse

**Earn a fee every time your users swap, save or lock on Mezo, capped by them.**

Fuse is a builder code router for Mezo. A wallet, bot or website sends its users' Mezo actions through `FuseRouter` and gets credit for each one. A builder can also charge a fee of up to 0.50%, which the user approves first. Fuse never holds funds and has no token.

Mezo testnet only (chain ID `31611`). There's no hosted app yet, and the UI is unstyled while the design system is being built.

## How it works

1. A builder registers on `FuseRouter` with a fee from 0 to 50 bps and a metadata URI. Anyone can register.
2. Before a paid builder can charge them, a user approves a fee cap for that builder. Zero-fee builders need no approval.
3. The user swaps on Tigris, saves into the MUSD Savings Vault or locks BTC as veBTC through the router.
4. The router takes the builder fee, sends the rest to Mezo and emits a `Routed` event with the builder, user, amounts and fee.
5. The leaderboard and paid analytics are built from those events.

## What users control

- A builder can't charge more than the cap the user approved. If the builder raises its fee above that cap, the transaction reverts with `FeeAboveUserApproval`.
- No builder can charge more than 50 bps, whatever the user approves.
- Approving a cap gives a builder no access to the user's funds.
- `revokeBuilder` removes a cap at any time and still works while the router is paused.
- veBTC locks are created for the user, so the user owns the lock.

## Deployments on Mezo testnet

| Contract | Address | Notes |
| :--- | :--- | :--- |
| `FuseRouter` | [`0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4`](https://explorer.test.mezo.org/address/0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4) | Current. Block `16569522`, commit `b804a54`, Sourcify `exact_match` |
| `FuseRouter` (legacy) | [`0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1`](https://explorer.test.mezo.org/address/0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1) | Block `16328764`, commit `f3615b6`. Still live. Its history is included in the leaderboard and analytics |
| Paid builder (15 bps) | [`0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283`](https://explorer.test.mezo.org/address/0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283) | Default builder in the SDK and widget |
| Zero-fee builder (0 bps) | [`0x4FdA3C5A0E49B183900d155f7820E7E40BFA8A9F`](https://explorer.test.mezo.org/address/0x4FdA3C5A0E49B183900d155f7820E7E40BFA8A9F) | Attribution only |
| Retired paid builder | [`0x782bfA8870BcEeAC867452f06Cb1caa73294539a`](https://explorer.test.mezo.org/address/0x782bfA8870BcEeAC867452f06Cb1caa73294539a) | Key lost. Still registered for history |
| Retired zero-fee builder | [`0xc271fACe6B1Bab9Eb59A5F3c6eb9a6cfD9d11B53`](https://explorer.test.mezo.org/address/0xc271fACe6B1Bab9Eb59A5F3c6eb9a6cfD9d11B53) | Key lost. Still registered for history |

Mezo contracts the router uses:

| Contract | Address |
| :--- | :--- |
| Tigris `PoolRouter` | [`0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9`](https://explorer.test.mezo.org/address/0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9) |
| Tigris `PoolFactory` | [`0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A`](https://explorer.test.mezo.org/address/0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A) |
| MUSD | [`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`](https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503) |
| BTC | [`0x7b7C000000000000000000000000000000000000`](https://explorer.test.mezo.org/address/0x7b7C000000000000000000000000000000000000) |
| MEZO | [`0x7B7c000000000000000000000000000000000001`](https://explorer.test.mezo.org/address/0x7B7c000000000000000000000000000000000001) |
| MUSD Savings Vault | [`0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16`](https://explorer.test.mezo.org/address/0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16) |
| veBTC | [`0xB63fcCd03521Cf21907627bd7fA465C129479231`](https://explorer.test.mezo.org/address/0xB63fcCd03521Cf21907627bd7fA465C129479231) |
| Skip BTC/USD oracle | [`0x7b7c000000000000000000000000000000000015`](https://explorer.test.mezo.org/address/0x7b7c000000000000000000000000000000000015) |

## Repository layout

```text
fuse/
├── contracts/      Foundry project: FuseRouter, deploy script, unit, fuzz and fork tests
├── packages/sdk/   @fuse/sdk: FuseClient, quotes, MUSD permit, oracle, leaderboard indexer, x402
└── apps/web/       @fuse/web: Next.js app with the widget, builders console, leaderboard, docs and APIs
```

## Run it locally

You need Node 22, pnpm 11 and [Foundry](https://getfoundry.sh).

```bash
pnpm install
pnpm build
pnpm --filter @fuse/web dev
```

| Page | URL |
| :--- | :--- |
| Home | `http://localhost:3000/` |
| Widget | `http://localhost:3000/widget?builder=0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283&action=save` |
| Builders console | `http://localhost:3000/builders` |
| Leaderboard | `http://localhost:3000/leaderboard` |
| Docs | `http://localhost:3000/docs` |
| Leaderboard API | `http://localhost:3000/api/leaderboard` |
| Paid analytics API | `http://localhost:3000/api/analytics/0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283` |

The widget reads `builder` and `action` (`swap`, `save` or `lock`) from the URL. Without a `builder` it uses the default paid builder.

## Tests

```bash
pnpm contracts:test        # unit and fuzz tests (256 fuzz runs)
pnpm contracts:test:fork   # fork tests against Mezo testnet
pnpm test:packages         # SDK and web tests
pnpm typecheck
```

`pnpm --filter @fuse/sdk test:live` runs the SDK against Mezo testnet.

## Integrate

### Embed the widget

Serve `apps/web` and point an iframe at its `/widget` route:

```html
<iframe
  src="http://localhost:3000/widget?builder=0xd4b987B2e9F5D1a2ca98A24a8A802eA6068Fc283&action=save"
  width="440"
  height="680"
  title="Fuse widget"
></iframe>
```

### Use the SDK

`@fuse/sdk` isn't published to npm yet, so use it from this workspace.

```ts
import { createPublicClient, http, parseUnits } from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  FuseClient,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_RPC_URL,
} from "@fuse/sdk";

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

## Paid analytics

`GET /api/analytics/{builder}` costs 0.05 MUSD per request over x402. Without payment it returns `402 Payment Required`. With a signed `PAYMENT-SIGNATURE` header the server settles the payment on Mezo testnet through the facilitator and returns the builder's analytics with the settlement hash. The endpoint fails closed when `X402_PAY_TO` isn't set.

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Used for |
| :--- | :--- |
| `MEZO_TESTNET_RPC_URL` | RPC endpoint |
| `DEPLOYER_PRIVATE_KEY`, `DEPLOYER_ADDRESS` | Deploying the router |
| `FUSE_OWNER_ADDRESS` | Router owner, set once at deployment. Use a Safe multisig on mainnet |
| `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_FUSE_ROUTER`, `NEXT_PUBLIC_DEPLOY_BLOCK` | Chain, router and first block for the web app |
| `NEXT_PUBLIC_SKIP_BTC_USD` | BTC/USD oracle for USD values |
| `X402_FACILITATOR_URL`, `X402_PAY_TO` | Paid analytics facilitator and payee |

## Owner powers

The router owner is set at deployment and can't be changed. The owner can pause and unpause routed actions and choose which tokens can be swapped. The owner can't move funds, change fees, change Mezo addresses or block `revokeBuilder`. The router holds no balances between transactions. The current owner is the deployer. The mainnet plan is a Safe multisig.

## Leaderboard rules

Registration stays permissionless, so anti-gaming happens in the metrics. A builder routing its own actions only gets its own fee back, and Fuse takes no cut. The leaderboard leaves out actions where the user is the builder, ranks by unique users by default and labels Fuse's test builders.

## License

[MIT](LICENSE)
