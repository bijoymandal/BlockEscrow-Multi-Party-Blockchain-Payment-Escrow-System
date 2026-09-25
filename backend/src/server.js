const { createApp } = require("./app");
require("dotenv").config();

const PORT = process.env.PORT || 8080;
const { app } = createApp();

const server = app.listen(PORT, () => {
  console.log(`[BlockEscrow API] Server running on port ${PORT}`);
  console.log(`[BlockEscrow API] Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = server;
