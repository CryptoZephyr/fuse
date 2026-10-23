// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "./helpers/TestBase.sol";
import {MockERC20Permit, MockTigrisRouter, MockMUSDSavingsVault, MockVeBTC} from "./helpers/Mocks.sol";
import {FuseRouter} from "../src/FuseRouter.sol";

contract FuseRouterFuzzTest is TestBase {
    FuseRouter internal router;
    MockTigrisRouter internal tigris;
    MockERC20Permit internal musd;
    MockERC20Permit internal btc;
    MockERC20Permit internal mezo;
    MockMUSDSavingsVault internal savingsVault;
    MockVeBTC internal veBTC;

    address internal constant POOL_FACTORY = address(0xFAc701);
    address internal constant USER = address(0xCAFE);
    address internal constant BUILDER = address(0xB001);

    function setUp() public {
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
    }

    /// @notice Fuzz test for fee math conservation (`fee + net == amount`), cap invariant (`fee <= amount * 50 / 10000`),
    ///         and zero residual router balance across arbitrary amounts and fees within the cap.
    function testFuzz_FeeMathConservationAndCap(uint256 amount, uint16 builderFeeBps, uint16 userMaxFeeBps) public {
        amount = bound(amount, 10_000, 100_000_000 ether);
        builderFeeBps = uint16(bound(uint256(builderFeeBps), 0, router.MAX_FEE_BPS()));
        userMaxFeeBps = uint16(bound(uint256(userMaxFeeBps), uint256(builderFeeBps), router.MAX_FEE_BPS()));

        vm.prank(BUILDER);
        router.registerBuilder(builderFeeBps, "ipfs://builder");

        (uint256 previewFee, uint256 previewNet) = router.calculateFee(BUILDER, amount);
        assertEq(previewFee + previewNet, amount, "fee + net must equal amount");
        assertLe(previewFee, (amount * uint256(router.MAX_FEE_BPS())) / 10_000, "fee must never exceed hard cap");

        musd.mint(USER, amount);
        vm.startPrank(USER);
        router.approveBuilder(BUILDER, userMaxFeeBps);
        musd.approve(address(router), amount);
        uint256 sharesOut = router.save(BUILDER, amount);
        vm.stopPrank();

        assertEq(sharesOut, previewNet, "sharesOut must equal net amount");
        assertEq(musd.balanceOf(BUILDER), previewFee, "builder balance must equal fee");
        assertEq(savingsVault.balanceOf(USER), previewNet, "user sMUSD balance must equal net");
        assertEq(musd.balanceOf(address(router)), 0, "router residual MUSD must be 0");
        assertEq(savingsVault.balanceOf(address(router)), 0, "router residual sMUSD must be 0");
    }

    /// @notice Fuzz test for approval semantics across random sequences of fee updates, approvals, and revocations.
    function testFuzz_ApprovalSemanticsAcrossSequences(
        uint16 fee1,
        uint16 fee2,
        uint16 approval1,
        uint16 approval2,
        bool revokeAfterFirst
    ) public {
        fee1 = uint16(bound(uint256(fee1), 0, router.MAX_FEE_BPS()));
        fee2 = uint16(bound(uint256(fee2), 0, router.MAX_FEE_BPS()));
        approval1 = uint16(bound(uint256(approval1), 0, router.MAX_FEE_BPS()));
        approval2 = uint16(bound(uint256(approval2), 0, router.MAX_FEE_BPS()));

        vm.prank(BUILDER);
        router.registerBuilder(fee1, "ipfs://builder");

        musd.mint(USER, 1_000 ether);
        vm.startPrank(USER);
        musd.approve(address(router), 1_000 ether);

        // Step 1: User approves `approval1`
        router.approveBuilder(BUILDER, approval1);
        if (fee1 <= approval1) {
            router.save(BUILDER, 100 ether);
        } else {
            vm.expectRevert(abi.encodeWithSelector(FuseRouter.FeeAboveUserApproval.selector, fee1, approval1));
            router.save(BUILDER, 100 ether);
        }
        vm.stopPrank();

        // Step 2: Builder changes fee to `fee2`
        vm.prank(BUILDER);
        router.setFee(fee2);

        // Step 3: Optional revoke or re-approval
        vm.startPrank(USER);
        if (revokeAfterFirst) {
            router.revokeBuilder(BUILDER);
            vm.expectRevert(abi.encodeWithSelector(FuseRouter.BuilderNotApprovedByUser.selector, USER, BUILDER));
            router.save(BUILDER, 100 ether);
        } else {
            router.approveBuilder(BUILDER, approval2);
            if (fee2 <= approval2) {
                router.save(BUILDER, 100 ether);
            } else {
                vm.expectRevert(abi.encodeWithSelector(FuseRouter.FeeAboveUserApproval.selector, fee2, approval2));
                router.save(BUILDER, 100 ether);
            }
        }
        vm.stopPrank();
    }

    /// @notice Fuzz test for VeBTC lock duration boundaries (`1 weeks <= duration <= 30 days`).
    function testFuzz_LockDurationBounds(uint256 duration) public {
        vm.prank(BUILDER);
        router.registerBuilder(10, "ipfs://builder");

        btc.mint(USER, 1 ether);
        vm.startPrank(USER);
        router.approveBuilder(BUILDER, 10);
        btc.approve(address(router), 1 ether);

        if (duration < 1 weeks || duration > 30 days) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    FuseRouter.InvalidLockDuration.selector, duration, uint256(1 weeks), uint256(30 days)
                )
            );
            router.lock(BUILDER, 0.1 ether, duration);
        } else {
            uint256 lockId = router.lock(BUILDER, 0.1 ether, duration);
            assertEq(lockId, 1, "valid duration should mint lockId 1");
            assertEq(veBTC.ownerOf(lockId), USER, "user must own minted veBTC");
        }
        vm.stopPrank();
    }
}
