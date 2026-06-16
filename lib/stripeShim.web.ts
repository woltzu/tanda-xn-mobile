// ══════════════════════════════════════════════════════════════════════════════
// lib/stripeShim.web.ts — web fallback.
// ══════════════════════════════════════════════════════════════════════════════
//
// Metro's platform extension resolver loads this file in place of
// `stripeShim.ts` when bundling for web. The web bundle therefore never
// imports @stripe/stripe-react-native — which is what unblocks
// `expo start --web` (the native `codegenNativeCommands` /
// `codegenNativeComponent` references in that package were the root
// cause of the bundling failure).
//
// Surface matches stripeShim.ts: `StripeProvider` passes children through;
// `useStripe` returns no-op promises that resolve to a fake "stripe
// not available" error so existing call sites in PaymentContext can
// still pattern-match on `error` without crashing. Real payment flows
// are native-only — anyone hitting these stubs is either previewing in
// a browser or accidentally landed on web without a guard.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";

const WEB_ERR = { message: "Stripe not available on web" } as const;

type StripeProviderProps = {
  children?: React.ReactNode;
  // Loose prop signature — anything PaymentContext passes (publishableKey,
  // merchantIdentifier, urlScheme, etc.) is accepted and ignored.
  [k: string]: unknown;
};

export const StripeProvider: React.FC<StripeProviderProps> = ({ children }) => {
  // The provider on native sets up Stripe SDK context; on web it has
  // nothing to do. Just rendering children keeps the tree shape
  // identical so consumer code doesn't care which platform it's on.
  return React.createElement(React.Fragment, null, children);
};

export function useStripe() {
  return {
    confirmPayment: async () => ({ error: WEB_ERR }),
    initPaymentSheet: async () => ({ error: WEB_ERR }),
    presentPaymentSheet: async () => ({ error: WEB_ERR }),
  };
}
