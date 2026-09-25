/**
 * Multi-Gateway IPFS Resolver with Latency Racing and Cache
 * Tries multiple public & dedicated gateways simultaneously to retrieve content with minimum latency.
 */
class GatewayResolver {
  constructor(config = {}) {
    this.gateways = config.gateways || [
      process.env.IPFS_DEDICATED_GATEWAY,
      "https://cloudflare-ipfs.com/ipfs/",
      "https://ipfs.io/ipfs/",
      "https://gateway.pinata.cloud/ipfs/",
      "https://dweb.link/ipfs/",
    ].filter(Boolean);

    this.timeoutMs = config.timeoutMs || 6000;
    this.cache = new Map(); // Simple in-memory cache: CID => { data, expiresAt }
    this.cacheTtlMs = config.cacheTtlMs || 60 * 60 * 1000; // 1 hour default
  }

  /**
   * Fetches JSON content from IPFS by racing multiple gateways.
   * @param {string} cid - The IPFS content identifier.
   * @returns {Promise<{ data: any, sourceGateway: string, latencyMs: number }>}
   */
  async fetchJSON(cid) {
    if (!cid || typeof cid !== "string") {
      throw new Error("Invalid CID: Must be a non-empty string");
    }

    // Check cache
    const cached = this._getFromCache(cid);
    if (cached) {
      return {
        data: cached.data,
        sourceGateway: "cache",
        latencyMs: 0,
      };
    }

    const cleanCid = cid.replace(/^ipfs:\/\//, "").trim();

    // Create abort controller for timeout racing
    const startTime = Date.now();

    // Race gateway fetch requests
    const fetchPromises = this.gateways.map(async (gateway) => {
      const url = `${gateway.replace(/\/+$/, "")}/${cleanCid}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Gateway returned HTTP ${res.status}`);
        }

        const data = await res.json();
        const latencyMs = Date.now() - startTime;
        return { data, sourceGateway: gateway, latencyMs };
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    });

    try {
      // Promise.any resolves as soon as ANY gateway successfully returns valid data
      const result = await Promise.any(fetchPromises);
      this._saveToCache(cid, result.data);
      return result;
    } catch (aggregateError) {
      throw new Error(`Failed to resolve CID [${cid}] across ${this.gateways.length} gateways: ${aggregateError.errors.map(e => e.message).join(", ")}`);
    }
  }

  /**
   * Fetches raw binary content from IPFS.
   * @param {string} cid - IPFS CID.
   * @returns {Promise<{ buffer: Buffer, sourceGateway: string, latencyMs: number }>}
   */
  async fetchBuffer(cid) {
    if (!cid) throw new Error("Invalid CID");
    const cleanCid = cid.replace(/^ipfs:\/\//, "").trim();
    const startTime = Date.now();

    const fetchPromises = this.gateways.map(async (gateway) => {
      const url = `${gateway.replace(/\/+$/, "")}/${cleanCid}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Gateway error: ${res.status}`);

        const arrayBuffer = await res.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          sourceGateway: gateway,
          latencyMs: Date.now() - startTime,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    });

    return await Promise.any(fetchPromises);
  }

  _getFromCache(cid) {
    const item = this.cache.get(cid);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(cid);
      return null;
    }
    return item;
  }

  _saveToCache(cid, data) {
    this.cache.set(cid, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = { GatewayResolver };
