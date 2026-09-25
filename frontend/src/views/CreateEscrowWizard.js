const { theme } = require("../config/theme.tokens");
const { renderButton } = require("../components/ui/Button");

/**
 * Escrow Creation Multi-step Wizard Model and UI Renderer.
 * Implements a strict 4-step wizard with deep parameter validation.
 */
class CreateEscrowWizard {
  constructor(initialData = {}) {
    this.step = 1;
    this.maxSteps = 4;
    this.data = {
      title: "",
      description: "",
      buyer: "",
      seller: "",
      arbitrator: "",
      tokenType: "ETH", // "ETH" or "ERC20"
      tokenAddress: "0x0000000000000000000000000000000000000000",
      totalAmount: "0",
      milestones: [],
      ...initialData,
    };
    this.errors = {};
  }

  setField(field, value) {
    this.data[field] = value;
    if (this.errors[field]) {
      delete this.errors[field];
    }
  }

  addMilestone({ title, amount, deadlineDays = 14 }) {
    this.data.milestones.push({
      id: this.data.milestones.length + 1,
      title: title || `Milestone ${this.data.milestones.length + 1}`,
      amount: String(amount || "0"),
      deadlineDays: Number(deadlineDays),
    });
  }

  removeMilestone(index) {
    this.data.milestones.splice(index, 1);
    this.data.milestones.forEach((m, idx) => {
      m.id = idx + 1;
    });
  }

  validateStep(stepNumber = this.step) {
    const errors = {};
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;

    if (stepNumber === 1) {
      if (!this.data.title || this.data.title.trim().length < 3) {
        errors.title = "Title must be at least 3 characters long";
      }
      if (!addressRegex.test(this.data.buyer)) {
        errors.buyer = "Invalid Buyer Ethereum address";
      }
      if (!addressRegex.test(this.data.seller)) {
        errors.seller = "Invalid Seller Ethereum address";
      }
      if (!addressRegex.test(this.data.arbitrator)) {
        errors.arbitrator = "Invalid Arbitrator Ethereum address";
      }
      if (this.data.buyer && this.data.seller && this.data.buyer.toLowerCase() === this.data.seller.toLowerCase()) {
        errors.seller = "Seller cannot be the same address as Buyer";
      }
    } else if (stepNumber === 2) {
      const amt = parseFloat(this.data.totalAmount);
      if (isNaN(amt) || amt <= 0) {
        errors.totalAmount = "Total amount must be greater than zero";
      }
      if (this.data.tokenType === "ERC20") {
        if (!addressRegex.test(this.data.tokenAddress) || this.data.tokenAddress === "0x0000000000000000000000000000000000000000") {
          errors.tokenAddress = "Valid ERC20 token contract address is required";
        }
      }
    } else if (stepNumber === 3) {
      if (!this.data.milestones || this.data.milestones.length === 0) {
        errors.milestones = "At least one milestone is required";
      } else {
        const sumMilestones = this.data.milestones.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
        const total = parseFloat(this.data.totalAmount) || 0;
        if (Math.abs(sumMilestones - total) > 0.000001) {
          errors.milestoneSum = `Milestone sum (${sumMilestones}) does not equal total amount (${total})`;
        }
      }
    }

    this.errors = errors;
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  nextStep() {
    const validation = this.validateStep(this.step);
    if (!validation.isValid) {
      return false;
    }
    if (this.step < this.maxSteps) {
      this.step += 1;
      return true;
    }
    return false;
  }

  prevStep() {
    if (this.step > 1) {
      this.step -= 1;
      return true;
    }
    return false;
  }

  render() {
    const stepLabels = ["Parties & Info", "Payment Terms", "Milestones", "Review & Deploy"];

    const stepHeadersHtml = stepLabels
      .map((lbl, idx) => {
        const num = idx + 1;
        const isActive = num === this.step;
        const isDone = num < this.step;
        const color = isActive ? theme.colors.accent.primary : isDone ? theme.colors.state.success : theme.colors.text.muted;
        return `
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:24px; height:24px; border-radius:50%; background:${isActive ? theme.colors.accent.primary : theme.colors.surface.nested}; color:${isActive ? '#0b0f19' : theme.colors.text.secondary}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">
            ${isDone ? "✓" : num}
          </div>
          <span style="font-size:${theme.typography.fontSize.xs}; color:${color}; font-weight:${isActive ? 600 : 400};">${lbl}</span>
        </div>
      `;
      })
      .join('<div style="flex:1; height:1px; background:' + theme.colors.border.subtle + '; margin:0 8px;"></div>');

    return {
      step: this.step,
      data: { ...this.data },
      errors: { ...this.errors },
      html: `
<div class="create-escrow-wizard" style="
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.border.subtle};
  border-radius: ${theme.radii.lg};
  padding: ${theme.spacing[6]};
  max-width: 640px;
  margin: 0 auto;
  font-family: ${theme.typography.fontFamily.sans};
  color: ${theme.colors.text.primary};
">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${theme.spacing[6]};">
    ${stepHeadersHtml}
  </div>

  <div class="wizard-step-content" style="margin-bottom: ${theme.spacing[6]};">
    <h2 style="font-size: ${theme.typography.fontSize.xl}; font-weight: ${theme.typography.fontWeight.bold}; margin: 0 0 ${theme.spacing[2]} 0;">
      Step ${this.step}: ${stepLabels[this.step - 1]}
    </h2>
    <p style="font-size: ${theme.typography.fontSize.sm}; color: ${theme.colors.text.secondary}; margin-bottom: ${theme.spacing[4]};">
      ${this.getStepDescription(this.step)}
    </p>
  </div>

  <div class="wizard-actions" style="display: flex; justify-content: space-between; border-top: 1px solid ${theme.colors.border.subtle}; padding-top: ${theme.spacing[4]};">
    ${this.step > 1 ? renderButton({ label: "Back", variant: "ghost", size: "md" }) : "<div></div>"}
    ${this.step < this.maxSteps ? renderButton({ label: "Continue", variant: "primary", size: "md" }) : renderButton({ label: "Create & Sign Escrow", variant: "primary", size: "md" })}
  </div>
</div>
`.trim(),
    };
  }

  getStepDescription(step) {
    switch (step) {
      case 1:
        return "Specify agreement title, description, and counterparty addresses.";
      case 2:
        return "Configure currency denomination (ETH or ERC20) and total contract deposit.";
      case 3:
        return "Define project deliverables, deadlines, and milestone tranches.";
      case 4:
        return "Review agreement terms, generate IPFS metadata, and initialize on-chain.";
      default:
        return "";
    }
  }
}

module.exports = {
  CreateEscrowWizard,
};
