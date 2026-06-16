// ══════════════════════════════════════════════════════════════════════════════
// lib/stripeShim.ts — native platforms (iOS / Android).
// ══════════════════════════════════════════════════════════════════════════════
//
// Re-exports the bits of @stripe/stripe-react-native that PaymentContext
// uses. Metro's platform extension resolver picks this file on iOS/Android;
// it picks `stripeShim.web.ts` on web so the native-only `codegenNativeCommands`
// chain never enters the web bundle.
//
// Why this file exists at all:
//   The naive approach — `if (Platform.OS !== 'web') require('@stripe/...')`
//   inside a single file — does NOT work. Metro's bundler statically
//   resolves every require() reachable from the entry point, regardless
//   of whether the surrounding `if` is dead at runtime. The platform
//   extension is the canonical Expo escape hatch: the web bundle simply
//   doesn't see the native import.
// ══════════════════════════════════════════════════════════════════════════════

export {
  StripeProvider,
  useStripe,
} from "@stripe/stripe-react-native";
