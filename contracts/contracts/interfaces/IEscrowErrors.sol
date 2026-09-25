// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrowErrors {
    error BlockEscrow__ZeroAddress();
    error BlockEscrow__IdenticalParties();
    error BlockEscrow__InvalidAmount();
    error BlockEscrow__MilestoneSumMismatch(uint256 totalAmount, uint256 milestonesSum);
    error BlockEscrow__NoMilestones();
    error BlockEscrow__EscrowNotFound(uint256 escrowId);
    error BlockEscrow__InvalidEscrowStatus(uint8 currentStatus, uint8 requiredStatus);
    error BlockEscrow__UnauthorizedCaller(address caller);
    error BlockEscrow__InvalidMilestoneIndex(uint256 milestoneIndex);
    error BlockEscrow__MilestoneAlreadyProcessed(uint256 milestoneIndex);
    error BlockEscrow__MilestoneNotSubmitted(uint256 milestoneIndex);
    error BlockEscrow__InvalidSplitTotal(uint256 sum, uint256 remainingBalance);
    error BlockEscrow__ExcessiveFeeBasisPoints(uint256 feeBps, uint256 maxFeeBps);
    error BlockEscrow__TransferFailed();
    error BlockEscrow__InsufficientRemainingBalance(uint256 requested, uint256 available);
    error BlockEscrow__EmptyIpfsHash();
}
