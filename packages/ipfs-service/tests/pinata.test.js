const test = require("node:test");
const assert = require("node:assert");
const { PinataService } = require("../src/pinata.service");

test("IPFS-202: PinataService Suite", async (t) => {
  const pinata = new PinataService();

  await t.test("pinJSONToIPFS should produce canonical CIDv1 string in fallback mode", async () => {
    const payload = {
      version: "1.0.0",
      title: "Test Agreement",
      totalAmount: "5000",
    };

    const res = await pinata.pinJSONToIPFS(payload, { name: "test-meta" });
    assert.ok(res.cid);
    assert.strictEqual(typeof res.cid, "string");
    assert.ok(res.cid.startsWith("bafkrei"));
    assert.strictEqual(res.isLocalFallback, true);
    assert.ok(res.pinSize > 0);
  });

  await t.test("pinFileToIPFS should produce valid CID from binary buffer", async () => {
    const buffer = Buffer.from("Hello BlockEscrow IPFS Decentralized Storage");
    const res = await pinata.pinFileToIPFS(buffer, "deliverable.txt", "text/plain");

    assert.ok(res.cid);
    assert.ok(res.cid.startsWith("bafkrei"));
    assert.strictEqual(res.pinSize, buffer.length);
  });

  await t.test("pinJSONToIPFS should reject invalid non-object input", async () => {
    await assert.rejects(async () => {
      await pinata.pinJSONToIPFS(null);
    }, /Invalid jsonBody/);
  });

  await t.test("pinFileToIPFS should reject non-buffer input", async () => {
    await assert.rejects(async () => {
      await pinata.pinFileToIPFS("not-a-buffer", "test.txt");
    }, /Invalid fileBuffer/);
  });
});
