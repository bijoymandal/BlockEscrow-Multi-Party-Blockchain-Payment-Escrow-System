const test = require("node:test");
const assert = require("node:assert");
const { EventIndexerService } = require("../src/services/indexer.service");
const { EscrowService } = require("../src/services/escrow.service");
const { cacheService } = require("../src/services/cache.service");

test("Phase 3: Escrow Service, Caching & Drafts", async (t) => {
  const indexer = new EventIndexerService();
  const escrowService = new EscrowService(indexer);

  // Setup indexed escrow
  indexer.processEvent({
    blockNumber: 150,
    blockHash: "0xHash150",
    transactionHash: "0xTx150",
    eventName: "EscrowCreated",
    args: {
      escrowId: 1n,
      buyer: "0x1111111111111111111111111111111111111111",
      seller: "0x2222222222222222222222222222222222222222",
      arbitrator: "0x3333333333333333333333333333333333333333",
      totalAmount: 10000n,
    },
  });

  await t.test("TC-BE-07: should cache fetched escrow and return from cache on subsequent read", () => {
    cacheService.clear();

    // First read: cache miss
    const firstRead = escrowService.getEscrow(1);
    assert.ok(firstRead);
    assert.strictEqual(firstRead._fromCache, false);

    // Second read: cache hit
    const secondRead = escrowService.getEscrow(1);
    assert.ok(secondRead);
    assert.strictEqual(secondRead._fromCache, true);
  });

  await t.test("TC-BE-07b: should invalidate cached escrow on demand", () => {
    escrowService.getEscrow(1); // Populate cache
    const invalidatedCount = escrowService.invalidateEscrowCache(1);
    assert.ok(invalidatedCount > 0);

    // Next read should be fresh from indexer
    const freshRead = escrowService.getEscrow(1);
    assert.strictEqual(freshRead._fromCache, false);
  });

  await t.test("TC-BE-07c: should create valid draft escrow and reject invalid draft", () => {
    const validDraft = {
      version: "1.0.0",
      title: "Mobile App Development",
      buyer: "0x1111111111111111111111111111111111111111",
      seller: "0x2222222222222222222222222222222222222222",
      arbitrator: "0x3333333333333333333333333333333333333333",
      tokenSymbol: "USDC",
      totalAmount: "3000.00",
      milestones: [{ index: 0, title: "M1", amount: "3000.00", dueDate: "2026-10-01T00:00:00Z" }],
    };

    const draft = escrowService.createDraftEscrow(validDraft);
    assert.ok(draft.id.startsWith("draft_"));
    assert.strictEqual(draft.status, "DRAFT");

    // Invalid draft with mismatched milestone sum
    const invalidDraft = { ...validDraft, totalAmount: "5000.00" };
    assert.throws(() => escrowService.createDraftEscrow(invalidDraft), /Milestones sum/);
  });

  await t.test("TC-BE-07d: should filter escrows by participant role and status", () => {
    const buyerEscrows = escrowService.listEscrows({
      role: "buyer",
      address: "0x1111111111111111111111111111111111111111",
    });
    assert.strictEqual(buyerEscrows.length, 1);

    const nonParticipantEscrows = escrowService.listEscrows({
      role: "buyer",
      address: "0x9999999999999999999999999999999999999999",
    });
    assert.strictEqual(nonParticipantEscrows.length, 0);
  });
});
