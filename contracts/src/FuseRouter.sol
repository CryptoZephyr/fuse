// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, IERC20Permit, ITigrisRouter, IMUSDSavingsVault, IVeBTC} from "./interfaces/IMezo.sol";

/// @title FuseRouter
/// @notice Non-custodial builder code registry, per-user fee approval guard, and action router
///         for Mezo's core products: Tigris DEX swaps, MUSD Savings Vault deposits, and VeBTC locks.
/// @dev Single non-upgradeable contract. All Mezo protocol addresses are immutable.
///      Fees are capped by `MAX_FEE_BPS` (50 bps) and by each user's explicit per-builder approval.
///      The router never holds user funds or builder fees across transactions.
contract FuseRouter {
    // -------------------------------------------------------------------------
    // Constants & Immutables
    // -------------------------------------------------------------------------

    /// @notice Hard protocol cap on builder fees in basis points (50 bps = 0.50%).
    uint16 public constant MAX_FEE_BPS = 50;

    /// @notice Basis points denominator (100% = 10,000 bps).
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice VeBTC epoch rounding unit (1 week = 604,800 seconds).
    uint256 public constant MIN_LOCK_DURATION = 1 weeks;

    /// @notice Maximum allowed lock duration (30 days = 2,592,000s on Mezo testnet; 4 years on mainnet).
    uint256 public immutable maxLockDuration;

    /// @notice Admin address restricted solely to pausing new actions and managing `allowedInput`.
    address public immutable owner;

    /// @notice Mezo Tigris Router contract.
    address public immutable tigrisRouter;

    /// @notice Mezo Tigris PoolFactory contract.
    address public immutable poolFactory;

    /// @notice Mezo USD (MUSD) ERC-20 token (supports EIP-2612 permit).
    address public immutable musd;

    /// @notice Mezo BTC ERC-20 precompile (`0x7b7C000000000000000000000000000000000000`).
    address public immutable btc;

    /// @notice MEZO ERC-20 precompile (`0x7B7c000000000000000000000000000000000001`).
    address public immutable mezoToken;

    /// @notice MUSD Savings Vault (`MUSDSavingsRate` proxy, `sMUSD` token).
    address public immutable savingsVault;

    /// @notice Mezo VotingEscrow BTC (`VeBTC` proxy).
    address public immutable veBTC;

    // -------------------------------------------------------------------------
    // Types & State
    // -------------------------------------------------------------------------

    /// @notice Supported routed actions emitted in `Routed`.
    enum Action {
        Swap,
        Save,
        Lock
    }

    /// @notice Builder metadata and fee configuration.
    struct Builder {
        uint16 feeBps;
        bool active;
        bool registered;
        string metadataURI;
    }

    /// @notice Registered builders keyed by payout/builder address.
    mapping(address => Builder) public builders;

    /// @notice Per-user builder fee approvals stored as `maxFeeBps + 1`.
    /// @dev `0` means not approved; `1` means approved at 0 bps; `n + 1` means approved up to `n` bps.
    mapping(address => mapping(address => uint16)) public approvals;

    /// @notice Allowlisted swap input tokens (BTC, MUSD, MEZO at launch).
    mapping(address => bool) public allowedInput;

    /// @notice Emergency pause flag. Blocks new routed actions, but never blocks `revokeBuilder`.
    bool public paused;

    /// @dev Reentrancy guard state (`1` = unlocked, `2` = locked).
    uint256 private _locked = 1;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event BuilderRegistered(address indexed builder, uint16 feeBps, string metadataURI);
    event BuilderFeeChanged(address indexed builder, uint16 oldFeeBps, uint16 newFeeBps);
    event BuilderActiveChanged(address indexed builder, bool active);
    event BuilderMetadataChanged(address indexed builder, string metadataURI);
    event BuilderApproved(address indexed user, address indexed builder, uint16 maxFeeBps);
    event BuilderRevoked(address indexed user, address indexed builder);
    event AllowedInputUpdated(address indexed token, bool allowed);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    event Routed(
        address indexed builder,
        address indexed user,
        Action indexed action,
        address tokenIn,
        uint256 amountIn,
        uint256 fee,
        address tokenOut,
        uint256 amountOut,
        uint256 lockId
    );

    // -------------------------------------------------------------------------
    // Custom Errors
    // -------------------------------------------------------------------------

    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error RouterPaused();
    error Reentrancy();
    error BuilderAlreadyRegistered();
    error BuilderNotRegistered();
    error BuilderNotActive();
    error FeeAboveMaxCap(uint16 feeBps, uint16 maxCapBps);
    error BuilderNotApprovedByUser(address user, address builder);
    error FeeAboveUserApproval(uint16 builderFeeBps, uint16 userMaxFeeBps);
    error TokenNotAllowed(address token);
    error EmptyRoutes();
    error InvalidRouteStart(address routeFrom, address expectedTokenIn);
    error InvalidRouteFactory(address routeFactory);
    error InvalidLockDuration(uint256 duration, uint256 minDuration, uint256 maxDuration);
    error InsufficientOutputAmount(uint256 amountOut, uint256 amountOutMin);
    error ResidualRouterBalance(address token, uint256 residual);
    error TransferFailed();
    error ApprovalFailed();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert RouterPaused();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _tigrisRouter,
        address _poolFactory,
        address _musd,
        address _btc,
        address _mezoToken,
        address _savingsVault,
        address _veBTC,
        uint256 _maxLockDuration
    ) {
        if (
            _tigrisRouter == address(0) || _poolFactory == address(0) || _musd == address(0) || _btc == address(0)
                || _savingsVault == address(0) || _veBTC == address(0)
        ) revert ZeroAddress();
        if (_maxLockDuration < MIN_LOCK_DURATION) {
            revert InvalidLockDuration(_maxLockDuration, MIN_LOCK_DURATION, type(uint256).max);
        }

        owner = msg.sender;
        tigrisRouter = _tigrisRouter;
        poolFactory = _poolFactory;
        musd = _musd;
        btc = _btc;
        mezoToken = _mezoToken;
        savingsVault = _savingsVault;
        veBTC = _veBTC;
        maxLockDuration = _maxLockDuration;

        allowedInput[_btc] = true;
        allowedInput[_musd] = true;
        if (_mezoToken != address(0)) {
            allowedInput[_mezoToken] = true;
        }
    }

    // -------------------------------------------------------------------------
    // Builder Registry (R1, R2)
    // -------------------------------------------------------------------------

    /// @notice Register the caller (`msg.sender`) as a builder with a fee in bps and metadata link.
    function registerBuilder(uint16 feeBps, string calldata metadataURI) external {
        if (builders[msg.sender].registered) revert BuilderAlreadyRegistered();
        if (feeBps > MAX_FEE_BPS) revert FeeAboveMaxCap(feeBps, MAX_FEE_BPS);

        builders[msg.sender] = Builder({feeBps: feeBps, active: true, registered: true, metadataURI: metadataURI});

        emit BuilderRegistered(msg.sender, feeBps, metadataURI);
    }

    /// @notice Update the caller's builder fee in basis points.
    /// @dev Any fee increase above a user's previously approved maximum will cause actions for that
    ///      user to revert until the user explicitly approves the higher fee.
    function setFee(uint16 newFeeBps) external {
        Builder storage b = builders[msg.sender];
        if (!b.registered) revert BuilderNotRegistered();
        if (newFeeBps > MAX_FEE_BPS) revert FeeAboveMaxCap(newFeeBps, MAX_FEE_BPS);

        uint16 oldFeeBps = b.feeBps;
        b.feeBps = newFeeBps;

        emit BuilderFeeChanged(msg.sender, oldFeeBps, newFeeBps);
    }

    /// @notice Activate or deactivate the caller's builder registration.
    function setActive(bool active) external {
        Builder storage b = builders[msg.sender];
        if (!b.registered) revert BuilderNotRegistered();

        b.active = active;
        emit BuilderActiveChanged(msg.sender, active);
    }

    /// @notice Update the caller's builder metadata URI.
    function setMetadataURI(string calldata metadataURI) external {
        Builder storage b = builders[msg.sender];
        if (!b.registered) revert BuilderNotRegistered();

        b.metadataURI = metadataURI;
        emit BuilderMetadataChanged(msg.sender, metadataURI);
    }

    // -------------------------------------------------------------------------
    // Per-User Builder Fee Approvals (R3, R12)
    // -------------------------------------------------------------------------

    /// @notice Approve a registered builder up to `maxFeeBps` (where `0` bps is valid for zero-fee attribution).
    function approveBuilder(address builder, uint16 maxFeeBps) external {
        if (builder == address(0)) revert ZeroAddress();
        if (!builders[builder].registered) revert BuilderNotRegistered();
        if (maxFeeBps > MAX_FEE_BPS) revert FeeAboveMaxCap(maxFeeBps, MAX_FEE_BPS);

        approvals[msg.sender][builder] = maxFeeBps + 1;
        emit BuilderApproved(msg.sender, builder, maxFeeBps);
    }

    /// @notice Revoke a previously granted builder approval at any time (works even when paused).
    function revokeBuilder(address builder) external {
        if (builder == address(0)) revert ZeroAddress();

        approvals[msg.sender][builder] = 0;
        emit BuilderRevoked(msg.sender, builder);
    }

    // -------------------------------------------------------------------------
    // Routed Action 1: Swap via Tigris DEX (R4, R7, R12, R13)
    // -------------------------------------------------------------------------

    /// @notice Swap an allowlisted input token through Tigris, paying the approved builder fee from input
    ///         and sending the output tokens straight to `msg.sender`.
    function swap(
        address builder,
        uint256 amountIn,
        uint256 amountOutMin,
        ITigrisRouter.Route[] calldata routes,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        return _swap(builder, amountIn, amountOutMin, routes, deadline);
    }

    /// @notice Single-transaction MUSD swap using an EIP-2612 MUSD `permit` signature (for EVM wallets).
    function swapWithPermit(
        address builder,
        uint256 amountIn,
        uint256 amountOutMin,
        ITigrisRouter.Route[] calldata routes,
        uint256 deadline,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        if (routes.length == 0) revert EmptyRoutes();
        if (routes[0].from != musd) revert InvalidRouteStart(routes[0].from, musd);

        IERC20Permit(musd).permit(msg.sender, address(this), amountIn, permitDeadline, v, r, s);
        return _swap(builder, amountIn, amountOutMin, routes, deadline);
    }

    function _swap(
        address builder,
        uint256 amountIn,
        uint256 amountOutMin,
        ITigrisRouter.Route[] calldata routes,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        if (routes.length == 0) revert EmptyRoutes();

        address tokenIn = routes[0].from;
        if (!allowedInput[tokenIn]) revert TokenNotAllowed(tokenIn);

        uint256 routeLen = routes.length;
        for (uint256 i = 0; i < routeLen; ++i) {
            address routeFactory = routes[i].factory;
            if (routeFactory != address(0) && routeFactory != poolFactory) {
                revert InvalidRouteFactory(routeFactory);
            }
            if (i > 0 && routes[i].from != routes[i - 1].to) {
                revert InvalidRouteStart(routes[i].from, routes[i - 1].to);
            }
        }
        address tokenOut = routes[routeLen - 1].to;

        (uint256 fee, uint256 netAmount) = _validateAndCalculateFee(msg.sender, builder, amountIn);

        uint256 routerTokenInBefore = IERC20(tokenIn).balanceOf(address(this));
        _pullExactTokens(tokenIn, msg.sender, amountIn, routerTokenInBefore);

        if (fee > 0) {
            _safeTransfer(tokenIn, builder, fee);
        }

        uint256 userTokenOutBefore = IERC20(tokenOut).balanceOf(msg.sender);

        _safeApprove(tokenIn, tigrisRouter, netAmount);
        ITigrisRouter(tigrisRouter).swapExactTokensForTokens(netAmount, amountOutMin, routes, msg.sender, deadline);
        _safeApprove(tokenIn, tigrisRouter, 0);

        uint256 userTokenOutAfter = IERC20(tokenOut).balanceOf(msg.sender);
        amountOut = userTokenOutAfter - userTokenOutBefore;
        if (amountOut < amountOutMin) {
            revert InsufficientOutputAmount(amountOut, amountOutMin);
        }

        uint256 routerTokenInAfter = IERC20(tokenIn).balanceOf(address(this));
        if (routerTokenInAfter != routerTokenInBefore) {
            revert ResidualRouterBalance(tokenIn, routerTokenInAfter - routerTokenInBefore);
        }

        emit Routed(builder, msg.sender, Action.Swap, tokenIn, amountIn, fee, tokenOut, amountOut, 0);
    }

    // -------------------------------------------------------------------------
    // Routed Action 2: Save MUSD in MUSD Savings Vault (R5, R7, R12, R13)
    // -------------------------------------------------------------------------

    /// @notice Deposit MUSD into the MUSD Savings Vault using standard ERC-20 approval
    ///         (used by Bitcoin wallets connected via Mezo Passport OrangeKit Safe or pre-approved EVM wallets).
    function save(address builder, uint256 amount) external nonReentrant whenNotPaused returns (uint256 sharesOut) {
        return _save(builder, amount);
    }

    /// @notice Deposit MUSD into the MUSD Savings Vault using an EIP-2612 MUSD `permit` signature
    ///         in a single transaction without a prior `approve` transaction.
    function saveWithPermit(address builder, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 sharesOut)
    {
        IERC20Permit(musd).permit(msg.sender, address(this), amount, deadline, v, r, s);
        return _save(builder, amount);
    }

    function _save(address builder, uint256 amount) internal returns (uint256 sharesOut) {
        (uint256 fee, uint256 netAmount) = _validateAndCalculateFee(msg.sender, builder, amount);

        uint256 routerMusdBefore = IERC20(musd).balanceOf(address(this));
        uint256 routerSMusdBefore = IERC20(savingsVault).balanceOf(address(this));

        _pullExactTokens(musd, msg.sender, amount, routerMusdBefore);

        if (fee > 0) {
            _safeTransfer(musd, builder, fee);
        }

        _safeApprove(musd, savingsVault, netAmount);
        IMUSDSavingsVault(savingsVault).deposit(netAmount);
        _safeApprove(musd, savingsVault, 0);

        uint256 routerSMusdMid = IERC20(savingsVault).balanceOf(address(this));
        sharesOut = routerSMusdMid - routerSMusdBefore;
        if (sharesOut == 0) revert ZeroAmount();

        _safeTransfer(savingsVault, msg.sender, sharesOut);

        uint256 routerMusdAfter = IERC20(musd).balanceOf(address(this));
        if (routerMusdAfter != routerMusdBefore) {
            revert ResidualRouterBalance(musd, routerMusdAfter - routerMusdBefore);
        }
        uint256 routerSMusdAfter = IERC20(savingsVault).balanceOf(address(this));
        if (routerSMusdAfter != routerSMusdBefore) {
            revert ResidualRouterBalance(savingsVault, routerSMusdAfter - routerSMusdBefore);
        }

        emit Routed(builder, msg.sender, Action.Save, musd, amount, fee, savingsVault, sharesOut, 0);
    }

    // -------------------------------------------------------------------------
    // Routed Action 3: Lock BTC in VeBTC (R6, R7, R12)
    // -------------------------------------------------------------------------

    /// @notice Lock BTC into Mezo's VeBTC contract via `createLockFor`, paying the builder fee in BTC
    ///         and minting the `veBTC` NFT directly to `msg.sender`.
    function lock(address builder, uint256 amount, uint256 lockDuration)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 lockId)
    {
        if (lockDuration < MIN_LOCK_DURATION || lockDuration > maxLockDuration) {
            revert InvalidLockDuration(lockDuration, MIN_LOCK_DURATION, maxLockDuration);
        }

        (uint256 fee, uint256 netAmount) = _validateAndCalculateFee(msg.sender, builder, amount);

        uint256 routerBtcBefore = IERC20(btc).balanceOf(address(this));
        _pullExactTokens(btc, msg.sender, amount, routerBtcBefore);

        if (fee > 0) {
            _safeTransfer(btc, builder, fee);
        }

        _safeApprove(btc, veBTC, netAmount);
        lockId = IVeBTC(veBTC).createLockFor(netAmount, lockDuration, msg.sender);
        _safeApprove(btc, veBTC, 0);

        uint256 routerBtcAfter = IERC20(btc).balanceOf(address(this));
        if (routerBtcAfter != routerBtcBefore) {
            revert ResidualRouterBalance(btc, routerBtcAfter - routerBtcBefore);
        }

        emit Routed(builder, msg.sender, Action.Lock, btc, amount, fee, veBTC, netAmount, lockId);
    }

    // -------------------------------------------------------------------------
    // Admin Controls (Pause & Swap Input Allowlist Only)
    // -------------------------------------------------------------------------

    /// @notice Pause new routed actions (`swap`, `save`, `lock`). Does not block `revokeBuilder`.
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Unpause routed actions.
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Add or remove a token from the swap input allowlist.
    function setAllowedInput(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        allowedInput[token] = allowed;
        emit AllowedInputUpdated(token, allowed);
    }

    // -------------------------------------------------------------------------
    // Read / Quote Helpers
    // -------------------------------------------------------------------------

    /// @notice Returns whether `user` has approved `builder` and the approved maximum fee in bps.
    function isBuilderApproved(address user, address builder) external view returns (bool approved, uint16 maxFeeBps) {
        uint16 raw = approvals[user][builder];
        if (raw == 0) {
            return (false, 0);
        }
        return (true, raw - 1);
    }

    /// @notice Computes the builder fee and net amount for `amount` given `builder`'s current fee.
    function calculateFee(address builder, uint256 amount) external view returns (uint256 fee, uint256 netAmount) {
        Builder storage b = builders[builder];
        if (!b.registered) revert BuilderNotRegistered();
        fee = (amount * uint256(b.feeBps)) / BPS_DENOMINATOR;
        netAmount = amount - fee;
    }

    /// @notice Previews the Thursday 00:00 UTC epoch-rounded unlock timestamp used by `VeBTC`.
    function previewUnlockTime(uint256 lockDuration) external view returns (uint256 unlockTime) {
        unlockTime = ((block.timestamp + lockDuration) / MIN_LOCK_DURATION) * MIN_LOCK_DURATION;
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    function _validateAndCalculateFee(address user, address builder, uint256 amount)
        internal
        view
        returns (uint256 fee, uint256 netAmount)
    {
        if (amount == 0) revert ZeroAmount();

        Builder storage b = builders[builder];
        if (!b.registered) revert BuilderNotRegistered();
        if (!b.active) revert BuilderNotActive();

        uint16 rawApproval = approvals[user][builder];
        if (rawApproval == 0) revert BuilderNotApprovedByUser(user, builder);

        uint16 userMaxFeeBps = rawApproval - 1;
        uint16 builderFeeBps = b.feeBps;

        if (builderFeeBps > MAX_FEE_BPS) revert FeeAboveMaxCap(builderFeeBps, MAX_FEE_BPS);
        if (builderFeeBps > userMaxFeeBps) {
            revert FeeAboveUserApproval(builderFeeBps, userMaxFeeBps);
        }

        fee = (amount * uint256(builderFeeBps)) / BPS_DENOMINATOR;
        netAmount = amount - fee;
        if (netAmount == 0) revert ZeroAmount();
    }

    function _pullExactTokens(address token, address from, uint256 amount, uint256 balanceBefore) internal {
        _safeTransferFrom(token, from, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert TransferFailed();
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!success) {
            if (data.length >= 4 && bytes4(data) == Reentrancy.selector) revert Reentrancy();
            revert TransferFailed();
        }
        if (data.length != 0 && !abi.decode(data, (bool))) {
            revert TransferFailed();
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!success) {
            if (data.length >= 4 && bytes4(data) == Reentrancy.selector) revert Reentrancy();
            revert TransferFailed();
        }
        if (data.length != 0 && !abi.decode(data, (bool))) {
            revert TransferFailed();
        }
    }

    function _safeApprove(address token, address spender, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
        if (!success) {
            if (data.length >= 4 && bytes4(data) == Reentrancy.selector) revert Reentrancy();
            revert ApprovalFailed();
        }
        if (data.length != 0 && !abi.decode(data, (bool))) {
            revert ApprovalFailed();
        }
    }
}
