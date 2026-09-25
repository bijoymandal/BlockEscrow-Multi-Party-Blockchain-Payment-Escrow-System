const test = require("node:test");
const assert = require("node:assert");
const { QueueService } = require("../src/services/queue.service");

test("Phase 3: BullMQ Notification Queue & Exponential Backoff Retries", async (t) => {
  await t.test("TC-BE-08: should process job successfully on first attempt", async () => {
    const queue = new QueueService();
    let handled = false;

    queue.registerHandler("SEND_EMAIL", async (payload) => {
      handled = true;
      return { sent: true, to: payload.to };
    });

    const job = await queue.addJob("SEND_EMAIL", { to: "buyer@example.com", subject: "Milestone Released" });

    assert.strictEqual(handled, true);
    assert.strictEqual(job.status, "COMPLETED");
    assert.strictEqual(job.attempts, 1);
    assert.strictEqual(job.result.sent, true);
  });

  await t.test("TC-BE-08b: should retry with exponential backoff and succeed after transient failure", async () => {
    const queue = new QueueService({ maxRetries: 3, baseDelayMs: 10 });
    let attemptsCount = 0;

    // Fails on attempt 1, succeeds on attempt 2
    queue.registerHandler("DISPUTE_ALERT", async (payload) => {
      attemptsCount++;
      if (attemptsCount === 1) {
        throw new Error("SMTP Gateway Transient 503");
      }
      return { notified: true };
    });

    const job = await queue.addJob("DISPUTE_ALERT", { escrowId: 10, reason: "Non-delivery" });

    assert.strictEqual(attemptsCount, 2);
    assert.strictEqual(job.status, "COMPLETED");
    assert.strictEqual(job.attempts, 2);
  });

  await t.test("TC-BE-08c: should route job to dead-letter state after exceeding max retries", async () => {
    const queue = new QueueService({ maxRetries: 3, baseDelayMs: 5 });

    // Always fails
    queue.registerHandler("PERSISTENT_FAIL", async () => {
      throw new Error("Connection refused permanently");
    });

    const job = await queue.addJob("PERSISTENT_FAIL", { data: 123 });

    assert.strictEqual(job.attempts, 3);
    assert.strictEqual(job.status, "DEAD_LETTER");
    assert.strictEqual(job.lastError, "Connection refused permanently");
    assert.strictEqual(queue.failedJobs.length, 1);
  });
});
