/**
 * Sign-In with Ethereum (SIWE / EIP-4361) Client Hook / Manager
 */

class SIWEService {
  constructor(config = {}) {
    this.apiBaseUrl = config.apiBaseUrl || "http://localhost:4000/api";
    this.domain = config.domain || (typeof window !== "undefined" ? window.location.host : "localhost:3000");
    this.uri = config.uri || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    this.token = null;
    this.user = null;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  getState() {
    return {
      isAuthenticated: Boolean(this.token && this.user),
      token: this.token,
      user: this.user,
    };
  }

  /**
   * Constructs standard EIP-4361 compliant message.
   */
  createMessage({ address, chainId = 137, nonce, issuedAt = new Date().toISOString() }) {
    if (!address) throw new Error("Wallet address is required for SIWE message");
    if (!nonce) throw new Error("Nonce is required for SIWE message");

    return [
      `${this.domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      "Sign in to BlockEscrow Decentralized Protocol.",
      "",
      `URI: ${this.uri}`,
      `Version: 1`,
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
    ].join("\n");
  }

  /**
   * Fetches nonce from backend or generates one if offline/mock.
   */
  async fetchNonce(walletAddress, customFetcher = null) {
    if (customFetcher) {
      return customFetcher(walletAddress);
    }
    const response = await fetch(`${this.apiBaseUrl}/auth/nonce?address=${encodeURIComponent(walletAddress)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch nonce: ${response.statusText}`);
    }
    const data = await response.json();
    return data.nonce;
  }

  /**
   * Performs full SIWE authentication flow given wallet address, chainId, and signer.
   */
  async signIn({ address, chainId, signMessageFn, fetchNonceFn = null, verifyFn = null }) {
    if (!address) throw new Error("Wallet address required for SIWE");
    if (typeof signMessageFn !== "function") throw new Error("Signer function required");

    // 1. Fetch Nonce
    const nonce = await this.fetchNonce(address, fetchNonceFn);

    // 2. Build message
    const issuedAt = new Date().toISOString();
    const message = this.createMessage({ address, chainId, nonce, issuedAt });

    // 3. Request signature from wallet
    const signature = await signMessageFn(message);

    // 4. Verify with backend
    let authResult;
    if (verifyFn) {
      authResult = await verifyFn({ message, signature, address });
    } else {
      const response = await fetch(`${this.apiBaseUrl}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, address }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `SIWE verification failed: ${response.statusText}`);
      }
      authResult = await response.json();
    }

    this.token = authResult.token;
    this.user = authResult.user || { address, chainId };
    this.notify();

    return { token: this.token, user: this.user };
  }

  signOut() {
    this.token = null;
    this.user = null;
    this.notify();
  }
}

module.exports = {
  SIWEService,
};
