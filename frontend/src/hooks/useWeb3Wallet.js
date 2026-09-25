const { isSupportedChain, getChainConfig } = require("../config/chains");
const { truncateAddress } = require("../config/theme.tokens");

/**
 * useWeb3Wallet Hook State Manager
 * Emulates Wagmi v2 account, network, and provider lifecycle.
 */
class Web3WalletState {
  constructor(config = {}) {
    this.provider = config.provider || (typeof window !== "undefined" && window.ethereum) || null;
    this.isConnected = Boolean(config.isConnected);
    this.address = config.address || null;
    this.chainId = config.chainId !== undefined ? config.chainId : (this.isConnected ? 137 : null);
    this.balance = config.balance || "0.00";
    this.balanceEth = config.balanceEth || "0.00";
    this.listeners = new Set();

    if (this.provider && typeof this.provider.on === "function") {
      this._bindProviderEvents();
    }
  }

  _bindProviderEvents() {
    this._handleAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        this.disconnect();
      } else {
        this.address = accounts[0];
        this._notify();
      }
    };

    this._handleChainChanged = (chainIdHex) => {
      this.chainId = parseInt(chainIdHex, 16);
      this._notify();
    };

    this._handleDisconnect = () => {
      this.disconnect();
    };

    this.provider.on("accountsChanged", this._handleAccountsChanged);
    this.provider.on("chainChanged", this._handleChainChanged);
    this.provider.on("disconnect", this._handleDisconnect);
  }

  async connect(params = {}) {
    if (params.provider) {
      this.provider = params.provider;
      if (typeof this.provider.on === "function") {
        this._bindProviderEvents();
      }
    }

    if (this.provider && typeof this.provider.request === "function") {
      const accounts = await this.provider.request({ method: "eth_requestAccounts" });
      const rawChainId = await this.provider.request({ method: "eth_chainId" });
      const hexBalance = await this.provider.request({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      }).catch(() => "0x0");

      this.isConnected = true;
      this.address = accounts[0];
      this.chainId = typeof rawChainId === "string" ? parseInt(rawChainId, 16) : Number(rawChainId);
      
      const wei = BigInt(hexBalance || "0x0");
      this.balanceEth = (Number(wei) / 1e18).toFixed(4);
      this.balance = this.balanceEth;

      this._notify();
      return this.getState();
    }

    // Direct parameter fallback (e.g. mock manual connect)
    const address = params.address || this.address;
    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      throw new Error("Invalid Ethereum wallet address");
    }

    this.isConnected = true;
    this.address = address;
    this.chainId = params.chainId || 137;
    this.balance = params.balance || "10.0";
    this.balanceEth = this.balance;
    this._notify();

    return this.getState();
  }

  disconnect() {
    this.isConnected = false;
    this.address = null;
    this.chainId = null;
    this.balance = "0.00";
    this.balanceEth = "0.00";
    this._notify();
    return this.getState();
  }

  switchChain(newChainId) {
    if (!isSupportedChain(newChainId)) {
      throw new Error(`Unsupported network chain ID: ${newChainId}`);
    }
    this.chainId = Number(newChainId);
    this._notify();
    return this.getState();
  }

  getState() {
    return {
      isConnected: this.isConnected,
      address: this.address,
      truncatedAddress: this.address ? truncateAddress(this.address) : null,
      chainId: this.chainId,
      chainConfig: this.chainId ? getChainConfig(this.chainId) : null,
      isSupportedNetwork: this.chainId ? isSupportedChain(this.chainId) : false,
      balance: this.balance,
      balanceEth: this.balanceEth,
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getState());
      } catch (err) {
        console.error("Error in Web3WalletState listener:", err);
      }
    }
  }
}

module.exports = {
  Web3WalletState,
};
