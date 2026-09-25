const { theme } = require("../../config/theme.tokens");
const { renderStatusBadge } = require("../ui/StatusBadge");
const { renderButton } = require("../ui/Button");

/**
 * Renders a standardized, responsive EscrowCard component.
 * Displays financial status, participant addresses, milestone progression, and context-aware action buttons.
 */
function renderEscrowCard(props = {}) {
  const {
    id = "ESC-001",
    title = "Escrow Agreement",
    buyer = "0x0000000000000000000000000000000000000000",
    seller = "0x0000000000000000000000000000000000000000",
    arbitrator = "0x0000000000000000000000000000000000000000",
    tokenSymbol = "ETH",
    totalAmount = "0.0",
    releasedAmount = "0.0",
    status = "FUNDED",
    completedMilestones = 0,
    totalMilestones = 3,
    currentUserAddress = null,
    onAction = null,
  } = props;

  const truncate = (addr) => (addr && addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr || "—");

  const progressPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  // Determine user role and applicable action
  const normalizedUser = (currentUserAddress || "").toLowerCase();
  const isBuyer = normalizedUser === (buyer || "").toLowerCase();
  const isSeller = normalizedUser === (seller || "").toLowerCase();
  const isArbitrator = normalizedUser === (arbitrator || "").toLowerCase();

  let primaryAction = null;
  if (status === "CREATED" && isBuyer) {
    primaryAction = { label: "Deposit Funds", variant: "primary", action: "DEPOSIT" };
  } else if (status === "FUNDED" || status === "IN_PROGRESS") {
    if (isSeller) {
      primaryAction = { label: "Submit Deliverable", variant: "primary", action: "SUBMIT_WORK" };
    } else if (isBuyer) {
      primaryAction = { label: "Approve Milestone", variant: "secondary", action: "APPROVE_MILESTONE" };
    }
  } else if (status === "DISPUTED" && isArbitrator) {
    primaryAction = { label: "Arbitrate Dispute", variant: "danger", action: "ARBITRATE" };
  }

  const badgeHtml = renderStatusBadge(status);
  const actionBtnHtml = primaryAction ? renderButton({ label: primaryAction.label, variant: primaryAction.variant, size: "sm" }) : "";

  const html = `
<div class="escrow-card" style="
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.border.subtle};
  border-radius: ${theme.radii.lg};
  padding: ${theme.spacing[5]};
  box-shadow: ${theme.shadows.card};
  font-family: ${theme.typography.fontFamily.sans};
  color: ${theme.colors.text.primary};
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing[4]};
">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: ${theme.spacing[3]};">
    <div>
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.muted}; font-family: ${theme.typography.fontFamily.mono};">#${id}</div>
      <h3 style="margin: 0; font-size: ${theme.typography.fontSize.lg}; font-weight: ${theme.typography.fontWeight.semibold}; color: ${theme.colors.text.primary};">${title}</h3>
    </div>
    ${badgeHtml}
  </div>

  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: ${theme.spacing[3]}; background: ${theme.colors.surface.nested}; padding: ${theme.spacing[3]}; border-radius: ${theme.radii.md};">
    <div>
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.muted};">Total Value</div>
      <div style="font-size: ${theme.typography.fontSize.base}; font-weight: ${theme.typography.fontWeight.bold}; color: ${theme.colors.accent.primary};">${totalAmount} ${tokenSymbol}</div>
    </div>
    <div>
      <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.muted};">Released</div>
      <div style="font-size: ${theme.typography.fontSize.base}; font-weight: ${theme.typography.fontWeight.bold}; color: ${theme.colors.state.success};">${releasedAmount} ${tokenSymbol}</div>
    </div>
  </div>

  <div style="display: flex; flex-direction: column; gap: ${theme.spacing[1]};">
    <div style="display: flex; justify-content: space-between; font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.secondary};">
      <span>Milestone Progress</span>
      <span style="font-family: ${theme.typography.fontFamily.mono}; font-weight: ${theme.typography.fontWeight.semibold};">${completedMilestones}/${totalMilestones} (${progressPct}%)</span>
    </div>
    <div style="background: ${theme.colors.surface.nested}; border-radius: ${theme.radii.full}; height: 6px; overflow: hidden;">
      <div style="width: ${progressPct}%; height: 100%; background: ${theme.colors.accent.primary}; border-radius: ${theme.radii.full}; transition: width 0.3s ease;"></div>
    </div>
  </div>

  <div style="border-top: 1px solid ${theme.colors.border.subtle}; padding-top: ${theme.spacing[3]}; display: flex; justify-content: space-between; align-items: center; font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.muted};">
    <div>
      <span>Buyer: <code style="color: ${theme.colors.text.primary}; font-family: ${theme.typography.fontFamily.mono};">${truncate(buyer)}</code></span>
      <span style="margin: 0 4px;">•</span>
      <span>Seller: <code style="color: ${theme.colors.text.primary}; font-family: ${theme.typography.fontFamily.mono};">${truncate(seller)}</code></span>
    </div>
    <div>
      ${actionBtnHtml}
    </div>
  </div>
</div>
`.trim();

  return {
    id,
    title,
    status,
    totalAmount,
    tokenSymbol,
    releasedAmount,
    progressPct,
    primaryAction,
    html,
  };
}

module.exports = {
  renderEscrowCard,
};
