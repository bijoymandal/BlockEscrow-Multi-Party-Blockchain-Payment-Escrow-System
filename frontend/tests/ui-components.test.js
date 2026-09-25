const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  renderStatusBadge,
  renderButton,
  renderMilestoneStepper,
  renderArbitrationConsole,
  renderEscrowCard,
  renderWalletConnectButton,
  renderNetworkSwitchBanner,
  theme,
} = require("../src/index");

describe("Phase 4: UI Components Test Suite", () => {
  describe("StatusBadge Component", () => {
    test("renders valid badge for all escrow states", () => {
      const states = ["CREATED", "FUNDED", "IN_PROGRESS", "COMPLETED", "DISPUTED", "REFUNDED"];
      for (const st of states) {
        const html = renderStatusBadge(st);
        assert.ok(html.includes("status-badge"), `Should contain status-badge class for ${st}`);
        assert.ok(html.includes(st.replace("_", " ")), `Should contain label text for ${st}`);
      }
    });

    test("falls back gracefully for unknown status", () => {
      const html = renderStatusBadge("UNKNOWN_STATE");
      assert.ok(html.includes("UNKNOWN_STATE"));
      assert.ok(html.includes(theme.colors.border.subtle));
    });
  });

  describe("Button Component", () => {
    test("renders primary button with correct styles", () => {
      const btn = renderButton({ label: "Confirm Action", variant: "primary", size: "md" });
      assert.ok(btn.includes("Confirm Action"));
      assert.ok(btn.includes(theme.colors.accent.primary));
    });

    test("handles disabled state and custom classes", () => {
      const btn = renderButton({ label: "Disabled Action", disabled: true, className: "custom-btn" });
      assert.ok(btn.includes("disabled"));
      assert.ok(btn.includes("custom-btn"));
      assert.ok(btn.includes("opacity: 0.5"));
    });

    test("renders danger and warning variants", () => {
      const dangerBtn = renderButton({ label: "Dispute", variant: "danger" });
      assert.ok(dangerBtn.includes(theme.colors.state.danger));

      const warnBtn = renderButton({ label: "Warning", variant: "warning" });
      assert.ok(warnBtn.includes(theme.colors.state.warning));
    });
  });

  describe("MilestoneStepper Component", () => {
    test("calculates progression correctly across milestones", () => {
      const milestones = [
        { id: 1, title: "Design Specs", amount: "1.0", status: "APPROVED" },
        { id: 2, title: "Smart Contracts", amount: "2.0", status: "PENDING_APPROVAL" },
        { id: 3, title: "Frontend UI", amount: "1.5", status: "NOT_STARTED" },
      ];

      const stepper = renderMilestoneStepper({ milestones });
      assert.equal(stepper.totalMilestones, 3);
      assert.equal(stepper.approvedCount, 1);
      assert.equal(stepper.progressPct, 33);
      assert.ok(stepper.html.includes("Design Specs"));
      assert.ok(stepper.html.includes("Smart Contracts"));
    });
  });

  describe("ArbitrationConsole Component", () => {
    test("calculates basis point splits accurately", () => {
      const consoleUi = renderArbitrationConsole({
        escrowId: "ESC-99",
        disputedAmount: "10.0",
        tokenSymbol: "ETH",
        buyerSplitBps: 6000, // 60%
        sellerSplitBps: 4000, // 40%
      });

      assert.equal(consoleUi.buyerShare, "6.0000");
      assert.equal(consoleUi.sellerShare, "4.0000");
      assert.ok(consoleUi.html.includes("Buyer (60%)"));
      assert.ok(consoleUi.html.includes("Seller (40%)"));
    });

    test("throws error if split basis points exceed 10000", () => {
      assert.throws(() => {
        renderArbitrationConsole({
          escrowId: "ESC-99",
          buyerSplitBps: 7000,
          sellerSplitBps: 4000, // Sum = 11000 != 10000
        });
      }, /Split basis points must equal 10,000/);
    });
  });

  describe("EscrowCard Component", () => {
    test("renders role-aware action buttons for Buyer on CREATED escrow", () => {
      const card = renderEscrowCard({
        id: "ESC-101",
        title: "Web3 Protocol Build",
        status: "CREATED",
        buyer: "0x1111111111111111111111111111111111111111",
        seller: "0x2222222222222222222222222222222222222222",
        currentUserAddress: "0x1111111111111111111111111111111111111111",
      });

      assert.equal(card.primaryAction.action, "DEPOSIT");
      assert.ok(card.html.includes("Deposit Funds"));
    });

    test("renders role-aware action buttons for Arbitrator on DISPUTED escrow", () => {
      const card = renderEscrowCard({
        id: "ESC-102",
        status: "DISPUTED",
        arbitrator: "0x3333333333333333333333333333333333333333",
        currentUserAddress: "0x3333333333333333333333333333333333333333",
      });

      assert.equal(card.primaryAction.action, "ARBITRATE");
      assert.ok(card.html.includes("Arbitrate Dispute"));
    });
  });

  describe("WalletConnectButton & NetworkSwitchBanner", () => {
    test("renders connected state with truncated address", () => {
      const btn = renderWalletConnectButton({
        isConnected: true,
        address: "0x1234567890abcdef1234567890abcdef12345678",
        chainId: 137,
      });

      assert.equal(btn.status, "connected");
      assert.ok(btn.html.includes("0x1234...5678"));
      assert.ok(btn.html.includes("Polygon"));
    });

    test("renders network switch banner on unsupported chain ID", () => {
      const banner = renderNetworkSwitchBanner({ currentChainId: 99999 });
      assert.equal(banner.visible, true);
      assert.ok(banner.html.includes("Unsupported Network"));
      assert.ok(banner.html.includes("99999"));
    });

    test("hides banner on supported chain ID", () => {
      const banner = renderNetworkSwitchBanner({ currentChainId: 137 });
      assert.equal(banner.visible, false);
      assert.equal(banner.html, "");
    });
  });
});
