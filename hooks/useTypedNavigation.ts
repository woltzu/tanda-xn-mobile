// ══════════════════════════════════════════════════════════════════════════════
// hooks/useTypedNavigation.ts — Typed wrapper around useNavigation()
// ══════════════════════════════════════════════════════════════════════════════
//
// Drop-in replacement for `useNavigation()` at navigate/replace/push call
// sites. The `route` argument is typed as `RootRoute` from `lib/routes.ts`,
// so typos at the source become TypeScript errors instead of runtime
// "no screen named X" warnings.
//
// Usage:
//
//   import { useTypedNavigation } from '../hooks/useTypedNavigation';
//   import { Routes } from '../lib/routes';
//
//   function MyScreen() {
//     const nav = useTypedNavigation();
//     return (
//       <Button onPress={() => nav.navigate(Routes.LinkedAccounts)} />
//     );
//   }
//
// Why a custom hook instead of just typing useNavigation directly:
//   - Mobile uses nested stacks (HomeStack, CirclesStack, MarketStack,
//     CommunityStack) plus the root Stack and Tab navigator. React
//     Navigation's typed API requires a `ParamList` generic that matches
//     ONE navigator at a time, which produces ugly type errors when the
//     same screen registers in multiple stacks (the trip-organizer screens
//     do — they're in 3 stacks at once).
//   - Routes is a flat union of every name in the app. The runtime
//     resolution still bubbles through React Navigation's normal lookup
//     (current navigator -> parent -> root), so cross-stack navigation
//     works without per-call-site coordinate gymnastics.
//   - This hook intentionally accepts loose `params: any`. Param-shape
//     safety per route is a worthwhile follow-up but is a much larger
//     refactor (every screen needs its own ParamList). Phase 1's win is
//     just catching the route-name typos.
//
// What this hook does NOT replace:
//   - useRoute() — keep that for reading the current route's params.
//   - Navigation state inspection (useNavigationState, etc.).
//   - The underlying useNavigation() itself when you need its less common
//     methods. Cast `nav.raw` (exposed below) for those.
//
// ══════════════════════════════════════════════════════════════════════════════

import { useNavigation } from '@react-navigation/native';
import type { RootRoute } from '../lib/routes';

interface TypedNavigation {
  /** Navigate to a route. Route name is type-checked against Routes. */
  navigate: (route: RootRoute, params?: object) => void;
  /** Replace current route with another. */
  replace: (route: RootRoute, params?: object) => void;
  /** Push a new instance of a route onto the stack. */
  push: (route: RootRoute, params?: object) => void;
  /** Go back one screen. */
  goBack: () => void;
  /** Reset the navigator state. */
  reset: (state: object) => void;
  /** Update params for the current screen. */
  setParams: (params: object) => void;
  /** Dispatch a navigation action (use for advanced cases). */
  dispatch: (action: object) => void;
  /** Escape hatch — the raw useNavigation() object for methods not surfaced here. */
  raw: ReturnType<typeof useNavigation>;
}

/**
 * Typed wrapper around React Navigation's useNavigation hook.
 * See file header for design rationale.
 */
export function useTypedNavigation(): TypedNavigation {
  const nav = useNavigation<any>();

  return {
    navigate: (route, params) => nav.navigate(route as never, params as never),
    replace: (route, params) => {
      if (typeof nav.replace === 'function') {
        nav.replace(route, params);
      } else {
        // Tab navigators don't have replace(); fall back to navigate().
        nav.navigate(route as never, params as never);
      }
    },
    push: (route, params) => {
      if (typeof nav.push === 'function') {
        nav.push(route, params);
      } else {
        // Tab navigators don't have push(); fall back to navigate().
        nav.navigate(route as never, params as never);
      }
    },
    goBack: () => nav.goBack(),
    reset: (state) => nav.reset(state as never),
    setParams: (params) => nav.setParams(params as never),
    dispatch: (action) => nav.dispatch(action as never),
    raw: nav,
  };
}
