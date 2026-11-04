// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MezoTestnetAddresses
/// @notice Verified Mezo Testnet (Chain ID 31611) protocol addresses.
library MezoTestnetAddresses {
    uint256 internal constant CHAIN_ID = 31611;

    address internal constant TIGRIS_ROUTER = 0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9;
    address internal constant POOL_FACTORY = 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A;
    address internal constant MUSD_BTC_POOL = 0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9;
    address internal constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address internal constant BTC = 0x7b7C000000000000000000000000000000000000;
    address internal constant MEZO = 0x7B7c000000000000000000000000000000000001;
    address internal constant MUSD_SAVINGS_VAULT = 0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16;
    address internal constant VEBTC = 0xB63fcCd03521Cf21907627bd7fA465C129479231;
    address internal constant SKIP_BTC_USD_ORACLE = 0x7b7c000000000000000000000000000000000015;

    /// @notice Testnet VeBTC `maxLockTime` (storage slot 82) is 30 days (2,592,000 seconds).
    uint256 internal constant TESTNET_MAX_LOCK_DURATION = 30 days;

    /// @notice Current FuseRouter deployment on Mezo Testnet.
    address internal constant FUSE_ROUTER = 0xF1E6021db0345b03055a76c8E1dAa0CC270f6DC4;
    uint256 internal constant FUSE_ROUTER_DEPLOY_BLOCK = 16_569_522;
    address internal constant LEGACY_FUSE_ROUTER = 0x37Bb02d6FF0080E85eccEee881a068A4b2bE81e1;
    uint256 internal constant LEGACY_FUSE_ROUTER_DEPLOY_BLOCK = 16_328_764;
}
