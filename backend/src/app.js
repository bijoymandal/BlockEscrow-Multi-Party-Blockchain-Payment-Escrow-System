const express = require("express");
const cors = require("cors");
const { createAuthRoutes } = require("./routes/auth.routes");
const { createEscrowRoutes } = require("./routes/escrow.routes");
const { EventIndexerService } = require("./services/indexer.service");
const { EscrowService } = require("./services/escrow.service");
const { metricsRegistry } = require("./telemetry/prometheus");

function createApp(options = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const indexerService = options.indexerService || new EventIndexerService();
  const escrowService = options.escrowService || new EscrowService(indexerService);

  // Telemetry middleware: track HTTP requests
  app.use((req, res, next) => {
    res.on("finish", () => {
      metricsRegistry.incCounter("blockescrow_http_requests_total", 1, {
        method: req.method,
        status: String(res.statusCode),
      });
    });
    next();
  });

  // Health check endpoints (for Docker and Load Balancers)
  const healthHandler = (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      indexer: {
        lastProcessedBlock: indexerService.lastProcessedBlock.toString(),
        confirmationDepth: indexerService.confirmationDepth,
      },
    });
  };

  app.get("/health", healthHandler);
  app.get("/api/v1/health", healthHandler);

  // Prometheus Metrics Scrape Endpoint
  app.get("/metrics", (req, res) => {
    // Sync indexer metrics
    metricsRegistry.setGauge("blockescrow_indexer_last_indexed_block", Number(indexerService.lastProcessedBlock));
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.status(200).send(metricsRegistry.metrics());
  });

  // Mount API routes
  app.use("/api/v1/auth", createAuthRoutes());
  app.use("/api/v1/escrows", createEscrowRoutes(escrowService));

  return { app, indexerService, escrowService };
}

module.exports = { createApp };
