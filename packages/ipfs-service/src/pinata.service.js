const crypto = require("crypto");

/**
 * Service for pinning JSON metadata and files to IPFS via Pinata API
 * Includes retry mechanism, timeout resilience, and local deterministic fallback.
 */
class PinataService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.PINATA_API_KEY || "";
    this.apiSecret = config.apiSecret || process.env.PINATA_SECRET_API_KEY || "";
    this.jwt = config.jwt || process.env.PINATA_JWT || "";
    this.pinataBaseUrl = config.baseUrl || "https://api.pinata.cloud";
    this.maxRetries = config.maxRetries || 3;
    this.retryDelayMs = config.retryDelayMs || 500;
  }

  /**
   * Generates a deterministic mock IPFS CID for offline, testing, or development environments.
   */
  generateLocalCid(contentBuffer) {
    const hash = crypto.createHash("sha256").update(contentBuffer).digest("hex");
    // Prefix with canonical IPFS CIDv1 raw multihash identifier
    return `bafkrei${hash.slice(0, 52)}`;
  }

  /**
   * Pins JSON metadata to IPFS.
   * @param {Object} jsonBody - The JavaScript object / agreement metadata to pin.
   * @param {Object} [options] - Custom metadata (e.g. name, keyvalues).
   * @returns {Promise<{ cid: string, pinSize: number, timestamp: string }>}
   */
  async pinJSONToIPFS(jsonBody, options = {}) {
    if (!jsonBody || typeof jsonBody !== "object") {
      throw new Error("Invalid jsonBody: Must be a non-null object");
    }

    const payload = {
      pinataContent: jsonBody,
      pinataMetadata: {
        name: options.name || `blockescrow-meta-${Date.now()}`,
        keyvalues: options.keyvalues || {},
      },
      pinataOptions: {
        cidVersion: 1,
      },
    };

    // If API credentials are not provided (e.g. testing / sandbox), generate local CID
    if (!this.jwt && (!this.apiKey || !this.apiSecret)) {
      const buffer = Buffer.from(JSON.stringify(jsonBody));
      const mockCid = this.generateLocalCid(buffer);
      return {
        cid: mockCid,
        pinSize: buffer.length,
        timestamp: new Date().toISOString(),
        isLocalFallback: true,
      };
    }

    return this._executeWithRetry(async () => {
      const headers = {
        "Content-Type": "application/json",
      };

      if (this.jwt) {
        headers["Authorization"] = `Bearer ${this.jwt}`;
      } else {
        headers["pinata_api_key"] = this.apiKey;
        headers["pinata_secret_api_key"] = this.apiSecret;
      }

      const res = await fetch(`${this.pinataBaseUrl}/pinning/pinJSONToIPFS`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Pinata API Error [${res.status}]: ${errorText}`);
      }

      const data = await res.json();
      return {
        cid: data.IpfsHash,
        pinSize: data.PinSize,
        timestamp: data.Timestamp,
        isLocalFallback: false,
      };
    });
  }

  /**
   * Pins binary file buffer to IPFS.
   * @param {Buffer} fileBuffer - The raw file bytes.
   * @param {string} filename - The original file name.
   * @param {string} [mimeType] - Optional MIME type.
   * @returns {Promise<{ cid: string, pinSize: number, timestamp: string }>}
   */
  async pinFileToIPFS(fileBuffer, filename, mimeType = "application/octet-stream") {
    if (!Buffer.isBuffer(fileBuffer)) {
      throw new Error("Invalid fileBuffer: Must be a Node.js Buffer");
    }

    if (!this.jwt && (!this.apiKey || !this.apiSecret)) {
      const mockCid = this.generateLocalCid(fileBuffer);
      return {
        cid: mockCid,
        pinSize: fileBuffer.length,
        timestamp: new Date().toISOString(),
        isLocalFallback: true,
      };
    }

    return this._executeWithRetry(async () => {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append("file", blob, filename);

      const headers = {};
      if (this.jwt) {
        headers["Authorization"] = `Bearer ${this.jwt}`;
      } else {
        headers["pinata_api_key"] = this.apiKey;
        headers["pinata_secret_api_key"] = this.apiSecret;
      }

      const res = await fetch(`${this.pinataBaseUrl}/pinning/pinFileToIPFS`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Pinata File Upload Error [${res.status}]: ${errorText}`);
      }

      const data = await res.json();
      return {
        cid: data.IpfsHash,
        pinSize: data.PinSize,
        timestamp: data.Timestamp,
        isLocalFallback: false,
      };
    });
  }

  /**
   * Executes an asynchronous network call with exponential backoff retries.
   */
  async _executeWithRetry(fn) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }
}

module.exports = { PinataService };
