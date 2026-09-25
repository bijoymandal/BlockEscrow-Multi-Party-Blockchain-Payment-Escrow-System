const { theme } = require("../config/theme.tokens");
const { renderEscrowCard } = require("../components/escrow/EscrowCard");
const { renderWalletConnectButton } = require("../components/web3/WalletConnectButton");
const { renderNetworkSwitchBanner } = require("../components/web3/NetworkSwitchBanner");

/**
 * Dashboard View for BlockEscrow.
 * Renders portfolio statistics, active agreements, role filters, and Web3 connection status.
 */
function renderDashboardView({
  walletState = {},
  escrows = [],
  filter = "all", // "all", "buyer", "seller", "arbitrator"
} = {}) {
  const { isConnected, address, chainId } = walletState;
  const normalizedUser = (address || "").toLowerCase();

  // Filter escrows based on active tab
  const filteredEscrows = escrows.filter((e) => {
    if (filter === "buyer") return (e.buyer || "").toLowerCase() === normalizedUser;
    if (filter === "seller") return (e.seller || "").toLowerCase() === normalizedUser;
    if (filter === "arbitrator") return (e.arbitrator || "").toLowerCase() === normalizedUser;
    return true;
  });

  // Calculate high-level stats
  const totalValueLocked = escrows.reduce((sum, e) => sum + (parseFloat(e.totalAmount) || 0), 0);
  const activeCount = escrows.filter((e) => e.status !== "COMPLETED" && e.status !== "REFUNDED").length;
  const disputeCount = escrows.filter((e) => e.status === "DISPUTED").length;

  const walletBtnHtml = renderWalletConnectButton(walletState).html;
  const networkBanner = renderNetworkSwitchBanner({ currentChainId: chainId });

  const escrowCardsHtml =
    filteredEscrows.length > 0
      ? filteredEscrows
          .map(
            (e) => `
        <div style="min-width: 320px;">
          ${renderEscrowCard({ ...e, currentUserAddress: address }).html}
        </div>
      `
          )
          .join("")
      : `
        <div style="grid-column: 1 / -1; padding: ${theme.spacing[8]}; text-align: center; color: ${theme.colors.text.muted}; background: ${theme.colors.surface.card}; border: 1px dashed ${theme.colors.border.subtle}; border-radius: ${theme.radii.lg};">
          No escrow agreements found for this view.
        </div>
      `;

  const html = `
<div class="block-escrow-dashboard" style="
  background: ${theme.colors.surface.background};
  color: ${theme.colors.text.primary};
  min-height: 100vh;
  font-family: ${theme.typography.fontFamily.sans};
  padding: ${theme.spacing[6]};
">
  <!-- Top Navigation Header -->
  <header style="
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid ${theme.colors.border.subtle};
    padding-bottom: ${theme.spacing[4]};
    margin-bottom: ${theme.spacing[6]};
  ">
    <div style="display: flex; align-items: center; gap: ${theme.spacing[3]};">
      <div style="width: 32px; height: 32px; border-radius: ${theme.radii.sm}; background: ${theme.colors.accent.primary}; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #0b0f19;">
        BE
      </div>
      <div>
        <h1 style="font-size: ${theme.typography.fontSize.xl}; font-weight: ${theme.typography.fontWeight.bold}; margin: 0;">BlockEscrow</h1>
        <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.muted};">Multi-Party Blockchain Escrow Protocol</div>
      </div>
    </div>
    <div>
      ${walletBtnHtml}
    </div>
  </header>

  <!-- Network Warning Banner if needed -->
  ${networkBanner.visible ? `<div style="margin-bottom: ${theme.spacing[4]};">${networkBanner.html}</div>` : ""}

  <!-- Metric Statistics Cards -->
  <section style="
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: ${theme.spacing[4]};
    margin-bottom: ${theme.spacing[6]};
  ">
    <div style="background: ${theme.colors.surface.card}; border: 1px solid ${theme.colors.border.subtle}; border-radius: ${theme.radii.lg}; padding: ${theme.spacing[4]};">
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.muted};">Total Value Locked</div>
      <div style="font-size: ${theme.typography.fontSize["2xl"]}; font-weight: ${theme.typography.fontWeight.bold}; color: ${theme.colors.accent.primary}; margin-top: 4px;">
        ${totalValueLocked.toFixed(2)} ETH
      </div>
    </div>
    <div style="background: ${theme.colors.surface.card}; border: 1px solid ${theme.colors.border.subtle}; border-radius: ${theme.radii.lg}; padding: ${theme.spacing[4]};">
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.muted};">Active Agreements</div>
      <div style="font-size: ${theme.typography.fontSize["2xl"]}; font-weight: ${theme.typography.fontWeight.bold}; color: ${theme.colors.text.primary}; margin-top: 4px;">
        ${activeCount}
      </div>
    </div>
    <div style="background: ${theme.colors.surface.card}; border: 1px solid ${theme.colors.border.subtle}; border-radius: ${theme.radii.lg}; padding: ${theme.spacing[4]};">
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.muted};">Disputes in Arbitration</div>
      <div style="font-size: ${theme.typography.fontSize["2xl"]}; font-weight: ${theme.typography.fontWeight.bold}; color: ${disputeCount > 0 ? theme.colors.state.danger : theme.colors.text.secondary}; margin-top: 4px;">
        ${disputeCount}
      </div>
    </div>
  </section>

  <!-- Main Escrows Section -->
  <section>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${theme.spacing[4]};">
      <h2 style="font-size: ${theme.typography.fontSize.lg}; font-weight: ${theme.typography.fontWeight.semibold}; margin: 0;">Agreements</h2>
      <div style="display: flex; gap: ${theme.spacing[2]};">
        <span style="font-size: ${theme.typography.fontSize.xs}; color: ${filter === "all" ? theme.colors.accent.primary : theme.colors.text.muted}; cursor: pointer;">All (${escrows.length})</span>
        <span style="color: ${theme.colors.border.subtle};">|</span>
        <span style="font-size: ${theme.typography.fontSize.xs}; color: ${filter === "buyer" ? theme.colors.accent.primary : theme.colors.text.muted}; cursor: pointer;">Buyer</span>
        <span style="color: ${theme.colors.border.subtle};">|</span>
        <span style="font-size: ${theme.typography.fontSize.xs}; color: ${filter === "seller" ? theme.colors.accent.primary : theme.colors.text.muted}; cursor: pointer;">Seller</span>
        <span style="color: ${theme.colors.border.subtle};">|</span>
        <span style="font-size: ${theme.typography.fontSize.xs}; color: ${filter === "arbitrator" ? theme.colors.accent.primary : theme.colors.text.muted}; cursor: pointer;">Arbitrator</span>
      </div>
    </div>

    <!-- Escrows Grid -->
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: ${theme.spacing[4]};
    ">
      ${escrowCardsHtml}
    </div>
  </section>
</div>
`.trim();

  return {
    stats: { totalValueLocked, activeCount, disputeCount },
    filteredEscrows,
    html,
  };
}

module.exports = {
  renderDashboardView,
};
