// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "./TestBase.sol";
import {IERC20, IERC20Permit, ITigrisRouter, ISkipOracle} from "../../src/interfaces/IMezo.sol";
import {MezoTestnetAddresses} from "../../src/MezoTestnetAddresses.sol";

/// @notice ERC-20 shim etched onto Mezo's BTC precompile (`0x7b7C000000000000000000000000000000000000`)
///         during local Foundry fork tests so `revm` does not infinitely recurse on the precompile wrapper bytecode.
contract PrecompileBTCShim is IERC20 {
    string public constant name = "Bitcoin";
    string public constant symbol = "BTC";
    uint8 public constant override decimals = 18;
    uint256 public override totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "BTC_INSUFFICIENT_BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "BTC_INSUFFICIENT_ALLOWANCE");
        require(balanceOf[from] >= amount, "BTC_INSUFFICIENT_BALANCE");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

    /// @notice Skip Oracle shim etched onto `0x7b7c000000000000000000000000000000000015` during local Foundry fork tests.
    contract PrecompileSkipOracleShim is ISkipOracle {
        uint8 public constant override decimals = 8;

        function latestRoundData()
            external
            view
            override
            returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
        {
            return (1, 8085462672000, block.timestamp, block.timestamp, 1);
        }
    }

    /// @title MezoForkTestBase
    /// @notice Shared base contract for Mezo Testnet (`31611`) fork tests implementing the T0 Finding 3 decision.
    abstract contract MezoForkTestBase is TestBase {
        bytes32 internal constant PERMIT_TYPEHASH =
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

        function _setupMezoPrecompileShims() internal {
            PrecompileBTCShim btcShimTemplate = new PrecompileBTCShim();
            vm.etch(MezoTestnetAddresses.BTC, address(btcShimTemplate).code);

            // Dynamically query the live MUSD/BTC pool's BTC reserve at the forked block and seed the shim
            (uint256 btcReserve,) = ITigrisRouter(MezoTestnetAddresses.TIGRIS_ROUTER)
                .getReserves(
                    MezoTestnetAddresses.BTC, MezoTestnetAddresses.MUSD, false, MezoTestnetAddresses.POOL_FACTORY
                );
            PrecompileBTCShim(MezoTestnetAddresses.BTC).mint(MezoTestnetAddresses.MUSD_BTC_POOL, btcReserve);

            PrecompileSkipOracleShim oracleShimTemplate = new PrecompileSkipOracleShim();
            vm.etch(MezoTestnetAddresses.SKIP_BTC_USD_ORACLE, address(oracleShimTemplate).code);
        }

        function _mintTestnetBTC(address to, uint256 amount) internal {
            PrecompileBTCShim(MezoTestnetAddresses.BTC).mint(to, amount);
        }

        function _signMusdPermit(
            uint256 ownerPrivateKey,
            address owner,
            address spender,
            uint256 value,
            uint256 deadline
        ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
            IERC20Permit musdPermit = IERC20Permit(MezoTestnetAddresses.MUSD);
            uint256 nonce = musdPermit.nonces(owner);
            bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", musdPermit.DOMAIN_SEPARATOR(), structHash));
            (v, r, s) = vm.sign(ownerPrivateKey, digest);
        }
    }
