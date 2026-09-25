// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrowEvents {
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        address arbitrator,
        address tokenAddress,
        uint256 totalAmount,
        uint256 milestoneCount,
        string agreementIpfsHash
    );

    event FundsDeposited(
        uint256 indexed escrowId,
        address indexed depositor,
        uint256 amount
    );

    event MilestoneSubmitted(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        string deliverableIpfsHash,
        uint256 submittedAt
    );

    event MilestoneApproved(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        uint256 netPayout,
        uint256 feeDeducted,
        uint256 approvedAt
    );

    event DisputeRaised(
        uint256 indexed escrowId,
        address indexed initiator,
        string reasonIpfsHash,
        uint256 raisedAt
    );

    event DisputeResolved(
        uint256 indexed escrowId,
        address indexed arbitrator,
        uint256 buyerAward,
        uint256 sellerAward,
        uint256 feeDeducted,
        string rulingIpfsHash,
        uint256 resolvedAt
    );

    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 refundAmount,
        string reason
    );

    event EscrowCompleted(
        uint256 indexed escrowId,
        uint256 completedAt
    );

    event ProtocolFeeUpdated(
        uint256 oldFeeBps,
        uint256 newFeeBps
    );

    event TreasuryAddressUpdated(
        address oldTreasury,
        address newTreasury
    );
}
