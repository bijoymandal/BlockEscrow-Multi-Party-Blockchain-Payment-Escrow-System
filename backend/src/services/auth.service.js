const crypto = require("crypto");

/**
 * Sign-In with Ethereum (SIWE / EIP-4361) and JWT Authentication Service
 */
class AuthService {
  constructor(config = {}) {
    this.jwtSecret = config.jwtSecret || process.env.JWT_SECRET || "default_dev_jwt_secret_min_32_characters";
    this.nonceTtlMs = (config.nonceTtlSeconds || 300) * 1000; // 5 minutes
    this.nonces = new Map(); // address => { nonce, expiresAt }
  }

  /**
   * Generates a 32-character cryptographically secure single-use nonce for a wallet.
   */
  generateNonce(walletAddress) {
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error("Invalid Ethereum wallet address");
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const nonce = crypto.randomBytes(16).toString("hex");

    this.nonces.set(normalizedAddress, {
      nonce,
      expiresAt: Date.now() + this.nonceTtlMs,
    });

    return nonce;
  }

  /**
   * Verifies and immediately consumes a single-use nonce.
   */
  verifyAndConsumeNonce(walletAddress, nonce) {
    const normalizedAddress = walletAddress.toLowerCase();
    const stored = this.nonces.get(normalizedAddress);

    if (!stored) {
      return { valid: false, error: "Nonce not found or already consumed" };
    }

    if (Date.now() > stored.expiresAt) {
      this.nonces.delete(normalizedAddress);
      return { valid: false, error: "Nonce has expired" };
    }

    if (stored.nonce !== nonce) {
      return { valid: false, error: "Nonce mismatch" };
    }

    // Immediately consume nonce to prevent replay attacks
    this.nonces.delete(normalizedAddress);
    return { valid: true };
  }

  /**
   * Constructs standard EIP-4361 compliant message.
   */
  createSIWEMessage({ domain, address, uri, version = "1", chainId = 137, nonce, issuedAt }) {
    return [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      "Sign in to BlockEscrow Decentralized Protocol.",
      "",
      `URI: ${uri}`,
      `Version: ${version}`,
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
    ].join("\n");
  }

  /**
   * Generates a signed JWT token for an authenticated user session.
   */
  generateJwt(payload, expiresInSeconds = 86400) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: now,
        exp: now + expiresInSeconds,
      })
    ).toString("base64url");

    const signature = crypto
      .createHmac("sha256", this.jwtSecret)
      .update(`${header}.${body}`)
      .digest("base64url");

    return `${header}.${body}.${signature}`;
  }

  /**
   * Verifies a JWT token.
   */
  verifyJwt(token) {
    if (!token || typeof token !== "string") {
      throw new Error("Invalid token format");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Malformed JWT token");
    }

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", this.jwtSecret)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) {
      throw new Error("Invalid JWT signature");
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      throw new Error("JWT token has expired");
    }

    return payload;
  }
}

module.exports = { AuthService, authService: new AuthService() };
