# BlockEscrow – Multi-Party Blockchain Payment & Escrow System

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-v5.0.2-4E5EE4?logo=openzeppelin)](https://openzeppelin.com/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22.5-FFF100?logo=ethereum)](https://hardhat.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A decentralized, non-custodial milestone payment and escrow protocol with on-chain arbitration and IPFS agreement integration.

---

## 🚀 Quick Start & Interactive Menu

Launch the interactive documentation and project operations menu:

```bash
npm start
# or
npm run docs
```

The interactive menu lets you:
1. **Browse Specifications:** Read System Architecture, Design Theme, Production Guide, Tasks, and Testing specifications.
2. **Launch Web Documentation:** Open a rich local web portal (`http://localhost:3333`) with dark-mode documentation and syntax highlighting.
3. **Run Smart Contracts Operations:** Compile Solidity contracts, execute automated tests, and run local deployments.

---

## 📚 Documentation Directory (`docs/`)

All engineering and architecture specifications are organized inside [`docs/`](file:///Users/nilanjanmondal/blockProjects/docs):

- [**`docs/architecture.md`**](file:///Users/nilanjanmondal/blockProjects/docs/architecture.md): Protocol state machine, smart contract inheritance, sequence diagrams, Prisma database schema, and IPFS metadata standard.
- [**`docs/theme.md`**](file:///Users/nilanjanmondal/blockProjects/docs/theme.md): Design system, color tokens, escrow state palette, typography scale, Web3 components, and Tailwind config.
- [**`docs/prod.md`**](file:///Users/nilanjanmondal/blockProjects/docs/prod.md): Multi-AZ deployment topology, RPC fallback round-robin pool, static analyzer audits, CI/CD pipeline, and disaster recovery playbooks.
- [**`docs/tasks.md`**](file:///Users/nilanjanmondal/blockProjects/docs/tasks.md): 6-phase engineering backlog, sprint roadmap, story points, and acceptance criteria.
- [**`docs/test.md`**](file:///Users/nilanjanmondal/blockProjects/docs/test.md): Multi-tier test pyramid, Foundry unit & invariant fuzzing tests, Testcontainers, and Synpress Web3 E2E testing.
- [**`docs/README.md`**](file:///Users/nilanjanmondal/blockProjects/docs/README.md): Documentation index and hub overview.

---

## ⚡ Smart Contracts (Phase 1 Completed)

The smart contracts are located in [`contracts/`](file:///Users/nilanjanmondal/blockProjects/contracts):

- [`contracts/contracts/BlockEscrow.sol`](file:///Users/nilanjanmondal/blockProjects/contracts/contracts/BlockEscrow.sol): Core UUPS upgradeable contract.
- [`contracts/contracts/security/ReentrancyGuardUpgradeable.sol`](file:///Users/nilanjanmondal/blockProjects/contracts/contracts/security/ReentrancyGuardUpgradeable.sol): Upgrade-safe reentrancy protection.
- [`contracts/test/BlockEscrow.test.js`](file:///Users/nilanjanmondal/blockProjects/contracts/test/BlockEscrow.test.js): 16 automated test suites verifying all Phase 1 requirements.

### Running Tests
```bash
npm test
```
