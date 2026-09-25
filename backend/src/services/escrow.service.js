const { cacheService } = require("./cache.service");
const { validator } = require("../../../packages/ipfs-service/src");

class EscrowService {
  constructor(indexerService) {
    this.indexer = indexerService;
    this.drafts = new Map();
  }

  createDraftEscrow(data) {
    const validation = validator.validateAgreement(data);
    if (!validation.valid) {
      const err = new Error(`Validation failed: ${validation.errors.join("; ")}`);
      err.errors = validation.errors;
      throw err;
    }

    const draftId = `draft_${Date.now()}`;
    const draftRecord = {
      id: draftId,
      status: "DRAFT",
      ...data,
      createdAt: new Date().toISOString(),
    };

    this.drafts.set(draftId, draftRecord);
    return draftRecord;
  }

  getEscrow(escrowId) {
    const cacheKey = `escrow:${escrowId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return { ...cached, _fromCache: true };
    }

    const escrow = this.indexer.getEscrow(Number(escrowId));
    if (escrow) {
      cacheService.set(cacheKey, escrow, 300); // 5 min TTL
      return { ...escrow, _fromCache: false };
    }

    // Check drafts
    const draft = this.drafts.get(escrowId);
    return draft || null;
  }

  listEscrows(filter) {
    const cacheKey = `escrows:list:${JSON.stringify(filter || {})}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const list = this.indexer.listEscrows(filter);
    cacheService.set(cacheKey, list, 60);
    return list;
  }

  invalidateEscrowCache(escrowId) {
    return cacheService.invalidateEscrow(escrowId);
  }
}

module.exports = { EscrowService };
