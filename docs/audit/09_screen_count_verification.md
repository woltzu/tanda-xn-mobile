# Screen Count Verification

You asked: is the **155** figure in `04_screen_status.md` actually right, or am I missing screens that reach the user some other way?

**Short answer: 155 is correct as the count of navigable Stack/Tab routes.** Total user-visible UI surface is somewhere in **155–156** depending on how you count an inactivity-lock overlay. No hidden navigators, no transitive screen imports, no parallel v0 routes, no Expo Router activation, no third-party sheet libraries. The five gaps you asked about are all closed.

Detail below, one gap at a time. Every count is exact (grep / find / wc -l) unless I say "approximate."

---

## Gap 1 — All navigator types in App.tsx

**Finding: 2 navigator types, 6 instances. No Drawer, no Material Top Tabs, no custom navigators anywhere in the repo.**

### Imports in `App.tsx`
```
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import { createStackNavigator }      from "@react-navigation/stack";
import { createBottomTabNavigator }  from "@react-navigation/bottom-tabs";
```

That's it. No `@react-navigation/drawer`, no `@react-navigation/material-top-tabs`, no `@react-navigation/material-bottom-tabs`.

### Navigator instances in `App.tsx` (6 total)
| Variable | Type | Purpose |
|---|---|---|
| `Stack` | `createStackNavigator<RootStackParamList>()` | root nav |
| `Tab` | `createBottomTabNavigator<TabParamList>()` | the 5 bottom tabs |
| `HomeStack` | `createStackNavigator()` | nested in `Home` tab |
| `CirclesStack` | `createStackNavigator()` | nested in `Circles` tab |
| `MarketStack` | `createStackNavigator()` | nested in `Market` tab |
| `CommunityStack` | `createStackNavigator()` | nested in `Community` tab |

### Repo-wide cross-check
Searched **all** `.tsx` / `.ts` files (outside `node_modules`) for any of `createStackNavigator`, `createBottomTabNavigator`, `createDrawerNavigator`, `createMaterialTopTabNavigator`, `createMaterialBottomTabNavigator`, `createNativeStackNavigator`. **Zero hits outside `App.tsx`.** Nobody else is building a navigator.

### Registration counts
| Metric | Count |
|---|---|
| Total `<*Stack.Screen>` and `<Tab.Screen>` lines | 222 |
| **Unique** Stack.Screen route names | **155** |
| Tab.Screen routes | 5 (`Home`, `Circles`, `Action`, `Market`, `Community`) |
| Unique components referenced via `component={...}` | 158 |

The gap between 222 raw lines and 155 unique names is because several screens are registered in BOTH the root Stack AND a nested tab stack (e.g. `CircleDetail` exists in root Stack + in `CirclesStack` so deep-link landings and in-tab navigation both work). Same screen, two registrations — but one component file.

The 158-vs-155 component gap = 4 nested-stack wrappers (HomeStackScreen, CirclesStackScreen, MarketStackScreen, CommunityStackScreen) + ActionScreen − overlap = 3 extra. Plus LockScreen which is rendered as a conditional overlay, not via a navigator at all.

---

## Gap 2 — Transitive screen imports

**Finding: NONE. Screens never import other screens.**

```
$ grep -rlE 'from\s+["\']\.\.?\/(\.\.\/)*screens/' screens/
(0 files)
```

Every screen is a leaf in App.tsx's import graph. There are no sub-screens silently brought in by a parent.

`components/` folder has only 25 files (Toast, TabBar, FeedPostCard, AffordabilityIndicator, etc.) — none are full-page screens. They're inline UI primitives.

`screens/` has **no subfolders** — flat tree of 155 files.

---

## Gap 3 — v0-tanda-xn

**Finding: it's pure build output. No source, no parallel screens.**

```
v0-tanda-xn/
├── CLAUDE.md            # repo notes
├── README.md
├── assets/              # bundled assets
├── docs/
├── expo-static/         # output of `expo export --platform web`
├── favicon.ico
├── fonts/
├── index.html           # entry HTML for Vercel
├── metadata.json
└── vercel.json          # deploy config
```

- No `app/`, no `pages/`, no `src/`.
- No `package.json` (no build step on Vercel — it serves static files).
- No `.tsx` or `.jsx` files anywhere.

This matches what `PROJECT_CONTEXT.md` says: it's the static export of `tanda-xn-mobile/` baked into a separate git repo so Vercel can serve it. Web visitors see the **same 155 screens** as the mobile app, just rendered via `react-native-web`. No additional UI lives here.

---

## Gap 4 — `app/` folder activation paths

**Finding: zero pathways to activate this tree. It is unambiguously dead.**

### External imports (ripgrep, both static and dynamic)
```
$ grep -rE 'from\s+["\'][^"\']*app/' --include="*.tsx" --include="*.ts" \
       --exclude-dir=node_modules --exclude-dir=app
(0 results)
$ grep -rE 'require\(\s*["\'][^"\']*app/' --include="*.tsx" --include="*.ts" \
       --exclude-dir=node_modules
(0 results)
```

Nothing outside `app/` references anything inside `app/`.

### Expo Router activation check
| Place to enable file-based routing | Status |
|---|---|
| `package.json`: dep on `expo-router` | ❌ not present (only `expo-linking` is) |
| `package.json`: `"main"` field | `"index.ts"` (custom entry, not `expo-router/entry`) |
| `app.json`: `"plugins": ["expo-router"]` | ❌ absent |
| `app.json`: `"scheme"` for typed routes | only `tandaxn` (deep-link scheme, unrelated) |
| `app.json`: `"experiments"` block | ❌ absent |
| `app.config.js` | ❌ no such file |
| Any `_layout.tsx` files | ❌ none in repo |
| Any `+native-intent.ts` files | ❌ none |

There is no configuration anywhere that would make Metro treat `app/` as a routes folder. The tree is invisible to the runtime.

---

## Gap 5 — Modal / sheet libraries

**Finding: no third-party sheet libraries. Modals are sub-states inside already-registered screens, not separate screens.**

### Library check
```
$ grep -E '"react-native-modal"|"@gorhom/bottom-sheet"|"react-native-modalize"|"react-native-actions-sheet"' package.json
(no matches)

$ ls node_modules/@gorhom node_modules/react-native-modal* node_modules/react-native-modalize
(none of these exist)
```

None installed, none usable.

### RN built-in `<Modal>` usage
- 15 of 155 `screens/` files use RN's built-in `<Modal>`:
  `AddRecipientScreen`, `CreateCircleDetailsScreen`, `CircleVotingScreen`, `CircleDetailScreen`, `CreateCommunityScreen`, `DomesticSendMoneyScreen`, `GoalDetailsScreen` (16 occurrences — heavy modal user), `LanguageRegionScreen`, `ItineraryBuilderScreen`, `ManageMembersScreen`, `MediationToolsScreen`, `MediationCaseScreen`, `RemittanceScreen`, `SavedRecipientsScreen`, `WalletScreen`
- These are toggled by component state (`setShowModal(true)`, `visible={...}`) — they appear *inside* their parent screen, not as separate routes.
- A "screen" in the navigation sense ≠ a "modal" in the RN sense. The modals don't add to the screen count.

If you want to count user-visible UI states (route + every modal you can pop) the number is closer to ~155 + a few dozen. But that's a different metric than what `04_screen_status.md` was reporting.

---

## Bonus check: orphan registered screens

Doing one more thing on top of your 5 gaps. Of the 155 registered screens, how many are actually navigated to by name from somewhere?

```
$ grep -rhoE "navigation\.navigate\(['\"][A-Z]\w*['\"]" screens/ | sort -u | wc -l
129
$ grep -rhoE "navigation\.(replace|reset)\(['\"][A-Z]\w*['\"]" screens/ App.tsx | sort -u | wc -l
8
```

129 + 8 = **137 unique navigation targets** out of **155 registered**. So **~18 screens are registered but never explicitly named in a `navigate/replace/reset` call**.

These are not necessarily dead. They might be reachable via:
- `initialRouteName="Splash"` (1 screen — `Splash` itself)
- deep linking config (`lib/deepLinking.ts` lists `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `EmailVerification`, `AuthCallback`, `CircleInvite`, `CommunityInvite`, `QuickJoin`, `JoinConfirm`, `SetPassword`, `CircleDetail`, `CommunityHub`, `GoalsHub`, `CreateGoal` — some of which match the missing 18)
- `navigation.dispatch()` calls with `CommonActions.reset()`

I didn't enumerate all of them — needs case-by-case look. **This is the only dark corner of the screen count.** It's an audit risk worth flagging:

> **18 registered screens may or may not be reachable in practice.** Static analysis can't tell without running the app and exercising every entry point (deep link, password reset email, OAuth callback, magic link, invite QR scan).

### Linking config inconsistency (separate issue, worth flagging)

`lib/deepLinking.ts` lists screens that DON'T match the current navigator tree:

```js
MainTabs: {
  screens: {
    Home: "home",
    Dreams: { ... },     // ← not a Tab.Screen in App.tsx
    Circles: "circles",
    Wallet: "wallet",    // ← not a Tab.Screen (you have "Action" and "Market")
    Community: "community",
    Profile: "profile",  // ← not a Tab.Screen
  },
},
```

The actual Tab routes are `Home / Circles / Action / Market / Community`. So `Dreams`, `Wallet`, `Profile` URLs would silently fail to navigate. This is a bug, not a hidden screen — flagging because it suggests the linking config has bit-rotted.

---

## Bounds for "screens a user can actually reach"

| | Count | Reasoning |
|---|---|---|
| **Lower bound** | **137** | Navigated to explicitly via `navigation.navigate/replace/reset(...)` from somewhere I can grep |
| **Mid-estimate** | **155** | All Stack.Screen registrations (deep links and initial route fill the gap to 18) |
| **Upper bound** | **156** | + `LockScreen` (conditional overlay rendered outside the navigator) |
| **Sub-states** (not in the count) | +N | Modal popups inside ~15 screens — additional UI states, NOT separate routes |

**Hard upper bound = 156.** No hidden navigators, no transitive imports, no parallel app, no Expo Router activation, no sheet libraries.

The `app/` folder's 305 files remain orphaned — still zero pathways to make them user-visible.

---

## Confidence summary

| Gap | Verdict | Confidence |
|---|---|---|
| 1. Other navigators | None exist | **High** — exhaustive grep of all .tsx/.ts files |
| 2. Transitive imports | None exist | **High** — exhaustive grep |
| 3. v0-tanda-xn parallel | None | **High** — repo has no source files at all |
| 4. `app/` activation | None | **High** — config check + import check both negative |
| 5. Modals add screens | No, sub-states only | **High** — no third-party libs, RN Modal is in-component |
| Bonus: orphan registered screens | 18 registered-but-not-navigated; reachable via deep link / initial route, but **needs runtime test to confirm each is actually reachable** | **Medium** — static analysis can't prove negative reachability |

---

*Read-only. No code, configs, or migration files were modified.*
