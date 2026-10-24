// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FuseRouter} from "../src/FuseRouter.sol";
import {MezoTestnetAddresses} from "../src/MezoTestnetAddresses.sol";

interface VmScript {
    function envUint(string calldata name) external view returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @title DeployFuseRouter
/// @notice Foundry deployment script for `FuseRouter` on Mezo Testnet (Chain ID 31611).
contract DeployFuseRouter {
    VmScript internal constant vm = VmScript(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external returns (FuseRouter router) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        router = new FuseRouter(
            MezoTestnetAddresses.TIGRIS_ROUTER,
            MezoTestnetAddresses.POOL_FACTORY,
            MezoTestnetAddresses.MUSD,
            MezoTestnetAddresses.BTC,
            MezoTestnetAddresses.MEZO,
            MezoTestnetAddresses.MUSD_SAVINGS_VAULT,
            MezoTestnetAddresses.VEBTC,
            MezoTestnetAddresses.TESTNET_MAX_LOCK_DURATION
        );

        vm.stopBroadcast();
    }
}
