const { theme } = require("../../config/theme.tokens");
const { SUPPORTED_CHAINS, isSupportedChain } = require("../../config/chains");
const { renderButton } = require("../ui/Button");

/**
 * Renders a network warning and switch banner if the user's active chain is unsupported.
 */
function renderNetworkSwitchBanner({ currentChainId, targetChainId = 137, onSwitch = null } = {}) {
  const isSupported = isSupportedChain(currentChainId);

  if (isSupported) {
    return {
      visible: false,
      html: "",
    };
  }

  const targetChain = SUPPORTED_CHAINS[targetChainId] || Object.values(SUPPORTED_CHAINS)[0];
  const switchBtnHtml = renderButton({
    label: `Switch to ${targetChain.name}`,
    variant: "warning",
    size: "sm",
  });

  const html = `
<div class="network-switch-banner" style="
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: ${theme.radii.md};
  padding: ${theme.spacing[3]} ${theme.spacing[4]};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${theme.spacing[3]};
  font-family: ${theme.typography.fontFamily.sans};
  color: ${theme.colors.state.warning};
">
  <div style="display: flex; align-items: center; gap: ${theme.spacing[2]};">
    <span style="font-size: ${theme.typography.fontSize.lg};">⚠️</span>
    <div>
      <div style="font-weight: ${theme.typography.fontWeight.semibold}; font-size: ${theme.typography.fontSize.sm};">
        Unsupported Network (Chain ID: ${currentChainId || "Unknown"})
      </div>
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.secondary};">
        BlockEscrow operates on Polygon, Arbitrum, and Sepolia testnet. Please switch your network.
      </div>
    </div>
  </div>
  <div>
    ${switchBtnHtml}
  </div>
</div>
`.trim();

  return {
    visible: true,
    currentChainId,
    targetChainId,
    html,
  };
}

module.exports = {
  renderNetworkSwitchBanner,
};
