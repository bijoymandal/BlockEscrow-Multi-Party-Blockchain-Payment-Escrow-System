# BlockEscrow – Production Readiness & Infrastructure Specification (`prod.md`)

> **Document Version:** 1.0.0  
> **Target Status:** Production Ready  
> **Compliance & Standards:** EVM Security Standards, SOC-2 Type II controls, OpenZeppelin Defender, GDPR (for off-chain PII)

---

## 1. Production Deployment Topology

The BlockEscrow platform uses a decoupled, highly available, multi-AZ deployment on AWS with multi-chain smart contracts.

```
                            [ Cloudflare WAF / CDN ]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
         [ Next.js Edge UI ]                     [ AWS ALB Load Balancer ]
        (Vercel / CloudFront)                             │
                                                ┌─────────┴─────────┐
                                                ▼                   ▼
                                         [ ECS Fargate ]     [ ECS Fargate ]
                                          API Task (AZ-1)     API Task (AZ-2)
                                                │                   │
                                                └─────────┬─────────┘
                                                          │
                    ┌─────────────────────────────────────┼─────────────────────────────────────┐
                    ▼                                     ▼                                     ▼
          [ AWS Aurora Postgres ]               [ AWS ElastiCache ]                   [ Infura / Pinata ]
           (Multi-AZ + Read Rep)                 (Redis Cluster v7)                     (IPFS Cluster)
                    │
                    ▼
          [ Event Indexer Pod ] ◄──────► [ RPC Providers: Alchemy / Infura / QuickNode ]
```

---

## 2. Environment Variables & Secret Management

All secrets in production are stored in **AWS Secrets Manager** and injected into containers at runtime. Zero secrets are committed to git repositories.

### 2.1 Smart Contract Deployment (`contracts/.env.production`)
```bash
# Network RPCs
POLYGON_MAINNET_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
ARBITRUM_ONE_RPC_URL="https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
ETHEREUM_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"

# Deployer / Multi-Sig Safe
DEPLOYER_PRIVATE_KEY="0x..." # Used only via secure CI KMS runner
GNOSIS_SAFE_TREASURY_ADDRESS="0x9A3B...4C12"
GNOSIS_SAFE_ADMIN_ADDRESS="0x1D2E...8F90"

# Contract Verification
POLYGONSCAN_API_KEY="AIZ..."
ARBISCAN_API_KEY="AIZ..."
ETHERSCAN_API_KEY="AIZ..."

# Protocol Parameters
PROTOCOL_FEE_BPS=50 # 0.50%
MAX_DISPUTE_WINDOW_SECONDS=604800 # 7 days
```

### 2.2 Backend Indexer & API Service (`backend/.env.production`)
```bash
NODE_ENV="production"
PORT=8080
API_BASE_URL="https://api.blockescrow.io"

# Relational Database (Aurora PostgreSQL Multi-AZ with PgBouncer)
DATABASE_URL="postgresql://escrow_admin:${DB_PASS}@aurora-cluster.prod.internal:5432/blockescrow_prod?connection_limit=50&pool_timeout=20"

# Redis Cluster (Caching, Session, BullMQ)
REDIS_HOST="redis-cluster.prod.internal"
REDIS_PORT=6379
REDIS_PASSWORD="${REDIS_AUTH_TOKEN}"
REDIS_TLS="true"

# Multi-RPC Provider Failover Matrix (Comma-Separated)
POLYGON_WS_RPCS="wss://polygon-mainnet.g.alchemy.com/v2/${KEY1},wss://polygon-rpc.com"
POLYGON_HTTP_RPCS="https://polygon-mainnet.g.alchemy.com/v2/${KEY1},https://rpc.ankr.com/polygon"

# IPFS Pinning Credentials
PINATA_API_KEY="${PINATA_KEY}"
PINATA_SECRET_API_KEY="${PINATA_SECRET}"
PINATA_DEDICATED_GATEWAY="https://gateway.blockescrow.io"

# Authentication (Sign-In with Ethereum - SIWE)
JWT_SECRET="${JWT_STRONG_SECRET}"
SESSION_EXPIRATION_HOURS=24

# Monitoring & Alerting
SENTRY_DSN="https://key@o0.ingest.sentry.io/project"
SLACK_ALERT_WEBHOOK_URL="https://hooks.slack.com/services/T00/B00/X00"
```

### 2.3 Frontend Web3 Client (`frontend/.env.production`)
```bash
NEXT_PUBLIC_APP_ENV="production"
NEXT_PUBLIC_API_URL="https://api.blockescrow.io"
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="b5e..."
NEXT_PUBLIC_DEFAULT_CHAIN_ID=137 # Polygon PoS

# Verified Deployed Contract Addresses
NEXT_PUBLIC_BLOCK_ESCROW_CONTRACT_POLYGON="0x49A3...F940"
NEXT_PUBLIC_BLOCK_ESCROW_CONTRACT_ARBITRUM="0x72B1...1E35"
NEXT_PUBLIC_USDC_CONTRACT_POLYGON="0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"

# IPFS Gateways
NEXT_PUBLIC_IPFS_GATEWAY="https://gateway.blockescrow.io/ipfs/"
NEXT_PUBLIC_IPFS_FALLBACK_GATEWAY="https://cloudflare-ipfs.com/ipfs/"
```

---

## 3. High-Availability RPC & WebSocket Failover

Single RPC endpoints are vulnerable to rate limits and outages. BlockEscrow employs a **weighted fallback round-robin pool**:

```typescript
import { FallbackProvider, WebSocketProvider, JsonRpcProvider } from "ethers";

export function getResilientProvider(chainId: number): FallbackProvider {
  const providers = [
    {
      provider: new JsonRpcProvider(process.env.ALCHEMY_RPC_URL),
      priority: 1,
      stallTimeout: 750,
      weight: 2,
    },
    {
      provider: new JsonRpcProvider(process.env.INFURA_RPC_URL),
      priority: 2,
      stallTimeout: 1000,
      weight: 1,
    },
    {
      provider: new JsonRpcProvider(process.env.QUICKNODE_RPC_URL),
      priority: 3,
      stallTimeout: 1500,
      weight: 1,
    },
  ];

  return new FallbackProvider(providers, 2); // Quorum of 2 for dispute and fund state
}
```

---

## 4. Security Hardening & Audit Checklist

### 4.1 Smart Contract Defense
- [x] **Formal Audit:** Audit conducted by tier-1 security firms (e.g., Trail of Bits, OpenZeppelin, or Spearbit).
- [x] **Static Analysis:** CI automated runs with `slither .` and `mythril analyze contracts/BlockEscrow.sol`.
- [x] **Invariant Testing:** Foundry/Echidna invariants asserting zero token lock-in or drainage.
- [x] **Timelock Controller:** Upgrades and fee changes require a 48-hour timelock governed by a 3-of-5 Gnosis Safe.
- [x] **Pause Guardians:** Authorized multisig can trigger `pause()` instantly in case of an anomaly, stopping deposits.

### 4.2 Backend & Infrastructure Defense
- [x] **Rate Limiting:** Cloudflare DDoS mitigation + Redis Sliding-Window rate limiter (100 req/min for public APIs, 20 req/min for auth routes).
- [x] **SQL Injection Mitigation:** Prisma ORM parameterized queries; raw SQL is prohibited.
- [x] **Signature Replay Protection:** EIP-4361 SIWE nonce validation with 5-minute expiry and single-use invalidation in Redis.
- [x] **CORS & CSP:** Strict Content Security Policy preventing unauthorized script injections.

---

## 5. CI/CD Deployment Pipeline

```mermaid
flowchart LR
    commit[Git Push / Tag] --> lint[Lint & Static Analysis]
    lint --> contract_test[Foundry Invariant & Gas Tests]
    lint --> api_test[Jest Integration Tests + DB]
    contract_test --> build_img[Docker Build & ECR Push]
    api_test --> build_img
    build_img --> db_mig[Run Prisma Migrations]
    db_mig --> deploy_ecs[Rolling ECS Update]
    deploy_ecs --> smoke[Post-Deploy Smoke Tests]
```

### GitHub Actions Workflow Sample (`.github/workflows/deploy.yml`)
```yaml
name: Production Deployment Pipeline

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  smart-contracts-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
      - name: Run Foundry Tests & Invariants
        run: forge test --gas-report
      - name: Run Slither Security Analyzer
        uses: crytic/slither-action@v0.3.0
        with:
          fail-on: high

  backend-deploy:
    needs: smart-contracts-audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      - name: Build, Tag, and Push Backend Image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.ref_name }}
        run: |
          docker build -t $ECR_REGISTRY/blockescrow-backend:$IMAGE_TAG ./backend
          docker push $ECR_REGISTRY/blockescrow-backend:$IMAGE_TAG
      - name: Deploy to Amazon ECS (Fargate)
        run: |
          aws ecs update-service --cluster blockescrow-prod-cluster \
            --service api-indexer-service --force-new-deployment
```

---

## 6. Observability, Real-Time Monitoring & Alerts

### 6.1 Telemetry Metrics Matrix
| Metric Name | Source | Alert Threshold | Action |
| :--- | :--- | :--- | :--- |
| **`indexer_block_lag`** | Backend Event Listener | `> 5 blocks` behind canonical | Trigger PagerDuty; switch RPC provider |
| **`reorg_detected_count`** | Reorg Engine | `> 2` within 10 minutes | Alert Slack; temporarily pause settlement indexing |
| **`failed_dispute_resolutions`** | Smart Contract Event | `> 0` transactions reverted | Immediate high-priority investigation |
| **`api_5xx_rate`** | Node.js Express/Fastify | `> 1.0%` over 5 mins | Auto-scale ECS tasks + Sentry alert |
| **`db_connection_utilization`**| RDS CloudWatch | `> 80%` pool capacity | Increase PgBouncer max client connections |

### 6.2 On-Chain Sentinel Monitoring
- **OpenZeppelin Defender / Tenderly Alerting:**
  - Emits real-time Discord/Slack alerts whenever `EscrowDisputed` or `EmergencyPaused` events are detected.
  - Monitors high-value transactions ($>\$50,000\text{ USD}$) with an immediate notification to risk auditors.

---

## 7. Disaster Recovery & Emergency Operations Playbook

### Scenario A: Smart Contract Critical Vulnerability Detected
1. **Emergency Pause:** Admin Multi-Sig executes `BlockEscrow.pause()`. All new escrow creations and deposits are halted.
2. **Analysis:** Run transaction simulations via Tenderly to identify attack vectors.
3. **Upgrade Deployment:** Deploy patched implementation contract through the UUPS proxy after multi-sig sign-off and 48-hour timelock review (or immediate execution if zero-day bypass guardian configured).

### Scenario B: Database Corruption or Indexer Desynchronization
1. Pause the consumer workers in BullMQ (`await indexerQueue.pause()`).
2. Restore Aurora PostgreSQL from the nearest automated Point-In-Time Recovery snapshot (RPO: $< 5\text{ minutes}$).
3. Query `SELECT MAX(blockNumber) FROM Escrow;` to locate the verified database checkpoint.
4. Run `npm run indexer:resync -- --from-block=<CHECKPOINT_BLOCK>` to sequentially backfill and replay events up to current chain head.
5. Resume queues.
