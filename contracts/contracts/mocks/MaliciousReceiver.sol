// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IBlockEscrow.sol";

contract MaliciousReceiver {
    IBlockEscrow public target;
    uint256 public attackEscrowId;
    bool public shouldAttack;
    bool public attackSucceeded;
    bytes public attackRevertData;

    constructor(address _target) {
        target = IBlockEscrow(_target);
    }

    function setAttackParams(uint256 _escrowId) external {
        attackEscrowId = _escrowId;
        shouldAttack = true;
        attackSucceeded = false;
    }

    receive() external payable {
        if (shouldAttack) {
            shouldAttack = false;
            // Attempt reentrant call to refundEscrow while approveMilestone is still executing
            (bool success, bytes memory data) = address(target).call(
                abi.encodeWithSelector(IBlockEscrow.refundEscrow.selector, attackEscrowId, "reentrancy")
            );
            attackSucceeded = success;
            attackRevertData = data;
        }
    }
}
