const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("BlockEscrow Protocol - Phase 1 Verification", function () {
  let BlockEscrow, escrow;
  let MockERC20, mockUsdc;
  let MaliciousReceiver, maliciousReceiver;
  let owner, treasury, buyer, seller, arbitrator, attacker;

  const PROTOCOL_FEE_BPS = 50; // 0.5%
  const INITIAL_USDC_SUPPLY = ethers.parseUnits("100000", 6); // 100k USDC (6 decimals)
  const ESCROW_AMOUNT_USDC = ethers.parseUnits("10000", 6); // 10k USDC
  const ESCROW_AMOUNT_ETH = ethers.parseEther("10"); // 10 ETH

  beforeEach(async function () {
    [owner, treasury, buyer, seller, arbitrator, attacker] = await ethers.getSigners();

    // Deploy Mock USDC with 6 decimals
    MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUsdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUsdc.waitForDeployment();

    // Mint USDC to buyer
    await mockUsdc.mint(buyer.address, INITIAL_USDC_SUPPLY);

    // Deploy BlockEscrow via UUPS Proxy
    BlockEscrow = await ethers.getContractFactory("BlockEscrow");
    escrow = await upgrades.deployProxy(
      BlockEscrow,
      [owner.address, treasury.address, PROTOCOL_FEE_BPS],
      { kind: "uups" }
    );
    await escrow.waitForDeployment();

    // Deploy Malicious Receiver for reentrancy testing
    MaliciousReceiver = await ethers.getContractFactory("MaliciousReceiver");
    maliciousReceiver = await MaliciousReceiver.deploy(await escrow.getAddress());
    await maliciousReceiver.waitForDeployment();
  });

  describe("1. Initialization & Governance (SC-101, SC-107)", function () {
    it("should initialize with correct owner, treasury, and fee basis points", async function () {
      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.treasury()).to.equal(treasury.address);
      expect(await escrow.feeBasisPoints()).to.equal(PROTOCOL_FEE_BPS);
    });

    it("should revert if initialized with zero addresses or fee exceeding 5%", async function () {
      const Factory = await ethers.getContractFactory("BlockEscrow");
      await expect(
        upgrades.deployProxy(
          Factory,
          [ethers.ZeroAddress, treasury.address, PROTOCOL_FEE_BPS],
          { kind: "uups" }
        )
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__ZeroAddress");

      await expect(
        upgrades.deployProxy(
          Factory,
          [owner.address, treasury.address, 501], // 5.01%
          { kind: "uups" }
        )
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__ExcessiveFeeBasisPoints");
    });

    it("should prevent re-initialization", async function () {
      await expect(
        escrow.initialize(owner.address, treasury.address, 100)
      ).to.be.revertedWithCustomError(escrow, "InvalidInitialization");
    });

    it("should allow owner to update fee and treasury, but reject non-owner", async function () {
      await escrow.connect(owner).setFeeBasisPoints(100);
      expect(await escrow.feeBasisPoints()).to.equal(100);

      await expect(
        escrow.connect(attacker).setFeeBasisPoints(200)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");

      await escrow.connect(owner).setTreasuryAddress(attacker.address);
      expect(await escrow.treasury()).to.equal(attacker.address);
    });

    it("should respect emergency pause controls", async function () {
      await escrow.connect(owner).pause();
      expect(await escrow.paused()).to.be.true;

      const milestones = [
        { title: "M1", amount: ethers.parseEther("1"), deadline: Math.floor(Date.now() / 1000) + 86400 }
      ];

      await expect(
        escrow.connect(buyer).createEscrow(
          seller.address,
          arbitrator.address,
          ethers.ZeroAddress,
          ethers.parseEther("1"),
          milestones,
          "QmHash"
        )
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await escrow.connect(owner).unpause();
      expect(await escrow.paused()).to.be.false;
    });
  });

  describe("2. Escrow Validation & Creation (SC-102, SC-103)", function () {
    it("should revert if milestone amounts do not sum to totalAmount", async function () {
      const milestones = [
        { title: "M1", amount: ethers.parseUnits("4000", 6), deadline: 10000000000 },
        { title: "M2", amount: ethers.parseUnits("5000", 6), deadline: 10000000000 }, // sum 9000 != 10000
      ];

      await expect(
        escrow.connect(buyer).createEscrow(
          seller.address,
          arbitrator.address,
          await mockUsdc.getAddress(),
          ESCROW_AMOUNT_USDC,
          milestones,
          "QmAgreement123"
        )
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__MilestoneSumMismatch");
    });

    it("should revert if parties are identical or zero address", async function () {
      const milestones = [{ title: "M1", amount: ESCROW_AMOUNT_USDC, deadline: 10000000000 }];

      await expect(
        escrow.connect(buyer).createEscrow(
          buyer.address, // Seller same as Buyer
          arbitrator.address,
          await mockUsdc.getAddress(),
          ESCROW_AMOUNT_USDC,
          milestones,
          "QmHash"
        )
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__IdenticalParties");

      await expect(
        escrow.connect(buyer).createEscrow(
          ethers.ZeroAddress,
          arbitrator.address,
          await mockUsdc.getAddress(),
          ESCROW_AMOUNT_USDC,
          milestones,
          "QmHash"
        )
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__ZeroAddress");
    });

    it("should allow two-step creation and funding for ERC-20 token", async function () {
      const milestones = [
        { title: "M1", amount: ethers.parseUnits("4000", 6), deadline: 10000000000 },
        { title: "M2", amount: ethers.parseUnits("6000", 6), deadline: 10000000000 },
      ];

      // 1. Create in DRAFT
      const tx = await escrow.connect(buyer).createEscrow(
        seller.address,
        arbitrator.address,
        await mockUsdc.getAddress(),
        ESCROW_AMOUNT_USDC,
        milestones,
        "QmAgreement123"
      );
      const receipt = await tx.wait();
      const escrowId = 1;

      expect(await escrow.getEscrowStatus(escrowId)).to.equal(0); // DRAFT

      // 2. Fund
      await mockUsdc.connect(buyer).approve(await escrow.getAddress(), ESCROW_AMOUNT_USDC);
      await escrow.connect(buyer).fundEscrow(escrowId);

      expect(await escrow.getEscrowStatus(escrowId)).to.equal(1); // FUNDED
      expect(await mockUsdc.balanceOf(await escrow.getAddress())).to.equal(ESCROW_AMOUNT_USDC);
    });

    it("should allow atomic createAndFundEscrow with Native ETH", async function () {
      const milestones = [
        { title: "Design", amount: ethers.parseEther("4"), deadline: 10000000000 },
        { title: "Development", amount: ethers.parseEther("6"), deadline: 10000000000 },
      ];

      await escrow.connect(buyer).createAndFundEscrow(
        seller.address,
        arbitrator.address,
        ethers.ZeroAddress,
        ESCROW_AMOUNT_ETH,
        milestones,
        "QmEthEscrow",
        { value: ESCROW_AMOUNT_ETH }
      );

      const escrowId = 1;
      expect(await escrow.getEscrowStatus(escrowId)).to.equal(1); // FUNDED
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(ESCROW_AMOUNT_ETH);
    });
  });

  describe("3. Milestone Deliverables & Approval Payouts (SC-104, SC-105)", function () {
    let escrowId;
    const m1Amount = ethers.parseUnits("4000", 6);
    const m2Amount = ethers.parseUnits("6000", 6);

    beforeEach(async function () {
      const milestones = [
        { title: "Milestone 1", amount: m1Amount, deadline: 10000000000 },
        { title: "Milestone 2", amount: m2Amount, deadline: 10000000000 },
      ];
      await mockUsdc.connect(buyer).approve(await escrow.getAddress(), ESCROW_AMOUNT_USDC);
      await escrow.connect(buyer).createAndFundEscrow(
        seller.address,
        arbitrator.address,
        await mockUsdc.getAddress(),
        ESCROW_AMOUNT_USDC,
        milestones,
        "QmAgreement123"
      );
      escrowId = 1;
    });

    it("should allow only seller to submit deliverable for pending milestone", async function () {
      await expect(
        escrow.connect(buyer).submitMilestone(escrowId, 0, "QmDeliverable1")
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__UnauthorizedCaller");

      await escrow.connect(seller).submitMilestone(escrowId, 0, "QmDeliverable1");
      const m = await escrow.getMilestone(escrowId, 0);
      expect(m.status).to.equal(1); // SUBMITTED
      expect(m.deliverableIpfsHash).to.equal("QmDeliverable1");
      expect(await escrow.getEscrowStatus(escrowId)).to.equal(2); // IN_PROGRESS
    });

    it("should release net payout to seller and platform fee to treasury on buyer approval", async function () {
      await escrow.connect(seller).submitMilestone(escrowId, 0, "QmDeliverable1");

      const sellerInitial = await mockUsdc.balanceOf(seller.address);
      const treasuryInitial = await mockUsdc.balanceOf(treasury.address);

      // Fee = 4000 * 50 / 10000 = 20 USDC
      const expectedFee = (m1Amount * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const expectedNet = m1Amount - expectedFee;

      await escrow.connect(buyer).approveMilestone(escrowId, 0);

      expect((await mockUsdc.balanceOf(seller.address)) - sellerInitial).to.equal(expectedNet);
      expect((await mockUsdc.balanceOf(treasury.address)) - treasuryInitial).to.equal(expectedFee);
      expect(await escrow.getRemainingBalance(escrowId)).to.equal(m2Amount);
    });

    it("should mark escrow as COMPLETED when all milestones are approved", async function () {
      // Approve M1
      await escrow.connect(seller).submitMilestone(escrowId, 0, "QmDeliverable1");
      await escrow.connect(buyer).approveMilestone(escrowId, 0);

      // Approve M2
      await escrow.connect(seller).submitMilestone(escrowId, 1, "QmDeliverable2");
      await escrow.connect(buyer).approveMilestone(escrowId, 1);

      expect(await escrow.getEscrowStatus(escrowId)).to.equal(3); // COMPLETED
      expect(await escrow.getRemainingBalance(escrowId)).to.equal(0);
    });
  });

  describe("4. Dispute Raising & Arbitrator Resolution (SC-106)", function () {
    let escrowId;

    beforeEach(async function () {
      const milestones = [
        { title: "Milestone 1", amount: ESCROW_AMOUNT_USDC, deadline: 10000000000 },
      ];
      await mockUsdc.connect(buyer).approve(await escrow.getAddress(), ESCROW_AMOUNT_USDC);
      await escrow.connect(buyer).createAndFundEscrow(
        seller.address,
        arbitrator.address,
        await mockUsdc.getAddress(),
        ESCROW_AMOUNT_USDC,
        milestones,
        "QmAgreementDispute"
      );
      escrowId = 1;
    });

    it("should allow either buyer or seller to raise a dispute and lock state", async function () {
      await escrow.connect(buyer).raiseDispute(escrowId, "QmDisputeReason");
      expect(await escrow.getEscrowStatus(escrowId)).to.equal(4); // DISPUTED

      // Milestone submissions / approvals must revert when disputed
      await expect(
        escrow.connect(seller).submitMilestone(escrowId, 0, "QmDeliverable")
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__InvalidEscrowStatus");
    });

    it("should allow only assigned arbitrator to resolve dispute with a valid split", async function () {
      await escrow.connect(seller).raiseDispute(escrowId, "QmDisputeReason");

      const buyerAward = ethers.parseUnits("4000", 6); // 40%
      const sellerAward = ethers.parseUnits("6000", 6); // 60%

      // Attacker attempts resolution
      await expect(
        escrow.connect(attacker).resolveDispute(escrowId, buyerAward, sellerAward, "QmRuling")
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__UnauthorizedCaller");

      // Mismatched sum
      await expect(
        escrow.connect(arbitrator).resolveDispute(escrowId, buyerAward, buyerAward, "QmRuling")
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__InvalidSplitTotal");

      // Valid resolution by arbitrator
      const buyerPre = await mockUsdc.balanceOf(buyer.address);
      const sellerPre = await mockUsdc.balanceOf(seller.address);
      const treasuryPre = await mockUsdc.balanceOf(treasury.address);

      const expectedFee = (sellerAward * BigInt(PROTOCOL_FEE_BPS)) / 10000n; // fee on seller portion
      const expectedSellerNet = sellerAward - expectedFee;

      await escrow.connect(arbitrator).resolveDispute(escrowId, buyerAward, sellerAward, "QmRuling");

      expect((await mockUsdc.balanceOf(buyer.address)) - buyerPre).to.equal(buyerAward);
      expect((await mockUsdc.balanceOf(seller.address)) - sellerPre).to.equal(expectedSellerNet);
      expect((await mockUsdc.balanceOf(treasury.address)) - treasuryPre).to.equal(expectedFee);

      expect(await escrow.getEscrowStatus(escrowId)).to.equal(5); // RESOLVED
      expect(await escrow.getRemainingBalance(escrowId)).to.equal(0);
    });
  });

  describe("5. Voluntary Seller Refund Flow", function () {
    it("should allow seller to unilaterally refund active escrow to buyer", async function () {
      const milestones = [
        { title: "Milestone 1", amount: ESCROW_AMOUNT_USDC, deadline: 10000000000 },
      ];
      await mockUsdc.connect(buyer).approve(await escrow.getAddress(), ESCROW_AMOUNT_USDC);
      await escrow.connect(buyer).createAndFundEscrow(
        seller.address,
        arbitrator.address,
        await mockUsdc.getAddress(),
        ESCROW_AMOUNT_USDC,
        milestones,
        "QmRefundTest"
      );
      const escrowId = 1;

      // Buyer cannot unilaterally refund once funded
      await expect(
        escrow.connect(buyer).refundEscrow(escrowId, "Cancel request")
      ).to.be.revertedWithCustomError(escrow, "BlockEscrow__UnauthorizedCaller");

      const buyerPre = await mockUsdc.balanceOf(buyer.address);
      await escrow.connect(seller).refundEscrow(escrowId, "Seller unable to complete work");

      expect((await mockUsdc.balanceOf(buyer.address)) - buyerPre).to.equal(ESCROW_AMOUNT_USDC);
      expect(await escrow.getEscrowStatus(escrowId)).to.equal(6); // REFUNDED
      expect(await escrow.getRemainingBalance(escrowId)).to.equal(0);
    });
  });

  describe("6. Security: Reentrancy Protection (SC-107)", function () {
    it("should resist reentrancy attacks during ETH payouts", async function () {
      const milestones = [
        { title: "Malicious M1", amount: ethers.parseEther("5"), deadline: 10000000000 }
      ];

      // Seller is MaliciousReceiver contract
      await escrow.connect(buyer).createAndFundEscrow(
        await maliciousReceiver.getAddress(),
        arbitrator.address,
        ethers.ZeroAddress,
        ethers.parseEther("5"),
        milestones,
        "QmMaliciousAgreement",
        { value: ethers.parseEther("5") }
      );
      const escrowId = 1;

      // Seller submits
      // Use low-level call since MaliciousReceiver doesn't forward submitMilestone directly
      await escrow.connect(owner).setTreasuryAddress(owner.address);

      // Fund attacker contract for gas first
      await owner.sendTransaction({
        to: await maliciousReceiver.getAddress(),
        value: ethers.parseEther("1"),
      });

      // Submit milestone as malicious receiver via impersonation
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [await maliciousReceiver.getAddress()],
      });
      const maliciousSigner = await ethers.getSigner(await maliciousReceiver.getAddress());
      await escrow.connect(maliciousSigner).submitMilestone(escrowId, 0, "QmDeliverable");

      // Arm malicious receiver to attempt reentering refundEscrow upon receiving ETH payout
      await maliciousReceiver.setAttackParams(escrowId);

      // When buyer approves, payout is sent, MaliciousReceiver attempts reentrancy in receive()
      // approveMilestone succeeds, but reentrancy call is blocked
      await escrow.connect(buyer).approveMilestone(escrowId, 0);

      // Verify the reentrancy attack failed
      expect(await maliciousReceiver.attackSucceeded()).to.be.false;

      // Verify the revert error was BlockEscrow__ReentrantCall
      const revertData = await maliciousReceiver.attackRevertData();
      const expectedSelector = ethers.id("BlockEscrow__ReentrantCall()").slice(0, 10);
      expect(revertData.slice(0, 10)).to.equal(expectedSelector);
    });
  });
});
