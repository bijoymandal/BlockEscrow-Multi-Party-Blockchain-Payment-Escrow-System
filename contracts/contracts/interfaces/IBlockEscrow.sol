// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IEscrowEvents.sol";
import "./IEscrowErrors.sol";
import "../storage/EscrowStorage.sol";

interface IBlockEscrow is IEscrowEvents, IEscrowErrors {
    function createEscrow(
        address seller,
        address arbitrator,
        address tokenAddress,
        uint256 totalAmount,
        EscrowStorage.MilestoneInput[] calldata milestones,
        string calldata agreementIpfsHash
    ) external returns (uint256 escrowId);

    function fundEscrow(uint256 escrowId) external payable;

    function createAndFundEscrow(
        address seller,
        address arbitrator,
        address tokenAddress,
        uint256 totalAmount,
        EscrowStorage.MilestoneInput[] calldata milestones,
        string calldata agreementIpfsHash
    ) external payable returns (uint256 escrowId);

    function submitMilestone(
        uint256 escrowId,
        uint256 milestoneIndex,
        string calldata deliverableIpfsHash
    ) external;

    function approveMilestone(
        uint256 escrowId,
        uint256 milestoneIndex
    ) external;

    function raiseDispute(
        uint256 escrowId,
        string calldata reasonIpfsHash
    ) external;

    function resolveDispute(
        uint256 escrowId,
        uint256 buyerAward,
        uint256 sellerAward,
        string calldata rulingIpfsHash
    ) external;

    function refundEscrow(
        uint256 escrowId,
        string calldata reason
    ) external;

    function getEscrow(uint256 escrowId) external view returns (EscrowStorage.Escrow memory);
    function getMilestone(uint256 escrowId, uint256 milestoneIndex) external view returns (EscrowStorage.Milestone memory);
    function getDispute(uint256 escrowId) external view returns (EscrowStorage.Dispute memory);
    function getEscrowStatus(uint256 escrowId) external view returns (EscrowStorage.EscrowStatus);
}
