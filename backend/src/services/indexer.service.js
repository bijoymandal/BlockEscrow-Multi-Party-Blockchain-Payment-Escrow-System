/**
 * Event Indexer & Block Reorganization (Reorg) Resilience Engine
 * Tracks on-chain BlockEscrow events, enforces confirmation depth, and rolls back orphan forks.
 */
class EventIndexerService {
  constructor(config = {}) {
    this.confirmationDepth = config.confirmationDepth || 12; // 12 blocks depth
    this.chainId = config.chainId || 137; // Polygon PoS

    // In-memory canonical block tree: blockNumber => { hash, parentHash }
    this.blockHeaders = new Map();
    // In-memory escrows: onChainEscrowId => EscrowRecord
    this.escrows = new Map();
    // Unconfirmed events buffer: Array<{ eventId, blockNumber, blockHash, eventName, args, status }>
    this.unconfirmedBuffer = [];
    // Processed cursor
    this.lastProcessedBlock = 0n;
    this.lastProcessedHash = "";
  }

  /**
   * Ingests a new block header into the canonical tracker and checks for reorgs.
   * @param {{ blockNumber: bigint, blockHash: string, parentHash: string }} header
   * @returns {{ reorgDetected: boolean, rolledBackCount: number }}
   */
  processBlockHeader(header) {
    const { blockNumber, blockHash, parentHash } = header;

    // Check if we have an existing block at this height with a different hash (Reorg)
    const existing = this.blockHeaders.get(blockNumber);
    let reorgDetected = false;
    let rolledBackCount = 0;

    if (existing && existing.hash !== blockHash) {
      reorgDetected = true;
      // Reorg detected! Rollback all unfinalized events from this block and above
      rolledBackCount = this.rollbackFromBlock(blockNumber);
    }

    this.blockHeaders.set(blockNumber, { hash: blockHash, parentHash });
    this.lastProcessedBlock = blockNumber;
    this.lastProcessedHash = blockHash;

    // Finalize buffered events that have surpassed confirmation depth
    this._finalizeEligibleEvents(blockNumber);

    return { reorgDetected, rolledBackCount };
  }

  /**
   * Ingests a smart contract event.
   */
  processEvent(event) {
    const { blockNumber, blockHash, eventName, args, transactionHash } = event;

    const eventRecord = {
      eventId: `${blockNumber}_${transactionHash}_${eventName}`,
      blockNumber: BigInt(blockNumber),
      blockHash,
      eventName,
      args,
      transactionHash,
      status: "UNCONFIRMED",
      receivedAt: Date.now(),
    };

    this.unconfirmedBuffer.push(eventRecord);

    // Apply optimistic state update
    this._applyEventState(eventRecord, false);

    return eventRecord;
  }

  /**
   * Internal state mutator for escrows.
   */
  _applyEventState(eventRecord, isConfirmed) {
    const { eventName, args, blockNumber, transactionHash } = eventRecord;

    switch (eventName) {
      case "EscrowCreated": {
        const escrowId = Number(args.escrowId);
        this.escrows.set(escrowId, {
          onChainEscrowId: escrowId,
          buyerAddress: args.buyer.toLowerCase(),
          sellerAddress: args.seller.toLowerCase(),
          arbitratorAddress: (args.arbitrator || "").toLowerCase(),
          tokenAddress: args.tokenAddress || "0x0000000000000000000000000000000000000000",
          totalAmount: args.totalAmount.toString(),
          remainingBalance: args.totalAmount.toString(),
          status: "DRAFT",
          agreementIpfsHash: args.agreementIpfsHash,
          blockNumber,
          txHash: transactionHash,
          isConfirmed,
          milestones: [],
        });
        break;
      }
      case "FundsDeposited": {
        const escrowId = Number(args.escrowId);
        const escrow = this.escrows.get(escrowId);
        if (escrow) {
          escrow.status = "FUNDED";
          escrow.isConfirmed = isConfirmed;
        }
        break;
      }
      case "MilestoneSubmitted": {
        const escrowId = Number(args.escrowId);
        const escrow = this.escrows.get(escrowId);
        if (escrow) {
          escrow.status = "IN_PROGRESS";
          const idx = Number(args.milestoneIndex);
          escrow.milestones[idx] = {
            index: idx,
            status: "SUBMITTED",
            deliverableIpfsHash: args.deliverableIpfsHash,
          };
        }
        break;
      }
      case "MilestoneApproved": {
        const escrowId = Number(args.escrowId);
        const escrow = this.escrows.get(escrowId);
        if (escrow) {
          const idx = Number(args.milestoneIndex);
          if (escrow.milestones[idx]) {
            escrow.milestones[idx].status = "APPROVED";
          }
        }
        break;
      }
      case "DisputeRaised": {
        const escrowId = Number(args.escrowId);
        const escrow = this.escrows.get(escrowId);
        if (escrow) {
          escrow.status = "DISPUTED";
          escrow.dispute = {
            initiator: args.initiator,
            reasonIpfsHash: args.reasonIpfsHash,
            isResolved: false,
          };
        }
        break;
      }
      case "DisputeResolved": {
        const escrowId = Number(args.escrowId);
        const escrow = this.escrows.get(escrowId);
        if (escrow) {
          escrow.status = "RESOLVED";
          escrow.remainingBalance = "0";
          if (escrow.dispute) {
            escrow.dispute.isResolved = true;
            escrow.dispute.buyerAward = args.buyerAward.toString();
            escrow.dispute.sellerAward = args.sellerAward.toString();
          }
        }
        break;
      }
    }
  }

  /**
   * Finalizes events that have passed currentBlock - confirmationDepth.
   */
  _finalizeEligibleEvents(currentBlock) {
    const minEligibleBlock = currentBlock - BigInt(this.confirmationDepth);

    for (let i = this.unconfirmedBuffer.length - 1; i >= 0; i--) {
      const item = this.unconfirmedBuffer[i];
      if (item.blockNumber <= minEligibleBlock) {
        item.status = "CONFIRMED";
        const escrow = this.escrows.get(Number(item.args.escrowId));
        if (escrow) escrow.isConfirmed = true;
        // Remove from unconfirmed buffer
        this.unconfirmedBuffer.splice(i, 1);
      }
    }
  }

  /**
   * Rolls back all unfinalized state associated with a reorged fork.
   */
  rollbackFromBlock(divergentBlockNumber) {
    let rolledBackCount = 0;

    for (let i = this.unconfirmedBuffer.length - 1; i >= 0; i--) {
      const item = this.unconfirmedBuffer[i];
      if (item.blockNumber >= divergentBlockNumber) {
        // Purge the unconfirmed state
        const escrowId = Number(item.args.escrowId);
        this.escrows.delete(escrowId);
        this.unconfirmedBuffer.splice(i, 1);
        rolledBackCount++;
      }
    }

    return rolledBackCount;
  }

  getEscrow(escrowId) {
    return this.escrows.get(escrowId) || null;
  }

  listEscrows(filter = {}) {
    let list = Array.from(this.escrows.values());
    if (filter.role && filter.address) {
      const addr = filter.address.toLowerCase();
      if (filter.role === "buyer") list = list.filter((e) => e.buyerAddress === addr);
      if (filter.role === "seller") list = list.filter((e) => e.sellerAddress === addr);
      if (filter.role === "arbitrator") list = list.filter((e) => e.arbitratorAddress === addr);
    }
    if (filter.status) {
      list = list.filter((e) => e.status === filter.status);
    }
    return list;
  }
}

module.exports = { EventIndexerService };
