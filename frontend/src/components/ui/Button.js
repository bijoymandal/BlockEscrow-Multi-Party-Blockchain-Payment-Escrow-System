const { theme } = require("../../config/theme.tokens");

/**
 * Button Primitive Component
 * Supports variants: primary, secondary, danger/destructive, warning, ghost
 * Sizes: sm, md, lg
 */
function renderButton({
  label = "Button",
  variant = "primary",
  size = "md",
  disabled = false,
  isLoading = false,
  className = "",
  onClick = null,
} = {}) {
  const sizeStyles = {
    sm: "padding: 6px 12px; font-size: 12px;",
    md: "padding: 10px 18px; font-size: 14px;",
    lg: "padding: 14px 24px; font-size: 16px;",
  };

  const variantStyles = {
    primary: `background: ${theme.colors.accent.primary}; color: #0b0f19; border: none; font-weight: 600;`,
    secondary: `background: ${theme.colors.surface.nested}; color: ${theme.colors.text.primary}; border: 1px solid ${theme.colors.border.subtle};`,
    danger: `background: ${theme.colors.state.danger}; color: #ffffff; border: none;`,
    destructive: `background: ${theme.colors.state.danger}; color: #ffffff; border: none;`,
    warning: `background: ${theme.colors.state.warning}; color: #0b0f19; border: none; font-weight: 600;`,
    ghost: `background: transparent; color: ${theme.colors.text.secondary}; border: 1px solid ${theme.colors.border.subtle};`,
  };

  const chosenSize = sizeStyles[size] || sizeStyles.md;
  const chosenVariant = variantStyles[variant] || variantStyles.primary;
  const isActionDisabled = disabled || isLoading;
  const displayLabel = isLoading ? `⏳ ${label}...` : label;

  return `
<button class="btn btn-${variant} ${className}" ${isActionDisabled ? "disabled" : ""} style="
  ${chosenVariant}
  ${chosenSize}
  border-radius: ${theme.radii.md};
  font-family: ${theme.typography.fontFamily.sans};
  cursor: ${isActionDisabled ? "not-allowed" : "pointer"};
  opacity: ${isActionDisabled ? "0.5" : "1"};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.2s ease;
">
  ${displayLabel}
</button>
`.trim();
}

function createButton(props) {
  const html = renderButton(props);
  return {
    label: props.label,
    variant: props.variant || "primary",
    disabled: Boolean(props.disabled || props.isLoading),
    isLoading: Boolean(props.isLoading),
    html,
  };
}

module.exports = {
  renderButton,
  createButton,
};
