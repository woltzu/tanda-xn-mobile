/**
 * TandaXn Design Tokens
 * STRICT COLOR HIERARCHY - DO NOT MODIFY WITHOUT DESIGN APPROVAL
 */

export const colors = {
  // Primary Colors
  primaryNavy: "#0A2342",      // Structure: header, titles, key numbers
  accentTeal: "#00C6AE",       // ONLY: primary CTA, progress fill, small highlight pills
  warningAmber: "#D97706",     // ONLY: penalties/warnings/reputation score

  // Backgrounds
  screenBg: "#F5F7FA",
  cardBg: "#FFFFFF",

  // Borders
  border: "#E5E7EB",

  // Text Colors
  textPrimary: "#0A2342",      // Primary text
  textSecondary: "#6B7280",    // Secondary/muted text
  textOnNavy: "#E5E7EB",       // Off-white text on navy header
  textWhite: "#FFFFFF",        // Pure white (ONLY for balance amount)

  // Success Colors
  successText: "#047857",      // Success text (muted)
  successLabel: "#065F46",     // Success label color
  successBg: "#ECFDF5",        // Success background tint

  // Warning Colors
  warningLabel: "#92400E",     // Warning label color
  warningBg: "#FFF7ED",        // Warning background tint

  // Error Colors
  errorText: "#DC2626",
  errorBg: "#FEF2F2",

  // RGBA Tints (MUST match exactly)
  tealTintBg: "rgba(0,198,174,0.12)",
  navyTintBg: "rgba(10,35,66,0.08)",
  softerNavyTintBg: "rgba(10,35,66,0.06)",
  whiteTransparent10: "rgba(255,255,255,0.1)",
  whiteTransparent20: "rgba(255,255,255,0.2)",
  whiteTransparent70: "rgba(255,255,255,0.7)",
};

export const radius = {
  card: 16,
  button: 12,
  pill: 9999,  // Fully rounded
  small: 8,
  medium: 12,
};

export const typography = {
  // Size scale
  balanceNumber: 44,
  userName: 24,
  sectionHeader: 18,
  bodyLarge: 16,
  body: 14,
  bodySmall: 13,
  label: 12,
  labelSmall: 11,
  caption: 10,

  // Weights
  bold: "700" as const,
  semibold: "600" as const,
  medium: "500" as const,
  regular: "400" as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

/**
 * STRICT COLOR HIERARCHY RULES (NO EXCEPTIONS):
 *
 * 1. NO gradients anywhere.
 *
 * 2. Only ONE saturated color per screen section.
 *
 * 3. Teal (#00C6AE) is used ONLY for:
 *    - ONE primary filled CTA button in the actions row ("Add Money")
 *    - Progress bar fill
 *    - Small pills (Score badge, "Your turn")
 *
 * 4. Amber (#D97706) used ONLY for:
 *    - Payment Due amount + warning card label
 *    - Elder System reputation score number/badge
 *
 * 5. Breakdown row must be neutral (gray icons, navy numbers, gray labels).
 *    NO teal/amber there.
 *
 * 6. Only ONE filled CTA in the action row. Others outlined/neutral.
 */
