// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract EscrowStorage {
    enum EscrowStatus {
        DRAFT,
        FUNDED,
        IN_PROGRESS,
        COMPLETED,
        DISPUTED,
        RESOLVED,
        REFUNDED,
        CANCELLED
    }

    enum MilestoneStatus {
        PENDING,
        SUBMITTED,
        APPROVED,
        DISPUTED
    }

    struct Milestone {
        string title;
        uint256 amount;
        uint256 deadline;
        MilestoneStatus status;
        string deliverableIpfsHash;
        uint256 submittedAt;
        uint256 approvedAt;
    }

    struct MilestoneInput {
        string title;
        uint256 amount;
        uint256 deadline;
    }

    struct Escrow {
        uint256 escrowId;
        address buyer;
        address seller;
        address arbitrator;
        address tokenAddress; // address(0) for native ETH/MATIC
        uint256 totalAmount;
        uint256 remainingBalance;
        uint256 feeBasisPoints;
        EscrowStatus status;
        string agreementIpfsHash;
        uint256 createdAt;
        uint256 milestoneCount;
        uint256 approvedMilestoneCount;
    }

    struct Dispute {
        uint256 escrowId;
        address initiator;
        string reasonIpfsHash;
        uint256 buyerAward;
        uint256 sellerAward;
        bool isResolved;
        string rulingIpfsHash;
        uint256 resolvedAt;
    }

    // --- State Variables ---
    uint256 public nextEscrowId;
    address public treasury;
    uint256 public feeBasisPoints; // Default platform fee, e.g. 50 = 0.5%
    uint256 public constant MAX_FEE_BPS = 500; // 5.0% maximum cap
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Escrow ID => Escrow details
    mapping(uint256 => Escrow) internal _escrows;
    // Escrow ID => Milestone index => Milestone details
    mapping(uint256 => mapping(uint256 => Milestone)) internal _milestones;
    // Escrow ID => Dispute details
    mapping(uint256 => Dispute) internal _disputes;

    // Storage gap for upgradeability safety
    uint256[45] private __gap;
}
