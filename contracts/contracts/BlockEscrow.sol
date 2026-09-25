// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IBlockEscrow.sol";
import "./storage/EscrowStorage.sol";

/**
 * @title BlockEscrow
 * @notice Production-grade non-custodial multi-party escrow protocol with milestone payouts and arbitration.
 * @dev Inherits OpenZeppelin v5 Upgradeable contracts. Implements UUPS proxy pattern.
 */
contract BlockEscrow is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    EscrowStorage,
    IBlockEscrow
{
    using SafeERC20 for IERC20;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the upgradeable contract.
     * @param initialOwner Address of the contract owner (admin/governance).
     * @param initialTreasury Address that receives protocol platform fees.
     * @param initialFeeBps Protocol fee in basis points (e.g. 50 = 0.5%).
     */
    function initialize(
        address initialOwner,
        address initialTreasury,
        uint256 initialFeeBps
    ) external initializer {
        if (initialOwner == address(0) || initialTreasury == address(0)) {
            revert BlockEscrow__ZeroAddress();
        }
        if (initialFeeBps > MAX_FEE_BPS) {
            revert BlockEscrow__ExcessiveFeeBasisPoints(initialFeeBps, MAX_FEE_BPS);
        }

        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();

        treasury = initialTreasury;
        feeBasisPoints = initialFeeBps;
        nextEscrowId = 1;
    }

    // =========================================================================
    // Core Escrow Lifecycle
    // =========================================================================

    /**
     * @notice Creates an escrow agreement off-chain metadata pointer without locking funds immediately.
     */
    function createEscrow(
        address seller,
        address arbitrator,
        address tokenAddress,
        uint256 totalAmount,
        MilestoneInput[] calldata milestones,
        string calldata agreementIpfsHash
    ) external override whenNotPaused returns (uint256 escrowId) {
        escrowId = _createEscrowInternal(
            msg.sender,
            seller,
            arbitrator,
            tokenAddress,
            totalAmount,
            milestones,
            agreementIpfsHash
        );
    }

    /**
     * @notice Funds a previously created escrow in DRAFT status.
     * @param escrowId The ID of the escrow to fund.
     */
    function fundEscrow(uint256 escrowId) public payable override nonReentrant whenNotPaused {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.escrowId == 0) revert BlockEscrow__EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.DRAFT) {
            revert BlockEscrow__InvalidEscrowStatus(uint8(escrow.status), uint8(EscrowStatus.DRAFT));
        }
        if (msg.sender != escrow.buyer) revert BlockEscrow__UnauthorizedCaller(msg.sender);

        _depositFundsInternal(escrow);
    }

    /**
     * @notice Atomically creates and funds an escrow in a single transaction.
     */
    function createAndFundEscrow(
        address seller,
        address arbitrator,
        address tokenAddress,
        uint256 totalAmount,
        MilestoneInput[] calldata milestones,
        string calldata agreementIpfsHash
    ) external payable override nonReentrant whenNotPaused returns (uint256 escrowId) {
        escrowId = _createEscrowInternal(
            msg.sender,
            seller,
            arbitrator,
            tokenAddress,
            totalAmount,
            milestones,
            agreementIpfsHash
        );

        Escrow storage escrow = _escrows[escrowId];
        _depositFundsInternal(escrow);
    }

    /**
     * @notice Seller submits deliverables for a specific milestone.
     */
    function submitMilestone(
        uint256 escrowId,
        uint256 milestoneIndex,
        string calldata deliverableIpfsHash
    ) external override whenNotPaused {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.escrowId == 0) revert BlockEscrow__EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.FUNDED && escrow.status != EscrowStatus.IN_PROGRESS) {
            revert BlockEscrow__InvalidEscrowStatus(uint8(escrow.status), uint8(EscrowStatus.FUNDED));
        }
        if (msg.sender != escrow.seller) revert BlockEscrow__UnauthorizedCaller(msg.sender);
        if (milestoneIndex >= escrow.milestoneCount) revert BlockEscrow__InvalidMilestoneIndex(milestoneIndex);
        if (bytes(deliverableIpfsHash).length == 0) revert BlockEscrow__EmptyIpfsHash();

        Milestone storage milestone = _milestones[escrowId][milestoneIndex];
        if (milestone.status != MilestoneStatus.PENDING) {
            revert BlockEscrow__MilestoneAlreadyProcessed(milestoneIndex);
        }

        milestone.status = MilestoneStatus.SUBMITTED;
        milestone.deliverableIpfsHash = deliverableIpfsHash;
        milestone.submittedAt = block.timestamp;

        if (escrow.status == EscrowStatus.FUNDED) {
            escrow.status = EscrowStatus.IN_PROGRESS;
        }

        emit MilestoneSubmitted(escrowId, milestoneIndex, deliverableIpfsHash, block.timestamp);
    }

    /**
     * @notice Buyer approves submitted milestone and releases payment to the seller.
     */
    function approveMilestone(
        uint256 escrowId,
        uint256 milestoneIndex
    ) external override nonReentrant whenNotPaused {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.escrowId == 0) revert BlockEscrow__EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.FUNDED && escrow.status != EscrowStatus.IN_PROGRESS) {
            revert BlockEscrow__InvalidEscrowStatus(uint8(escrow.status), uint8(EscrowStatus.IN_PROGRESS));
        }
        if (msg.sender != escrow.buyer) revert BlockEscrow__UnauthorizedCaller(msg.sender);
        if (milestoneIndex >= escrow.milestoneCount) revert BlockEscrow__InvalidMilestoneIndex(milestoneIndex);

        Milestone storage milestone = _milestones[escrowId][milestoneIndex];
        if (milestone.status != MilestoneStatus.SUBMITTED) {
            revert BlockEscrow__MilestoneNotSubmitted(milestoneIndex);
        }

        uint256 milestoneAmount = milestone.amount;
        if (milestoneAmount > escrow.remainingBalance) {
            revert BlockEscrow__InsufficientRemainingBalance(milestoneAmount, escrow.remainingBalance);
        }

        // Checks-Effects
        milestone.status = MilestoneStatus.APPROVED;
        milestone.approvedAt = block.timestamp;
        escrow.remainingBalance -= milestoneAmount;
        escrow.approvedMilestoneCount += 1;

        uint256 feeDeducted = (milestoneAmount * escrow.feeBasisPoints) / BPS_DENOMINATOR;
        uint256 netPayout = milestoneAmount - feeDeducted;

        bool isFullyCompleted = (escrow.approvedMilestoneCount == escrow.milestoneCount);
        if (isFullyCompleted) {
            escrow.status = EscrowStatus.COMPLETED;
            emit EscrowCompleted(escrowId, block.timestamp);
        }

        // Interactions
        _transferOut(escrow.tokenAddress, escrow.seller, netPayout);
        if (feeDeducted > 0) {
            _transferOut(escrow.tokenAddress, treasury, feeDeducted);
        }

        emit MilestoneApproved(escrowId, milestoneIndex, netPayout, feeDeducted, block.timestamp);
    }

    // =========================================================================
    // Dispute & Arbitration Resolution
    // =========================================================================

    /**
     * @notice Buyer or seller raises a dispute on an active escrow.
     */
    function raiseDispute(
        uint256 escrowId,
        string calldata reasonIpfsHash
    ) external override whenNotPaused {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.escrowId == 0) revert BlockEscrow__EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.FUNDED && escrow.status != EscrowStatus.IN_PROGRESS) {
            revert BlockEscrow__InvalidEscrowStatus(uint8(escrow.status), uint8(EscrowStatus.FUNDED));
        }
        if (msg.sender != escrow.buyer && msg.sender != escrow.seller) {
            revert BlockEscrow__UnauthorizedCaller(msg.sender);
        }
        if (bytes(reasonIpfsHash).length == 0) revert BlockEscrow__EmptyIpfsHash();

        escrow.status = EscrowStatus.DISPUTED;
        _disputes[escrowId] = Dispute({
            escrowId: escrowId,
            initiator: msg.sender,
            reasonIpfsHash: reasonIpfsHash,
            buyerAward: 0,
            sellerAward: 0,
            isResolved: false,
            rulingIpfsHash: "",
            resolvedAt: 0
        });

        emit DisputeRaised(escrowId, msg.sender, reasonIpfsHash, block.timestamp);
    }

    /**
     * @notice Arbitrator issues the binding dispute ruling, distributing remaining funds.
     */
    function resolveDispute(
        uint256 escrowId,
        uint256 buyerAward,
        uint256 sellerAward,
        string calldata rulingIpfsHash
    ) external override nonReentrant whenNotPaused {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.escrowId == 0) revert BlockEscrow__EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.DISPUTED) {
            revert BlockEscrow__InvalidEscrowStatus(uint8(escrow.status), uint8(EscrowStatus.DISPUTED));
        }
        if (msg.sender != escrow.arbitrator) revert BlockEscrow__UnauthorizedCaller(msg.sender);
        if (buyerAward + sellerAward != escrow.remainingBalance) {
            revert BlockEscrow__InvalidSplitTotal(buyerAward + sellerAward, escrow.remainingBalance);
        }

        // Checks-Effects
        escrow.remainingBalance = 0;
        escrow.status = EscrowStatus.RESOLVED;

        Dispute storage dispute = _disputes[escrowId];
        dispute.buyerAward = buyerAward;
        dispute.sellerAward = sellerAward;
        dispute.isResolved = true;
        dispute.rulingIpfsHash = rulingIpfsHash;
        dispute.resolvedAt = block.timestamp;

        // Calculate fee on seller's portion if awarded
        uint256 feeDeducted = 0;
        uint256 netSellerAward = sellerAward;
        if (sellerAward > 0) {
            feeDeducted = (sellerAward * escrow.feeBasisPoints) / BPS_DENOMINATOR;
            netSellerAward = sellerAward - feeDeducted;
        }

        // Interactions
        if (buyerAward > 0) {
            _transferOut(escrow.tokenAddress, escrow.buyer, buyerAward);
        }
        if (netSellerAward > 0) {
            _transferOut(escrow.tokenAddress, escrow.seller, netSellerAward);
        }
        if (feeDeducted > 0) {
            _transferOut(escrow.tokenAddress, treasury, feeDeducted);
        }

        emit DisputeResolved(
            escrowId,
            msg.sender,
            buyerAward,
            sellerAward,
            feeDeducted,
            rulingIpfsHash,
            block.timestamp
        );
    }

    /**
     * @notice Refunds remaining funds to the buyer. Can be triggered by the seller willingly or when in DRAFT.
     */
    function refundEscrow(
        uint256 escrowId,
        string calldata reason
    ) external override nonReentrant whenNotPaused {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.escrowId == 0) revert BlockEscrow__EscrowNotFound(escrowId);

        if (escrow.status == EscrowStatus.DRAFT) {
            if (msg.sender != escrow.buyer) revert BlockEscrow__UnauthorizedCaller(msg.sender);
            escrow.status = EscrowStatus.CANCELLED;
            emit EscrowRefunded(escrowId, escrow.buyer, 0, reason);
            return;
        }

        if (escrow.status != EscrowStatus.FUNDED && escrow.status != EscrowStatus.IN_PROGRESS) {
            revert BlockEscrow__InvalidEscrowStatus(uint8(escrow.status), uint8(EscrowStatus.FUNDED));
        }

        // Only seller can unilaterally refund active escrow back to buyer without dispute
        if (msg.sender != escrow.seller) revert BlockEscrow__UnauthorizedCaller(msg.sender);

        uint256 refundAmount = escrow.remainingBalance;
        escrow.remainingBalance = 0;
        escrow.status = EscrowStatus.REFUNDED;

        _transferOut(escrow.tokenAddress, escrow.buyer, refundAmount);

        emit EscrowRefunded(escrowId, escrow.buyer, refundAmount, reason);
    }

    // =========================================================================
    // Internal Helper Functions
    // =========================================================================

    function _createEscrowInternal(
        address buyer,
        address seller,
        address arbitrator,
        address tokenAddress,
        uint256 totalAmount,
        MilestoneInput[] calldata milestones,
        string calldata agreementIpfsHash
    ) internal returns (uint256 escrowId) {
        if (buyer == address(0) || seller == address(0) || arbitrator == address(0)) {
            revert BlockEscrow__ZeroAddress();
        }
        if (buyer == seller || buyer == arbitrator || seller == arbitrator) {
            revert BlockEscrow__IdenticalParties();
        }
        if (totalAmount == 0) revert BlockEscrow__InvalidAmount();
        if (milestones.length == 0) revert BlockEscrow__NoMilestones();
        if (bytes(agreementIpfsHash).length == 0) revert BlockEscrow__EmptyIpfsHash();

        uint256 milestonesSum = 0;
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestones[i].amount == 0) revert BlockEscrow__InvalidAmount();
            milestonesSum += milestones[i].amount;
        }

        if (milestonesSum != totalAmount) {
            revert BlockEscrow__MilestoneSumMismatch(totalAmount, milestonesSum);
        }

        escrowId = nextEscrowId++;

        _escrows[escrowId] = Escrow({
            escrowId: escrowId,
            buyer: buyer,
            seller: seller,
            arbitrator: arbitrator,
            tokenAddress: tokenAddress,
            totalAmount: totalAmount,
            remainingBalance: totalAmount,
            feeBasisPoints: feeBasisPoints,
            status: EscrowStatus.DRAFT,
            agreementIpfsHash: agreementIpfsHash,
            createdAt: block.timestamp,
            milestoneCount: milestones.length,
            approvedMilestoneCount: 0
        });

        for (uint256 i = 0; i < milestones.length; i++) {
            _milestones[escrowId][i] = Milestone({
                title: milestones[i].title,
                amount: milestones[i].amount,
                deadline: milestones[i].deadline,
                status: MilestoneStatus.PENDING,
                deliverableIpfsHash: "",
                submittedAt: 0,
                approvedAt: 0
            });
        }

        emit EscrowCreated(
            escrowId,
            buyer,
            seller,
            arbitrator,
            tokenAddress,
            totalAmount,
            milestones.length,
            agreementIpfsHash
        );
    }

    function _depositFundsInternal(Escrow storage escrow) internal {
        escrow.status = EscrowStatus.FUNDED;

        if (escrow.tokenAddress == address(0)) {
            if (msg.value != escrow.totalAmount) revert BlockEscrow__InvalidAmount();
        } else {
            if (msg.value != 0) revert BlockEscrow__InvalidAmount();
            IERC20(escrow.tokenAddress).safeTransferFrom(msg.sender, address(this), escrow.totalAmount);
        }

        emit FundsDeposited(escrow.escrowId, msg.sender, escrow.totalAmount);
    }

    function _transferOut(address tokenAddress, address recipient, uint256 amount) internal {
        if (amount == 0) return;
        if (tokenAddress == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            if (!success) revert BlockEscrow__TransferFailed();
        } else {
            IERC20(tokenAddress).safeTransfer(recipient, amount);
        }
    }

    // =========================================================================
    // Admin & Governance Controls
    // =========================================================================

    function setFeeBasisPoints(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert BlockEscrow__ExcessiveFeeBasisPoints(newFeeBps, MAX_FEE_BPS);
        emit ProtocolFeeUpdated(feeBasisPoints, newFeeBps);
        feeBasisPoints = newFeeBps;
    }

    function setTreasuryAddress(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert BlockEscrow__ZeroAddress();
        emit TreasuryAddressUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // =========================================================================
    // View Functions
    // =========================================================================

    function getEscrow(uint256 escrowId) external view override returns (Escrow memory) {
        return _escrows[escrowId];
    }

    function getMilestone(uint256 escrowId, uint256 milestoneIndex) external view override returns (Milestone memory) {
        return _milestones[escrowId][milestoneIndex];
    }

    function getDispute(uint256 escrowId) external view override returns (Dispute memory) {
        return _disputes[escrowId];
    }

    function getEscrowStatus(uint256 escrowId) external view override returns (EscrowStatus) {
        return _escrows[escrowId].status;
    }

    function getRemainingBalance(uint256 escrowId) external view returns (uint256) {
        return _escrows[escrowId].remainingBalance;
    }

    receive() external payable {
        revert("Direct deposits not allowed");
    }
}
