const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  Web3WalletState,
  SIWEService,
  CreateEscrowWizard,
  EscrowContractClient,
  renderDashboardView,
  renderMilestoneStepper,
  renderArbitrationConsole,
} = require("../src/index");

describe("Phase 4: End-to-End User Journey Simulation", () => {
  const buyerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const sellerAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const arbitratorAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  test("full lifecycle: Wallet Connect -> SIWE Auth -> Wizard Creation -> Dashboard Inspection -> Milestone Resolution", async () => {
    // 1. Connect Web3 Wallet
    const mockProvider = {
      request: async ({ method }) => {
        if (method === "eth_requestAccounts") return [buyerAddress];
        if (method === "eth_chainId") return "0x89"; // Polygon 137
        if (method === "eth_getBalance") return "0x21e19e0c9bab2400000"; // 10,000 ETH
        return null;
      },
      on: () => {},
      removeListener: () => {},
    };

    const wallet = new Web3WalletState({ provider: mockProvider });
    const walletState = await wallet.connect();
    assert.equal(walletState.isConnected, true);
    assert.equal(walletState.address, buyerAddress);
    assert.equal(walletState.chainId, 137);

    // 2. Authenticate Session with SIWE
    const siwe = new SIWEService();
    const authSession = await siwe.signIn({
      address: buyerAddress,
      chainId: 137,
      signMessageFn: async (msg) => "0x9876543210fedcba",
      fetchNonceFn: async () => "nonce_99887766554433221100",
      verifyFn: async ({ message, signature, address }) => ({
        token: "jwt_token_sample",
        user: { address, role: "BUYER" },
      }),
    });
    assert.equal(authSession.user.address, buyerAddress);
    assert.equal(siwe.getState().isAuthenticated, true);

    // 3. Create Escrow via 4-Step Wizard
    const wizard = new CreateEscrowWizard();

    // Step 1: Parties
    wizard.setField("title", "Cross-Chain DeFi Bridge Audit");
    wizard.setField("description", "Security audit of multi-chain bridge smart contracts");
    wizard.setField("buyer", buyerAddress);
    wizard.setField("seller", sellerAddress);
    wizard.setField("arbitrator", arbitratorAddress);
    assert.equal(wizard.nextStep(), true);
    assert.equal(wizard.step, 2);

    // Step 2: Payment
    wizard.setField("tokenType", "ETH");
    wizard.setField("totalAmount", "4.0");
    assert.equal(wizard.nextStep(), true);
    assert.equal(wizard.step, 3);

    // Step 3: Milestones
    wizard.addMilestone({ title: "Architecture & Threat Modeling", amount: "1.0", deadlineDays: 7 });
    wizard.addMilestone({ title: "Vulnerability Assessment", amount: "2.0", deadlineDays: 14 });
    wizard.addMilestone({ title: "Final Report & Mitigation Review", amount: "1.0", deadlineDays: 21 });
    assert.equal(wizard.nextStep(), true);
    assert.equal(wizard.step, 4);

    // Step 4: Validate ready to deploy
    assert.equal(wizard.data.milestones.length, 3);
    assert.equal(wizard.data.totalAmount, "4.0");

    // 4. Client creates on-chain escrow
    const mockEscrows = [];
    const client = new EscrowContractClient({
      contractAddress: "0x1234567890123456789012345678901234567890",
      provider: {
        getSigner: () => ({
          getAddress: async () => buyerAddress,
        }),
      },
    });

    const txMock = await client.createEscrow({
      buyer: wizard.data.buyer,
      seller: wizard.data.seller,
      arbitrator: wizard.data.arbitrator,
      amount: wizard.data.totalAmount,
      milestonePercentages: [2500, 5000, 2500], // 25%, 50%, 25% = 100%
      ipfsHash: "QmE2EJourneyHash123456789",
      customExecutor: async (params) => {
        const newEscrow = {
          id: "ESC-001",
          title: wizard.data.title,
          buyer: params.buyer,
          seller: params.seller,
          arbitrator: params.arbitrator,
          totalAmount: params.amount,
          releasedAmount: "0.0",
          status: "FUNDED",
          completedMilestones: 0,
          totalMilestones: 3,
        };
        mockEscrows.push(newEscrow);
        return { hash: "0xtxhash_create_123", escrowId: 1 };
      },
    });

    assert.equal(txMock.escrowId, 1);
    assert.equal(mockEscrows.length, 1);

    // 5. Render Dashboard View with New Escrow
    const dashboard = renderDashboardView({
      walletState: wallet.getState(),
      escrows: mockEscrows,
      filter: "all",
    });

    assert.equal(dashboard.stats.totalValueLocked, 4.0);
    assert.equal(dashboard.stats.activeCount, 1);
    assert.ok(dashboard.html.includes("Cross-Chain DeFi Bridge Audit"));
    assert.ok(dashboard.html.includes("ESC-001"));

    // 6. Milestone Stepper & Arbitration Console Component Check
    const stepper = renderMilestoneStepper({
      milestones: [
        { id: 1, title: "Architecture & Threat Modeling", amount: "1.0", status: "APPROVED" },
        { id: 2, title: "Vulnerability Assessment", amount: "2.0", status: "IN_PROGRESS" },
        { id: 3, title: "Final Report & Mitigation Review", amount: "1.0", status: "NOT_STARTED" },
      ],
    });
    assert.equal(stepper.approvedCount, 1);
    assert.equal(stepper.progressPct, 33);

    // Simulate dispute console
    const arbitrationConsole = renderArbitrationConsole({
      escrowId: "ESC-001",
      disputedAmount: "3.0",
      tokenSymbol: "ETH",
      buyerSplitBps: 5000,
      sellerSplitBps: 5000,
    });
    assert.equal(arbitrationConsole.buyerShare, "1.5000");
    assert.equal(arbitrationConsole.sellerShare, "1.5000");
  });
});
