const { authService } = require("../services/auth.service");

function createAuthRoutes() {
  const router = require("express").Router();

  // GET /api/v1/auth/nonce?address=0x...
  router.get("/nonce", (req, res) => {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ success: false, error: "Query parameter 'address' is required" });
    }

    try {
      const nonce = authService.generateNonce(address);
      return res.status(200).json({ success: true, nonce, address });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/v1/auth/verify
  router.post("/verify", (req, res) => {
    const { address, nonce, message, signature } = req.body;
    if (!address || !nonce) {
      return res.status(400).json({ success: false, error: "address and nonce are required" });
    }

    const nonceCheck = authService.verifyAndConsumeNonce(address, nonce);
    if (!nonceCheck.valid) {
      return res.status(401).json({ success: false, error: nonceCheck.error });
    }

    // In production with live web3 provider, verify ECDSA signature:
    // const recovered = ethers.verifyMessage(message, signature);
    // if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401)...

    // Issue JWT session token
    const token = authService.generateJwt({
      address: address.toLowerCase(),
      role: "USER",
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        address: address.toLowerCase(),
        role: "USER",
      },
    });
  });

  return router;
}

module.exports = { createAuthRoutes };
