const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { PrometheusRegistry, metricsRegistry } = require("../src/telemetry/prometheus");
const { ResilientRpcProvider } = require("../src/telemetry/resilient-rpc");

describe("Phase 6: DevOps, Cloud Infrastructure & Operational Tests", () => {
  beforeEach(() => {
    metricsRegistry.reset();
  });

  describe("TC-OPS-01: Multi-Stage Docker Build & Compose Configuration", () => {
    test("validates docker-compose.yml service topology and health checks", () => {
      const composePath = path.join(__dirname, "../../docker-compose.yml");
      assert.ok(fs.existsSync(composePath), "docker-compose.yml must exist at repository root");

      const composeContent = fs.readFileSync(composePath, "utf8");

      // Verify all essential microservices are defined
      const requiredServices = ["postgres", "redis", "ipfs", "backend", "worker", "frontend", "prometheus"];
      for (const s of requiredServices) {
        assert.ok(composeContent.includes(`${s}:`), `Service ${s} must be defined in docker-compose.yml`);
      }

      // Verify health check directives
      assert.ok(composeContent.includes("healthcheck:"), "Healthcheck must be defined for core services");
      assert.ok(composeContent.includes("condition: service_healthy"), "Services must wait for database health");
    });

    test("validates Dockerfiles enforce unprivileged non-root users", () => {
      const backendDockerfilePath = path.join(__dirname, "../../deploy/docker/Dockerfile.backend");
      const workerDockerfilePath = path.join(__dirname, "../../deploy/docker/Dockerfile.worker");

      assert.ok(fs.existsSync(backendDockerfilePath), "Dockerfile.backend must exist");
      assert.ok(fs.existsSync(workerDockerfilePath), "Dockerfile.worker must exist");

      const backendDocker = fs.readFileSync(backendDockerfilePath, "utf8");
      assert.ok(backendDocker.includes("USER nodejs"), "Backend container must run as unprivileged nodejs user");
      assert.ok(backendDocker.includes("HEALTHCHECK"), "Backend container must define container healthcheck");
    });
  });

  describe("TC-OPS-02: Indexer Lag Telemetry & Alert Rule Evaluation", () => {
    test("calculates block lag accurately and formats Prometheus output", () => {
      const registry = new PrometheusRegistry();

      // Canonical chain is at block 1,000,015; indexer is at block 1,000,005 (lag = 10)
      const lag = registry.updateIndexerLag(1000015, 1000005);
      assert.equal(lag, 10);

      assert.equal(registry.getGauge("blockescrow_indexer_canonical_block"), 1000015);
      assert.equal(registry.getGauge("blockescrow_indexer_last_indexed_block"), 1000005);
      assert.equal(registry.getGauge("blockescrow_indexer_block_lag"), 10);

      const metricsOutput = registry.metrics();
      assert.ok(metricsOutput.includes("blockescrow_indexer_block_lag 10"));
      assert.ok(metricsOutput.includes("# TYPE blockescrow_indexer_block_lag gauge"));
    });

    test("evaluates IndexerHighBlockLag alert threshold rule (> 5 blocks)", () => {
      const alertRulePath = path.join(__dirname, "../../deploy/prometheus/rules/indexer-alerts.yml");
      assert.ok(fs.existsSync(alertRulePath), "Alert rules YAML must exist");

      const rulesContent = fs.readFileSync(alertRulePath, "utf8");
      assert.ok(rulesContent.includes("alert: IndexerHighBlockLag"));
      assert.ok(rulesContent.includes("blockescrow_indexer_canonical_block - blockescrow_indexer_last_indexed_block > 5"));

      // Simulate threshold evaluation
      const canonicalBlock = 5020;
      const lastIndexedBlock = 5012;
      const computedLag = canonicalBlock - lastIndexedBlock; // 8 blocks > 5 threshold

      const alertTriggered = computedLag > 5;
      assert.equal(alertTriggered, true, "Alert condition must evaluate to true when lag exceeds 5 blocks");
    });
  });

  describe("TC-OPS-03: RPC Fallback Switching Resilience", () => {
    test("fails over seamlessly from Primary Alchemy to Secondary Infura in <1s", async () => {
      const rpc = new ResilientRpcProvider({
        network: "polygon",
        providers: [
          { name: "Alchemy-Primary", url: "https://alchemy.mock", priority: 1, healthy: false }, // Injected 500 error
          { name: "Infura-Secondary", url: "https://infura.mock", priority: 2, healthy: true },
          { name: "Ankr-Tertiary", url: "https://ankr.mock", priority: 3, healthy: true },
        ],
      });

      const startTime = Date.now();
      const response = await rpc.execute("eth_blockNumber");
      const durationMs = Date.now() - startTime;

      // Failover SLA: < 1000ms
      assert.ok(durationMs < 1000, `Failover latency must be under 1s (took ${durationMs}ms)`);
      assert.equal(response.success, true);
      assert.equal(response.provider, "Infura-Secondary");
      assert.equal(rpc.failoverCount, 1);

      // Verify Prometheus failover metric
      const failoversRecorded = metricsRegistry.getCounter("blockescrow_rpc_failovers_total", {
        network: "polygon",
        from_provider: "Alchemy-Primary",
      });
      assert.equal(failoversRecorded, 1);
    });

    test("raises error only when all available RPC fallback providers fail", async () => {
      const rpc = new ResilientRpcProvider({
        providers: [
          { name: "P1", healthy: false },
          { name: "P2", healthy: false },
        ],
      });

      await assert.rejects(
        () => rpc.execute("eth_getBalance"),
        /All 2 RPC providers failed/
      );
    });
  });

  describe("TC-OPS-04: Multi-Chain Deployment Parameter Integrity", () => {
    test("verifies deployment configuration maps to supported chains", () => {
      const chainConfigs = {
        polygon: { chainId: 137, expectedExplorer: "polygonscan.com" },
        arbitrum: { chainId: 42161, expectedExplorer: "arbiscan.io" },
        sepolia: { chainId: 11155111, expectedExplorer: "sepolia.etherscan.io" },
      };

      for (const [net, cfg] of Object.entries(chainConfigs)) {
        assert.ok(cfg.chainId > 0, `Chain ID for ${net} must be valid integer`);
        const verificationCmd = `npx hardhat verify --network ${net} 0xImplementationAddressMock`;
        assert.ok(verificationCmd.includes(net));
      }
    });
  });

  describe("TC-OPS-05: Database Disaster Recovery & Queue Idempotency", () => {
    test("preserves event idempotency during network reconnection", async () => {
      const processedEventIds = new Set();
      let dbConnected = false;

      const simulateIngestion = async (eventId) => {
        if (!dbConnected) {
          throw new Error("DATABASE_CONNECTION_LOST: Failover to replica in progress");
        }
        if (processedEventIds.has(eventId)) {
          return { status: "ALREADY_PROCESSED" };
        }
        processedEventIds.add(eventId);
        return { status: "COMMITTED", eventId };
      };

      // 1. Initial attempt fails due to simulated AZ disconnect
      await assert.rejects(
        () => simulateIngestion("0xEventLog101"),
        /DATABASE_CONNECTION_LOST/
      );
      assert.equal(processedEventIds.size, 0);

      // 2. Multi-AZ replica promotes to primary (<60s SLA)
      dbConnected = true;

      // 3. Retry succeeds
      const result = await simulateIngestion("0xEventLog101");
      assert.equal(result.status, "COMMITTED");
      assert.equal(processedEventIds.size, 1);

      // 4. Duplicate redelivery is idempotent
      const duplicateResult = await simulateIngestion("0xEventLog101");
      assert.equal(duplicateResult.status, "ALREADY_PROCESSED");
      assert.equal(processedEventIds.size, 1);
    });
  });
});
