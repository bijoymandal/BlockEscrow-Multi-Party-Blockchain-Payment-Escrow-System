const test = require("node:test");
const assert = require("node:assert");
const { AuthService } = require("../src/services/auth.service");

test("Phase 3: SIWE Authentication & JWT Token Management", async (t) => {
  const auth = new AuthService({ jwtSecret: "test_jwt_secret_key_1234567890_min_32" });
  const sampleWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  await t.test("TC-BE-04: should generate 32-character cryptographically secure nonce", () => {
    const nonce = auth.generateNonce(sampleWallet);
    assert.strictEqual(typeof nonce, "string");
    assert.strictEqual(nonce.length, 32);

    // Rejects invalid wallet address
    assert.throws(() => auth.generateNonce("invalid-addr"), /Invalid Ethereum wallet address/);
  });

  await t.test("TC-BE-05: should verify valid nonce and issue JWT token", () => {
    const nonce = auth.generateNonce(sampleWallet);
    const verification = auth.verifyAndConsumeNonce(sampleWallet, nonce);

    assert.strictEqual(verification.valid, true);

    const token = auth.generateJwt({ address: sampleWallet.toLowerCase(), role: "BUYER" });
    assert.strictEqual(typeof token, "string");

    const decoded = auth.verifyJwt(token);
    assert.strictEqual(decoded.address, sampleWallet.toLowerCase());
    assert.strictEqual(decoded.role, "BUYER");
  });

  await t.test("TC-BE-06: should prevent replay attacks by consuming nonce upon first use", () => {
    const nonce = auth.generateNonce(sampleWallet);

    // First use: Valid
    const firstCheck = auth.verifyAndConsumeNonce(sampleWallet, nonce);
    assert.strictEqual(firstCheck.valid, true);

    // Replay attempt with same nonce: Must fail
    const replayCheck = auth.verifyAndConsumeNonce(sampleWallet, nonce);
    assert.strictEqual(replayCheck.valid, false);
    assert.strictEqual(replayCheck.error, "Nonce not found or already consumed");
  });

  await t.test("TC-BE-06b: should reject expired nonces", () => {
    const shortTtlAuth = new AuthService({ nonceTtlSeconds: 0.01 }); // 10ms TTL
    const nonce = shortTtlAuth.generateNonce(sampleWallet);

    // Force expiration
    const record = shortTtlAuth.nonces.get(sampleWallet.toLowerCase());
    record.expiresAt = Date.now() - 1000;

    const res = shortTtlAuth.verifyAndConsumeNonce(sampleWallet, nonce);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, "Nonce has expired");
  });

  await t.test("TC-BE-05b: should reject tampered JWT tokens", () => {
    const token = auth.generateJwt({ address: sampleWallet.toLowerCase() });
    const parts = token.split(".");

    // Tamper with payload
    const tamperedPayload = Buffer.from(JSON.stringify({ address: "0xattacker", role: "ADMIN" })).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.throws(() => auth.verifyJwt(tamperedToken), /Invalid JWT signature/);
  });
});
