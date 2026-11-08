// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, IERC20Permit, ITigrisRouter, IMUSDSavingsVault, IVeBTC} from "../../src/interfaces/IMezo.sol";
import {FuseRouter} from "../../src/FuseRouter.sol";

contract MockERC20Permit is IERC20, IERC20Permit {
    string public name;
    string public symbol;
    uint8 public constant override decimals = 18;
    uint256 public override totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    mapping(address => uint256) public override nonces;

    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    error PermitExpired();
    error InvalidSignature();

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external virtual override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "INSUFFICIENT_BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external virtual override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "INSUFFICIENT_ALLOWANCE");
        require(balanceOf[from] >= amount, "INSUFFICIENT_BALANCE");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        override
    {
        if (block.timestamp > deadline) revert PermitExpired();
        uint256 currentNonce = nonces[owner]++;
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, currentNonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0) || recovered != owner) revert InvalidSignature();
        allowance[owner][spender] = value;
    }
}

    /// @notice Token that deducts a 1% tax on `transferFrom` to verify `FuseRouter` rejects fee-on-transfer inputs.
    contract MockFeeOnTransferERC20 is MockERC20Permit {
        constructor() MockERC20Permit("Tax Token", "TAX") {}

        function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
            uint256 allowed = allowance[from][msg.sender];
            require(allowed >= amount, "INSUFFICIENT_ALLOWANCE");
            require(balanceOf[from] >= amount, "INSUFFICIENT_BALANCE");
            allowance[from][msg.sender] = allowed - amount;
            uint256 tax = amount / 100;
            uint256 net = amount - tax;
            balanceOf[from] -= amount;
            balanceOf[to] += net;
            totalSupply -= tax;
            return true;
        }
    }

    /// @notice Malicious token that attempts to re-enter `FuseRouter` during `transferFrom`.
    contract MockReentrantERC20 is MockERC20Permit {
        FuseRouter public targetRouter;
        address public builder;
        bool public attackArmed;

        constructor(FuseRouter _router, address _builder) MockERC20Permit("Reentrant", "REENT") {
            targetRouter = _router;
            builder = _builder;
        }

        function armAttack(bool armed) external {
            attackArmed = armed;
        }

        function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
            if (attackArmed) {
                attackArmed = false;
                // Attempt to re-enter FuseRouter.save while inside FuseRouter.swap / save
                targetRouter.save(builder, 1 ether);
            }
            uint256 allowed = allowance[from][msg.sender];
            require(allowed >= amount, "INSUFFICIENT_ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
            return true;
        }
    }

    /// @notice Mock Tigris Router with configurable exchange rate (`rateNumerator / rateDenominator`).
    contract MockTigrisRouter is ITigrisRouter {
        uint256 public rateNumerator = 80_000;
        uint256 public rateDenominator = 1;

        error DeadlineExpired();
        error InsufficientOutput();

        function setRate(uint256 _num, uint256 _den) external {
            rateNumerator = _num;
            rateDenominator = _den;
        }

        function getReserves(address, address, bool, address)
            external
            pure
            override
            returns (uint256 reserveA, uint256 reserveB)
        {
            return (10 ether, 800_000 ether);
        }

        function getAmountsOut(uint256 amountIn, Route[] calldata routes)
            public
            view
            override
            returns (uint256[] memory amounts)
        {
            amounts = new uint256[](routes.length + 1);
            amounts[0] = amountIn;
            uint256 running = amountIn;
            for (uint256 i = 0; i < routes.length; ++i) {
                running = (running * rateNumerator) / rateDenominator;
                amounts[i + 1] = running;
            }
        }

        function swapExactTokensForTokens(
            uint256 amountIn,
            uint256 amountOutMin,
            Route[] calldata routes,
            address to,
            uint256 deadline
        ) external override returns (uint256[] memory amounts) {
            if (block.timestamp > deadline) revert DeadlineExpired();
            amounts = getAmountsOut(amountIn, routes);
            uint256 finalOut = amounts[amounts.length - 1];
            if (finalOut < amountOutMin) revert InsufficientOutput();

            address tokenIn = routes[0].from;
            address tokenOut = routes[routes.length - 1].to;

            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
            MockERC20Permit(tokenOut).mint(to, finalOut);
        }
    }

    /// @notice Mock MUSD Savings Vault (`MUSDSavingsRate` behavior: mints transferable `sMUSD` 1:1 to caller).
    contract MockMUSDSavingsVault is MockERC20Permit, IMUSDSavingsVault {
        IERC20 public immutable asset;

        constructor(IERC20 _asset) MockERC20Permit("Staked Mezo USD", "sMUSD") {
            asset = _asset;
        }

        function deposit(uint256 amount) external override {
            asset.transferFrom(msg.sender, address(this), amount);
            balanceOf[msg.sender] += amount;
            totalSupply += amount;
        }

        function withdraw(uint256 shares) external override {
            require(balanceOf[msg.sender] >= shares, "INSUFFICIENT_SHARES");
            balanceOf[msg.sender] -= shares;
            totalSupply -= shares;
            asset.transfer(msg.sender, shares);
        }
    }

    /// @notice Mock VeBTC enforcing Mezo's weekly epoch rounding and `maxLockTime`.
    contract MockVeBTC is IVeBTC {
        address public immutable override token;
        uint256 public constant WEEK = 1 weeks;
        uint256 public maxLockTime = 30 days;
        uint256 public nextTokenId = 1;

        mapping(uint256 => address) public override ownerOf;
        mapping(uint256 => uint256) public lockedAmount;
        mapping(uint256 => uint256) public unlockTimestamp;

        error LockDurationNotInFuture();
        error LockDurationTooLong();

        constructor(address _token) {
            token = _token;
        }

        function createLockFor(uint256 value, uint256 lockDuration, address to)
            external
            override
            returns (uint256 tokenId)
        {
            uint256 unlockTime = ((block.timestamp + lockDuration) / WEEK) * WEEK;
            if (unlockTime <= block.timestamp) revert LockDurationNotInFuture();
            if (unlockTime > block.timestamp + maxLockTime) revert LockDurationTooLong();

            IERC20(token).transferFrom(msg.sender, address(this), value);

            tokenId = nextTokenId++;
            ownerOf[tokenId] = to;
            lockedAmount[tokenId] = value;
            unlockTimestamp[tokenId] = unlockTime;
        }
    }
