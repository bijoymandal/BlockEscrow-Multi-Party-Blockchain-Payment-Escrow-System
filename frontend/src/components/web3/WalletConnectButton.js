const { theme } = require("../../config/theme.tokens");
const { getChainConfig } = require("../../config/chains");

/**
 * Renders a WalletConnectButton component reflecting connection status, current network, and address.
 */
function renderWalletConnectButton(state = {}) {
  const {
    isConnected = false,
    isConnecting = false,
    address = null,
    chainId = null,
    balance = "0.0",
    error = null,
  } = state;

  const truncate = (addr) => (addr && addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr || "");

  if (isConnecting) {
    return {
      status: "connecting",
      html: `
<button class="wallet-btn connecting" disabled style="
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing[2]};
  padding: ${theme.spacing[2]} ${theme.spacing[4]};
  background: ${theme.colors.surface.nested};
  border: 1px solid ${theme.colors.border.subtle};
  border-radius: ${theme.radii.full};
  color: ${theme.colors.text.secondary};
  font-family: ${theme.typography.fontFamily.sans};
  font-size: ${theme.typography.fontSize.sm};
  cursor: wait;
">
  <span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid ${theme.colors.accent.primary}; border-top-color:transparent; border-radius:50%; animation: spin 1s linear infinite;"></span>
  <span>Connecting...</span>
</button>
`.trim(),
    };
  }

  if (isConnected && address) {
    const chain = getChainConfig(chainId);
    const networkName = chain ? chain.name : `Chain #${chainId}`;
    const isTestnet = chain ? chain.isTestnet : false;
    const dotColor = isTestnet ? theme.colors.state.warning : theme.colors.state.success;

    return {
      status: "connected",
      address,
      chainId,
      html: `
<div class="wallet-btn connected" style="
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing[2]};
  padding: 4px ${theme.spacing[3]} 4px ${theme.spacing[2]};
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.border.subtle};
  border-radius: ${theme.radii.full};
  font-family: ${theme.typography.fontFamily.sans};
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.text.primary};
  box-shadow: ${theme.shadows.card};
">
  <span style="display:inline-flex; align-items:center; gap:4px; font-size:${theme.typography.fontSize.xs}; background:${theme.colors.surface.nested}; padding:2px 8px; border-radius:${theme.radii.full}; color:${theme.colors.text.secondary};">
    <span style="width:6px; height:6px; border-radius:50%; background:${dotColor};"></span>
    ${networkName}
  </span>
  <span style="font-family:${theme.typography.fontFamily.mono}; font-weight:${theme.typography.fontWeight.semibold};">${truncate(address)}</span>
</div>
`.trim(),
    };
  }

  return {
    status: "disconnected",
    error,
    html: `
<button class="wallet-btn disconnected" style="
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing[2]};
  padding: ${theme.spacing[2]} ${theme.spacing[4]};
  background: ${theme.colors.accent.primary};
  color: #0b0f19;
  border: none;
  border-radius: ${theme.radii.full};
  font-family: ${theme.typography.fontFamily.sans};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  box-shadow: ${theme.shadows.glow};
  transition: opacity 0.2s ease;
">
  <span>Connect Wallet</span>
</button>
`.trim(),
  };
}

module.exports = {
  renderWalletConnectButton,
};
