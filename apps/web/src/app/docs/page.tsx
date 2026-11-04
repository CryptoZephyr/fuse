import React from "react";
import Link from "next/link";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_ZERO_FEE_BUILDER_TESTNET,
  MEZO_TESTNET_ADDRESSES,
  getExplorerAddressUrl,
} from "mezo-fuse";

export default function DocsPage() {
  return (
    <main data-fuse-page="docs">
      <header data-fuse-header="docs">
        <h1>Fuse Protocol Documentation (Mezo Testnet · Chain ID 31611)</h1>
        <p>
          Developer and integrator reference for <strong>Fuse</strong>, the
          Embeddable DeFi Router &amp; Builder Attribution Layer for Mezo.
        </p>
        <nav aria-label="Fuse navigation" data-fuse-nav="primary">
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/widget">Widget (/widget)</Link>
            </li>
            <li>
              <Link href="/builders">Builders Console (/builders)</Link>
            </li>
            <li>
              <Link href="/leaderboard">Leaderboard (/leaderboard)</Link>
            </li>
            <li>
              <Link href="/docs">Docs (/docs)</Link>
            </li>
          </ul>
        </nav>
      </header>

      <hr />

      <section aria-label="Quickstart" data-fuse-section="quickstart">
        <h2>1. Quickstart Integration</h2>
        <p>
          Fuse lets any Mezo app, wallet, or community portal embed real on-chain{" "}
          <strong>Swap</strong> (Tigris DEX), <strong>Save</strong> (MUSD
          Savings Vault / sMUSD), and <strong>Lock</strong> (VeBTC voting
          escrow) actions while earning a transparent, user-approved builder fee
          (<code>0</code> to <code>50 bps</code> / <code>0.50%</code>) and
          on-chain attribution via the canonical <code>Routed</code> event.
        </p>

        <h3>Option A: Drop-in <code>&lt;iframe&gt;</code> Embed</h3>
        <pre data-fuse-doc-snippet="iframe">
          <code>{`<iframe
  src="http://localhost:3000/widget?builder=${DEFAULT_PAID_BUILDER_TESTNET}&action=save"
  width="440"
  height="680"
  title="Fuse Mezo DeFi Widget"
  allow="clipboard-write"
></iframe>`}</code>
        </pre>

        <h3>Option B: React <code>&lt;FuseWidget /&gt;</code> Component</h3>
        <pre data-fuse-doc-snippet="react">
          <code>{`import { FusePassportProvider, FuseWidget } from "@fuse/web";

export default function PartnerPage() {
  return (
    <FusePassportProvider>
      <FuseWidget
        builder="${DEFAULT_PAID_BUILDER_TESTNET}"
        defaultAction="save"
      />
    </FusePassportProvider>
  );
}`}</code>
        </pre>

        <h3>Option C: Headless TypeScript SDK (<code>mezo-fuse</code>)</h3>
        <pre data-fuse-doc-snippet="sdk">
          <code>{`import { createPublicClient, http, parseUnits } from "viem";
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

const fuse = new FuseClient({ publicClient, walletClient });

// 1. Quote Save (MUSD -> sMUSD) with Skip BTC/USD oracle valuation
const quote = await fuse.getSaveQuote({
  builder: DEFAULT_PAID_BUILDER_TESTNET,
  amountIn: parseUnits("10", 18),
});

// 2. Approve builder fee once (only needed when builder feeBps > 0)
if (quote.feeBps > 0) {
  await fuse.approveBuilder({
    builder: DEFAULT_PAID_BUILDER_TESTNET,
    maxFeeBps: quote.feeBps,
  });
}

// 3. Execute Save (uses 1-tx EIP-2612 MUSD permit on EVM wallets, or automatic 2-step approve+save on Bitcoin Smart Accounts)
const tx = await fuse.executeSave({
  builder: DEFAULT_PAID_BUILDER_TESTNET,
  amount: parseUnits("10", 18),
});
console.log("Explorer URL:", tx.explorerUrl);`}</code>
        </pre>
      </section>

      <hr />

      <section
        aria-label="Deployed Contract Addresses"
        data-fuse-section="addresses"
      >
        <h2>2. Verified Mezo Testnet (Chain ID 31611) Addresses</h2>
        <table data-fuse-table="contract-addresses">
          <thead>
            <tr>
              <th>Contract / Resource</th>
              <th>Address</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>FuseRouter (Current)</strong>
              </td>
              <td>
                <a
                  href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.fuseRouter)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.fuseRouter}</code>
                </a>
              </td>
              <td>
                Deployed at block{" "}
                <code>{MEZO_TESTNET_ADDRESSES.fuseRouterDeployBlock.toString()}</code>{" "}
                from commit <code>b804a54</code>. Owner is deployer. Sourcify{" "}
                <code>exact_match</code>.
              </td>
            </tr>
            <tr>
              <td>FuseRouter (Previous deployment)</td>
              <td>
                <a
                  href={getExplorerAddressUrl(
                    "0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1",
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1</code>
                </a>
              </td>
              <td>
                Deployed at block <code>16328764</code> from commit{" "}
                <code>f3615b6</code>
              </td>
            </tr>
            <tr>
              <td>Tigris DEX PoolRouter</td>
              <td>
                <a
                  href={getExplorerAddressUrl(
                    MEZO_TESTNET_ADDRESSES.tigrisRouter,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.tigrisRouter}</code>
                </a>
              </td>
              <td>Canonical V2 PoolRouter on Mezo Testnet</td>
            </tr>
            <tr>
              <td>Tigris PoolFactory</td>
              <td>
                <a
                  href={getExplorerAddressUrl(
                    MEZO_TESTNET_ADDRESSES.poolFactory,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.poolFactory}</code>
                </a>
              </td>
              <td>Volatile &amp; stable pool factory</td>
            </tr>
            <tr>
              <td>MUSD (Mezo USD)</td>
              <td>
                <a
                  href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.musd)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.musd}</code>
                </a>
              </td>
              <td>Supports EIP-2612 <code>permit</code> &amp; Permit2 x402</td>
            </tr>
            <tr>
              <td>BTC ERC-20 Precompile</td>
              <td>
                <a
                  href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.btc)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.btc}</code>
                </a>
              </td>
              <td>18 decimals; no EIP-2612 permit</td>
            </tr>
            <tr>
              <td>MEZO ERC-20 Precompile</td>
              <td>
                <a
                  href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.mezoToken)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.mezoToken}</code>
                </a>
              </td>
              <td>18 decimals</td>
            </tr>
            <tr>
              <td>MUSD Savings Vault (sMUSD)</td>
              <td>
                <a
                  href={getExplorerAddressUrl(
                    MEZO_TESTNET_ADDRESSES.savingsVault,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.savingsVault}</code>
                </a>
              </td>
              <td>ERC-4626 vault receiving MUSD deposits</td>
            </tr>
            <tr>
              <td>VeBTC (VotingEscrow)</td>
              <td>
                <a
                  href={getExplorerAddressUrl(MEZO_TESTNET_ADDRESSES.veBTC)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.veBTC}</code>
                </a>
              </td>
              <td>ERC-721 lock NFT minted directly to <code>msg.sender</code></td>
            </tr>
            <tr>
              <td>Skip BTC/USD Oracle</td>
              <td>
                <a
                  href={getExplorerAddressUrl(
                    MEZO_TESTNET_ADDRESSES.skipBtcUsdOracle,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{MEZO_TESTNET_ADDRESSES.skipBtcUsdOracle}</code>
                </a>
              </td>
              <td>Chainlink-compatible <code>latestRoundData()</code></td>
            </tr>
            <tr>
              <td>Demo Paid Builder (15 bps / 0.15%)</td>
              <td>
                <a
                  href={getExplorerAddressUrl(DEFAULT_PAID_BUILDER_TESTNET)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{DEFAULT_PAID_BUILDER_TESTNET}</code>
                </a>
              </td>
              <td>Registered &amp; Active on Mezo Testnet</td>
            </tr>
            <tr>
              <td>Demo Zero-Fee Builder (0 bps / 0.00%)</td>
              <td>
                <a
                  href={getExplorerAddressUrl(DEFAULT_ZERO_FEE_BUILDER_TESTNET)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{DEFAULT_ZERO_FEE_BUILDER_TESTNET}</code>
                </a>
              </td>
              <td>Attribution-only mode (requires no user fee approval)</td>
            </tr>
          </tbody>
        </table>
        <p>Leaderboard and analytics include events from both router deployments.</p>
      </section>

      <hr />

      <section
        aria-label="Fee Rules and Consent Model"
        data-fuse-section="fee-rules"
      >
        <h2>3. Builder Fee Rules &amp; User Consent Model</h2>
        <ul>
          <li>
            <strong>Hard Protocol Cap:</strong>{" "}
            <code>MAX_FEE_BPS = 50</code> (<code>0.50%</code>). Any attempt to
            register or set a builder fee above 50 bps reverts on-chain with{" "}
            <code>FeeAboveMax(feeBps, 50)</code>.
          </li>
          <li>
            <strong>Explicit Per-User Fee Approval:</strong> When a registered,
            active builder has <code>feeBps &gt; 0</code>,{" "}
            <code>FuseRouter</code> verifies{" "}
            <code>userBuilderApproval[msg.sender][builder]</code> and{" "}
            <code>userMaxFeeBps[msg.sender][builder] &gt;= builder.feeBps</code>.
            If a builder raises their fee above the user&apos;s approved cap,
            transactions revert with{" "}
            <code>FeeAboveUserApproval(builderFeeBps, userMaxFeeBps)</code>{" "}
            until the user explicitly approves the higher fee.
          </li>
          <li>
            <strong>Zero-Fee Attribution Mode (0 bps):</strong> Builders can
            register with <code>feeBps = 0</code> (or pass an unregistered /
            inactive builder address) to receive full on-chain{" "}
            <code>Routed</code> event attribution without deducting any fee or
            requiring a prior <code>approveBuilder</code> transaction.
          </li>
          <li>
            <strong>Self-Reported Builder Names:</strong> Because builder
            registration on <code>FuseRouter</code> is permissionless, all
            builder display names parsed from <code>metadataURI</code> are
            labeled <strong>(self-reported)</strong> across the Widget,
            Builders Console, and Leaderboard.
          </li>
        </ul>
      </section>

      <hr />

      <section
        aria-label="Protocol Mechanics"
        data-fuse-section="mechanics"
      >
        <h2>4. Mezo-Specific Protocol Mechanics</h2>
        <dl>
          <dt>
            <strong>Dual-Path MUSD Permit &amp; Fallback</strong>
          </dt>
          <dd>
            MUSD on Mezo Testnet supports EIP-2612 <code>permit</code>. Standard
            EVM wallets execute <code>saveWithPermit</code> and{" "}
            <code>swapWithPermit</code> (when <code>tokenIn == MUSD</code>) in a
            single on-chain transaction. For Bitcoin wallets connected via Mezo
            Passport / OrangeKit smart accounts where{" "}
            <code>eth_signTypedData_v4</code> throws{" "}
            <code>Unsupported method</code>, <code>mezo-fuse</code>{" "}
            automatically falls back to the 2-step ERC-20{" "}
            <code>approve</code> + <code>save</code>/<code>swap</code> flow.
          </dd>

          <dt>
            <strong>VeBTC Testnet Lock Duration Window (7 to 30 Days)</strong>
          </dt>
          <dd>
            On Mezo Testnet (<code>31611</code>), the canonical{" "}
            <code>VeBTC</code> contract (
            <code>0xB63fcCd03521Cf21907627bd7fA465C129479231</code>) configures{" "}
            <code>maxLockTime = 2,592,000</code> seconds (30 days) and{" "}
            <code>WEEK = 604,800</code> seconds (7 days). Unlock timestamps
            round down to Thursday 00:00 UTC epochs:{" "}
            <code>((block.timestamp + duration) / 604800) * 604800</code>.{" "}
            <code>FuseRouter.lock</code> calls{" "}
            <code>veBTC.createLockFor(netAmount, lockDuration, msg.sender)</code>{" "}
            so the user directly receives the VeBTC NFT.
          </dd>

          <dt>
            <strong>Bitcoin Wallet Compatibility (Native SegWit vs Taproot)</strong>
          </dt>
          <dd>
            Mezo Passport supports Native SegWit (<code>tb1q...</code> /{" "}
            <code>bc1q...</code>) and Nested SegWit Bitcoin addresses. Taproot (
            <code>tb1p...</code> / <code>bc1p...</code>) addresses are detected
            early and shown a clear prompt to switch to Native SegWit or connect
            an EVM wallet.
          </dd>
        </dl>
      </section>

      <hr />

      <section
        aria-label="Paid Builder Analytics over MUSD x402"
        data-fuse-section="x402-docs"
      >
        <h2>5. Paid Builder Analytics API over MUSD x402</h2>
        <p>
          Endpoint: <code>GET /api/analytics/[builder]</code>
        </p>
        <ul>
          <li>
            <strong>Without payment header:</strong> Returns{" "}
            <code>HTTP 402 Payment Required</code> with the{" "}
            <code>PAYMENT-REQUIRED</code> header (base64-encoded x402 v2
            challenge) specifying <code>0.05 MUSD</code> on{" "}
            <code>eip155:31611</code> via <code>permit2</code> +{" "}
            <code>eip2612GasSponsoring</code>.
          </li>
          <li>
            <strong>With <code>PAYMENT-SIGNATURE</code> header:</strong> Verifies
            the signed MUSD Permit2 + EIP-2612 payment, computes analytics, then
            settles on success through <code>https://facilitator.vativ.io</code>.
            It returns <code>HTTP 200 OK</code> with the on-chain settlement
            transaction hash (<code>PAYMENT-RESPONSE</code> header) and the
            complete per-builder analytics report. Analytics failures do not
            settle the payment.
          </li>
        </ul>
        <pre data-fuse-doc-snippet="x402">
          <code>{`import {
  createMusdX402PaymentPayload,
  type X402PaymentRequired,
} from "mezo-fuse";

// 1. Request analytics -> receive HTTP 402 challenge
const res402 = await fetch("/api/analytics/${DEFAULT_PAID_BUILDER_TESTNET}");
const paymentRequired = (await res402.json()) as X402PaymentRequired;

// 2. Sign 0.05 MUSD Permit2 + EIP-2612 Gas Sponsoring payload
const { headerValue } = await createMusdX402PaymentPayload({
  publicClient,
  walletClient,
  paymentRequired,
});

// 3. Send signed header -> facilitator settles 0.05 MUSD on Mezo Testnet -> receive HTTP 200 analytics
const res200 = await fetch("/api/analytics/${DEFAULT_PAID_BUILDER_TESTNET}", {
  headers: { "PAYMENT-SIGNATURE": headerValue },
});
const { x402, analytics } = await res200.json();
console.log("x402 Settlement Tx:", x402.explorerUrl);`}</code>
        </pre>
      </section>

      <hr />

      <section aria-label="Owner Powers" data-fuse-section="owner-powers">
        <h2>6. Owner Powers and Deployment Note</h2>
        <p>
          The immutable <code>FuseRouter</code> owner can pause and unpause
          routed actions and edit the swap input token allowlist. The owner
          cannot move funds, change fees, change Mezo protocol addresses, or
          block <code>revokeBuilder</code>, which works while the router is
          paused. The router holds no balances between transactions.
        </p>
        <p>
          The current testnet router is{" "}
          <code>0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4</code>, deployed at
          block <code>16569522</code> from commit <code>b804a54</code> with the
          explicit <code>_owner</code> constructor argument. The owner is the
          deployer, and Sourcify reports <code>exact_match</code>. The previous
          router at <code>0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1</code>
          remains live and unpaused. Leaderboard and analytics include both
          deployments. The mainnet plan is to use a Safe multisig as owner.
          Safe 1.4.1 is deployed on Mezo and is used by Mezo Passport and
          OrangeKit.
        </p>
      </section>

      <hr />

      <section
        aria-label="Leaderboard and Gauge Anti-Gaming"
        data-fuse-section="anti-gaming"
      >
        <h2>7. Leaderboard and Gauge Anti-Gaming</h2>
        <p>
          The router remains permissionless. A self-referral only refunds the
          user&apos;s own fee, and Fuse takes no cut, so anti-gaming is handled
          at the metrics layer. Leaderboard metrics exclude events where{" "}
          <code>user == builder</code>, ranking uses unique users by default,
          and Fuse test wallets are labelled.
        </p>
        <p>
          Planned gauge rules include weighting saves and locks above swaps,
          setting minimum action sizes, and having a Fuse-controlled distributor
          review eligibility before payout.
        </p>
      </section>

      <hr />

      <section aria-label="Environment Variables" data-fuse-section="env">
        <h2>8. Environment Variables</h2>
        <ul>
          <li>
            <code>X402_PAY_TO</code> is required as a valid payee address for
            paid analytics at <code>/api/analytics/[builder]</code>. The
            endpoint fails closed when no valid payee is configured.
          </li>
          <li>
            <code>FUSE_OWNER_ADDRESS</code> is required by the deployment
            script as the immutable router owner. Use a Safe multisig for a
            mainnet deployment.
          </li>
        </ul>
      </section>

      <hr />

      <section aria-label="Security Notes" data-fuse-section="security">
        <h2>9. Security Architecture</h2>
        <ul>
          <li>
            <strong>Zero Retained Funds:</strong> <code>FuseRouter</code> never
            custodies user funds. Every routed call pulls <code>amountIn</code>{" "}
            from <code>msg.sender</code>, transfers <code>fee</code> directly to{" "}
            <code>builder</code>, forwards <code>netAmount</code> to the target
            Mezo contract (Tigris <code>PoolRouter</code>,{" "}
            <code>SavingsVault</code>, or <code>VeBTC</code>), and resets
            temporary allowance to <code>0</code> via{" "}
            <code>forceApprove(target, 0)</code>.
          </li>
          <li>
            <strong>Reentrancy &amp; Emergency Pause:</strong> All{" "}
            <code>swap</code>, <code>swapWithPermit</code>, <code>save</code>,{" "}
            <code>saveWithPermit</code>, and <code>lock</code> entrypoints are
            protected by OpenZeppelin <code>nonReentrant</code> and{" "}
            <code>whenNotPaused</code> modifiers.
          </li>
        </ul>
      </section>
    </main>
  );
}
