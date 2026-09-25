const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { CreateEscrowWizard } = require("../src/index");

describe("Phase 4: Escrow Creation Wizard Test Suite", () => {
  const validBuyer = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const validSeller = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const validArbitrator = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  test("initializes at Step 1 with empty state", () => {
    const wizard = new CreateEscrowWizard();
    assert.equal(wizard.step, 1);
    assert.equal(wizard.data.title, "");
    assert.deepEqual(wizard.data.milestones, []);
  });

  test("fails step 1 validation on invalid addresses or empty title", () => {
    const wizard = new CreateEscrowWizard();
    wizard.setField("title", "");
    wizard.setField("buyer", "invalid_address");

    const validation = wizard.validateStep(1);
    assert.equal(validation.isValid, false);
    assert.ok(validation.errors.title);
    assert.ok(validation.errors.buyer);
    assert.equal(wizard.nextStep(), false);
  });

  test("rejects buyer address equal to seller address", () => {
    const wizard = new CreateEscrowWizard();
    wizard.setField("title", "Smart Contract Audit");
    wizard.setField("buyer", validBuyer);
    wizard.setField("seller", validBuyer); // Same address
    wizard.setField("arbitrator", validArbitrator);

    const validation = wizard.validateStep(1);
    assert.equal(validation.isValid, false);
    assert.equal(validation.errors.seller, "Seller cannot be the same address as Buyer");
  });

  test("progresses from Step 1 to Step 2 when valid", () => {
    const wizard = new CreateEscrowWizard();
    wizard.setField("title", "Smart Contract Audit");
    wizard.setField("buyer", validBuyer);
    wizard.setField("seller", validSeller);
    wizard.setField("arbitrator", validArbitrator);

    const advanced = wizard.nextStep();
    assert.equal(advanced, true);
    assert.equal(wizard.step, 2);
  });

  test("validates Step 2 payment parameters for ETH and ERC20", () => {
    const wizard = new CreateEscrowWizard();
    wizard.step = 2;

    // Zero amount
    wizard.setField("totalAmount", "0");
    let validation = wizard.validateStep(2);
    assert.equal(validation.isValid, false);
    assert.ok(validation.errors.totalAmount);

    // ERC20 with missing token address
    wizard.setField("totalAmount", "5000");
    wizard.setField("tokenType", "ERC20");
    wizard.setField("tokenAddress", "0x0000000000000000000000000000000000000000");
    validation = wizard.validateStep(2);
    assert.equal(validation.isValid, false);
    assert.ok(validation.errors.tokenAddress);

    // Valid ERC20
    wizard.setField("tokenAddress", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"); // USDC
    validation = wizard.validateStep(2);
    assert.equal(validation.isValid, true);
  });

  test("validates Step 3 milestone breakdown and sum reconciliation", () => {
    const wizard = new CreateEscrowWizard();
    wizard.step = 3;
    wizard.setField("totalAmount", "10.0");

    // No milestones
    let validation = wizard.validateStep(3);
    assert.equal(validation.isValid, false);
    assert.ok(validation.errors.milestones);

    // Milestone sum does not equal total amount (4 + 4 = 8 != 10)
    wizard.addMilestone({ title: "Milestone 1", amount: "4.0" });
    wizard.addMilestone({ title: "Milestone 2", amount: "4.0" });
    validation = wizard.validateStep(3);
    assert.equal(validation.isValid, false);
    assert.ok(validation.errors.milestoneSum);

    // Milestone sum equals total amount (4 + 6 = 10)
    wizard.removeMilestone(1);
    wizard.addMilestone({ title: "Milestone 2 Final", amount: "6.0" });
    validation = wizard.validateStep(3);
    assert.equal(validation.isValid, true);
  });

  test("supports bidirectional step navigation and HTML rendering", () => {
    const wizard = new CreateEscrowWizard({
      title: "Full Stack DApp",
      buyer: validBuyer,
      seller: validSeller,
      arbitrator: validArbitrator,
      totalAmount: "5.0",
      milestones: [{ id: 1, title: "Deliverable", amount: "5.0", deadlineDays: 10 }],
    });

    wizard.step = 3;
    assert.equal(wizard.nextStep(), true);
    assert.equal(wizard.step, 4);

    // Should not exceed step 4
    assert.equal(wizard.nextStep(), false);
    assert.equal(wizard.step, 4);

    // Back to step 3
    assert.equal(wizard.prevStep(), true);
    assert.equal(wizard.step, 3);

    // HTML rendering inspection
    const ui = wizard.render();
    assert.ok(ui.html.includes("create-escrow-wizard"));
    assert.ok(ui.html.includes("Step 3: Milestones"));
  });
});
