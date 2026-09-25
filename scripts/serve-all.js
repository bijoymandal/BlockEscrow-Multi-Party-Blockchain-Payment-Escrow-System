#!/usr/bin/env node

const { fork } = require("child_process");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");

console.log("\n=======================================================");
console.log("🚀 Starting BlockEscrow Full-Stack Local Environment");
console.log("=======================================================\n");

// 1. Launch Backend API Server
const backendProcess = fork(path.join(ROOT_DIR, "backend", "src", "server.js"), [], {
  env: { ...process.env, PORT: "4000", NODE_ENV: "development" },
});

// 2. Launch Frontend DApp & Admin Web Server
const frontendProcess = fork(path.join(ROOT_DIR, "frontend", "server.js"), [], {
  env: { ...process.env, PORT: "3000", NODE_ENV: "development" },
});

console.log("✔ Backend API starting on:      http://localhost:4000");
console.log("✔ Telemetry & Metrics on:       http://localhost:4000/metrics");
console.log("✔ Frontend DApp & Admin on:     http://localhost:3000");
console.log("=======================================================");
console.log("💡 Press [Ctrl+C] to gracefully stop all services.\n");

function shutdown() {
  console.log("\n🛑 Stopping BlockEscrow services...");
  try {
    backendProcess.kill();
    frontendProcess.kill();
  } catch (e) {}
  console.log("✔ All services stopped.");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
