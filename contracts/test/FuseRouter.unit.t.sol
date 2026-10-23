// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "./helpers/TestBase.sol";
import {
    MockERC20Permit,
    MockFeeOnTransferERC20,
    MockReentrantERC20,
    MockTigrisRouter,
    MockMUSDSavingsVault,
    MockVeBTC
} from "./helpers/Mocks.sol";
import {FuseRouter} from "../src/FuseRouter.sol";
import {ITigrisRouter} from "../src/interfaces/IMezo.sol";

contract FuseRouterUnitTest is TestBase {
    FuseRouter internal router;
    MockTigrisRouter internal tigris;
    MockERC20Permit internal musd;
    MockERC20Permit internal btc;
    MockERC20Permit internal mezo;
    MockMUSDSavingsVault internal savingsVault;
    MockVeBTC internal veBTC;

    address internal constant POOL_FACTORY = address(0xFAc701);
    address internal ownerAddr;

    uint256 internal constant USER_PK = 0xA11CE;
    address internal user;

    address internal constant BUILDER_A = address(0xB001);
    address internal constant BUILDER_ZERO = address(0xB000);

    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public {
        ownerAddr = address(this);
        user = vm.addr(USER_PK);

        tigris = new MockTigrisRouter();
        musd = new MockERC20Permit("Mezo USD", "MUSD");
        btc = new MockERC20Permit("Bitcoin", "BTC");
        mezo = new MockERC20Permit("Mezo", "MEZO");
        savingsVault = new MockMUSDSavingsVault(musd);
        veBTC = new MockVeBTC(address(btc));

        router = new FuseRouter(
            address(tigris),
            POOL_FACTORY,
            address(musd),
            address(btc),
            address(mezo),
            address(savingsVault),
            address(veBTC),
            30 days
        );

        // Mint initial balances to user
        btc.mint(user, 10 ether);
        musd.mint(user, 100_000 ether);
        mezo.mint(user, 50_000 ether);

        // Register BUILDER_A at 20 bps (0.20%) and BUILDER_ZERO at 0 bps
        vm.prank(BUILDER_A);
        router.registerBuilder(20, "https://builder-a.example/fuse.json");

        vm.prank(BUILDER_ZERO);
        router.registerBuilder(0, "https://builder-zero.example/fuse.json");
    }

    // -------------------------------------------------------------------------
    // 1. Builder Registry: Register, Change Fee, Metadata, Deactivate
    // -------------------------------------------------------------------------

    function test_BuilderRegistrationAndLifecycle() public {
        (uint16 feeBps, bool active, bool registered, string memory uri) = router.builders(BUILDER_A);
        assertEq(uint256(feeBps), 20, "feeBps mismatch");
        assertTrue(active, "builder should be active");
        assertTrue(registered, "builder should be registered");
        assertEq(uri, "https://builder-a.example/fuse.json", "metadataURI mismatch");

        // Duplicate registration reverts
        vm.prank(BUILDER_A);
        vm.expectRevert(FuseRouter.BuilderAlreadyRegistered.selector);
        router.registerBuilder(10, "dup");

        // Update fee
        vm.prank(BUILDER_A);
        router.setFee(35);
        (feeBps,,,) = router.builders(BUILDER_A);
        assertEq(uint256(feeBps), 35, "updated feeBps mismatch");

        // Update metadata
        vm.prank(BUILDER_A);
        router.setMetadataURI("https://builder-a.example/v2.json");
        (,,, uri) = router.builders(BUILDER_A);
        assertEq(uri, "https://builder-a.example/v2.json", "updated metadataURI mismatch");

        // Deactivate and reactivate
        vm.prank(BUILDER_A);
        router.setActive(false);
        (, active,,) = router.builders(BUILDER_A);
        assertFalse(active, "builder should be inactive");

        // Routing through inactive builder reverts
        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 50);
        musd.approve(address(router), 100 ether);
        vm.expectRevert(FuseRouter.BuilderNotActive.selector);
        router.save(BUILDER_A, 100 ether);
        vm.stopPrank();

        // Reactivate
        vm.prank(BUILDER_A);
        router.setActive(true);
        vm.prank(user);
        uint256 shares = router.save(BUILDER_A, 100 ether);
        assertGt(shares, 0, "save should succeed after reactivation");
    }

    function test_UnregisteredBuilderCallsRevert() public {
        address unregistered = address(0xDEAD);

        vm.prank(unregistered);
        vm.expectRevert(FuseRouter.BuilderNotRegistered.selector);
        router.setFee(10);

        vm.prank(unregistered);
        vm.expectRevert(FuseRouter.BuilderNotRegistered.selector);
        router.setActive(false);

        vm.prank(unregistered);
        vm.expectRevert(FuseRouter.BuilderNotRegistered.selector);
        router.setMetadataURI("uri");

        vm.prank(user);
        vm.expectRevert(FuseRouter.BuilderNotRegistered.selector);
        router.approveBuilder(unregistered, 10);
    }

    // -------------------------------------------------------------------------
    // 2. Hard Fee Cap (50 bps) & Per-User Approval Semantics (Including 0 bps)
    // -------------------------------------------------------------------------

    function test_FeeAboveHardCapReverts() public {
        address newBuilder = address(0xB999);
        vm.prank(newBuilder);
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.FeeAboveMaxCap.selector, uint16(51), uint16(50)));
        router.registerBuilder(51, "too-high");

        vm.prank(BUILDER_A);
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.FeeAboveMaxCap.selector, uint16(51), uint16(50)));
        router.setFee(51);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.FeeAboveMaxCap.selector, uint16(51), uint16(50)));
        router.approveBuilder(BUILDER_A, 51);
    }

    function test_ApproveAndRevoke_ZeroBpsDistinctFromNotApproved() public {
        // Initially not approved (approvals[user][BUILDER_ZERO] == 0)
        (bool approved, uint16 maxFee) = router.isBuilderApproved(user, BUILDER_ZERO);
        assertFalse(approved, "initially not approved");
        assertEq(uint256(maxFee), 0, "initial maxFee should be 0");

        // Even though BUILDER_ZERO charges 0 bps, routing without approval must revert!
        vm.startPrank(user);
        musd.approve(address(router), 50 ether);
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.BuilderNotApprovedByUser.selector, user, BUILDER_ZERO));
        router.save(BUILDER_ZERO, 50 ether);

        // Approve BUILDER_ZERO at 0 bps -> stored as 1 (maxFeeBps + 1)
        router.approveBuilder(BUILDER_ZERO, 0);
        assertEq(uint256(router.approvals(user, BUILDER_ZERO)), 1, "raw storage should be 1");
        (approved, maxFee) = router.isBuilderApproved(user, BUILDER_ZERO);
        assertTrue(approved, "should be approved at 0 bps");
        assertEq(uint256(maxFee), 0, "approved maxFee should be 0 bps");

        // Zero-fee save succeeds and emits Routed with fee = 0
        uint256 shares = router.save(BUILDER_ZERO, 50 ether);
        assertEq(shares, 50 ether, "zero-fee save should deposit full amount");
        assertEq(savingsVault.balanceOf(user), 50 ether, "user should receive 50 sMUSD");
        assertEq(musd.balanceOf(BUILDER_ZERO), 0, "zero-fee builder gets 0 fee");

        // Revoke BUILDER_ZERO -> back to 0 (not approved)
        router.revokeBuilder(BUILDER_ZERO);
        (approved,) = router.isBuilderApproved(user, BUILDER_ZERO);
        assertFalse(approved, "should not be approved after revoke");

        musd.approve(address(router), 50 ether);
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.BuilderNotApprovedByUser.selector, user, BUILDER_ZERO));
        router.save(BUILDER_ZERO, 50 ether);
        vm.stopPrank();
    }

    function test_FeeIncreaseAboveUserApprovalRevertsUntilReapproved() public {
        // User approves BUILDER_A up to 20 bps
        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 20);
        musd.approve(address(router), 200 ether);
        router.save(BUILDER_A, 100 ether);
        vm.stopPrank();

        // BUILDER_A increases fee from 20 bps to 30 bps
        vm.prank(BUILDER_A);
        router.setFee(30);

        // User's next action reverts with FeeAboveUserApproval(30, 20)
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.FeeAboveUserApproval.selector, uint16(30), uint16(20)));
        router.save(BUILDER_A, 100 ether);

        // User explicitly approves 30 bps -> action now succeeds
        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 30);
        uint256 shares = router.save(BUILDER_A, 100 ether);
        vm.stopPrank();

        assertEq(shares, 99.7 ether, "net shares after 30 bps fee");
    }

    // -------------------------------------------------------------------------
    // 3. Pause Semantics: Blocks Actions, Never Blocks Revoking
    // -------------------------------------------------------------------------

    function test_PausedRouterBlocksActionsButAllowsRevoke() public {
        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 50);
        btc.approve(address(router), 1 ether);
        musd.approve(address(router), 100 ether);
        vm.stopPrank();

        // Non-owner cannot pause
        vm.prank(user);
        vm.expectRevert(FuseRouter.Unauthorized.selector);
        router.pause();

        // Owner pauses router
        router.pause();
        assertTrue(router.paused(), "router should be paused");

        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: address(btc), to: address(musd), stable: false, factory: POOL_FACTORY});

        vm.startPrank(user);
        vm.expectRevert(FuseRouter.RouterPaused.selector);
        router.swap(BUILDER_A, 0.1 ether, 1 ether, routes, block.timestamp + 600);

        vm.expectRevert(FuseRouter.RouterPaused.selector);
        router.save(BUILDER_A, 10 ether);

        vm.expectRevert(FuseRouter.RouterPaused.selector);
        router.lock(BUILDER_A, 0.1 ether, 2 weeks);

        // CRITICAL: revokeBuilder MUST still succeed while paused!
        router.revokeBuilder(BUILDER_A);
        (bool approved,) = router.isBuilderApproved(user, BUILDER_A);
        assertFalse(approved, "user must be able to revoke while paused");
        vm.stopPrank();

        // Unpause restores routing
        router.unpause();
        assertFalse(router.paused(), "router should be unpaused");
    }

    // -------------------------------------------------------------------------
    // 4. Swap Action: Happy Path, Events, Route & Allowlist Validation
    // -------------------------------------------------------------------------

    function test_SwapHappyPath_FeePaidAndZeroResidual() public {
        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: address(btc), to: address(musd), stable: false, factory: POOL_FACTORY});

        uint256 amountIn = 1 ether; // 1 BTC
        uint256 expectedFee = 0.002 ether; // 20 bps = 0.002 BTC
        uint256 expectedNet = 0.998 ether;
        uint256 expectedOut = expectedNet * 80_000; // 79,840 MUSD

        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 25);
        btc.approve(address(router), amountIn);

        uint256 userMusdBefore = musd.balanceOf(user);

        vm.expectEmit(true, true, true, true, address(router));
        emit FuseRouter.Routed(
            BUILDER_A, user, FuseRouter.Action.Swap, address(btc), amountIn, expectedFee, address(musd), expectedOut, 0
        );

        uint256 amountOut = router.swap(BUILDER_A, amountIn, expectedOut, routes, block.timestamp + 600);
        vm.stopPrank();

        assertEq(amountOut, expectedOut, "swap amountOut mismatch");
        assertEq(btc.balanceOf(BUILDER_A), expectedFee, "builder BTC fee mismatch");
        assertEq(musd.balanceOf(user) - userMusdBefore, expectedOut, "user MUSD increase mismatch");
        assertEq(btc.balanceOf(address(router)), 0, "router residual BTC must be 0");
        assertEq(musd.balanceOf(address(router)), 0, "router residual MUSD must be 0");
        assertEq(btc.allowance(address(router), address(tigris)), 0, "tigris allowance must reset to 0");
    }

    function test_SwapInputAllowlistAndRouteValidation() public {
        MockERC20Permit unlisted = new MockERC20Permit("Unlisted", "UNL");
        unlisted.mint(user, 100 ether);

        ITigrisRouter.Route[] memory emptyRoutes = new ITigrisRouter.Route[](0);

        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 50);

        // Empty routes revert
        vm.expectRevert(FuseRouter.EmptyRoutes.selector);
        router.swap(BUILDER_A, 1 ether, 0, emptyRoutes, block.timestamp + 600);

        // Disallowed input token reverts
        ITigrisRouter.Route[] memory badTokenRoutes = new ITigrisRouter.Route[](1);
        badTokenRoutes[0] =
            ITigrisRouter.Route({from: address(unlisted), to: address(musd), stable: false, factory: POOL_FACTORY});
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.TokenNotAllowed.selector, address(unlisted)));
        router.swap(BUILDER_A, 1 ether, 0, badTokenRoutes, block.timestamp + 600);

        // Invalid factory reverts
        ITigrisRouter.Route[] memory badFactoryRoutes = new ITigrisRouter.Route[](1);
        badFactoryRoutes[0] =
            ITigrisRouter.Route({from: address(btc), to: address(musd), stable: false, factory: address(0xBAD)});
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.InvalidRouteFactory.selector, address(0xBAD)));
        router.swap(BUILDER_A, 1 ether, 0, badFactoryRoutes, block.timestamp + 600);

        // Disconnected multi-hop route reverts
        ITigrisRouter.Route[] memory disconnectedRoutes = new ITigrisRouter.Route[](2);
        disconnectedRoutes[0] =
            ITigrisRouter.Route({from: address(btc), to: address(musd), stable: false, factory: POOL_FACTORY});
        disconnectedRoutes[1] = ITigrisRouter.Route({
            from: address(btc), // should be musd!
            to: address(mezo),
            stable: false,
            factory: POOL_FACTORY
        });
        vm.expectRevert(abi.encodeWithSelector(FuseRouter.InvalidRouteStart.selector, address(btc), address(musd)));
        router.swap(BUILDER_A, 1 ether, 0, disconnectedRoutes, block.timestamp + 600);
        vm.stopPrank();
    }

    function test_FeeOnTransferTokenRejected() public {
        MockFeeOnTransferERC20 taxToken = new MockFeeOnTransferERC20();
        router.setAllowedInput(address(taxToken), true);
        taxToken.mint(user, 100 ether);

        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] =
            ITigrisRouter.Route({from: address(taxToken), to: address(musd), stable: false, factory: POOL_FACTORY});

        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 50);
        taxToken.approve(address(router), 100 ether);
        vm.expectRevert(FuseRouter.TransferFailed.selector);
        router.swap(BUILDER_A, 100 ether, 0, routes, block.timestamp + 600);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // 5. Save & Permit Variants: Valid Permit, Expired Permit, Replayed Permit
    // -------------------------------------------------------------------------

    function test_SaveAndSwapWithPermit_ValidExpiredAndReplayedSignatures() public {
        uint256 amount = 500 ether;
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(user);
        router.approveBuilder(BUILDER_A, 20);

        // Sign valid permit for 500 MUSD
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(musd, USER_PK, user, address(router), amount, deadline);

        uint256 expectedFee = 1 ether; // 20 bps of 500 = 1 MUSD
        uint256 expectedShares = 499 ether;

        vm.expectEmit(true, true, true, true, address(router));
        emit FuseRouter.Routed(
            BUILDER_A,
            user,
            FuseRouter.Action.Save,
            address(musd),
            amount,
            expectedFee,
            address(savingsVault),
            expectedShares,
            0
        );

        vm.prank(user);
        uint256 sharesOut = router.saveWithPermit(BUILDER_A, amount, deadline, v, r, s);

        assertEq(sharesOut, expectedShares, "sharesOut mismatch");
        assertEq(savingsVault.balanceOf(user), expectedShares, "user sMUSD balance mismatch");
        assertEq(musd.balanceOf(BUILDER_A), expectedFee, "builder MUSD fee mismatch");
        assertEq(musd.balanceOf(address(router)), 0, "router residual MUSD must be 0");
        assertEq(savingsVault.balanceOf(address(router)), 0, "router residual sMUSD must be 0");
        assertEq(musd.allowance(address(router), address(savingsVault)), 0, "vault allowance must reset to 0");

        // Replaying the same signature (nonce already incremented) must revert!
        vm.prank(user);
        vm.expectRevert(MockERC20Permit.InvalidSignature.selector);
        router.saveWithPermit(BUILDER_A, amount, deadline, v, r, s);

        // Expired permit signature must revert!
        uint256 expiredDeadline = block.timestamp - 1;
        (uint8 vExp, bytes32 rExp, bytes32 sExp) =
            _signPermit(musd, USER_PK, user, address(router), amount, expiredDeadline);
        vm.prank(user);
        vm.expectRevert(MockERC20Permit.PermitExpired.selector);
        router.saveWithPermit(BUILDER_A, amount, expiredDeadline, vExp, rExp, sExp);

        // Now test swapWithPermit (MUSD -> BTC)
        tigris.setRate(1, 80_000); // 80,000 MUSD -> 1 BTC
        uint256 swapAmount = 800 ether;
        (uint8 vSwap, bytes32 rSwap, bytes32 sSwap) =
            _signPermit(musd, USER_PK, user, address(router), swapAmount, deadline);

        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: address(musd), to: address(btc), stable: false, factory: POOL_FACTORY});

        uint256 userBtcBefore = btc.balanceOf(user);
        vm.prank(user);
        uint256 btcOut =
            router.swapWithPermit(BUILDER_A, swapAmount, 0.009 ether, routes, deadline, deadline, vSwap, rSwap, sSwap);
        assertGt(btcOut, 0.009 ether, "swapWithPermit btcOut");
        assertEq(btc.balanceOf(user) - userBtcBefore, btcOut, "user BTC balance increase");
    }

    // -------------------------------------------------------------------------
    // 6. Lock Action: Mints veBTC NFT to User & Enforces Testnet Lock Bounds
    // -------------------------------------------------------------------------

    function test_LockMintsVeBTCAndEnforcesDurationLimits() public {
        uint256 lockAmount = 0.5 ether;
        uint256 expectedFee = 0.001 ether; // 20 bps of 0.5 BTC
        uint256 expectedNet = 0.499 ether;
        uint256 duration = 2 weeks;

        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 20);
        btc.approve(address(router), 2 ether);

        // Duration < 1 week reverts with InvalidLockDuration
        vm.expectRevert(
            abi.encodeWithSelector(
                FuseRouter.InvalidLockDuration.selector, uint256(6 days), uint256(1 weeks), uint256(30 days)
            )
        );
        router.lock(BUILDER_A, lockAmount, 6 days);

        // Duration > 30 days reverts with InvalidLockDuration
        vm.expectRevert(
            abi.encodeWithSelector(
                FuseRouter.InvalidLockDuration.selector, uint256(31 days), uint256(1 weeks), uint256(30 days)
            )
        );
        router.lock(BUILDER_A, lockAmount, 31 days);

        // Valid 2-week lock succeeds and mints NFT to user
        vm.expectEmit(true, true, true, true, address(router));
        emit FuseRouter.Routed(
            BUILDER_A,
            user,
            FuseRouter.Action.Lock,
            address(btc),
            lockAmount,
            expectedFee,
            address(veBTC),
            expectedNet,
            1
        );

        uint256 lockId = router.lock(BUILDER_A, lockAmount, duration);
        vm.stopPrank();

        assertEq(lockId, 1, "lockId should be 1");
        assertEq(veBTC.ownerOf(lockId), user, "veBTC NFT must belong to user");
        assertEq(veBTC.lockedAmount(lockId), expectedNet, "locked BTC must equal net amount");
        assertEq(btc.balanceOf(BUILDER_A), expectedFee, "builder BTC fee mismatch");
        assertEq(btc.balanceOf(address(router)), 0, "router residual BTC must be 0");
        assertEq(btc.allowance(address(router), address(veBTC)), 0, "veBTC allowance must reset to 0");
    }

    // -------------------------------------------------------------------------
    // 7. Reentrancy Guard Verification
    // -------------------------------------------------------------------------

    function test_ReentrancyGuardBlocksCallbackAttack() public {
        MockReentrantERC20 malToken = new MockReentrantERC20(router, BUILDER_A);
        router.setAllowedInput(address(malToken), true);
        malToken.mint(user, 10 ether);
        malToken.armAttack(true);

        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] =
            ITigrisRouter.Route({from: address(malToken), to: address(musd), stable: false, factory: POOL_FACTORY});

        vm.startPrank(user);
        router.approveBuilder(BUILDER_A, 50);
        malToken.approve(address(router), 10 ether);
        musd.approve(address(router), 10 ether);

        vm.expectRevert(FuseRouter.Reentrancy.selector);
        router.swap(BUILDER_A, 1 ether, 0, routes, block.timestamp + 600);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _signPermit(
        MockERC20Permit token,
        uint256 pk,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        uint256 nonce = token.nonces(owner);
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }
}
