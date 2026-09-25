const test = require("node:test");
const assert = require("node:assert");
const { GatewayResolver } = require("../src/gateway.resolver");
const {
  validateAndPinAgreement,
  validateAndPinDeliverable,
  validateAndPinDispute,
} = require("../src/index");

test("IPFS-203: GatewayResolver & Integration Suite", async (t) => {
  const resolver = new GatewayResolver();

  await t.test("cache should store and return cached content with 0ms latency", async () => {
    const testCid = "bafkreitestcid123456";
    const sampleData = { title: "Cached Agreement", totalAmount: "1000" };

    resolver._saveToCache(testCid, sampleData);

    const fetched = await resolver.fetchJSON(testCid);
    assert.deepStrictEqual(fetched.data, sampleData);
    assert.strictEqual(fetched.sourceGateway, "cache");
    assert.strictEqual(fetched.latencyMs, 0);
  });

  await t.test("cache expiration should purge stale items", () => {
    const shortTtlResolver = new GatewayResolver({ cacheTtlMs: 50 });
    const expiredCid = "bafkrieexpired123";
    shortTtlResolver._saveToCache(expiredCid, { expired: true });

    // Manually force expiration timestamp
    const item = shortTtlResolver.cache.get(expiredCid);
    item.expiresAt = Date.now() - 1000;

    assert.strictEqual(shortTtlResolver._getFromCache(expiredCid), null);
  });

  await t.test("validateAndPinAgreement should validate and return pinned metadata", async () => {
    const agreement = {
      version: "1.0.0",
      title: "UI Design Sprint",
      buyer: "0x1111111111111111111111111111111111111111",
      seller: "0x2222222222222222222222222222222222222222",
      arbitrator: "0x3333333333333333333333333333333333333333",
      tokenSymbol: "USDC",
      totalAmount: "2500.00",
      milestones: [
        {
          index: 0,
          title: "Wireframes",
          amount: "2500.00",
          dueDate: "2026-10-10T00:00:00Z",
        },
      ],
    };

    const pinned = await validateAndPinAgreement(agreement);
    assert.ok(pinned.cid);
    assert.strictEqual(typeof pinned.cid, "string");
    assert.deepStrictEqual(pinned.data, agreement);
  });

  await t.test("validateAndPinDeliverable should validate and pin deliverable", async () => {
    const deliverable = {
      version: "1.0.0",
      escrowId: 5,
      milestoneIndex: 0,
      seller: "0x2222222222222222222222222222222222222222",
      summary: "Delivered Figma interactive prototypes and design system tokens.",
      submittedAt: "2026-09-25T15:00:00Z",
    };

    const pinned = await validateAndPinDeliverable(deliverable);
    assert.ok(pinned.cid);
    assert.strictEqual(pinned.data.escrowId, 5);
  });

  await t.test("validateAndPinDispute should reject invalid dispute filing", async () => {
    const invalidDispute = {
      version: "1.0.0",
      escrowId: 5,
      statement: "Short", // Too short
    };

    await assert.rejects(async () => {
      await validateAndPinDispute(invalidDispute);
    }, /Dispute validation failed/);
  });
});
