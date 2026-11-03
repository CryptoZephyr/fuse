# Fuse — Builder Codes & Distribution Router for Mezo

**Fuse** is the on-chain distribution, attribution, and monetization layer for **Mezo** (`Chain ID: 31611` Testnet). It enables any wallet, consumer app, creator portal, or AI agent to embed real Mezo DeFi actions — **Swap** (Tigris DEX), **Save** (MUSD Savings Vault / `sMUSD`), and **Lock** (`VeBTC` voting escrow) — while earning a transparent, user-approved builder fee (`0` to `50 bps` / `0.50%`) and canonical on-chain attribution via `FuseRouter`'s `Routed` event.

---

## 1. Verified Mezo Testnet (`31611`) Deployment

| Contract / Resource | Address | Details |
| :--- | :--- | :--- |
| **`FuseRouter`** | [`0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1`](https://explorer.test.mezo.org/address/0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1) | Deployed at block `16328764` · Verified `exact_match` on Sourcify v2 (`matchId: 56804757`) |
| **Tigris `PoolRouter`** | [`0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9`](https://explorer.test.mezo.org/address/0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9) | Canonical V2 AMM router (`MUSD/BTC` volatile pool `0xd16A...6AA9`) |
| **Tigris `PoolFactory`** | [`0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A`](https://explorer.test.mezo.org/address/0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A) | Pool factory passed in `Route` struct |
| **`MUSD` (Mezo USD)** | [`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`](https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503) | 18 decimals · Supports EIP-2612 `permit` & Permit2 x402 |
| **`BTC` ERC-20 Precompile** | [`0x7b7C000000000000000000000000000000000000`](https://explorer.test.mezo.org/address/0x7b7C000000000000000000000000000000000000) | 18 decimals · Native gas & ERC-20 token |
| **`MEZO` ERC-20 Precompile** | [`0x7B7c000000000000000000000000000000000001`](https://explorer.test.mezo.org/address/0x7B7c000000000000000000000000000000000001) | 18 decimals |
| **MUSD Savings Vault (`sMUSD`)** | [`0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16`](https://explorer.test.mezo.org/address/0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16) | ERC-4626 yield vault for MUSD |
| **`VeBTC` (`VotingEscrow`)** | [`0xB63fcCd03521Cf21907627bd7fA465C129479231`](https://explorer.test.mezo.org/address/0xB63fcCd03521Cf21907627bd7fA465C129479231) | Testnet `maxLockTime = 30 days` (`2,592,000s`), `WEEK = 7 days` (`604,800s`) |
| **Skip `BTC/USD` Oracle** | [`0x7b7c000000000000000000000000000000000015`](https://explorer.test.mezo.org/address/0x7b7c000000000000000000000000000000000015) | Chainlink-compatible `latestRoundData()` |
| **Demo Paid Builder (`15 bps`)** | [`0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a`](https://explorer.test.mezo.org/address/0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a) | Registered on-chain with `15 bps` (`0.15%`) fee |
| **Demo Zero-Fee Builder (`0 bps`)** | [`0x637A41a27e14897E72D3f9e488D4D33090DABEde`](https://explorer.test.mezo.org/address/0x637A41a27e14897E72D3f9e488D4D33090DABEde) | Attribution-only (`0.00%` fee, no user fee approval required) |

---

## 2. Architecture & Monorepo Layout

```text
fuse/
├── packages/
│   ├── contracts/          # Foundry project: FuseRouter.sol + unit, fuzz (256 runs), and live fork tests
│   └── sdk/                # @fuse/sdk: FuseClient, quotes, Skip oracle, Dual-Path MUSD permit, leaderboard indexer & MUSD x402
├── apps/
│   ├── web/                # @fuse/web: Next.js App Router (/widget, /builders, /leaderboard, /docs, /api/leaderboard, /api/analytics/[builder])
│   └── demo-builder/       # Partner demo app embedding Fuse with a registered builder code
```

### Core Protocol Features
1. **Explicit User Fee Consent & Hard Protocol Cap (`MAX_FEE_BPS = 50`):**
   - Builders register on-chain with `0 <= feeBps <= 50` (`0.00%` to `0.50%`) and a `metadataURI` (explicitly labeled `(self-reported)` across all surfaces).
   - When `feeBps > 0`, `FuseRouter` requires the user to have called `approveBuilder(builder, maxFeeBps)` where `maxFeeBps >= builder.feeBps`. If a builder increases their fee above the user's approved cap, routed calls revert with `FeeAboveUserApproval(builderFeeBps, userMaxFeeBps)`.
   - Zero-fee builders (`feeBps == 0`) require no approval transaction while still emitting canonical `Routed` attribution events.
2. **Dual-Path MUSD Execution (`permit` + Automatic Fallback):**
   - Standard EVM wallets execute `saveWithPermit` and `swapWithPermit` (`MUSD -> BTC`) in **1 transaction** via EIP-2612 `permit`.
   - Bitcoin wallets connected via Mezo Passport / OrangeKit smart accounts (where `eth_signTypedData_v4` throws `Unsupported method`) automatically fall back to the 2-step `approve` + `save`/`swap` flow without failing.
3. **VeBTC Lock Duration Rules on Mezo Testnet:**
   - Enforces Mezo Testnet's `604,800s` (1 week) to `2,592,000s` (30 days) lock window and previews the exact Thursday `00:00 UTC` epoch-rounded unlock timestamp.
   - Calls `veBTC.createLockFor(netAmount, lockDuration, msg.sender)` so the user directly owns the minted `VeBTC` NFT (`lockId`).
4. **Skip BTC/USD Oracle Valuation (`T17`):**
   - Both the Widget and Leaderboard read Mezo's Skip oracle (`0x7b7c000000000000000000000000000000000015`) to value BTC and MUSD volume and builder fees in USD, gracefully hiding USD equivalents if the oracle read fails.
5. **Paid Builder Analytics over MUSD x402 (`T18`):**
   - `GET /api/analytics/[builder]` returns an `HTTP 402 Payment Required` challenge (`0.05 MUSD` on `eip155:31611` via `permit2` + `eip2612GasSponsoring`).
   - When called with a signed `PAYMENT-SIGNATURE` header, the server verifies and settles the `0.05 MUSD` payment on Mezo Testnet via `https://facilitator.vativ.io` and returns the settlement transaction hash plus full per-builder analytics.

---

## 3. Quickstart Integration

### A. Drop-In `<iframe>` Embed
```html
<iframe
  src="https://fuse.mezo.org/widget?builder=0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a&tab=save"
  width="440"
  height="680"
  title="Fuse Mezo DeFi Widget"
  allow="clipboard-write"
></iframe>
```

### B. React `<FuseWidget />` Component
```tsx
import { FusePassportProvider, FuseWidget } from "@fuse/web";

export function MyMezoDapp() {
  return (
    <FusePassportProvider>
      <FuseWidget
        builder="0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a"
        defaultAction="save"
      />
    </FusePassportProvider>
  );
}
```

### C. Headless TypeScript SDK (`@fuse/sdk`)
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

const fuse = new FuseClient({ publicClient, walletClient });

const saveResult = await fuse.executeSave({
  builder: DEFAULT_PAID_BUILDER_TESTNET,
  amount: parseUnits("10", 18),
});
console.log("Confirmed on Mezo Testnet:", saveResult.explorerUrl);
```

---

## 4. Local Development & Verification Commands

### Prerequisites
- **Node.js** `>= 22`
- **pnpm** `11.x`
- **Foundry** (`forge`, `cast`)

### Install & Build
```bash
pnpm install
pnpm --filter @fuse/sdk build
pnpm --filter @fuse/web build
```

### Run Smart Contract Tests (Unit + Fuzz + Mezo Testnet Fork)
```bash
cd packages/contracts
forge test -vv
```

### Run `@fuse/sdk` Unit & Live Mezo Testnet Tests
```bash
pnpm --filter @fuse/sdk test
```

### Start the Web App Locally
```bash
pnpm --filter @fuse/web dev
```
- **Home & Surface Directory:** `http://localhost:3000/`
- **Embeddable Widget:** `http://localhost:3000/widget?builder=0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a&action=swap`
- **Builders Console:** `http://localhost:3000/builders`
- **Builder Leaderboard:** `http://localhost:3000/leaderboard`
- **Documentation:** `http://localhost:3000/docs`
- **Leaderboard JSON API:** `http://localhost:3000/api/leaderboard`
- **Paid Builder Analytics (MUSD x402):** `http://localhost:3000/api/analytics/0xFfC2625b3282D05E28dFcedE7D522c464349Ee9a`

## 5. Owner Powers

The immutable `FuseRouter` owner can pause and unpause routed actions and edit the swap input token allowlist. The owner cannot move funds, change fees, change Mezo protocol addresses, or block `revokeBuilder`, which continues to work while the router is paused. The router holds no balances between transactions.

## 6. Deployment Note

The live testnet router at `0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1` was deployed and Sourcify-verified from commit `f3615b6`, where the owner was the deployer. The explicit `_owner` constructor argument applies to the next deployment. The mainnet plan is to use a Safe multisig as owner. Safe 1.4.1 is deployed on Mezo and is used by Mezo Passport and OrangeKit.

## 7. Leaderboard and Gauge Anti-Gaming

The router remains permissionless. A self-referral only refunds the user's own fee, and Fuse takes no cut, so anti-gaming is handled at the metrics layer. Leaderboard metrics exclude events where `user == builder`, ranking uses unique users by default, and Fuse test wallets are labelled. Planned gauge rules include weighting saves and locks above swaps, setting minimum action sizes, and having a Fuse-controlled distributor review eligibility before payout.

## 8. Environment Variables

- `X402_PAY_TO` is required as a valid payee address for paid analytics at `/api/analytics/[builder]`. The endpoint fails closed when no valid payee is configured.
- `FUSE_OWNER_ADDRESS` is required by the deployment script as the immutable router owner. Use a Safe multisig for a mainnet deployment.
