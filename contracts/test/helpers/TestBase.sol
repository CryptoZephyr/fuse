// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function etch(address target, bytes calldata newRuntimeBytecode) external;
    function load(address target, bytes32 slot) external view returns (bytes32 data);
    function store(address target, bytes32 slot, bytes32 value) external;
    function warp(uint256 newTimestamp) external;
    function sign(uint256 privateKey, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external pure returns (address keyAddr);
    function expectRevert(bytes calldata revertData) external;
    function expectRevert(bytes4 revertSelector) external;
    function expectRevert() external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData, address emitter) external;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    error AssertionFailed(string message);

    function assertTrue(bool condition, string memory message) internal pure {
        if (!condition) revert AssertionFailed(message);
    }

    function assertFalse(bool condition, string memory message) internal pure {
        if (condition) revert AssertionFailed(message);
    }

    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        if (a != b) revert AssertionFailed(message);
    }

    function assertEq(address a, address b, string memory message) internal pure {
        if (a != b) revert AssertionFailed(message);
    }

    function assertEq(bool a, bool b, string memory message) internal pure {
        if (a != b) revert AssertionFailed(message);
    }

    function assertEq(string memory a, string memory b, string memory message) internal pure {
        if (keccak256(bytes(a)) != keccak256(bytes(b))) revert AssertionFailed(message);
    }

    function assertGt(uint256 a, uint256 b, string memory message) internal pure {
        if (a <= b) revert AssertionFailed(message);
    }

    function assertGe(uint256 a, uint256 b, string memory message) internal pure {
        if (a < b) revert AssertionFailed(message);
    }

    function assertLe(uint256 a, uint256 b, string memory message) internal pure {
        if (a > b) revert AssertionFailed(message);
    }

    function bound(uint256 x, uint256 min, uint256 max) internal pure returns (uint256 result) {
        if (min > max) revert AssertionFailed("bound: min > max");
        if (x >= min && x <= max) return x;
        uint256 size = max - min + 1;
        if (size == 0) return x;
        return min + (x % size);
    }
}
