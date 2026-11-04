import {
  type Account,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  encodeFunctionData,
} from "viem";
import { erc20PermitAbi, fuseRouterAbi } from "./abis.js";
import {
  type FuseAddresses,
  MAX_FEE_BPS,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN_ID,
  MIN_LOCK_DURATION_SECONDS,
  TESTNET_MAX_LOCK_DURATION_SECONDS,
  getExplorerTxUrl,
} from "./addresses.js";
import { type BuilderStatus, getBuilderStatus } from "./builders.js";
import {
  FuseTransactionRevertedError,
  isUnsupportedMethodError,
} from "./errors.js";
import { type RoutedEventRecord, getRoutedEvents } from "./events.js";
import { type BtcUsdOraclePrice, getBtcUsdPrice } from "./oracle.js";
import {
  type PermitSignature,
  isBitcoinSmartAccountWallet,
  signMusdPermit,
} from "./permit.js";
import {
  type LockQuote,
  type SaveQuote,
  type SwapQuote,
  type TigrisRoute,
  buildDefaultTigrisRoute,
  getLockQuote,
  getSaveQuote,
  getSwapQuote,
} from "./quotes.js";

export interface BuiltTransaction {
  to: Address;
  data: Hex;
  value: bigint;
}

export type ExecutionStep =
  | "checking_allowance"
  | "permit_signature_pending"
  | "permit_fallback_to_approve"
  | "token_approval_pending"
  | "token_approval_confirming"
  | "action_tx_pending"
  | "action_tx_confirming"
  | "confirmed";

export type MusdExecutionMode = "auto" | "permit" | "approve";

export interface ActionExecutionResult {
  txHash: Hash;
  approvalTxHash?: Hash;
  receipt: TransactionReceipt;
  explorerUrl: string;
  usedPermit: boolean;
}

function isExecutionRevert(error: unknown): boolean {
  if (
    error instanceof BaseError &&
    error.walk(
      (cause) =>
        cause instanceof ExecutionRevertedError ||
        cause instanceof ContractFunctionRevertedError,
    )
  ) {
    return true;
  }

  const message =
    error instanceof Error
      ? `${error.name} ${error.message} ${(error as { shortMessage?: string }).shortMessage ?? ""}`
      : String(error);
  return /\bexecution reverted\b|\breverted?\b|\brevert(?:ed)?\s*[:(]/i.test(message);
}

// ---------------------------------------------------------------------------
// Raw Calldata Transaction Builders (PRD R8)
// ---------------------------------------------------------------------------

export function buildRegisterBuilderTx(
  params: { feeBps: number; metadataURI: string },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "registerBuilder",
      args: [params.feeBps, params.metadataURI],
    }),
    value: 0n,
  };
}

export function buildSetFeeTx(
  params: { newFeeBps: number },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "setFee",
      args: [params.newFeeBps],
    }),
    value: 0n,
  };
}

export function buildSetActiveTx(
  params: { active: boolean },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "setActive",
      args: [params.active],
    }),
    value: 0n,
  };
}

export function buildSetMetadataURITx(
  params: { metadataURI: string },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "setMetadataURI",
      args: [params.metadataURI],
    }),
    value: 0n,
  };
}

export function buildApproveBuilderTx(
  params: { builder: Address; maxFeeBps: number },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  if (params.maxFeeBps < 0 || params.maxFeeBps > MAX_FEE_BPS) {
    throw new Error(`maxFeeBps (${params.maxFeeBps}) exceeds MAX_FEE_BPS (${MAX_FEE_BPS})`);
  }
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "approveBuilder",
      args: [params.builder, params.maxFeeBps],
    }),
    value: 0n,
  };
}

export function buildRevokeBuilderTx(
  params: { builder: Address },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "revokeBuilder",
      args: [params.builder],
    }),
    value: 0n,
  };
}

export function buildErc20ApproveTx(params: {
  token: Address;
  spender: Address;
  amount: bigint;
}): BuiltTransaction {
  return {
    to: params.token,
    data: encodeFunctionData({
      abi: erc20PermitAbi,
      functionName: "approve",
      args: [params.spender, params.amount],
    }),
    value: 0n,
  };
}

export function buildSwapTx(
  params: {
    builder: Address;
    amountIn: bigint;
    amountOutMin: bigint;
    routes: TigrisRoute[];
    deadline: bigint;
  },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "swap",
      args: [
        params.builder,
        params.amountIn,
        params.amountOutMin,
        params.routes,
        params.deadline,
      ],
    }),
    value: 0n,
  };
}

export function buildSwapWithPermitTx(
  params: {
    builder: Address;
    amountIn: bigint;
    amountOutMin: bigint;
    routes: TigrisRoute[];
    deadline: bigint;
    permit: Pick<PermitSignature, "deadline" | "v" | "r" | "s">;
  },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "swapWithPermit",
      args: [
        params.builder,
        params.amountIn,
        params.amountOutMin,
        params.routes,
        params.deadline,
        params.permit.deadline,
        params.permit.v,
        params.permit.r,
        params.permit.s,
      ],
    }),
    value: 0n,
  };
}

export function buildSaveTx(
  params: { builder: Address; amount: bigint },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "save",
      args: [params.builder, params.amount],
    }),
    value: 0n,
  };
}

export function buildSaveWithPermitTx(
  params: {
    builder: Address;
    amount: bigint;
    permit: Pick<PermitSignature, "deadline" | "v" | "r" | "s">;
  },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "saveWithPermit",
      args: [
        params.builder,
        params.amount,
        params.permit.deadline,
        params.permit.v,
        params.permit.r,
        params.permit.s,
      ],
    }),
    value: 0n,
  };
}

export function buildLockTx(
  params: {
    builder: Address;
    amount: bigint;
    lockDurationSeconds: number;
  },
  addresses: FuseAddresses = MEZO_TESTNET_ADDRESSES,
): BuiltTransaction {
  return {
    to: addresses.fuseRouter,
    data: encodeFunctionData({
      abi: fuseRouterAbi,
      functionName: "lock",
      args: [
        params.builder,
        params.amount,
        BigInt(params.lockDurationSeconds),
      ],
    }),
    value: 0n,
  };
}

// ---------------------------------------------------------------------------
// High-Level FuseClient
// ---------------------------------------------------------------------------

export interface FuseClientConfig {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  addresses?: FuseAddresses;
  chainId?: number;
  /** Optional hint from Mezo Passport (`connector.type === "orangekit"` or `networkFamily === "bitcoin"`) */
  connectorInfo?: {
    type?: string;
    id?: string;
    networkFamily?: "bitcoin" | "evm";
  } | null;
}

export class FuseClient {
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;
  public readonly addresses: FuseAddresses;
  public readonly chainId: number;
  public readonly connectorInfo?: FuseClientConfig["connectorInfo"];

  constructor(config: FuseClientConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.addresses = config.addresses ?? MEZO_TESTNET_ADDRESSES;
    this.chainId = config.chainId ?? MEZO_TESTNET_CHAIN_ID;
    this.connectorInfo = config.connectorInfo;
  }

  private requireWallet(): {
    walletClient: WalletClient;
    account: Account;
    address: Address;
  } {
    if (!this.walletClient || !this.walletClient.account) {
      throw new Error("WalletClient with an active account is required for write actions.");
    }
    return {
      walletClient: this.walletClient,
      account: this.walletClient.account,
      address: this.walletClient.account.address,
    };
  }

  private async sendBuiltTransaction(
    built: BuiltTransaction,
    fallbackGasLimit = 500_000n,
  ): Promise<Hash> {
    const { walletClient, account } = this.requireWallet();
    let gas: bigint | undefined;
    try {
      const estimated = await this.publicClient.estimateGas({
        account,
        to: built.to,
        data: built.data,
        value: built.value,
      });
      // Use the per-action fallback as a minimum because Mezo RPC estimates can be stale.
      const buffered = (estimated * 125n) / 100n;
      gas = buffered > fallbackGasLimit ? buffered : fallbackGasLimit;
    } catch (error) {
      if (isExecutionRevert(error)) throw error;
      gas = fallbackGasLimit;
    }

    return walletClient.sendTransaction({
      account,
      chain: walletClient.chain ?? null,
      to: built.to,
      data: built.data,
      value: built.value,
      gas,
    });
  }

  private async waitForSuccessfulReceipt(
    txHash: Hash,
    step: string,
  ): Promise<TransactionReceipt> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new FuseTransactionRevertedError({
        txHash,
        explorerUrl: getExplorerTxUrl(txHash),
        step,
      });
    }
    return receipt;
  }

  // -------------------------------------------------------------------------
  // Read Helpers
  // -------------------------------------------------------------------------

  async getBtcUsdPrice(): Promise<BtcUsdOraclePrice | null> {
    return getBtcUsdPrice(this.publicClient, this.addresses.skipBtcUsdOracle);
  }

  async getBuilderStatus(builder: Address, user?: Address): Promise<BuilderStatus> {
    return getBuilderStatus({
      publicClient: this.publicClient,
      builder,
      user,
      addresses: this.addresses,
    });
  }

  async getTokenBalance(token: Address, account: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: erc20PermitAbi,
      functionName: "balanceOf",
      args: [account],
    });
  }

  async getTokenAllowance(
    token: Address,
    owner: Address,
    spender: Address = this.addresses.fuseRouter,
  ): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: erc20PermitAbi,
      functionName: "allowance",
      args: [owner, spender],
    });
  }

  async getSwapQuote(params: {
    builder: Address;
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    slippageBps?: number;
    routes?: TigrisRoute[];
  }): Promise<SwapQuote> {
    return getSwapQuote({
      publicClient: this.publicClient,
      addresses: this.addresses,
      ...params,
    });
  }

  async getSaveQuote(params: {
    builder: Address;
    amountIn: bigint;
  }): Promise<SaveQuote> {
    return getSaveQuote({
      publicClient: this.publicClient,
      addresses: this.addresses,
      ...params,
    });
  }

  async getLockQuote(params: {
    builder: Address;
    amountIn: bigint;
    lockDurationSeconds: number;
  }): Promise<LockQuote> {
    return getLockQuote({
      publicClient: this.publicClient,
      addresses: this.addresses,
      ...params,
    });
  }

  async getRoutedEvents(params?: {
    fromBlock?: bigint;
    toBlock?: bigint | "latest";
    router?: Address;
    builder?: Address;
    user?: Address;
  }): Promise<RoutedEventRecord[]> {
    return getRoutedEvents({
      publicClient: this.publicClient,
      addresses: this.addresses,
      ...params,
    });
  }

  // -------------------------------------------------------------------------
  // Builder & User Approval Write Methods
  // -------------------------------------------------------------------------

  async registerBuilder(params: {
    feeBps: number;
    metadataURI: string;
  }): Promise<{ txHash: Hash; receipt: TransactionReceipt }> {
    const built = buildRegisterBuilderTx(params, this.addresses);
    const txHash = await this.sendBuiltTransaction(built, 250_000n);
    const receipt = await this.waitForSuccessfulReceipt(txHash, "builder registration");
    return { txHash, receipt };
  }

  async setFee(params: {
    newFeeBps: number;
  }): Promise<{ txHash: Hash; receipt: TransactionReceipt }> {
    const built = buildSetFeeTx(params, this.addresses);
    const txHash = await this.sendBuiltTransaction(built, 200_000n);
    const receipt = await this.waitForSuccessfulReceipt(txHash, "builder fee update");
    return { txHash, receipt };
  }

  async setActive(params: {
    active: boolean;
  }): Promise<{ txHash: Hash; receipt: TransactionReceipt }> {
    const built = buildSetActiveTx(params, this.addresses);
    const txHash = await this.sendBuiltTransaction(built, 200_000n);
    const receipt = await this.waitForSuccessfulReceipt(txHash, "builder status update");
    return { txHash, receipt };
  }

  async setMetadataURI(params: {
    metadataURI: string;
  }): Promise<{ txHash: Hash; receipt: TransactionReceipt }> {
    const built = buildSetMetadataURITx(params, this.addresses);
    const txHash = await this.sendBuiltTransaction(built, 250_000n);
    const receipt = await this.waitForSuccessfulReceipt(txHash, "builder metadata update");
    return { txHash, receipt };
  }

  async approveBuilder(params: {
    builder: Address;
    maxFeeBps: number;
  }): Promise<{ txHash: Hash; receipt: TransactionReceipt; explorerUrl: string }> {
    const built = buildApproveBuilderTx(params, this.addresses);
    const txHash = await this.sendBuiltTransaction(built, 200_000n);
    const receipt = await this.waitForSuccessfulReceipt(txHash, "builder approval");
    return {
      txHash,
      receipt,
      explorerUrl: getExplorerTxUrl(txHash),
    };
  }

  async revokeBuilder(params: {
    builder: Address;
  }): Promise<{ txHash: Hash; receipt: TransactionReceipt; explorerUrl: string }> {
    const built = buildRevokeBuilderTx(params, this.addresses);
    const txHash = await this.sendBuiltTransaction(built, 200_000n);
    const receipt = await this.waitForSuccessfulReceipt(txHash, "builder revocation");
    return {
      txHash,
      receipt,
      explorerUrl: getExplorerTxUrl(txHash),
    };
  }

  // -------------------------------------------------------------------------
  // Routed Actions with Dual-Path MUSD Permit / Approve Execution (T13)
  // -------------------------------------------------------------------------

  async executeSave(params: {
    builder: Address;
    amount: bigint;
    mode?: MusdExecutionMode;
    onStep?: (step: ExecutionStep) => void;
  }): Promise<ActionExecutionResult> {
    const { walletClient, account, address } = this.requireWallet();
    const { builder, amount, mode = "auto", onStep } = params;

    onStep?.("checking_allowance");
    const currentAllowance = await this.getTokenAllowance(this.addresses.musd, address);

    // 1. If existing MUSD allowance is already sufficient, call `save` directly in 1 step
    if (currentAllowance >= amount && mode !== "permit") {
      onStep?.("action_tx_pending");
      const txHash = await this.sendBuiltTransaction(
        buildSaveTx({ builder, amount }, this.addresses),
        500_000n,
      );
      onStep?.("action_tx_confirming");
      const receipt = await this.waitForSuccessfulReceipt(txHash, "save");
      onStep?.("confirmed");
      return {
        txHash,
        receipt,
        explorerUrl: getExplorerTxUrl(txHash),
        usedPermit: false,
      };
    }

    // 2. Try EIP-2612 MUSD permit (`saveWithPermit`) for EVM wallets unless explicitly set to "approve"
    const isBitcoinWallet = isBitcoinSmartAccountWallet(this.connectorInfo);
    if (mode === "permit" || (mode === "auto" && !isBitcoinWallet)) {
      try {
        onStep?.("permit_signature_pending");
        const permit = await signMusdPermit({
          publicClient: this.publicClient,
          walletClient,
          owner: address,
          account,
          spender: this.addresses.fuseRouter,
          value: amount,
          chainId: this.chainId,
          musdAddress: this.addresses.musd,
        });

        onStep?.("action_tx_pending");
        const txHash = await this.sendBuiltTransaction(
          buildSaveWithPermitTx({ builder, amount, permit }, this.addresses),
          550_000n,
        );
        onStep?.("action_tx_confirming");
        const receipt = await this.waitForSuccessfulReceipt(txHash, "save");
        onStep?.("confirmed");
        return {
          txHash,
          receipt,
          explorerUrl: getExplorerTxUrl(txHash),
          usedPermit: true,
        };
      } catch (err) {
        // Architectural Decision #2 from T0 Spike:
        // If `signTypedData` throws `Unsupported method` (Bitcoin Smart Account), fall back automatically to approve + save
        if (mode === "auto" && isUnsupportedMethodError(err)) {
          onStep?.("permit_fallback_to_approve");
        } else {
          throw err;
        }
      }
    }

    // 3. Fallback / Bitcoin Smart Account 2-step flow: `approve` + `save`
    let approvalTxHash: Hash | undefined;
    if (currentAllowance < amount) {
      onStep?.("token_approval_pending");
      approvalTxHash = await this.sendBuiltTransaction(
        buildErc20ApproveTx({
          token: this.addresses.musd,
          spender: this.addresses.fuseRouter,
          amount,
        }),
        200_000n,
      );
      onStep?.("token_approval_confirming");
      await this.waitForSuccessfulReceipt(approvalTxHash, "save token approval");
    }

    onStep?.("action_tx_pending");
    const txHash = await this.sendBuiltTransaction(
      buildSaveTx({ builder, amount }, this.addresses),
      500_000n,
    );
    onStep?.("action_tx_confirming");
    const receipt = await this.waitForSuccessfulReceipt(txHash, "save");
    onStep?.("confirmed");
    return {
      txHash,
      approvalTxHash,
      receipt,
      explorerUrl: getExplorerTxUrl(txHash),
      usedPermit: false,
    };
  }

  async executeSwap(params: {
    builder: Address;
    amountIn: bigint;
    amountOutMin: bigint;
    routes?: TigrisRoute[];
    tokenIn?: Address;
    tokenOut?: Address;
    deadlineSeconds?: number;
    mode?: MusdExecutionMode;
    onStep?: (step: ExecutionStep) => void;
  }): Promise<ActionExecutionResult> {
    const { walletClient, account, address } = this.requireWallet();
    const {
      builder,
      amountIn,
      amountOutMin,
      deadlineSeconds = 1800,
      mode = "auto",
      onStep,
    } = params;

    const routes =
      params.routes && params.routes.length > 0
        ? params.routes
        : buildDefaultTigrisRoute(
            params.tokenIn ?? this.addresses.btc,
            params.tokenOut ?? this.addresses.musd,
            this.addresses.poolFactory,
          );

    const tokenIn = routes[0].from;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
    const isMusdInput = tokenIn.toLowerCase() === this.addresses.musd.toLowerCase();

    onStep?.("checking_allowance");
    const currentAllowance = await this.getTokenAllowance(tokenIn, address);

    // 1. If existing allowance is already sufficient, call `swap` directly in 1 step
    if (currentAllowance >= amountIn && !(isMusdInput && mode === "permit")) {
      onStep?.("action_tx_pending");
      const txHash = await this.sendBuiltTransaction(
        buildSwapTx({ builder, amountIn, amountOutMin, routes, deadline }, this.addresses),
        600_000n,
      );
      onStep?.("action_tx_confirming");
      const receipt = await this.waitForSuccessfulReceipt(txHash, "swap");
      onStep?.("confirmed");
      return {
        txHash,
        receipt,
        explorerUrl: getExplorerTxUrl(txHash),
        usedPermit: false,
      };
    }

    // 2. If tokenIn is MUSD and wallet supports EIP-712, use 1-tx `swapWithPermit`
    const isBitcoinWallet = isBitcoinSmartAccountWallet(this.connectorInfo);
    if (isMusdInput && (mode === "permit" || (mode === "auto" && !isBitcoinWallet))) {
      try {
        onStep?.("permit_signature_pending");
        const permit = await signMusdPermit({
          publicClient: this.publicClient,
          walletClient,
          owner: address,
          account,
          spender: this.addresses.fuseRouter,
          value: amountIn,
          chainId: this.chainId,
          musdAddress: this.addresses.musd,
        });

        onStep?.("action_tx_pending");
        const txHash = await this.sendBuiltTransaction(
          buildSwapWithPermitTx(
            { builder, amountIn, amountOutMin, routes, deadline, permit },
            this.addresses,
          ),
          650_000n,
        );
        onStep?.("action_tx_confirming");
        const receipt = await this.waitForSuccessfulReceipt(txHash, "swap");
        onStep?.("confirmed");
        return {
          txHash,
          receipt,
          explorerUrl: getExplorerTxUrl(txHash),
          usedPermit: true,
        };
      } catch (err) {
        if (mode === "auto" && isUnsupportedMethodError(err)) {
          onStep?.("permit_fallback_to_approve");
        } else {
          throw err;
        }
      }
    }

    // 3. Standard ERC-20 `approve` + `swap` (used for BTC/MEZO or Bitcoin Smart Account wallets)
    let approvalTxHash: Hash | undefined;
    if (currentAllowance < amountIn) {
      onStep?.("token_approval_pending");
      approvalTxHash = await this.sendBuiltTransaction(
        buildErc20ApproveTx({
          token: tokenIn,
          spender: this.addresses.fuseRouter,
          amount: amountIn,
        }),
        200_000n,
      );
      onStep?.("token_approval_confirming");
      await this.waitForSuccessfulReceipt(approvalTxHash, "swap token approval");
    }

    onStep?.("action_tx_pending");
    const txHash = await this.sendBuiltTransaction(
      buildSwapTx({ builder, amountIn, amountOutMin, routes, deadline }, this.addresses),
      600_000n,
    );
    onStep?.("action_tx_confirming");
    const receipt = await this.waitForSuccessfulReceipt(txHash, "swap");
    onStep?.("confirmed");
    return {
      txHash,
      approvalTxHash,
      receipt,
      explorerUrl: getExplorerTxUrl(txHash),
      usedPermit: false,
    };
  }

  async executeLock(params: {
    builder: Address;
    amount: bigint;
    lockDurationSeconds: number;
    onStep?: (step: ExecutionStep) => void;
  }): Promise<ActionExecutionResult> {
    const { address } = this.requireWallet();
    const { builder, amount, lockDurationSeconds, onStep } = params;

    if (
      lockDurationSeconds < MIN_LOCK_DURATION_SECONDS ||
      lockDurationSeconds > TESTNET_MAX_LOCK_DURATION_SECONDS
    ) {
      throw new Error(
        `InvalidLockDuration: Lock duration (${lockDurationSeconds}s) must be between ${MIN_LOCK_DURATION_SECONDS}s (7 days) and ${TESTNET_MAX_LOCK_DURATION_SECONDS}s (30 days) on Mezo Testnet.`,
      );
    }

    onStep?.("checking_allowance");
    const currentAllowance = await this.getTokenAllowance(this.addresses.btc, address);

    let approvalTxHash: Hash | undefined;
    if (currentAllowance < amount) {
      onStep?.("token_approval_pending");
      approvalTxHash = await this.sendBuiltTransaction(
        buildErc20ApproveTx({
          token: this.addresses.btc,
          spender: this.addresses.fuseRouter,
          amount,
        }),
        200_000n,
      );
      onStep?.("token_approval_confirming");
      await this.waitForSuccessfulReceipt(approvalTxHash, "lock token approval");
    }

    onStep?.("action_tx_pending");
    const txHash = await this.sendBuiltTransaction(
      buildLockTx({ builder, amount, lockDurationSeconds }, this.addresses),
      750_000n,
    );
    onStep?.("action_tx_confirming");
    const receipt = await this.waitForSuccessfulReceipt(txHash, "lock");
    onStep?.("confirmed");
    return {
      txHash,
      approvalTxHash,
      receipt,
      explorerUrl: getExplorerTxUrl(txHash),
      usedPermit: false,
    };
  }
}
