const express = require("express");
const cors = require("cors");
const { createAuthRoutes } = require("./routes/auth.routes");
const { createEscrowRoutes } = require("./routes/escrow.routes");
const { EventIndexerService } = require("./services/indexer.service");
const { EscrowService } = require("./services/escrow.service");

function createApp(options = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const indexerService = options.indexerService || new EventIndexerService();
  const escrowService = options.escrowService || new EscrowService(indexerService);

  // Health check
  app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      indexer: {
        lastProcessedBlock: indexerService.lastProcessedBlock.toString(),
        confirmationDepth: indexerService.confirmationDepth,
      },
    });
  });

  // Mount API routes
  app.use("/api/v1/auth", createAuthRoutes());
  app.use("/api/v1/escrows", createEscrowRoutes(escrowService));

  return { app, indexerService, escrowService };
}

module.exports = { createApp };
