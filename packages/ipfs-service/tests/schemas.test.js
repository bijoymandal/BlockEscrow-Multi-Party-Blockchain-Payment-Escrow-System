const test = require("node:test");
const assert = require("node:assert");
const {
  validateAgreement,
  validateDeliverable,
  validateDispute,
  isEthereumAddress,
} = require("../src/validator");

test("IPFS-201: Schema & Validator Suite", async (t) => {
  await t.test("isEthereumAddress should validate 40-char hex addresses", () => {
    assert.strictEqual(isEthereumAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"), true);
    assert.strictEqual(isEthereumAddress("0x123"), false);
    assert.strictEqual(isEthereumAddress("invalid-address"), false);
    assert.strictEqual(isEthereumAddress(12345), false);
  });

  await t.test("validateAgreement should accept a well-formed agreement", () => {
    const validAgreement = {
      version: "1.0.0",
      title: "Smart Contract Audit & Formal Verification",
      description: "Full security review of BlockEscrow protocol",
      buyer: "0x1111111111111111111111111111111111111111",
      seller: "0x2222222222222222222222222222222222222222",
      arbitrator: "0x3333333333333333333333333333333333333333",
      tokenSymbol: "USDC",
      tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      totalAmount: "10000.00",
      milestones: [
        {
          index: 0,
          title: "Milestone 1: Static Analysis",
          amount: "4000.00",
          dueDate: "2026-10-01T00:00:00Z",
          deliverables: "Slither & Mythril report",
        },
        {
          index: 1,
          title: "Milestone 2: Manual Review",
          amount: "6000.00",
          dueDate: "2026-10-15T00:00:00Z",
          deliverables: "Final audit report PDF",
        },
      ],
      disputeTerms: {
        arbitrationFeeBps: 100,
        evidenceWindowDays: 7,
      },
    };

    const res = validateAgreement(validAgreement);
    assert.strictEqual(res.valid, true, `Expected valid agreement but got errors: ${res.errors.join(", ")}`);
    assert.strictEqual(res.errors.length, 0);
  });

  await t.test("validateAgreement should reject mismatched milestone sum", () => {
    const invalidAgreement = {
      version: "1.0.0",
      title: "Design & Development",
      buyer: "0x1111111111111111111111111111111111111111",
      seller: "0x2222222222222222222222222222222222222222",
      arbitrator: "0x3333333333333333333333333333333333333333",
      tokenSymbol: "ETH",
      totalAmount: "10.00",
      milestones: [
        { index: 0, title: "M1", amount: "4.00", dueDate: "2026-10-01T00:00:00Z" },
        { index: 1, title: "M2", amount: "5.00", dueDate: "2026-10-02T00:00:00Z" }, // 4+5 = 9 != 10
      ],
    };

    const res = validateAgreement(invalidAgreement);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("Milestones sum")));
  });

  await t.test("validateAgreement should reject identical buyer and seller", () => {
    const invalidAgreement = {
      version: "1.0.0",
      title: "Invalid Parties",
      buyer: "0x1111111111111111111111111111111111111111",
      seller: "0x1111111111111111111111111111111111111111",
      arbitrator: "0x3333333333333333333333333333333333333333",
      tokenSymbol: "USDC",
      totalAmount: "100.00",
      milestones: [{ index: 0, title: "M1", amount: "100.00", dueDate: "2026-10-01T00:00:00Z" }],
    };

    const res = validateAgreement(invalidAgreement);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("cannot be identical")));
  });

  await t.test("validateDeliverable should validate correct deliverable submission", () => {
    const validDeliverable = {
      version: "1.0.0",
      escrowId: 1,
      milestoneIndex: 0,
      seller: "0x2222222222222222222222222222222222222222",
      summary: "Completed smart contract implementation and pushed to GitHub with 100% tests.",
      repoUrl: "https://github.com/bijoymandal/BlockEscrow",
      commitHash: "e99c9165d629e9f3431efdfea25749bde37b412b",
      submittedAt: "2026-09-25T14:30:00Z",
    };

    const res = validateDeliverable(validDeliverable);
    assert.strictEqual(res.valid, true);
  });

  await t.test("validateDispute should validate dispute categories and statements", () => {
    const validDispute = {
      version: "1.0.0",
      escrowId: 10,
      initiator: "0x1111111111111111111111111111111111111111",
      category: "NON_DELIVERY",
      statement: "The seller missed the agreed milestone deadline by 14 days without any communication.",
      filedAt: "2026-10-05T12:00:00Z",
    };

    const res = validateDispute(validDispute);
    assert.strictEqual(res.valid, true);

    const invalidDispute = { ...validDispute, category: "UNSUPPORTED_REASON" };
    const invalidRes = validateDispute(invalidDispute);
    assert.strictEqual(invalidRes.valid, false);
    assert.ok(invalidRes.errors.some((e) => e.includes("Invalid category")));
  });
});
