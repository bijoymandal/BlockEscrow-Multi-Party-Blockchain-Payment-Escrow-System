/**
 * Asynchronous Notification & Job Queue Service
 * Simulates BullMQ queue processing with retry semantics, exponential backoff, and dead-letter queue.
 */
class QueueService {
  constructor(config = {}) {
    this.jobs = new Map();
    this.completedJobs = [];
    this.failedJobs = [];
    this.maxRetries = config.maxRetries || 3;
    this.baseDelayMs = config.baseDelayMs || 50;
    this.handlers = new Map();
  }

  registerHandler(jobType, handlerFn) {
    this.handlers.set(jobType, handlerFn);
  }

  async addJob(jobType, payload, options = {}) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job = {
      id: jobId,
      type: jobType,
      payload,
      attempts: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      status: "QUEUED",
      createdAt: Date.now(),
    };

    this.jobs.set(jobId, job);
    await this._processJob(job);
    return job;
  }

  async _processJob(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = "FAILED";
      job.error = `No handler registered for job type: ${job.type}`;
      this.failedJobs.push(job);
      return;
    }

    job.status = "PROCESSING";

    while (job.attempts < job.maxRetries) {
      job.attempts++;
      try {
        const result = await handler(job.payload);
        job.status = "COMPLETED";
        job.result = result;
        job.completedAt = Date.now();
        this.completedJobs.push(job);
        return;
      } catch (err) {
        job.lastError = err.message;
        if (job.attempts < job.maxRetries) {
          const delay = this.baseDelayMs * Math.pow(2, job.attempts - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Exceeded max retries -> Dead Letter Queue
    job.status = "DEAD_LETTER";
    this.failedJobs.push(job);
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }
}

module.exports = { QueueService, queueService: new QueueService() };
