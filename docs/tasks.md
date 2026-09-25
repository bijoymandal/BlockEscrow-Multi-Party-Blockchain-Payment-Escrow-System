# BlockEscrow – Production Implementation Tasks & Roadmap (`tasks.md`)

> **Document Version:** 1.0.0  
> **Methodology:** Agile / 2-Week Sprints  
> **Total Estimated Effort:** 138 Story Points (approx. 6 Sprints / 12 Weeks)

---

## Sprint & Phase Overview

| Phase | Domain | Focus Area | Story Points | Target Sprints |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Smart Contracts | Core Escrow, Milestones, Security & Upgrades | 34 pts | Sprint 1 – 2 |
| **Phase 2** | IPFS & Storage | Metadata Schemas, Pinned Deliverables & Gateway | 13 pts | Sprint 2 |
| **Phase 3** | Backend & Indexer | Event Listener, Reorg Engine, Prisma DB, APIs | 34 pts | Sprint 2 – 4 |
| **Phase 4** | Frontend Web3 | Next.js 14, Viem/Wagmi, Dashboard, Dispute Room | 34 pts | Sprint 3 – 5 |
| **Phase 5** | Security & Testing | Foundry Invariants, Synpress E2E, Slither Audits | 13 pts | Sprint 5 – 6 |
| **Phase 6** | DevOps & Launch | Multi-AZ Cloud, Monitoring, Mainnet Deployment | 10 pts | Sprint 6 |

---

## Phase 1: Smart Contract Protocol Engineering [COMPLETED - 34/34 pts]

### `SC-101`: Project Scaffolding & OpenZeppelin Upgrades Setup `[COMPLETED]`
- **Priority:** `P0` | **Points:** 3
- **Status:** Done. Hardhat 2 + OpenZeppelin Contracts v5 initialized, UUPS proxy setup configured.
- **Verification:** `npx hardhat compile` succeeds with 0 warnings.

### `SC-102`: Core Escrow Storage & State Machine `[COMPLETED]`
- **Priority:** `P0` | **Points:** 5
- **Dependencies:** `SC-101`
- **Status:** Done. `EscrowStorage.sol`, `IEscrowErrors.sol`, `IEscrowEvents.sol`, and `IBlockEscrow.sol` implemented.
- **Verification:** 8 state enum transitions and custom errors verified in tests.

### `SC-103`: Multi-Party Escrow Creation & Funding Logic `[COMPLETED]`
- **Priority:** `P0` | **Points:** 5
- **Dependencies:** `SC-102`
- **Status:** Done. Supports both Native currency (ETH/MATIC) and ERC-20 (`SafeERC20`). Supports atomic `createAndFundEscrow` and two-step `createEscrow` + `fundEscrow`.
- **Verification:** Tested against ERC-20 MockUSDC (6 decimals) and Native ETH.

### `SC-104`: Milestone Submission & Approval Release Engine `[COMPLETED]`
- **Priority:** `P0` | **Points:** 5
- **Dependencies:** `SC-103`
- **Status:** Done. `submitMilestone` and `approveMilestone` with partial fund releases and final completion check.
- **Verification:** Tests verify seller submission, buyer approval, and progression to `COMPLETED`.

### `SC-105`: Protocol Fee Calculation & Treasury Transfer `[COMPLETED]`
- **Priority:** `P1` | **Points:** 3
- **Dependencies:** `SC-104`
- **Status:** Done. Basis-point calculations (`netAmount = amount - fee`) directed to configurable treasury address with 500 bps (5%) hard cap.
- **Verification:** Verified exact fee arithmetic down to 6-decimal units.

### `SC-106`: Dispute Raising & Arbitrator Resolution Engine `[COMPLETED]`
- **Priority:** `P0` | **Points:** 8
- **Dependencies:** `SC-104`
- **Status:** Done. Buyer/seller dispute triggering with `DISPUTED` state lock; arbitrator-enforced split resolution with sum invariance checking.
- **Verification:** Tested unauthorized access, sum mismatch revert, and 60/40 award distribution.

### `SC-107`: Emergency Controls, ReentrancyGuard & Pausable `[COMPLETED]`
- **Priority:** `P0` | **Points:** 5
- **Dependencies:** `SC-106`
- **Status:** Done. `ReentrancyGuardUpgradeable`, `PausableUpgradeable`, and `OwnableUpgradeable` integrated across all state-mutating methods.
- **Verification:** Verified reentrancy attack intercept with `MaliciousReceiver` catching `BlockEscrow__ReentrantCall`, and `EnforcedPause` testing.

---

## Phase 2: Decentralized Storage & IPFS Metadata

### `IPFS-201`: Agreement & Deliverable JSON Schema Specification
- **Priority:** `P0` | **Points:** 2
- **Description:** Define JSON Schemas for agreement metadata, milestone descriptions, and dispute filings.
- **Acceptance Criteria:**
  - Validates all required fields (title, milestones, dates, wallet checksums, deliverables).
  - TypeScript types auto-generated from JSON schemas.

### `IPFS-202`: Pinata & Private IPFS Cluster Integration Service
- **Priority:** `P1` | **Points:** 5
- **Dependencies:** `IPFS-201`
- **Description:** Build a Node.js IPFS upload utility with automated dual-pinning to Pinata and fallback to a self-hosted IPFS node.
- **Acceptance Criteria:**
  - Service exposes `pinJSONToIPFS(metadata)` and `pinFileToIPFS(buffer, filename)`.
  - Returns canonical IPFS CIDv1 strings.
  - Unit tests verify automated retries on timeout.

### `IPFS-203`: Fast-Fetch Gateway Resolver with Client-Side Fallback
- **Priority:** `P1` | **Points:** 3
- **Dependencies:** `IPFS-202`
- **Description:** Implement a frontend and backend gateway client that races multiple public/private IPFS gateways with caching.
- **Acceptance Criteria:**
  - Tries dedicated gateway -> Cloudflare IPFS -> ipfs.io.
  - Cached in Redis for 7 days once resolved.

---

## Phase 3: Backend & Blockchain Event Indexing

### `BE-301`: PostgreSQL & Prisma Database Schema Migration
- **Priority:** `P0` | **Points:** 3
- **Description:** Set up Prisma ORM with models for `User`, `Escrow`, `Milestone`, `Dispute`, and `EventCursor`.
- **Acceptance Criteria:**
  - `prisma migrate dev` executes cleanly.
  - Indexes on `buyerAddress`, `sellerAddress`, `txHash`, and `onChainEscrowId`.

### `BE-302`: Real-Time WebSocket Event Indexer Service
- **Priority:** `P0` | **Points:** 8
- **Dependencies:** `BE-301`, `SC-102`
- **Description:** Implement an event listener subscribing to `BlockEscrow` contract events via WebSockets using `viem` / `ethers`.
- **Acceptance Criteria:**
  - Catches `EscrowCreated`, `MilestoneSubmitted`, `MilestoneReleased`, `DisputeRaised`, `DisputeResolved`.
  - Inserts / updates corresponding database records.
  - Persists `lastProcessedBlock` to `EventCursor`.

### `BE-303`: Block Reorganization (Reorg) Resilience Engine
- **Priority:** `P0` | **Points:** 8
- **Dependencies:** `BE-302`
- **Description:** Buffer events until confirmation depth (12 blocks) is reached. Detect block hash divergences and rollback unconfirmed state.
- **Acceptance Criteria:**
  - Simulated 3-block reorg in local test properly rolls back unfinalized escrows.
  - Finalized events are marked as immutable.

### `BE-304`: Sign-In with Ethereum (SIWE / EIP-4361) Auth API
- **Priority:** `P0` | **Points:** 5
- **Dependencies:** `BE-301`
- **Description:** Implement wallet authentication using SIWE. Generates cryptographically secure nonces and issues JWT session tokens.
- **Acceptance Criteria:**
  - `/api/v1/auth/nonce` generates single-use nonce stored in Redis.
  - `/api/v1/auth/verify` validates signature, creates/updates user in DB, and returns JWT.

### `BE-305`: REST & WebSocket APIs for Escrow Management
- **Priority:** `P1` | **Points:** 5
- **Dependencies:** `BE-304`, `BE-302`
- **Description:** Build CRUD and query endpoints:
  - `GET /api/v1/escrows?role=buyer&status=FUNDED`
  - `GET /api/v1/escrows/:id`
  - `POST /api/v1/escrows/draft`
  - WebSocket `/ws/escrow/:id` for live status streaming.
- **Acceptance Criteria:**
  - Responses cached in Redis with cache invalidation on new block events.
  - Role-based authorization: only involved parties can view unpinned private contract drafts.

### `BE-306`: BullMQ Notification & Email Dispatch Worker
- **Priority:** `P2` | **Points:** 5
- **Dependencies:** `BE-305`
- **Description:** Asynchronously send email and webhook alerts when milestone submission, approval, or dispute events occur.
- **Acceptance Criteria:**
  - Uses BullMQ with Redis backing.
  - Handles retries with exponential backoff.

---

## Phase 4: Frontend Web3 Application

### `FE-401`: Next.js 14 App Scaffolding & Wagmi v2 Integration
- **Priority:** `P0` | **Points:** 3
- **Description:** Set up Next.js 14 App Router, Tailwind CSS, shadcn/ui, and Wagmi v2 with `@tanstack/react-query`.
- **Acceptance Criteria:**
  - Connects to MetaMask, Coinbase Wallet, and WalletConnect v2.
  - Auto-detects network and prompts user to switch if on incorrect chain.

### `FE-402`: SIWE Authentication Hook & Session State
- **Priority:** `P0` | **Points:** 3
- **Dependencies:** `FE-401`, `BE-304`
- **Description:** Implement `useSIWE()` hook that triggers on wallet connection, prompts user signature, and stores session token.
- **Acceptance Criteria:**
  - Automatically clears session on wallet account disconnect or network switch.

### `FE-403`: User Dashboard (Active, Completed, Disputed Escrows)
- **Priority:** `P1` | **Points:** 5
- **Dependencies:** `FE-402`, `BE-305`
- **Description:** Build main dashboard displaying aggregated balances, quick stats, and filterable tabs for Buyer / Seller / Arbitrator views.
- **Acceptance Criteria:**
  - Real-time updates via WebSocket / TanStack Query invalidation.
  - Truncated addresses with copy-to-clipboard and explorer link pills.

### `FE-404`: Multi-Step Escrow Creation Wizard
- **Priority:** `P0` | **Points:** 8
- **Dependencies:** `FE-401`, `IPFS-202`
- **Description:** Build interactive wizard:
  - Step 1: Counterparty & Arbitrator Selection.
  - Step 2: Milestone Breakdown (amounts, deadlines, deliverables).
  - Step 3: Metadata Review & IPFS Pinning.
  - Step 4: Token Approval (`approve()`) & Escrow Creation Transaction (`createEscrow()`).
- **Acceptance Criteria:**
  - Validates checksummed Ethereum addresses.
  - Pre-calculates gas estimates and allowance checks.
  - Live progress stepper with toast notifications.

### `FE-405`: Escrow Detail & Milestone Management View
- **Priority:** `P0` | **Points:** 8
- **Dependencies:** `FE-404`
- **Description:** Detailed page for a specific escrow showing:
  - Contract status badge, countdown timer to milestones.
  - Deliverable submission modal with file upload for sellers.
  - Fund release approval button with transaction confirmation for buyers.
- **Acceptance Criteria:**
  - Real-time milestone state changes reflect within 2 seconds of block confirmation.

### `FE-406`: Dispute Filing & Arbitration Court Room
- **Priority:** `P0` | **Points:** 7
- **Dependencies:** `FE-405`
- **Description:** Build dispute interface:
  - "Raise Dispute" modal with evidence upload to IPFS.
  - Arbitrator Ruling Console with split slider (e.g. 60% Seller / 40% Buyer) and transaction executor.
- **Acceptance Criteria:**
  - Only assigned arbitrator sees the decision execution panel.
  - Slider enforces exact $100\%$ distribution of remaining escrow balance.

---

## Phase 5: Security Audits & Quality Assurance

### `QA-501`: Comprehensive Foundry Unit & Fuzz Tests
- **Priority:** `P0` | **Points:** 5
- **Dependencies:** `SC-107`
- **Description:** Write Foundry unit tests and fuzzing campaigns covering all state transitions, boundary values, and zero-value transfers.
- **Acceptance Criteria:**
  - Test coverage $>98\%$ on `BlockEscrow.sol`.
  - Zero critical/high findings on Slither.

### `QA-502`: Synpress & Playwright Web3 End-to-End Test Suite
- **Priority:** `P1` | **Points:** 5
- **Dependencies:** `FE-405`
- **Description:** Automate full user journey tests with Synpress (simulated MetaMask):
  - Buyer creates escrow -> Seller submits milestone -> Buyer releases funds.
- **Acceptance Criteria:**
  - Runs in CI headlessly on local Anvil fork.

### `QA-503`: Load & Concurrency Testing with k6
- **Priority:** `P2` | **Points:** 3
- **Dependencies:** `BE-305`
- **Description:** Stress-test backend REST APIs and WebSocket connections under 1,000 concurrent users.
- **Acceptance Criteria:**
  - $p95$ API latency $< 200\text{ms}$. Zero unhandled memory leaks.

---

## Phase 6: DevOps, Cloud & Launch

### `OPS-601`: Multi-Stage Dockerfile & Local Docker Compose
- **Priority:** `P0` | **Points:** 3
- **Description:** Create production Dockerfiles for backend API, worker, and local `docker-compose.yml` including Postgres, Redis, and local IPFS.
- **Acceptance Criteria:**
  - `docker compose up` spins up entire local environment in $< 60$ seconds.

### `OPS-602`: Multi-Chain Smart Contract Deployment & Verification
- **Priority:** `P0` | **Points:** 4
- **Dependencies:** `QA-501`
- **Description:** Deploy contracts via Hardhat Ignition / Foundry to Polygon PoS, Arbitrum One, and Sepolia Testnet.
- **Acceptance Criteria:**
  - Contracts verified on Polygonscan and Arbiscan.
  - Ownership transferred to Gnosis Safe Multi-Sig.

### `OPS-603`: Production Telemetry, Sentry & Prometheus Setup
- **Priority:** `P1` | **Points:** 3
- **Dependencies:** `OPS-601`
- **Description:** Configure Prometheus metrics exporter, Sentry error tracking, and CloudWatch dashboards.
- **Acceptance Criteria:**
  - Alert notifications wired to Slack channel `#escrow-alerts`.
