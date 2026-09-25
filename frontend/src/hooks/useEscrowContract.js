/**
 * useEscrowContract Hook Helper & Interaction Client
 * Prepares, validates, and dispatches contract write/read interactions for viem / ethers.
 */
class EscrowContractClient {
  constructor(config = {}) {
    this.contractAddress = config.contractAddress || "0x0000000000000000000000000000000000000000";
    this.provider = config.provider || null;
  }

  prepareCreateAndFund({ seller, arbitrator, tokenAddress, totalAmount, milestones, agreementCid }) {
    if (!seller || !arbitrator) {
      throw new Error("Seller and Arbitrator addresses are required");
    }
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      throw new Error("Total amount must be greater than zero");
    }
    if (!Array.isArray(milestones) || milestones.length === 0) {
      throw new Error("At least one milestone is required");
    }
    if (!agreementCid) {
      throw new Error("Agreement IPFS CID is required before on-chain lock");
    }

    let sum = 0;
    milestones.forEach((m) => {
      sum += parseFloat(m.amount);
    });

    if (Math.abs(sum - parseFloat(totalAmount)) > 0.000001) {
      throw new Error(`Milestone sum (${sum}) must equal totalAmount (${totalAmount})`);
    }

    const isNative = !tokenAddress || tokenAddress === "0x0" || tokenAddress === "0x0000000000000000000000000000000000000000";

    return {
      functionName: "createAndFundEscrow",
      args: [
        seller,
        arbitrator,
        isNative ? "0x0000000000000000000000000000000000000000" : tokenAddress,
        totalAmount,
        milestones,
        agreementCid,
      ],
      value: isNative ? totalAmount : "0",
      requiresTokenApproval: !isNative,
    };
  }

  async createEscrow({
    buyer,
    seller,
    arbitrator,
    token = "0x0000000000000000000000000000000000000000",
    amount,
    milestonePercentages = [],
    ipfsHash,
    customExecutor = null,
  }) {
    const addressRegex = /^0x[a-fA-F0-9]{40}$/i;
    if (!buyer || !addressRegex.test(buyer)) {
      throw new Error("Valid buyer address required");
    }
    if (!seller || !addressRegex.test(seller)) {
      throw new Error("Valid seller address required");
    }
    if (!arbitrator || !addressRegex.test(arbitrator)) {
      throw new Error("Valid arbitrator address required");
    }
    if (!amount || parseFloat(amount) <= 0) {
      throw new Error("Amount must be greater than zero");
    }
    if (!Array.isArray(milestonePercentages) || milestonePercentages.length === 0) {
      throw new Error("At least one milestone percentage is required");
    }

    const sumBps = milestonePercentages.reduce((acc, bps) => acc + Number(bps), 0);
    if (sumBps !== 10000) {
      throw new Error(`Milestone percentages must sum to 10,000 basis points (received ${sumBps})`);
    }

    if (customExecutor) {
      return customExecutor({ buyer, seller, arbitrator, token, amount, milestonePercentages, ipfsHash });
    }

    return {
      hash: "0xmock_creation_tx_hash",
      escrowId: 1,
    };
  }

  async deposit({ escrowId, amount, customExecutor = null }) {
    if (!escrowId) throw new Error("escrowId is required");
    if (!amount || parseFloat(amount) <= 0) throw new Error("Deposit amount must be greater than zero");

    if (customExecutor) {
      return customExecutor({ escrowId, amount });
    }
    return { hash: "0xmock_deposit_tx_hash" };
  }

  async releaseMilestone({ escrowId, milestoneIndex, customExecutor = null }) {
    if (escrowId === undefined || milestoneIndex === undefined) {
      throw new Error("escrowId and milestoneIndex are required");
    }
    if (customExecutor) {
      return customExecutor({ escrowId, milestoneIndex });
    }
    return { hash: "0xmock_release_tx_hash" };
  }

  async resolveDispute({ escrowId, buyerSplitBps, sellerSplitBps, customExecutor = null }) {
    if (escrowId === undefined) throw new Error("escrowId is required");
    const total = Number(buyerSplitBps) + Number(sellerSplitBps);
    if (total !== 10000) {
      throw new Error(`Split basis points must equal 10,000 (received ${total})`);
    }

    if (customExecutor) {
      return customExecutor({ escrowId, buyerSplitBps, sellerSplitBps });
    }
    return { hash: "0xmock_resolve_dispute_hash" };
  }

  prepareSubmitMilestone({ escrowId, milestoneIndex, deliverableCid }) {
    if (!escrowId || milestoneIndex === undefined || milestoneIndex === null) {
      throw new Error("escrowId and milestoneIndex are required");
    }
    if (!deliverableCid) {
      throw new Error("deliverableCid is required");
    }

    return {
      functionName: "submitMilestone",
      args: [Number(escrowId), Number(milestoneIndex), deliverableCid],
      value: "0",
    };
  }

  prepareApproveMilestone({ escrowId, milestoneIndex }) {
    if (!escrowId || milestoneIndex === undefined || milestoneIndex === null) {
      throw new Error("escrowId and milestoneIndex are required");
    }

    return {
      functionName: "approveMilestone",
      args: [Number(escrowId), Number(milestoneIndex)],
      value: "0",
    };
  }

  prepareRaiseDispute({ escrowId, reasonCid }) {
    if (!escrowId || !reasonCid) {
      throw new Error("escrowId and reasonCid are required");
    }

    return {
      functionName: "raiseDispute",
      args: [Number(escrowId), reasonCid],
      value: "0",
    };
  }

  prepareResolveDispute({ escrowId, buyerAward, sellerAward, rulingCid, remainingBalance }) {
    if (!escrowId || buyerAward === undefined || sellerAward === undefined) {
      throw new Error("escrowId, buyerAward, and sellerAward are required");
    }

    const total = parseFloat(buyerAward) + parseFloat(sellerAward);
    if (remainingBalance && Math.abs(total - parseFloat(remainingBalance)) > 0.000001) {
      throw new Error(`Award total (${total}) must equal remaining balance (${remainingBalance})`);
    }

    return {
      functionName: "resolveDispute",
      args: [Number(escrowId), buyerAward, sellerAward, rulingCid || ""],
      value: "0",
    };
  }
}

module.exports = { EscrowContractClient };
