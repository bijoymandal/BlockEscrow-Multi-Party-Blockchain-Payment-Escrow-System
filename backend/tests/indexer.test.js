const test = require("node:test");
const assert = require("node:assert");
const { EventIndexerService } = require("../src/services/indexer.service");

test("Phase 3: Blockchain Event Indexer & Reorg Engine", async (t) => {
  await t.test("TC-BE-01: should ingest EscrowCreated and FundsDeposited events", () => {
    const indexer = new EventIndexerService({ confirmationDepth: 12 });

    // 1. EscrowCreated event at block 100
    indexer.processEvent({
      blockNumber: 100,
      blockHash: "0xBlockHash100",
      transactionHash: "0xTxHash1",
      eventName: "EscrowCreated",
      args: {
        escrowId: 1n,
        buyer: "0x1111111111111111111111111111111111111111",
        seller: "0x2222222222222222222222222222222222222222",
        arbitrator: "0x3333333333333333333333333333333333333333",
        totalAmount: 10000000000n, // 10k USDC
        agreementIpfsHash: "bafkreiagreement123",
      },
    });

    const escrow = indexer.getEscrow(1);
    assert.ok(escrow);
    assert.strictEqual(escrow.onChainEscrowId, 1);
    assert.strictEqual(escrow.status, "DRAFT");
    assert.strictEqual(escrow.isConfirmed, false);

    // 2. FundsDeposited event
    indexer.processEvent({
      blockNumber: 101,
      blockHash: "0xBlockHash101",
      transactionHash: "0xTxHash2",
      eventName: "FundsDeposited",
      args: { escrowId: 1n, depositor: "0x1111111111111111111111111111111111111111", amount: 10000000000n },
    });

    const fundedEscrow = indexer.getEscrow(1);
    assert.strictEqual(fundedEscrow.status, "FUNDED");
  });

  await t.test("TC-BE-02: should transition events from UNCONFIRMED to CONFIRMED after 12 blocks", () => {
    const indexer = new EventIndexerService({ confirmationDepth: 12 });

    indexer.processEvent({
      blockNumber: 100,
      blockHash: "0xHash100",
      transactionHash: "0xTx1",
      eventName: "EscrowCreated",
      args: {
        escrowId: 10n,
        buyer: "0x1111111111111111111111111111111111111111",
        seller: "0x2222222222222222222222222222222222222222",
        totalAmount: 5000n,
      },
    });

    // Unconfirmed buffer contains the event
    assert.strictEqual(indexer.unconfirmedBuffer.length, 1);
    assert.strictEqual(indexer.getEscrow(10).isConfirmed, false);

    // Process blocks up to 111 (only 11 blocks ahead - still unconfirmed)
    indexer.processBlockHeader({ blockNumber: 111n, blockHash: "0xHash111", parentHash: "0xHash110" });
    assert.strictEqual(indexer.unconfirmedBuffer.length, 1);
    assert.strictEqual(indexer.getEscrow(10).isConfirmed, false);

    // Process block 112 (12 blocks ahead: 112 - 100 == 12 -> FINALIZED)
    indexer.processBlockHeader({ blockNumber: 112n, blockHash: "0xHash112", parentHash: "0xHash111" });
    assert.strictEqual(indexer.unconfirmedBuffer.length, 0);
    assert.strictEqual(indexer.getEscrow(10).isConfirmed, true);
  });

  await t.test("TC-BE-03: should detect chain reorg and roll back orphan unfinalized events", () => {
    const indexer = new EventIndexerService({ confirmationDepth: 12 });

    // Canonical blocks 50 and 51
    indexer.processBlockHeader({ blockNumber: 50n, blockHash: "0xCanonical50", parentHash: "0xCanonical49" });
    indexer.processBlockHeader({ blockNumber: 51n, blockHash: "0xForkA_51", parentHash: "0xCanonical50" });

    // Event emitted on Fork A at block 51
    indexer.processEvent({
      blockNumber: 51,
      blockHash: "0xForkA_51",
      transactionHash: "0xTxOrphan",
      eventName: "EscrowCreated",
      args: {
        escrowId: 99n,
        buyer: "0x1111111111111111111111111111111111111111",
        seller: "0x2222222222222222222222222222222222222222",
        totalAmount: 1000n,
      },
    });

    assert.ok(indexer.getEscrow(99), "Escrow 99 should exist optimistically");
    assert.strictEqual(indexer.unconfirmedBuffer.length, 1);

    // Reorg occurs! Chain reorganization switches block 51 to Fork B:
    const headerForkB = { blockNumber: 51n, blockHash: "0xForkB_Canonical51", parentHash: "0xCanonical50" };
    const { reorgDetected, rolledBackCount } = indexer.processBlockHeader(headerForkB);

    assert.strictEqual(reorgDetected, true, "Reorg must be detected");
    assert.strictEqual(rolledBackCount, 1, "Should roll back 1 unconfirmed event");

    // Verify unconfirmed orphan event was purged
    assert.strictEqual(indexer.getEscrow(99), null, "Orphan escrow 99 must be removed");
    assert.strictEqual(indexer.unconfirmedBuffer.length, 0);
  });

  await t.test("TC-BE-01b: should process milestone and dispute lifecycle events", () => {
    const indexer = new EventIndexerService();

    // Setup escrow
    indexer.processEvent({
      blockNumber: 200,
      blockHash: "0xHash200",
      transactionHash: "0xTx200",
      eventName: "EscrowCreated",
      args: {
        escrowId: 5n,
        buyer: "0x1111111111111111111111111111111111111111",
        seller: "0x2222222222222222222222222222222222222222",
        totalAmount: 2000n,
      },
    });

    // Milestone submission
    indexer.processEvent({
      blockNumber: 201,
      blockHash: "0xHash201",
      transactionHash: "0xTx201",
      eventName: "MilestoneSubmitted",
      args: { escrowId: 5n, milestoneIndex: 0n, deliverableIpfsHash: "bafkreideliverable" },
    });
    assert.strictEqual(indexer.getEscrow(5).status, "IN_PROGRESS");
    assert.strictEqual(indexer.getEscrow(5).milestones[0].status, "SUBMITTED");

    // Milestone approval
    indexer.processEvent({
      blockNumber: 202,
      blockHash: "0xHash202",
      transactionHash: "0xTx202",
      eventName: "MilestoneApproved",
      args: { escrowId: 5n, milestoneIndex: 0n },
    });
    assert.strictEqual(indexer.getEscrow(5).milestones[0].status, "APPROVED");

    // Dispute raised
    indexer.processEvent({
      blockNumber: 203,
      blockHash: "0xHash203",
      transactionHash: "0xTx203",
      eventName: "DisputeRaised",
      args: { escrowId: 5n, initiator: "0x1111111111111111111111111111111111111111", reasonIpfsHash: "bafkreidispute" },
    });
    assert.strictEqual(indexer.getEscrow(5).status, "DISPUTED");

    // Dispute resolved
    indexer.processEvent({
      blockNumber: 204,
      blockHash: "0xHash204",
      transactionHash: "0xTx204",
      eventName: "DisputeResolved",
      args: { escrowId: 5n, buyerAward: 1000n, sellerAward: 1000n },
    });
    assert.strictEqual(indexer.getEscrow(5).status, "RESOLVED");
    assert.strictEqual(indexer.getEscrow(5).remainingBalance, "0");
  });
});
