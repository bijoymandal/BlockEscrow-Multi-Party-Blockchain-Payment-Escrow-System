/**
 * Theme & UI Design System Tokens
 * Directly implements specifications from docs/theme.md
 */

const EscrowStateTokens = {
  DRAFT: {
    label: "DRAFT",
    bg: "rgba(245, 158, 11, 0.1)",
    text: "#F59E0B",
    border: "rgba(245, 158, 11, 0.3)",
    badgeClass: "badge-draft",
  },
  CREATED: {
    label: "CREATED",
    bg: "rgba(245, 158, 11, 0.1)",
    text: "#F59E0B",
    border: "rgba(245, 158, 11, 0.3)",
    badgeClass: "badge-created",
  },
  FUNDED: {
    label: "FUNDED",
    bg: "rgba(59, 130, 246, 0.1)",
    text: "#3B82F6",
    border: "rgba(59, 130, 246, 0.3)",
    badgeClass: "badge-funded",
  },
  IN_PROGRESS: {
    label: "IN PROGRESS",
    bg: "rgba(99, 102, 241, 0.1)",
    text: "#6366F1",
    border: "rgba(99, 102, 241, 0.3)",
    badgeClass: "badge-inprogress",
  },
  COMPLETED: {
    label: "COMPLETED",
    bg: "rgba(16, 185, 129, 0.1)",
    text: "#10B981",
    border: "rgba(16, 185, 129, 0.3)",
    badgeClass: "badge-completed",
  },
  DISPUTED: {
    label: "DISPUTED",
    bg: "rgba(244, 63, 94, 0.1)",
    text: "#F43F5E",
    border: "rgba(244, 63, 94, 0.3)",
    badgeClass: "badge-disputed",
  },
  RESOLVED: {
    label: "RESOLVED",
    bg: "rgba(168, 85, 247, 0.1)",
    text: "#A855F7",
    border: "rgba(168, 85, 247, 0.3)",
    badgeClass: "badge-resolved",
  },
  REFUNDED: {
    label: "REFUNDED",
    bg: "rgba(113, 113, 122, 0.1)",
    text: "#71717A",
    border: "rgba(113, 113, 122, 0.3)",
    badgeClass: "badge-refunded",
  },
};

const theme = {
  colors: {
    surface: {
      background: "#080B11",
      card: "#0D131F",
      nested: "#1A2333",
    },
    border: {
      subtle: "#2D3A4F",
      highlight: "#38BDF8",
    },
    text: {
      primary: "#F1F5F9",
      secondary: "#8B9BB4",
      muted: "#64748B",
    },
    accent: {
      primary: "#38BDF8",
      brand: "#2563EB",
    },
    state: {
      success: "#10B981",
      warning: "#F59E0B",
      danger: "#F43F5E",
      info: "#3B82F6",
      disputed: "#F43F5E",
    },
  },
  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
  },
  radii: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
    },
    fontSize: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "30px",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
  shadows: {
    card: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
    glow: "0 0 15px rgba(56, 189, 248, 0.3)",
  },
};

/**
 * Truncates an Ethereum address to 0x1234...5678 format.
 */
function truncateAddress(address, leadChars = 6, tailChars = 4) {
  if (!address || typeof address !== "string") return "";
  if (address.length <= leadChars + tailChars) return address;
  return `${address.slice(0, leadChars)}...${address.slice(-tailChars)}`;
}

/**
 * Formats token amount with commas and decimals.
 */
function formatTokenAmount(amount, symbol = "USDC", decimals = 2) {
  const num = parseFloat(amount);
  if (isNaN(num)) return `0.00 ${symbol}`;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${symbol}`;
}

module.exports = {
  theme,
  EscrowStateTokens,
  truncateAddress,
  formatTokenAmount,
};
