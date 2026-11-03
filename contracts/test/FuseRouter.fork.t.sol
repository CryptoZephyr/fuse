// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MezoForkTestBase} from "./helpers/MezoForkTestBase.sol";
import {FuseRouter} from "../src/FuseRouter.sol";
import {MezoTestnetAddresses} from "../src/MezoTestnetAddresses.sol";
import {IERC20, ITigrisRouter, IVeBTC, ISkipOracle} from "../src/interfaces/IMezo.sol";

/// @title FuseRouterForkTest
/// @notice Fork test suite against live Mezo Testnet (`https://rpc.test.mezo.org`, Chain ID 31611)
///         exercising the real Tigris Router, MUSD, MUSDSavingsRate (`sMUSD`), and VeBTC contracts.
contract FuseRouterForkTest is MezoForkTestBase {
    FuseRouter internal router;

    uint256 internal constant USER_PK = 0xB0B12345;
    address internal user;

    address internal constant BUILDER_PAID = address(0xB111);
    address internal constant BUILDER_FREE = address(0xB000);

    function setUp() public {
        _setupMezoPrecompileShims();

        user = vm.addr(USER_PK);
        _mintTestnetBTC(user, 1 ether);

        router = new FuseRouter(
            address(this),
            MezoTestnetAddresses.TIGRIS_ROUTER,
            MezoTestnetAddresses.POOL_FACTORY,
            MezoTestnetAddresses.MUSD,
            MezoTestnetAddresses.BTC,
            MezoTestnetAddresses.MEZO,
            MezoTestnetAddresses.MUSD_SAVINGS_VAULT,
            MezoTestnetAddresses.VEBTC,
            MezoTestnetAddresses.TESTNET_MAX_LOCK_DURATION
        );

        vm.prank(BUILDER_PAID);
        router.registerBuilder(15, "https://paid-builder.example/metadata.json"); // 15 bps (0.15%)

        vm.prank(BUILDER_FREE);
        router.registerBuilder(0, "https://free-builder.example/metadata.json"); // 0 bps attribution mode
    }

    function testFork_EndToEnd_SwapSavePermitAndLockOnMezoTestnet() public {
        // 0. Verify Skip Oracle shim & VeBTC testnet storage slot 82 (maxLockTime == 30 days)
        (, int256 btcUsdPrice,,,) = ISkipOracle(MezoTestnetAddresses.SKIP_BTC_USD_ORACLE).latestRoundData();
        assertGt(uint256(btcUsdPrice), 0, "Skip oracle price should be positive");

        uint256 onchainMaxLock = uint256(vm.load(MezoTestnetAddresses.VEBTC, bytes32(uint256(82))));
        assertEq(
            onchainMaxLock,
            MezoTestnetAddresses.TESTNET_MAX_LOCK_DURATION,
            "VeBTC slot 82 maxLockTime should be 30 days on Mezo testnet"
        );

        // 1. User approves BUILDER_PAID up to 20 bps
        vm.startPrank(user);
        router.approveBuilder(BUILDER_PAID, 20);

        // 2. Swap 0.01 BTC -> MUSD through real Tigris Router
        uint256 swapBtcIn = 0.01 ether;
        IERC20(MezoTestnetAddresses.BTC).approve(address(router), swapBtcIn);

        ITigrisRouter.Route[] memory btcToMusdRoutes = new ITigrisRouter.Route[](1);
        btcToMusdRoutes[0] = ITigrisRouter.Route({
            from: MezoTestnetAddresses.BTC,
            to: MezoTestnetAddresses.MUSD,
            stable: false,
            factory: MezoTestnetAddresses.POOL_FACTORY
        });

        (uint256 expectedBtcFee, uint256 netBtcSwap) = router.calculateFee(BUILDER_PAID, swapBtcIn);
        uint256[] memory quotedOut =
            ITigrisRouter(MezoTestnetAddresses.TIGRIS_ROUTER).getAmountsOut(netBtcSwap, btcToMusdRoutes);

        uint256 musdOut =
            router.swap(BUILDER_PAID, swapBtcIn, (quotedOut[1] * 99) / 100, btcToMusdRoutes, block.timestamp + 600);
        vm.stopPrank();

        assertEq(musdOut, quotedOut[1], "MUSD received should match Tigris quote for netBtcSwap");
        assertEq(
            IERC20(MezoTestnetAddresses.BTC).balanceOf(BUILDER_PAID),
            expectedBtcFee,
            "Builder should receive 15 bps BTC fee"
        );
        assertEq(IERC20(MezoTestnetAddresses.MUSD).balanceOf(user), musdOut, "User should hold swapped MUSD");

        // 3. Save 100 MUSD using EIP-2612 Permit (`saveWithPermit`) — EVM Wallet Path
        uint256 saveAmount = 100 ether;
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signMusdPermit(USER_PK, user, address(router), saveAmount, deadline);

        vm.prank(user);
        uint256 sharesFromPermit = router.saveWithPermit(BUILDER_PAID, saveAmount, deadline, v, r, s);

        (uint256 expectedMusdFee, uint256 expectedNetMusd) = router.calculateFee(BUILDER_PAID, saveAmount);
        assertEq(sharesFromPermit, expectedNetMusd, "sMUSD from saveWithPermit should equal net MUSD");
        assertEq(
            IERC20(MezoTestnetAddresses.MUSD_SAVINGS_VAULT).balanceOf(user),
            expectedNetMusd,
            "User sMUSD balance should equal net MUSD"
        );
        assertEq(
            IERC20(MezoTestnetAddresses.MUSD).balanceOf(BUILDER_PAID),
            expectedMusdFee,
            "Builder should receive 15 bps MUSD fee"
        );

        // 4. Save 50 MUSD using Standard `approve` + `save` — Bitcoin Wallet (OrangeKit Safe) Fallback Path
        uint256 fallbackSaveAmount = 50 ether;
        vm.startPrank(user);
        IERC20(MezoTestnetAddresses.MUSD).approve(address(router), fallbackSaveAmount);
        uint256 sharesFromStandardSave = router.save(BUILDER_PAID, fallbackSaveAmount);
        vm.stopPrank();

        (, uint256 expectedFallbackNet) = router.calculateFee(BUILDER_PAID, fallbackSaveAmount);
        assertEq(sharesFromStandardSave, expectedFallbackNet, "sMUSD from standard save should equal net MUSD");

        // 5. Swap 50 MUSD -> BTC using `swapWithPermit`
        uint256 swapMusdIn = 50 ether;
        (uint8 vSwap, bytes32 rSwap, bytes32 sSwap) =
            _signMusdPermit(USER_PK, user, address(router), swapMusdIn, deadline);

        ITigrisRouter.Route[] memory musdToBtcRoutes = new ITigrisRouter.Route[](1);
        musdToBtcRoutes[0] = ITigrisRouter.Route({
            from: MezoTestnetAddresses.MUSD,
            to: MezoTestnetAddresses.BTC,
            stable: false,
            factory: MezoTestnetAddresses.POOL_FACTORY
        });

        uint256 userBtcBefore = IERC20(MezoTestnetAddresses.BTC).balanceOf(user);
        vm.prank(user);
        uint256 btcReceived = router.swapWithPermit(
            BUILDER_PAID, swapMusdIn, 1, musdToBtcRoutes, deadline, deadline, vSwap, rSwap, sSwap
        );
        assertGt(btcReceived, 0, "User should receive BTC from swapWithPermit");
        assertEq(
            IERC20(MezoTestnetAddresses.BTC).balanceOf(user) - userBtcBefore,
            btcReceived,
            "User BTC balance increase should match btcReceived"
        );

        // 6. Lock 0.005 BTC into real VeBTC (`createLockFor`) for 2 weeks & 30 days (max)
        uint256 lockBtcIn = 0.005 ether;
        vm.startPrank(user);
        IERC20(MezoTestnetAddresses.BTC).approve(address(router), lockBtcIn * 2);

        uint256 lockId2Weeks = router.lock(BUILDER_PAID, lockBtcIn, 2 weeks);
        assertEq(IVeBTC(MezoTestnetAddresses.VEBTC).ownerOf(lockId2Weeks), user, "User must own the 2-week veBTC NFT");

        // Also test locking at the exact 30-day testnet maximum
        uint256 lockIdMax = router.lock(BUILDER_PAID, lockBtcIn, 30 days);
        assertEq(IVeBTC(MezoTestnetAddresses.VEBTC).ownerOf(lockIdMax), user, "User must own the 30-day max veBTC NFT");

        // 7. Zero-fee builder attribution (0 bps) on real Mezo contracts
        router.approveBuilder(BUILDER_FREE, 0);
        IERC20(MezoTestnetAddresses.MUSD).approve(address(router), 10 ether);
        uint256 zeroFeeShares = router.save(BUILDER_FREE, 10 ether);
        vm.stopPrank();

        assertEq(zeroFeeShares, 10 ether, "Zero-fee builder save should yield 100% shares");
        assertEq(IERC20(MezoTestnetAddresses.MUSD).balanceOf(BUILDER_FREE), 0, "Zero-fee builder receives 0 fee");
    }
}
