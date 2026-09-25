# BlockEscrow – Comprehensive Testing & Verification Specification (`test.md`)

> **Document Version:** 1.0.0  
> **Testing Target:** 100% Line & Branch Coverage on Smart Contracts, Automated CI Integration, Invariant & Fuzzing Verification, E2E Synpress Testing.

---

## 1. Multi-Tier Testing Pyramid

BlockEscrow adopts a defense-in-depth testing hierarchy to guarantee zero loss of locked capital and fault-tolerant event processing.

```
                         ▲
                        / \
                       /   \   Web3 E2E Tests (Synpress / Playwright)
                      / E2E \  [Simulated MetaMask, Full User Journey]
                     /-------\
                    / Fork &  \  Mainnet Forking Tests
                   / Integrat. \ [Live USDC/MATIC, Real Decimals & Fees]
                  /-------------\
                 / Fuzz & Invar. \  Foundry Invariant & Stateful Fuzzing
                /                 \ [Invariant: Contract Bal == Sum(Remaining)]
               /-------------------\
              /  Unit & Contract    \  Foundry / Hardhat Unit Tests
             /     Isolation         \ [Every State Transition & Modifier]
            /-------------------------\
```

---

## 2. Smart Contract Test Suite (Foundry / Forge)

### 2.1 Core Test Fixtures & Setup

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/BlockEscrow.sol";
import "../contracts/mocks/MockERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract BlockEscrowTestBase is Test {
    BlockEscrow public escrowImplementation;
    BlockEscrow public escrow;
    MockERC20 public mockUsdc;

    address public owner = makeAddr("owner");
    address public treasury = makeAddr("treasury");
    address public buyer = makeAddr("buyer");
    address public seller = makeAddr("seller");
    address public arbitrator = makeAddr("arbitrator");
    address public attacker = makeAddr("attacker");

    uint256 public constant INITIAL_BALANCE = 100_000 * 1e6; // 100k USDC
    uint256 public constant PROTOCOL_FEE_BPS = 50; // 0.5%

    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 totalAmount);
    event MilestoneReleased(uint256 indexed escrowId, uint256 indexed milestoneId, uint256 amount);
    event DisputeRaised(uint256 indexed escrowId, address indexed initiator, string reasonCid);
    event DisputeResolved(uint256 indexed escrowId, uint256 buyerAward, uint256 sellerAward);

    function setUp() public virtual {
        vm.startPrank(owner);
        mockUsdc = new MockERC20("Mock USD Coin", "USDC", 6);
        
        escrowImplementation = new BlockEscrow();
        bytes memory initData = abi.encodeWithSelector(
            BlockEscrow.initialize.selector,
            owner,
            treasury,
            PROTOCOL_FEE_BPS
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(escrowImplementation), initData);
        escrow = BlockEscrow(payable(address(proxy)));
        vm.stopPrank();

        // Seed Balances
        mockUsdc.mint(buyer, INITIAL_BALANCE);
        vm.deal(buyer, 50 ether);
        vm.deal(seller, 10 ether);
    }
}
```

---

### 2.2 Critical Smart Contract Test Scenarios

#### Scenario A: Happy Path – Escrow Creation & Milestone Payment Release
- **Test ID:** `TC-SC-001`
- **Objective:** Verify funds lock in contract and transfer accurately to seller minus protocol fees.
- **Assertions:**
  1. `escrow.remainingBalance(escrowId)` matches deposited sum.
  2. Seller balance increases by $\text{amount} \times (1 - 0.005)$.
  3. Treasury balance increases by $\text{amount} \times 0.005$.
  4. Escrow status transitions from `FUNDED` to `COMPLETED` upon final milestone release.

```solidity
function test_SuccessfulEscrowFlow_ERC20() public {
    uint256 escrowAmount = 10_000 * 1e6; // 10k USDC
    MilestoneInput[] memory milestones = new MilestoneInput[](2);
    milestones[0] = MilestoneInput("Milestone 1", 4_000 * 1e6, block.timestamp + 3 days);
    milestones[1] = MilestoneInput("Milestone 2", 6_000 * 1e6, block.timestamp + 7 days);

    vm.startPrank(buyer);
    mockUsdc.approve(address(escrow), escrowAmount);
    uint256 escrowId = escrow.createAndFundEscrow(
        seller,
        arbitrator,
        address(mockUsdc),
        escrowAmount,
        milestones,
        "QmAgreementCID123"
    );
    vm.stopPrank();

    assertEq(mockUsdc.balanceOf(address(escrow)), escrowAmount);
    assertEq(uint256(escrow.getEscrowStatus(escrowId)), uint256(EscrowStatus.FUNDED));

    // Seller submits milestone 0
    vm.prank(seller);
    escrow.submitMilestone(escrowId, 0, "QmDeliverableCID1");

    // Buyer approves milestone 0
    uint256 sellerPreBalance = mockUsdc.balanceOf(seller);
    uint256 treasuryPreBalance = mockUsdc.balanceOf(treasury);

    vm.prank(buyer);
    escrow.approveMilestone(escrowId, 0);

    uint256 expectedFee = (4_000 * 1e6 * 50) / 10000; // 20 USDC
    uint256 expectedSellerPayout = (4_000 * 1e6) - expectedFee; // 3980 USDC

    assertEq(mockUsdc.balanceOf(seller) - sellerPreBalance, expectedSellerPayout);
    assertEq(mockUsdc.balanceOf(treasury) - treasuryPreBalance, expectedFee);
}
```

---

#### Scenario B: Dispute Resolution – Split Ruling
- **Test ID:** `TC-SC-002`
- **Objective:** Verify arbitrator can split remaining funds between buyer and seller; unauthorized parties are blocked.
- **Assertions:**
  1. Non-parties cannot raise disputes.
  2. Non-arbitrator cannot execute `resolveDispute`.
  3. Reverts if `buyerAward + sellerAward != remainingBalance`.
  4. Final state is `RESOLVED` and funds distributed without residue.

```solidity
function test_DisputeAndSplitResolution() public {
    uint256 escrowId = _setupFundedEscrow(10_000 * 1e6);

    // Buyer raises dispute
    vm.prank(buyer);
    escrow.raiseDispute(escrowId, "QmDisputeReasonCID");
    assertEq(uint256(escrow.getEscrowStatus(escrowId)), uint256(EscrowStatus.DISPUTED));

    // Attacker attempts unauthorized resolution -> must revert
    vm.prank(attacker);
    vm.expectRevert(BlockEscrow.BlockEscrow__UnauthorizedArbitrator.selector);
    escrow.resolveDispute(escrowId, 5_000 * 1e6, 5_000 * 1e6, "QmRulingCID");

    // Arbitrator submits mismatched split -> must revert
    vm.prank(arbitrator);
    vm.expectRevert(BlockEscrow.BlockEscrow__InvalidSplitTotal.selector);
    escrow.resolveDispute(escrowId, 4_000 * 1e6, 5_000 * 1e6, "QmRulingCID");

    // Arbitrator executes valid 60/40 split
    uint256 buyerPreBal = mockUsdc.balanceOf(buyer);
    uint256 sellerPreBal = mockUsdc.balanceOf(seller);

    vm.prank(arbitrator);
    escrow.resolveDispute(escrowId, 4_000 * 1e6, 6_000 * 1e6, "QmRulingCID");

    assertEq(mockUsdc.balanceOf(buyer) - buyerPreBal, 4_000 * 1e6);
    assertEq(mockUsdc.balanceOf(seller) - sellerPreBal, 6_000 * 1e6);
    assertEq(escrow.getRemainingBalance(escrowId), 0);
}
```

---

#### Scenario C: Invariant & Fuzz Testing (Foundry Invariant Campaign)
- **Invariant 1:** The smart contract's token balance must **always be greater than or equal to** the sum of all active escrows' remaining balances.
- **Invariant 2:** No state transition can cause total supply or protocol accounting to underflow.

```solidity
contract BlockEscrowInvariantTest is Test {
    BlockEscrow public escrow;
    MockERC20 public mockUsdc;
    EscrowHandler public handler;

    function setUp() public {
        // Initialization ...
        handler = new EscrowHandler(escrow, mockUsdc);
        targetContract(address(handler));
    }

    function invariant_SolvencyAlwaysMaintained() public view {
        uint256 contractUsdcBalance = mockUsdc.balanceOf(address(escrow));
        uint256 totalRecordedRemaining = handler.ghost_totalRemainingBalances();
        assertGe(contractUsdcBalance, totalRecordedRemaining, "CRITICAL: Protocol Insolvent");
    }
}
```

---

## 3. Backend & Event Indexer Integration Testing

Tests use **Testcontainers** to launch ephemeral, isolated PostgreSQL and Redis instances in Docker.

```typescript
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { PrismaClient } from "@prisma/client";
import { EventIndexerService } from "../src/services/indexer.service";

describe("EventIndexer & Reorg Integration Tests", () => {
  let pgContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  let prisma: PrismaClient;
  let indexer: EventIndexerService;

  beforeAll(async () => {
    pgContainer = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_DB: "test_db", POSTGRES_PASSWORD: "test" })
      .withExposedPorts(5432)
      .start();

    redisContainer = await new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .start();

    // Initialize Prisma Client and run migrations
    // ...
  });

  it("should process EscrowCreated event and persist to PostgreSQL", async () => {
    const mockEvent = {
      eventName: "EscrowCreated",
      args: {
        escrowId: 101n,
        buyer: "0x1111111111111111111111111111111111111111",
        seller: "0x2222222222222222222222222222222222222222",
        totalAmount: 5000000000n, // 5000 USDC
      },
      blockNumber: 15420100n,
      transactionHash: "0xabc123...",
    };

    await indexer.processBlockEvent(mockEvent);

    const savedEscrow = await prisma.escrow.findUnique({
      where: { onChainEscrowId: 101 },
    });

    expect(savedEscrow).toBeDefined();
    expect(savedEscrow?.status).toEqual("FUNDED");
    expect(savedEscrow?.totalAmount.toString()).toEqual("5000000000");
  });

  it("should handle 3-block reorg and roll back orphan events", async () => {
    // 1. Emit event at block 100 with Hash A
    // 2. Simulate reorg: canonical chain switches to Hash B at block 100
    // 3. Assert indexer un-marks intermediate record from verified status
  });
});
```

---

## 4. Frontend Web3 End-to-End Testing (Synpress & Playwright)

Automated tests interacting with a real headless browser instance injected with a pre-funded MetaMask wallet.

```typescript
// tests/e2e/escrow-lifecycle.spec.ts
import { test, expect } from "../fixtures/metamask-fixture";

test.describe("Full Escrow User Journey", () => {
  test("Buyer creates escrow, Seller submits, Buyer approves release", async ({ page, metamask }) => {
    // Step 1: Connect Wallet
    await page.goto("http://localhost:3000/dashboard");
    await page.click("button:has-text('Connect Wallet')");
    await metamask.acceptAccess();
    await expect(page.locator("[data-testid='user-address-pill']")).toBeVisible();

    // Step 2: Create Escrow Wizard
    await page.click("a:has-text('Create Escrow')");
    await page.fill("input[name='title']", "Full-Stack DApp Development");
    await page.fill("input[name='sellerAddress']", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    await page.fill("input[name='amount']", "1000");
    await page.click("button:has-text('Add Milestone')");
    await page.fill("input[name='milestones.0.title']", "Smart Contract Delivery");
    await page.fill("input[name='milestones.0.amount']", "1000");

    await page.click("button:has-text('Review & Fund Escrow')");

    // Step 3: Approve & Confirm in MetaMask
    await metamask.confirmPermissionToSpend();
    await metamask.confirmTransaction();

    // Step 4: Verify Success Toast & Redirect
    await expect(page.locator(".toast-success")).toContainText("Escrow successfully funded");
    await expect(page.locator("[data-testid='escrow-status-badge']")).toHaveText("FUNDED");
  });
});
```

---

## 5. Security & Static Analysis Run Sheet

Run these commands in CI before every release:

```bash
# 1. Foundry Test Suite (Unit & Gas Benchmarks)
forge test -vvv --gas-report

# 2. Slither Static Analysis
slither . --config-file slither.config.json --exclude-dependencies

# 3. Aderyn Rust-based Smart Contract Static Analyzer
aderyn .

# 4. Backend Jest Integration Suite (with Testcontainers)
npm run test:integration --prefix backend

# 5. Frontend E2E Synpress Test Suite
npm run test:e2e --prefix frontend
```
