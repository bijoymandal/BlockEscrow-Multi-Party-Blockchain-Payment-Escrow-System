# BlockEscrow – Comprehensive Multi-Phase Testing Specification (`test.md`)

> **Document Version:** 2.0.0  
> **Status:** Production Test Matrix (Phase 1 & Phase 2 Verified — 34 of 34 Automated Tests Passing)  
> **Structure:** Detailed Test Cases, Realistic Code Snippets, Inputs, Assertions, and Failure Modes for Every Phase (Phase 1 through Phase 6).

---

## 🗺️ Master Testing Architecture by Phase

```
┌────────────────────────────────────────────────────────────────────────┐
│                       BLOCKESCROW TESTING PYRAMID                      │
└────────────────────────────────────────────────────────────────────────┘

  [Phase 6] DevOps & Cloud    │ Docker Healthchecks, Prometheus Metrics, RPC Failover
  [Phase 5] Security & Fuzz   │ Foundry Invariants (Solvency), Slither AST, Echidna
  [Phase 4] Frontend Web3     │ Synpress E2E (MetaMask), Wagmi Hooks, Optimistic UI
  [Phase 3] Backend & Indexer │ Testcontainers (PG/Redis), 3-Block Reorg Rollback, SIWE
  [Phase 2] IPFS & Metadata   │ 18 Unit Tests: JSON Schemas, Pinata CIDv1, Gateway Race
  [Phase 1] Smart Contracts   │ 16 Unit Tests: UUPS Proxy, Milestones, Fees, Disputes
```

---

## 1. Phase 1: Smart Contract Protocol Engineering

Target Contract: [`contracts/contracts/BlockEscrow.sol`](file:///Users/nilanjanmondal/blockProjects/contracts/contracts/BlockEscrow.sol)  
Framework: Hardhat, Ethers.js v6, OpenZeppelin v5  
Total Test Cases: **16 Automated Tests** (All Passing)

### Test Cases Matrix (Phase 1)

| Test ID | Test Name | Input / Setup | Expected Outcome | Assertion Example |
| :--- | :--- | :--- | :--- | :--- |
| `TC-SC-01` | Proxy Initialization | Deploy UUPS proxy; set owner, treasury, fee = 50 bps | Variables stored correctly in proxy storage | `expect(await escrow.feeBasisPoints()).to.equal(50)` |
| `TC-SC-02` | Zero Address Rejection | Initialize with `treasury = address(0)` | Transaction reverts with custom error | `revertedWithCustomError(escrow, "BlockEscrow__ZeroAddress")` |
| `TC-SC-03` | Excessive Fee Rejection | Initialize with fee = 501 bps (5.01%) | Reverts with fee cap custom error | `revertedWithCustomError(escrow, "BlockEscrow__ExcessiveFeeBasisPoints")` |
| `TC-SC-04` | Re-initialization Guard | Call `initialize()` on already initialized proxy | OpenZeppelin `InvalidInitialization` error | `revertedWithCustomError(escrow, "InvalidInitialization")` |
| `TC-SC-05` | Fee Governance Access | Attacker calls `setFeeBasisPoints(100)` | Reverts with OpenZeppelin access error | `revertedWithCustomError(escrow, "OwnableUnauthorizedAccount")` |
| `TC-SC-06` | Emergency Pause Trigger | Owner calls `pause()`; user calls `createEscrow()` | Reverts with pause modifier error | `revertedWithCustomError(escrow, "EnforcedPause")` |
| `TC-SC-07` | Milestone Sum Check | M1 = 4000, M2 = 5000, Total = 10000 | Reverts because $4000 + 5000 \ne 10000$ | `revertedWithCustomError(escrow, "BlockEscrow__MilestoneSumMismatch")` |
| `TC-SC-08` | Identity Separation | Buyer address == Seller address | Reverts to prevent self-dealing | `revertedWithCustomError(escrow, "BlockEscrow__IdenticalParties")` |
| `TC-SC-09` | Two-Step ERC-20 Escrow | Buyer creates escrow (DRAFT), then approves & funds | Status moves from DRAFT (0) to FUNDED (1) | `expect(await escrow.getEscrowStatus(1)).to.equal(1)` |
| `TC-SC-10` | Atomic Native ETH Escrow | Buyer calls `createAndFundEscrow` with 10 ETH | Contract balance increases by 10 ETH | `expect(await provider.getBalance(escrowAddress)).to.equal(10 ETH)` |
| `TC-SC-11` | Milestone Submission Role | Seller submits deliverable IPFS hash | Status moves to SUBMITTED; timestamp logged | `expect(milestone.status).to.equal(1)` |
| `TC-SC-12` | Milestone Approval & Fee | Buyer approves 4000 USDC milestone at 0.5% fee | Seller: +3980 USDC, Treasury: +20 USDC | Net payout and fee math exact match |
| `TC-SC-13` | Full Contract Completion | Buyer approves final milestone | Escrow status transitions to COMPLETED (3) | `expect(await escrow.getEscrowStatus(1)).to.equal(3)` |
| `TC-SC-14` | Dispute State Lock | Buyer calls `raiseDispute()`; seller submits work | Milestone actions blocked while DISPUTED | `revertedWithCustomError(escrow, "BlockEscrow__InvalidEscrowStatus")` |
| `TC-SC-15` | Arbitrator Award Split | Arbitrator approves 40% Buyer / 60% Seller split | Enforces $Award_B + Award_S \equiv Remaining$ | `expect(await escrow.getRemainingBalance(1)).to.equal(0)` |
| `TC-SC-16` | Reentrancy Defense | Malicious contract calls `refundEscrow()` in `receive()` | Intercepted with `BlockEscrow__ReentrantCall` | `attackSucceeded == false` |

### Concrete Phase 1 Code Examples

#### Example 1.1: Atomic Native ETH Escrow & Milestone Flow (`TC-SC-10` & `TC-SC-12`)
```javascript
it("should create and fund escrow with native ETH and approve milestone", async function () {
  const milestones = [
    { title: "Design Phase", amount: ethers.parseEther("4"), deadline: 10000000000 },
    { title: "Smart Contracts", amount: ethers.parseEther("6"), deadline: 10000000000 }
  ];

  // Atomic deposit of 10 ETH
  await escrow.connect(buyer).createAndFundEscrow(
    seller.address,
    arbitrator.address,
    ethers.ZeroAddress, // Native ETH
    ethers.parseEther("10"),
    milestones,
    "QmAgreementCID",
    { value: ethers.parseEther("10") }
  );

  expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(ethers.parseEther("10"));

  // Seller submits deliverable
  await escrow.connect(seller).submitMilestone(1, 0, "QmDeliverable1");

  // Buyer approves milestone 0
  const sellerInitial = await ethers.provider.getBalance(seller.address);
  await escrow.connect(buyer).approveMilestone(1, 0);

  // Remaining balance in escrow is now 6 ETH
  expect(await escrow.getRemainingBalance(1)).to.equal(ethers.parseEther("6"));
});
```

#### Example 1.2: Reentrancy Attack Protection (`TC-SC-16`)
```javascript
it("should intercept reentrancy attacks using upgrade-safe guard", async function () {
  // MaliciousReceiver is the seller
  await maliciousReceiver.setAttackParams(escrowId);

  // Buyer triggers payout; MaliciousReceiver receive() attempts reentrant refundEscrow()
  await escrow.connect(buyer).approveMilestone(escrowId, 0);

  // Reentrancy attack was completely neutralized
  expect(await maliciousReceiver.attackSucceeded()).to.be.false;

  const revertData = await maliciousReceiver.attackRevertData();
  const expectedSelector = ethers.id("BlockEscrow__ReentrantCall()").slice(0, 10);
  expect(revertData.slice(0, 10)).to.equal(expectedSelector);
});
```

---

## 2. Phase 2: Decentralized Storage & IPFS Metadata Layer

Target Package: [`packages/ipfs-service/`](file:///Users/nilanjanmondal/blockProjects/packages/ipfs-service/)  
Framework: Node.js `node:test`, Native `fetch`, JSON Schema Draft-07  
Total Test Cases: **18 Automated Tests** (All Passing)

### Test Cases Matrix (Phase 2)

| Test ID | Test Name | Input / Setup | Expected Outcome | Assertion Example |
| :--- | :--- | :--- | :--- | :--- |
| `TC-IPFS-01` | Address Regex Check | Test valid `0x7099...C8` and invalid string `"0x123"` | Returns `true` for 40-char hex, `false` otherwise | `assert.strictEqual(isEthereumAddress(addr), true)` |
| `TC-IPFS-02` | Valid Agreement Schema | Complete agreement JSON matching `agreement.schema.json` | Schema validator returns `valid = true` | `assert.strictEqual(res.valid, true)` |
| `TC-IPFS-03` | Milestone Sum Check | M1 = 4000, M2 = 5000, TotalAmount = 10000 | Fails with explicit math mismatch error | `assert.ok(res.errors[0].includes("Milestones sum"))` |
| `TC-IPFS-04` | Self-Dealing Check | Buyer address == Seller address | Validator detects identity collision | `assert.ok(res.errors[0].includes("cannot be identical"))` |
| `TC-IPFS-05` | Deliverable Schema | Milestone deliverable JSON with repo URL & git commit | Validates all fields against deliverable schema | `assert.strictEqual(res.valid, true)` |
| `TC-IPFS-06` | Dispute Category Enum | Category = `"NON_DELIVERY"` vs `"INVALID_REASON"` | Enum validation permits known; rejects unknown | `assert.ok(res.errors[0].includes("Invalid category"))` |
| `TC-IPFS-07` | Pinata JSON Pinning | Upload JSON metadata in offline/sandbox mode | Produces canonical CIDv1 (`bafkrei...`) | `assert.ok(res.cid.startsWith("bafkrei"))` |
| `TC-IPFS-08` | Pinata File Pinning | Buffer = `Buffer.from("file contents")` | Produces CIDv1 and matches byte length | `assert.strictEqual(res.pinSize, buffer.length)` |
| `TC-IPFS-09` | Malformed JSON Input | Pass `null` or string into `pinJSONToIPFS` | Throws descriptive `Invalid jsonBody` error | `assert.rejects(..., /Invalid jsonBody/)` |
| `TC-IPFS-10` | Malformed Buffer Input | Pass string instead of Buffer to `pinFileToIPFS` | Throws `Invalid fileBuffer` error | `assert.rejects(..., /Invalid fileBuffer/)` |
| `TC-IPFS-11` | Gateway Cache Hit | Query already cached CID | Resolves from in-memory cache with 0ms latency | `assert.strictEqual(res.latencyMs, 0)` |
| `TC-IPFS-12` | Cache Expiration | Query CID whose TTL timestamp has passed | Stale record purged; returns `null` | `assert.strictEqual(cached, null)` |
| `TC-IPFS-13` | Validate & Pin Flow | Run `validateAndPinAgreement()` | Validates schema + returns CIDv1 + metadata | `assert.ok(pinned.cid.startsWith("bafkrei"))` |
| `TC-IPFS-14` | Validate Deliverable | Run `validateAndPinDeliverable()` | Validates schema + returns deliverable CIDv1 | `assert.strictEqual(pinned.data.escrowId, 5)` |
| `TC-IPFS-15` | Dispute Statement Length | Statement $< 20$ characters long | Rejects because statement is too short | `assert.rejects(..., /Dispute validation failed/)` |
| `TC-IPFS-16` | Protocol URI Clean | Pass `ipfs://bafkrei...` to resolver | Strips `ipfs://` and builds clean HTTP URL | Gateway URL properly constructed |
| `TC-IPFS-17` | Multi-Gateway Race | Race Cloudflare, Pinata, and ipfs.io | `Promise.any` resolves with fastest provider | Resolves first responding gateway |
| `TC-IPFS-18` | Security Checksums | Deliverable contains SHA-256 and commit hash | Pattern regex enforces strict security format | Validates 40-char hex commit hashes |

### Concrete Phase 2 Code Examples

#### Example 2.1: Agreement Schema Validation & Pinning (`TC-IPFS-02` & `TC-IPFS-07`)
```javascript
const { validateAndPinAgreement } = require("../src/index");

const agreementPayload = {
  version: "1.0.0",
  title: "Frontend & Backend Integration",
  description: "Next.js UI paired with Node.js event indexer",
  buyer: "0x1111111111111111111111111111111111111111",
  seller: "0x2222222222222222222222222222222222222222",
  arbitrator: "0x3333333333333333333333333333333333333333",
  tokenSymbol: "USDC",
  totalAmount: "5000.00",
  milestones: [
    { index: 0, title: "API Development", amount: "2500.00", dueDate: "2026-10-01T00:00:00Z" },
    { index: 1, title: "UI Integration", amount: "2500.00", dueDate: "2026-10-15T00:00:00Z" }
  ]
};

const result = await validateAndPinAgreement(agreementPayload);
assert.ok(result.cid.startsWith("bafkrei"));
assert.strictEqual(result.data.totalAmount, "5000.00");
```

#### Example 2.2: Multi-Gateway Latency Racing with Cache Acceleration (`TC-IPFS-11` & `TC-IPFS-17`)
```javascript
const { GatewayResolver } = require("../src/gateway.resolver");
const resolver = new GatewayResolver();

// Pre-fill cache
const sampleCid = "bafkreia7b25e709a34bc1d8f89104fa28db872410a562719a8";
resolver._saveToCache(sampleCid, { agreementTitle: "Audit Escrow" });

// Resolves instantly from cache with 0ms latency
const resolved = await resolver.fetchJSON(sampleCid);
assert.strictEqual(resolved.sourceGateway, "cache");
assert.strictEqual(resolved.latencyMs, 0);
assert.strictEqual(resolved.data.agreementTitle, "Audit Escrow");
```

---

## 3. Phase 3: Backend & Blockchain Event Indexing Specification

Target Directory: `backend/`  
Framework: Node.js, Express, Prisma ORM, BullMQ, Redis, Ethers.js WebSocket Provider  
Testing Target: **8 Integration Test Cases**

### Test Cases Matrix (Phase 3)

| Test ID | Test Name | Scenario Description | Expected Outcome | Verification |
| :--- | :--- | :--- | :--- | :--- |
| `TC-BE-01` | Event Ingestion | Smart contract emits `EscrowCreated` | Event indexed into PostgreSQL `Escrow` table | `expect(dbEscrow.onChainEscrowId).toEqual(1)` |
| `TC-BE-02` | Confirmation Depth | Event arrives at block $H$; depth = 12 blocks | Marked `UNCONFIRMED` until $H + 12$ finalized | Database status moves to `CONFIRMED` |
| `TC-BE-03` | 3-Block Reorg Rollback | Block hash diverges at height 100 on Polygon | Unfinalized event rows deleted / rolled back | Database rolls back to canonical block hash |
| `TC-BE-04` | SIWE Nonce Generator | Client requests `/api/v1/auth/nonce` | Generates 32-char cryptographically secure nonce | Nonce stored in Redis with 5-minute TTL |
| `TC-BE-05` | SIWE EIP-4361 Auth | Client submits signed EIP-4361 message | Validates signature; returns signed JWT | JWT contains user wallet address; HTTP 200 |
| `TC-BE-06` | Nonce Replay Prevention | Attacker submits same signed SIWE twice | Replay attempt rejected with HTTP 401 | Redis marks nonce as consumed immediately |
| `TC-BE-07` | Cache Invalidation | Buyer approves milestone on-chain | Redis cache for `/api/v1/escrows/:id` invalidated | Fresh data fetched from PostgreSQL |
| `TC-BE-08` | BullMQ Job Retries | Email worker fails on transient SMTP timeout | Job retried 3 times with exponential backoff | Successfully delivers on retry 2 |

### Concrete Phase 3 Code Example: Reorg Detection & Rollback (`TC-BE-03`)
```typescript
// backend/tests/reorg.test.ts
import { PrismaClient } from "@prisma/client";
import { EventIndexerService } from "../src/services/indexer.service";

it("should detect chain divergence and roll back unfinalized escrows", async () => {
  const indexer = new EventIndexerService();

  // 1. Process block 100 on Fork A
  await indexer.processBlock({
    blockNumber: 100n,
    blockHash: "0xForkA_Hash",
    events: [{ name: "EscrowCreated", escrowId: 99 }]
  });

  expect(await prisma.escrow.findUnique({ where: { onChainEscrowId: 99 } })).toBeDefined();

  // 2. Chain reorg occurs: Canonical block 100 is Fork B
  await indexer.handleBlockHeader({
    blockNumber: 100n,
    blockHash: "0xForkB_CanonicalHash",
    parentHash: "0xBlock99_Hash"
  });

  // 3. Unconfirmed Fork A event has been successfully purged
  const purgedEscrow = await prisma.escrow.findUnique({ where: { onChainEscrowId: 99 } });
  expect(purgedEscrow).toBeNull();
});
```

---

## 4. Phase 4: Frontend Web3 Application Specification

Target Directory: `frontend/`  
Framework: Next.js 14 (App Router), Wagmi v2, Viem, TanStack Query, Synpress (Playwright + MetaMask)  
Testing Target: **8 E2E Test Cases**

### Test Cases Matrix (Phase 4)

| Test ID | Test Name | Scenario Description | Expected Outcome | Verification |
| :--- | :--- | :--- | :--- | :--- |
| `TC-FE-01` | Wallet Connection | User clicks "Connect Wallet" on dashboard | MetaMask modal approves; address displayed | `[data-testid='user-address-pill']` visible |
| `TC-FE-02` | Network Switch | User is connected to Ethereum Mainnet | Banner prompts "Switch to Polygon PoS" | Switch network prompt accepted in wallet |
| `TC-FE-03` | Token Allowance Flow | Escrow Wizard detects zero USDC allowance | Renders "Approve USDC" button before deposit | MetaMask approves token spending cap |
| `TC-FE-04` | Escrow Wizard Stepper | User inputs 3 milestones with dates | Pre-validates milestone sum == deposit amount | "Next Step" disabled until amounts balance |
| `TC-FE-05` | Optimistic Status Update| Buyer clicks "Approve Milestone" | UI immediately shows "Releasing Funds..." | Replaced with confirmed green check on tx receipt |
| `TC-FE-06` | Dispute Evidence Modal | User files dispute with statement and files | Uploads evidence to IPFS; submits on-chain tx | Escrow badge updates to `DISPUTED` |
| `TC-FE-07` | Arbitrator Award Slider | Arbitrator opens ruling panel | Slider enforces Buyer % + Seller % == 100% | Resolving transaction broadcasts to chain |
| `TC-FE-08` | Transaction Toast Alert | Transaction broadcasted to mempool | Toast displays Polygonscan link and confirmations | Toast updates from pending to confirmed |

### Concrete Phase 4 Code Example: Synpress E2E User Journey (`TC-FE-01` & `TC-FE-03`)
```typescript
// frontend/tests/e2e/escrow-creation.spec.ts
import { test, expect } from "../fixtures/synpress";

test("Full Escrow Creation Journey with MetaMask", async ({ page, metamask }) => {
  await page.goto("http://localhost:3000");

  // Step 1: Connect Wallet
  await page.click("button:has-text('Connect Wallet')");
  await metamask.acceptAccess();
  await expect(page.locator("[data-testid='user-pill']")).toContainText("0x7099...79C8");

  // Step 2: Escrow Wizard
  await page.click("a:has-text('Create Escrow')");
  await page.fill("input[name='title']", "Full-Stack Security Audit");
  await page.fill("input[name='totalAmount']", "5000");
  await page.fill("input[name='sellerAddress']", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");

  // Step 3: Approve & Fund in MetaMask
  await page.click("button:has-text('Review & Fund Escrow')");
  await metamask.confirmPermissionToSpend();
  await metamask.confirmTransaction();

  // Step 4: Verification
  await expect(page.locator(".toast-success")).toContainText("Escrow successfully funded on-chain");
  await expect(page.locator("[data-testid='escrow-badge']")).toHaveText("FUNDED");
});
```

---

## 5. Phase 5: Security Audits, Invariant & Fuzz Testing Specification

Framework: Foundry (`forge test`), Slither, Echidna, Mythril  
Testing Target: **6 Security Invariants & Static Analysis Tests**

### Test Cases Matrix (Phase 5)

| Test ID | Test Name | Scenario Description | Expected Outcome | Verification |
| :--- | :--- | :--- | :--- | :--- |
| `TC-SEC-01` | Invariant: Solvency | Fuzz random deposits, releases, and disputes | Contract Token Balance $\ge \sum \text{Remaining}$ | `assertGe(contractBalance, totalRemaining)` |
| `TC-SEC-02` | Invariant: No Fund Lock | Run 100,000 fuzzed transactions | Funds can always be claimed or refunded | Zero funds trapped permanently |
| `TC-SEC-03` | Slither Static Analyzer | Run AST static vulnerability analysis | Zero High / Critical severity warnings | `slither . --fail-on high` exits with 0 |
| `TC-SEC-04` | Reentrancy Fuzzing | Fuzz external calls with recursive contracts | Reentrancy guard reverts all inner entries | Zero unauthorized state modifications |
| `TC-SEC-05` | Fee Arithmetic Rounding | Test with 1 wei amounts and odd decimals | Rounding favors protocol or remains lossless | Zero integer underflow / divide-by-zero |
| `TC-SEC-06` | MEV / Front-Running | Simulate front-running milestone submissions | Order of submission cannot steal recipient payout| Payout locked to original seller address |

### Concrete Phase 5 Code Example: Foundry Invariant Solvency Campaign (`TC-SEC-01`)
```solidity
// contracts/test/invariants/BlockEscrowInvariant.t.sol
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/BlockEscrow.sol";

contract BlockEscrowInvariantTest is Test {
    BlockEscrow public escrow;
    MockERC20 public usdc;
    EscrowHandler public handler;

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        escrow = new BlockEscrow();
        escrow.initialize(address(this), address(0x999), 50);

        handler = new EscrowHandler(escrow, usdc);
        targetContract(address(handler));
    }

    /// @notice Invariant: The protocol must NEVER be insolvent under any sequence of transactions
    function invariant_ProtocolSolvencyMaintained() public view {
        uint256 contractBalance = usdc.balanceOf(address(escrow));
        uint256 expectedRemaining = handler.ghost_totalRemainingBalances();

        assertGe(
            contractBalance, 
            expectedRemaining, 
            "CRITICAL: Contract balance is less than sum of active escrow balances!"
        );
    }
}
```

---

## 6. Phase 6: DevOps, Cloud Infrastructure & Smoke Tests

Framework: Docker, AWS ECS Fargate, Prometheus, CloudWatch, Hardhat Ignition  
Testing Target: **5 Operational Verification Tests**

### Test Cases Matrix (Phase 6)

| Test ID | Test Name | Scenario Description | Expected Outcome | Verification |
| :--- | :--- | :--- | :--- | :--- |
| `TC-OPS-01` | Multi-Stage Docker Build | Run `docker build` on backend and indexer | Image size $< 200\text{MB}$; unprivileged user | Docker healthcheck returns HTTP 200 |
| `TC-OPS-02` | Indexer Lag Alerting | Simulate WebSocket disconnect for 15 blocks | Prometheus metric `indexer_block_lag > 5` | PagerDuty / Slack alert triggers in 30s |
| `TC-OPS-03` | RPC Fallback Switching | Inject 500 error into Primary Alchemy RPC | Resilient provider fails over to Infura in $< 1\text{s}$ | Zero failed user transactions |
| `TC-OPS-04` | Mainnet Verification | Deploy contract using Hardhat Ignition | Etherscan / Polygonscan automatically verified | ABI and bytecode match on explorer |
| `TC-OPS-05` | Database Disaster Recovery | Terminate primary Aurora PostgreSQL AZ | Multi-AZ replica promotes to primary in $< 60\text{s}$ | BullMQ consumer resumes without lost events |

### Concrete Phase 6 Code Example: Prometheus Alert Rule (`TC-OPS-02`)
```yaml
# deploy/prometheus/rules/indexer-alerts.yml
groups:
  - name: blockescrow-indexer
    rules:
      - alert: IndexerHighBlockLag
        expr: blockescrow_indexer_canonical_block - blockescrow_indexer_last_indexed_block > 5
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "BlockEscrow indexer is lagging behind canonical chain"
          description: "Indexer is {{ $value }} blocks behind on Polygon Mainnet. Initiating RPC failover."
```

---

## 🏃 Summary: How to Run Current Automated Tests (Phases 1 & 2)

```bash
# Run all 34 automated tests across Smart Contracts and IPFS
npm test

# Run only Smart Contract tests (Phase 1: 16 tests)
npm run test:contracts

# Run only IPFS & Schema tests (Phase 2: 18 tests)
npm run test:ipfs
```
