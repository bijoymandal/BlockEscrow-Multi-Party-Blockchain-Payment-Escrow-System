# BlockEscrow – Design System & Theme Specification (`theme.md`)

> **Document Version:** 1.0.0  
> **Target Framework:** Next.js 14+ (App Router), Tailwind CSS v3.4+, Radix UI / shadcn/ui, Lucide Icons  
> **Design Philosophy:** Institutional Web3 Financial Security, Clarity, High-Trust Visual Feedback, and Accessibility.

---

## 1. Visual Identity & Brand Philosophy

BlockEscrow facilitates high-value, trustless financial agreements. The user interface must project **unquestioned stability, crystal-clear state communication, and zero ambiguity regarding financial transactions**.

### Core Tenets
1. **Financial Confidence:** Color is reserved for state changes and financial status. Backgrounds and surfaces remain restrained.
2. **Defensive UX:** Irreversible actions (fund lock, release, dispute escalation) have distinct warning treatments and confirmation gates.
3. **Optimistic Yet Truthful:** Immediate local state feedback paired with real-time on-chain confirmation counters.
4. **Data Density with Hierarchy:** Important contract addresses, balances, and deadlines are legible and easily verifiable.

---

## 2. Color Palette & Semantic Tokens

BlockEscrow utilizes an **Electric Slate / Cyber Blue / Mint Emerald** palette. Dark mode is the primary target for professional crypto operators, with a fully contrast-compliant Light Mode for institutional audits.

### 2.1 Base Color Spectrum

| Token Name | Hex Code | HSL Value | Description / Usage |
| :--- | :--- | :--- | :--- |
| `slate-950` | `#080B11` | `hsl(222, 47%, 5%)` | Primary Application Canvas (Dark Mode) |
| `slate-900` | `#0D131F` | `hsl(220, 41%, 9%)` | Card / Surface Background |
| `slate-800` | `#1A2333` | `hsl(217, 33%, 15%)` | Elevated Borders & Interactive Card Hover |
| `slate-700` | `#2D3A4F` | `hsl(218, 27%, 24%)` | Divider Lines & Input Field Borders |
| `slate-400` | `#8B9BB4` | `hsl(218, 23%, 63%)` | Secondary / Metadata Typography |
| `slate-100` | `#F1F5F9` | `hsl(210, 40%, 96%)` | Primary Header Typography (Dark Mode) |
| `brand-500` | `#2563EB` | `hsl(221, 83%, 53%)` | Primary Interactive Action (Buttons, Toggles) |
| `brand-400` | `#38BDF8` | `hsl(199, 89%, 60%)` | Accent Highlights, Active Stepper Indicators |

---

### 2.2 Semantic Escrow State Colors

Escrows transition through strict smart contract states. Each state is paired with a distinct semantic token and pulsing visual indicator:

```
[DRAFT] ──────► [LOCKED/ACTIVE] ──────► [DISPUTED] ──────► [RESOLVED]
                      │
                      ▼
                 [COMPLETED]
```

| Escrow State | Background Token | Foreground Token | Border Token | UI Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **`DRAFT`** | `bg-amber-500/10` | `text-amber-400` | `border-amber-500/30` | Agreement created off-chain; funds not deposited. |
| **`LOCKED` / `FUNDED`** | `bg-blue-500/10` | `text-blue-400` | `border-blue-500/30` | Tokens locked inside BlockEscrow smart contract. |
| **`IN_PROGRESS`** | `bg-indigo-500/10` | `text-indigo-400` | `border-indigo-500/30` | Seller has commenced milestones; deliverables submitted. |
| **`COMPLETED`** | `bg-emerald-500/10` | `text-emerald-400` | `border-emerald-500/30` | Funds 100% released to seller. Contract finalized. |
| **`DISPUTED`** | `bg-rose-500/10` | `text-rose-400` | `border-rose-500/30` | Escrow locked; awaiting arbitrator ruling. |
| **`RESOLVED`** | `bg-purple-500/10` | `text-purple-400` | `border-purple-500/30` | Arbitrator issued split or complete resolution. |
| **`REFUNDED`** | `bg-zinc-500/10` | `text-zinc-300` | `border-zinc-500/30` | Funds returned to buyer. |

---

## 3. Typography & Hierarchy

BlockEscrow enforces strict dual-font typography: **Inter** for human-readable copy and **JetBrains Mono** for cryptographically verifiable data (hashes, addresses, balances).

```
Inter (UI Copy)            JetBrains Mono (On-Chain Data)
├── Headers (SemiBold 600) ├── Tx Hashes: 0x8a9...c4b2
├── Body (Regular 400)     ├── Wallet Addresses: 0x4f3...901e
└── Tooltips (Medium 500)  └── Balances: 14,500.00 USDC
```

### 3.1 Type Scale

| Scale | Size | Line Height | Weight | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display 1** | 36px (2.25rem) | 2.5rem | 700 Bold | `text-4xl font-bold tracking-tight` | Landing Page Hero, Main Dashboard Balance |
| **Heading 1** | 28px (1.75rem) | 2rem | 600 SemiBold | `text-2xl font-semibold` | Escrow Detail View, Dispute Room |
| **Heading 2** | 20px (1.25rem) | 1.75rem | 600 SemiBold | `text-xl font-semibold` | Card Titles, Milestone Section Headers |
| **Subheading**| 16px (1.0rem)  | 1.5rem | 500 Medium | `text-base font-medium` | Form Field Labels, Table Headers |
| **Body Text** | 14px (0.875rem)| 1.25rem | 400 Regular| `text-sm font-normal text-slate-300`| Description text, agreement clauses |
| **Code/Hash** | 13px (0.812rem)| 1.2rem | 500 Medium | `font-mono text-xs text-slate-400`  | Addresses, Tx Hashes, Gas Estimates |

---

## 4. Key Component Design Standards

### 4.1 Wallet Connect & Account Button
- **Disconnected:** Prominent `brand-500` button with a pulsing plug icon and text `"Connect Wallet"`.
- **Connecting:** Disabled state with an animated circular SVG spinner and text `"Confirm in Wallet..."`.
- **Connected:** Pill component displaying:
  1. Network Badge (e.g. Green dot + `Polygon Mainnet`).
  2. Native Token Balance (e.g. `2.415 MATIC`).
  3. Truncated Address with avatar generated from checksummed address (`0x3A21...b84F`).
  4. Dropdown indicator for profile, copy address, explorer link, disconnect.

### 4.2 Milestone Stepper Widget
Displays chronological progress of multi-party deliverables:

```
[● Milestone 1: Design Specs] ───► [● Milestone 2: Smart Contract] ───► [○ Milestone 3: Audit]
     Status: RELEASED                   Status: IN_REVIEW                    Status: LOCKED
     Amount: 2,500 USDC                 Amount: 5,000 USDC                   Amount: 2,500 USDC
```

- **Completed:** Emerald checkmark icon, green connecting line, unlocked unlock icon.
- **Active / Pending Approval:** Amber pulsing border, action button `"Review & Release Funds"`.
- **Locked:** Slate muted icon, locked padlock, non-clickable.
- **Disputed:** Rose alert triangle, `"Dispute Filed"` badge with link to arbitration court.

### 4.3 Transaction Status Toast System
Web3 transactions undergo 4 discrete stages:
1. **Signature Requested:** Blue toast `"Awaiting user signature in MetaMask..."`.
2. **Submitted / Pending:** Yellow toast with spinner: `"Transaction broadcasted. Tx: 0x93f...3b1 [View on Polygonscan]"`. Confirmations counter: `(2/12 confirmations)`.
3. **Confirmed:** Green toast with celebration badge: `"Escrow #1042 successfully funded on-chain!"`.
4. **Reverted / Failed:** Red toast with decoded revert reason (e.g., `Error: BlockEscrow__InsufficientAllowance()`).

---

## 5. CSS & Tailwind Production Configuration

### 5.1 `tailwind.config.ts`
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        escrow: {
          draft: "#F59E0B",
          locked: "#3B82F6",
          active: "#6366F1",
          completed: "#10B981",
          disputed: "#F43F5E",
          resolved: "#A855F7",
          refunded: "#71717A",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "glow-border": {
          "0%, 100%": { borderColor: "rgba(59, 130, 246, 0.4)" },
          "50%": { borderColor: "rgba(59, 130, 246, 0.8)" },
        },
      },
      animation: {
        "pulse-subtle": "pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-border": "glow-border 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

### 5.2 `globals.css` Tokens
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 220 33% 98%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 221 83% 53%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222 47% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222 47% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221 83% 53%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 222 47% 5%;
    --foreground: 210 40% 98%;
    --card: 220 41% 9%;
    --card-foreground: 210 40% 98%;
    --popover: 220 41% 9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217 91% 60%;
    --primary-foreground: 222 47% 5%;
    --secondary: 217 33% 15%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217 33% 15%;
    --muted-foreground: 218 23% 63%;
    --accent: 217 33% 18%;
    --accent-foreground: 210 40% 98%;
    --destructive: 347 77% 50%;
    --destructive-foreground: 210 40% 98%;
    --border: 218 27% 18%;
    --input: 218 27% 18%;
    --ring: 217 91% 60%;
  }
}
```
