const { EscrowStateTokens, theme } = require("../../config/theme.tokens");

/**
 * StatusBadge Component
 * Displays semantic on-chain status with contrast colors and pulsing indicator.
 */
function renderStatusBadge(status) {
  const normalizedKey = (status || "").toUpperCase();
  const token = EscrowStateTokens[normalizedKey] || {
    label: status || "UNKNOWN",
    bg: "rgba(148, 163, 184, 0.1)",
    text: "#94A3B8",
    border: theme.colors.border.subtle,
    badgeClass: "badge-unknown",
  };

  const html = `<span class="status-badge badge ${token.badgeClass || ""}" data-status="${status}" style="background-color: ${token.bg}; color: ${token.text}; border: 1px solid ${token.border}; border-radius: 9999px; padding: 4px 12px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
    <span style="width: 6px; height: 6px; border-radius: 50%; background-color: ${token.text};"></span>
    ${token.label}
  </span>`.trim();

  const str = new String(html);
  str.status = status;
  str.label = token.label;
  str.html = html;
  str.style = {
    backgroundColor: token.bg,
    color: token.text,
    borderColor: token.border,
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: "9999px",
    padding: "4px 12px",
    fontSize: "0.75rem",
    fontWeight: "600",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  };

  return str;
}

module.exports = { renderStatusBadge };
