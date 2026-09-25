const { theme } = require("../../config/theme.tokens");

/**
 * MilestoneStepper Component
 * Visualizes multi-stage payment releases and deliverable progress.
 */
function renderMilestoneStepper(input = []) {
  const milestones = Array.isArray(input) ? input : (input && input.milestones) || [];

  if (milestones.length === 0) {
    return {
      progressPercentage: 0,
      progressPct: 0,
      completedCount: 0,
      approvedCount: 0,
      totalCount: 0,
      totalMilestones: 0,
      isFullyApproved: false,
      steps: [],
      html: `<div class="milestone-stepper empty">No milestones</div>`,
    };
  }

  let approvedCount = 0;

  const steps = milestones.map((m, index) => {
    const isApproved = m.status === "APPROVED";
    const isSubmitted = m.status === "SUBMITTED" || m.status === "PENDING_APPROVAL";
    const isDisputed = m.status === "DISPUTED";

    if (isApproved) approvedCount++;

    let stepState = "pending";
    let icon = "○";
    let color = theme.colors.text.muted;

    if (isApproved) {
      stepState = "approved";
      icon = "✔";
      color = theme.colors.state.success;
    } else if (isSubmitted) {
      stepState = "submitted";
      icon = "⏳";
      color = theme.colors.accent.brand;
    } else if (isDisputed) {
      stepState = "disputed";
      icon = "⚠";
      color = theme.colors.state.danger;
    }

    return {
      index,
      title: m.title || `Milestone ${index + 1}`,
      amount: m.amount,
      status: m.status || "NOT_STARTED",
      stepState,
      icon,
      color,
      deliverableCid: m.deliverableIpfsHash || null,
    };
  });

  const progressPercentage = Math.round((approvedCount / milestones.length) * 100);
  const isFullyApproved = approvedCount === milestones.length;

  const stepsHtml = steps
    .map(
      (s) => `
    <div class="stepper-step" style="display: flex; align-items: flex-start; gap: ${theme.spacing[3]};">
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${theme.colors.surface.nested}; border: 2px solid ${s.color}; display: flex; align-items: center; justify-content: center; font-size: 14px; color: ${s.color};">
        ${s.icon}
      </div>
      <div>
        <div style="font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.semibold}; color: ${theme.colors.text.primary};">
          ${s.title}
        </div>
        <div style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.text.secondary};">
          ${s.amount ? `${s.amount} • ` : ""}${s.status}
        </div>
      </div>
    </div>
  `
    )
    .join(`<div style="width: 2px; height: 24px; background: ${theme.colors.border.subtle}; margin-left: 13px;"></div>`);

  const html = `
<div class="milestone-stepper" style="
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.border.subtle};
  border-radius: ${theme.radii.lg};
  padding: ${theme.spacing[4]};
  font-family: ${theme.typography.fontFamily.sans};
">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${theme.spacing[4]};">
    <span style="font-size: ${theme.typography.fontSize.sm}; font-weight: bold; color: ${theme.colors.text.primary};">Milestone Progression</span>
    <span style="font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.accent.primary}; font-family: ${theme.typography.fontFamily.mono};">
      ${approvedCount}/${milestones.length} (${progressPercentage}%)
    </span>
  </div>
  <div class="stepper-body" style="display: flex; flex-direction: column;">
    ${stepsHtml}
  </div>
</div>
`.trim();

  return {
    progressPercentage,
    progressPct: progressPercentage,
    completedCount: approvedCount,
    approvedCount,
    totalCount: milestones.length,
    totalMilestones: milestones.length,
    isFullyApproved,
    steps,
    html,
  };
}

module.exports = {
  renderMilestoneStepper,
};
