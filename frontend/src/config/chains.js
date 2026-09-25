/**
 * Supported Network Chains & RPC Configurations
 */
const SupportedChains = {
  137: {
    id: 137,
    name: "Polygon PoS",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com", "https://rpc.ankr.com/polygon"],
    blockExplorers: { default: { name: "PolygonScan", url: "https://polygonscan.com" } },
    testnet: false,
    isTestnet: false,
  },
  42161: {
    id: 42161,
    name: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorers: { default: { name: "Arbiscan", url: "https://arbiscan.io" } },
    testnet: false,
    isTestnet: false,
  },
  11155111: {
    id: 11155111,
    name: "Sepolia Testnet",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorers: { default: { name: "Etherscan", url: "https://sepolia.etherscan.io" } },
    testnet: true,
    isTestnet: true,
  },
};

const SUPPORTED_CHAINS = SupportedChains;

function isSupportedChain(chainId) {
  if (!chainId) return false;
  return Boolean(SupportedChains[Number(chainId)]);
}

function getChainConfig(chainId) {
  if (!chainId) return null;
  return SupportedChains[Number(chainId)] || null;
}

module.exports = {
  SupportedChains,
  SUPPORTED_CHAINS,
  isSupportedChain,
  getChainConfig,
};
