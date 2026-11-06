export const fuseRouterAbi = [
  // Constants & Immutables
  {
    type: "function",
    name: "MAX_FEE_BPS",
    inputs: [],
    outputs: [{ name: "", type: "uint16", internalType: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "BPS_DENOMINATOR",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MIN_LOCK_DURATION",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxLockDuration",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tigrisRouter",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "poolFactory",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "musd",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "btc",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mezoToken",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "savingsVault",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "veBTC",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowedInput",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "builders",
    inputs: [{ name: "builder", type: "address", internalType: "address" }],
    outputs: [
      { name: "feeBps", type: "uint16", internalType: "uint16" },
      { name: "active", type: "bool", internalType: "bool" },
      { name: "registered", type: "bool", internalType: "bool" },
      { name: "metadataURI", type: "string", internalType: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approvals",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "builder", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint16", internalType: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isBuilderApproved",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "builder", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "approved", type: "bool", internalType: "bool" },
      { name: "maxFeeBps", type: "uint16", internalType: "uint16" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "calculateFee",
    inputs: [
      { name: "builder", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "fee", type: "uint256", internalType: "uint256" },
      { name: "netAmount", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewUnlockTime",
    inputs: [{ name: "lockDuration", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "unlockTime", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  // Builder registry write methods
  {
    type: "function",
    name: "registerBuilder",
    inputs: [
      { name: "feeBps", type: "uint16", internalType: "uint16" },
      { name: "metadataURI", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFee",
    inputs: [{ name: "newFeeBps", type: "uint16", internalType: "uint16" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setActive",
    inputs: [{ name: "active", type: "bool", internalType: "bool" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMetadataURI",
    inputs: [{ name: "metadataURI", type: "string", internalType: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // User approvals
  {
    type: "function",
    name: "approveBuilder",
    inputs: [
      { name: "builder", type: "address", internalType: "address" },
      { name: "maxFeeBps", type: "uint16", internalType: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeBuilder",
    inputs: [{ name: "builder", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Actions
  {
    type: "function",
    name: "swap",
    inputs: [
      { name: "builder", type: "address", internalType: "address" },
      { name: "amountIn", type: "uint256", internalType: "uint256" },
      { name: "amountOutMin", type: "uint256", internalType: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        internalType: "struct ITigrisRouter.Route[]",
        components: [
          { name: "from", type: "address", internalType: "address" },
          { name: "to", type: "address", internalType: "address" },
          { name: "stable", type: "bool", internalType: "bool" },
          { name: "factory", type: "address", internalType: "address" },
        ],
      },
      { name: "deadline", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "swapWithPermit",
    inputs: [
      { name: "builder", type: "address", internalType: "address" },
      { name: "amountIn", type: "uint256", internalType: "uint256" },
      { name: "amountOutMin", type: "uint256", internalType: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        internalType: "struct ITigrisRouter.Route[]",
        components: [
          { name: "from", type: "address", internalType: "address" },
          { name: "to", type: "address", internalType: "address" },
          { name: "stable", type: "bool", internalType: "bool" },
          { name: "factory", type: "address", internalType: "address" },
        ],
      },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      { name: "permitDeadline", type: "uint256", internalType: "uint256" },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "amountOut", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "save",
    inputs: [
      { name: "builder", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "sharesOut", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "saveWithPermit",
    inputs: [
      { name: "builder", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "sharesOut", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "lock",
    inputs: [
      { name: "builder", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "lockDuration", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "lockId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  // Events
  {
    type: "event",
    name: "BuilderRegistered",
    inputs: [
      { name: "builder", type: "address", indexed: true, internalType: "address" },
      { name: "feeBps", type: "uint16", indexed: false, internalType: "uint16" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BuilderFeeChanged",
    inputs: [
      { name: "builder", type: "address", indexed: true, internalType: "address" },
      { name: "oldFeeBps", type: "uint16", indexed: false, internalType: "uint16" },
      { name: "newFeeBps", type: "uint16", indexed: false, internalType: "uint16" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BuilderActiveChanged",
    inputs: [
      { name: "builder", type: "address", indexed: true, internalType: "address" },
      { name: "active", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BuilderMetadataChanged",
    inputs: [
      { name: "builder", type: "address", indexed: true, internalType: "address" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BuilderApproved",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "builder", type: "address", indexed: true, internalType: "address" },
      { name: "maxFeeBps", type: "uint16", indexed: false, internalType: "uint16" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BuilderRevoked",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "builder", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Routed",
    inputs: [
      { name: "builder", type: "address", indexed: true, internalType: "address" },
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "action", type: "uint8", indexed: true, internalType: "enum FuseRouter.Action" },
      { name: "tokenIn", type: "address", indexed: false, internalType: "address" },
      { name: "amountIn", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "fee", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "tokenOut", type: "address", indexed: false, internalType: "address" },
      { name: "amountOut", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "lockId", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  // Custom Errors
  { type: "error", name: "Unauthorized", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "RouterPaused", inputs: [] },
  { type: "error", name: "Reentrancy", inputs: [] },
  { type: "error", name: "BuilderAlreadyRegistered", inputs: [] },
  { type: "error", name: "BuilderNotRegistered", inputs: [] },
  { type: "error", name: "BuilderNotActive", inputs: [] },
  {
    type: "error",
    name: "FeeAboveMaxCap",
    inputs: [
      { name: "feeBps", type: "uint16", internalType: "uint16" },
      { name: "maxCapBps", type: "uint16", internalType: "uint16" },
    ],
  },
  {
    type: "error",
    name: "BuilderNotApprovedByUser",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "builder", type: "address", internalType: "address" },
    ],
  },
  {
    type: "error",
    name: "FeeAboveUserApproval",
    inputs: [
      { name: "builderFeeBps", type: "uint16", internalType: "uint16" },
      { name: "userMaxFeeBps", type: "uint16", internalType: "uint16" },
    ],
  },
  {
    type: "error",
    name: "TokenNotAllowed",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
  },
  { type: "error", name: "EmptyRoutes", inputs: [] },
  {
    type: "error",
    name: "InvalidRouteStart",
    inputs: [
      { name: "routeFrom", type: "address", internalType: "address" },
      { name: "expectedTokenIn", type: "address", internalType: "address" },
    ],
  },
  {
    type: "error",
    name: "InvalidRouteFactory",
    inputs: [{ name: "routeFactory", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "InvalidLockDuration",
    inputs: [
      { name: "duration", type: "uint256", internalType: "uint256" },
      { name: "minDuration", type: "uint256", internalType: "uint256" },
      { name: "maxDuration", type: "uint256", internalType: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InsufficientOutputAmount",
    inputs: [
      { name: "amountOut", type: "uint256", internalType: "uint256" },
      { name: "amountOutMin", type: "uint256", internalType: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ResidualRouterBalance",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "residual", type: "uint256", internalType: "uint256" },
    ],
  },
  { type: "error", name: "TransferFailed", inputs: [] },
  { type: "error", name: "ApprovalFailed", inputs: [] },
] as const;

export const tigrisRouterAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    inputs: [
      { name: "amountIn", type: "uint256", internalType: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        internalType: "struct ITigrisRouter.Route[]",
        components: [
          { name: "from", type: "address", internalType: "address" },
          { name: "to", type: "address", internalType: "address" },
          { name: "stable", type: "bool", internalType: "bool" },
          { name: "factory", type: "address", internalType: "address" },
        ],
      },
    ],
    outputs: [{ name: "amounts", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
] as const;

export const erc20PermitAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nonces",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "permit",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const musdSavingsVaultAbi = [
  {
    type: "function",
    name: "previewDeposit",
    inputs: [{ name: "assets", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const veBtcAbi = [
  {
    type: "function",
    name: "createLockFor",
    inputs: [
      { name: "_value", type: "uint256", internalType: "uint256" },
      { name: "_lockDuration", type: "uint256", internalType: "uint256" },
      { name: "_to", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOfNFT",
    inputs: [{ name: "_tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "locked",
    inputs: [{ name: "_tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "amount", type: "int128", internalType: "int128" },
      { name: "end", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
] as const;

export const skipOracleAbi = [
  {
    type: "function",
    name: "latestRoundData",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80", internalType: "uint80" },
      { name: "answer", type: "int256", internalType: "int256" },
      { name: "startedAt", type: "uint256", internalType: "uint256" },
      { name: "updatedAt", type: "uint256", internalType: "uint256" },
      { name: "answeredInRound", type: "uint80", internalType: "uint80" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
] as const;
