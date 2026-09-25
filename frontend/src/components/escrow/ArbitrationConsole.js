const { theme } = require("../../config/theme.tokens");
const { renderButton } = require("../ui/Button");

/**
 * Calculates proportional award distributions for dispute rulings.
 */
function calculateArbitrationSplit({ remainingBalance, buyerPercentage, feeBasisPoints = 50 }) {
  const balance = parseFloat(remainingBalance);
  if (isNaN(balance) || balance <= 0) {
    throw new Error("Invalid remaining balance");
  }

  const pct = parseFloat(buyerPercentage);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    throw new Error("Buyer percentage must be between 0 and 100");
  }

  const sellerPercentage = 100 - pct;
  const buyerAward = (balance * pct) / 100;
  const rawSellerAward = (balance * sellerPercentage) / 100;

  // Platform fee applies to seller's portion if awarded
  const feeDeducted = rawSellerAward > 0 ? (rawSellerAward * feeBasisPoints) / 10000 : 0;
  const sellerNetPayout = rawSellerAward - feeDeducted;

  return {
    remainingBalance: balance,
    buyerPercentage: pct,
    sellerPercentage,
    buyerAward,
    sellerAward: rawSellerAward,
    feeDeducted,
    sellerNetPayout,
    isValid: Math.abs(buyerAward + rawSellerAward - balance) < 0.000001,
  };
}

/**
 * Renders the Arbitration Console UI for dispute resolution.
 */
function renderArbitrationConsole({
  escrowId = "ESC-001",
  disputedAmount = "1.0",
  tokenSymbol = "ETH",
  buyerSplitBps = 5000,
  sellerSplitBps = 5000,
  rulingNotes = "",
} = {}) {
  const totalBps = buyerSplitBps + sellerSplitBps;
  if (totalBps !== 10000) {
    throw new Error(`Split basis points must equal 10,000 (received ${totalBps})`);
  }

  const total = parseFloat(disputedAmount) || 0;
  const buyerShare = ((total * buyerSplitBps) / 10000).toFixed(4);
  const sellerShare = ((total * sellerSplitBps) / 10000).toFixed(4);
  const buyerPct = buyerSplitBps / 100;
  const sellerPct = sellerSplitBps / 100;

  const resolveBtnHtml = renderButton({
    label: "Submit Final Ruling",
    variant: "primary",
    size: "md",
  });

  const html = `
<div class="arbitration-console" style="
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.state.danger};
  border-radius: ${theme.radii.lg};
  padding: ${theme.spacing[6]};
  font-family: ${theme.typography.fontFamily.sans};
  color: ${theme.colors.text.primary};
">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${theme.spacing[4]};">
    <div>
      <span style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.state.danger}; font-weight: bold; text-transform: uppercase;">Dispute Resolution Console</span>
      <h3 style="margin: 0; font-size: ${theme.typography.fontSize.xl};">Escrow #${escrowId}</h3>
    </div>
    <div style="font-size: ${theme.typography.fontSize.lg}; font-weight: bold; color: ${theme.colors.accent.primary};">
      Disputed: ${total} ${tokenSymbol}
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${theme.spacing[4]}; margin-bottom: ${theme.spacing[5]};">
    <div style="background: ${theme.colors.surface.nested}; padding: ${theme.spacing[4]}; border-radius: ${theme.radii.md}; border-left: 4px solid ${theme.colors.accent.primary};">
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.secondary};">Buyer (${buyerPct}%)</div>
      <div style="font-size: ${theme.typography.fontSize.xl}; font-weight: bold; margin-top: 4px;">${buyerShare} ${tokenSymbol}</div>
    </div>
    <div style="background: ${theme.colors.surface.nested}; padding: ${theme.spacing[4]}; border-radius: ${theme.radii.md}; border-left: 4px solid ${theme.colors.state.success};">
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.secondary};">Seller (${sellerPct}%)</div>
      <div style="font-size: ${theme.typography.fontSize.xl}; font-weight: bold; margin-top: 4px;">${sellerShare} ${tokenSymbol}</div>
    </div>
  </div>

  <div style="display: flex; justify-content: flex-end;">
    ${resolveBtnHtml}
  </div>
</div>
`.trim();

  return {
    escrowId,
    disputedAmount,
    buyerSplitBps,
    sellerSplitBps,
    buyerShare,
    sellerShare,
    buyerPct,
    sellerPct,
    html,
  };
}

module.exports = {
  calculateArbitrationSplit,
  renderArbitrationConsole,
};
