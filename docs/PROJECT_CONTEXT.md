# TandaXn — Project Context

**Purpose of this doc:** an honest snapshot of the project for any engineer (human or AI) stepping in for the first time. Answers the three onboarding questions at the top, then gives the supporting detail underneath.

Last updated: 2026-04-16

---

## 1. Where does the code live?

**Your computer:** `C:\Users\franck\OneDrive\Desktop\TandaXn\`

That folder contains **two separate git repositories**:

| Folder | What it is | GitHub remote | Deploy target |
|---|---|---|---|
| `tanda-xn-mobile/` | **The actual app.** React Native / Expo. iOS, Android, and Web all build from this. | `https://github.com/woltzu/tanda-xn-mobile.git` | Expo Go (phone), EAS builds (stores), `expo export --platform web` → static site |
| `v0-tanda-xn/` | **Web deployment shell.** Holds the static files produced by `expo export --platform web`. Used to be a Next.js scaffold; replaced with the Expo Web build. | `https://github.com/woltzu/v0-tanda-xn.git` | Vercel → `https://v0-tanda-xn.vercel.app/` |

Both repos push to the GitHub user `woltzu`. Local git identity (per-repo): `kimagui <kimagui@hotmail.com>` (set on `v0-tanda-xn` on 2026-04-16 so Vercel auto-deploys stop getting blocked).

Current branch on both: `main`.

---

## 2. What do you see when you run the app?

The entry point is `App.tsx` → `initialRouteName="Splash"`. Flow:

1. **SplashScreen** (`screens/SplashScreen.tsx`) — animated logo, 2.5s loading animation. While animating, it checks `useAuth()` from `context/AuthContext`.
2. **If an active Supabase session exists** → `navigation.reset()` to `MainTabs` (5-tab bottom bar: Home / Circles / Wallet-or-center-action / Market / Community). The default landing tab is **Home** → `DashboardScreen`.
3. **If no session** → user taps "Get Started" → `WelcomeScreen` (3-slide carousel) → `SignupScreen`, or taps "Login" → `LoginScreen`.

**On web (`https://v0-tanda-xn.vercel.app/`)** the same SplashScreen renders first because `expo export --platform web` bundles the same `App.tsx`. The bundle is a single 5.76 MB JS file.

**What does the user actually see right now?** I don't know their device state. The following are the things only **you** can answer — please fill in:

> **[NEEDS YOUR INPUT]**
> - [ ] On your phone (Expo Go or installed build), what screen appears after the splash animation finishes? Splash → Welcome? Or Splash → Dashboard (already logged in)?
> - [ ] On `https://v0-tanda-xn.vercel.app/` in a browser, same question — Welcome, Login, or Dashboard?
> - [ ] Any red error screens, blank screens, or infinite spinners? If yes, which screen and what does the error say?
> - [ ] Which flow is "broken" right now that you need help with? (e.g., "tapping Create Trip crashes", "login button does nothing")

Until those are filled in, any other Claude/engineer is guessing. Code-level I can confirm the happy-path entry flow exists and compiles; runtime behavior on a specific device requires your eyes.

---

## 3. Tech stack

Pulled from `tanda-xn-mobile/package.json` and `app.json`.

### Framework & runtime
- **Expo SDK 54** (`expo: ~54.0.33`)
- **React Native 0.81.5** + **React 19.1.0**
- **TypeScript 5.9** (dev dep)
- **Metro bundler** (also used for web: `"bundler": "metro"` in app.json)

### Navigation
- **React Navigation v7** — `@react-navigation/native`, `native-stack`, `stack`, `bottom-tabs`
- Structure: one root `Stack` wrapping a `Tab` (5 tabs) wrapping per-tab stacks (HomeStack, CirclesStack, MarketStack, CommunityStack).
- **215 `Stack.Screen` registrations** in `App.tsx` (some screens are registered in multiple stacks).

### Backend
- **Supabase** (`@supabase/supabase-js ^2.90.1`) — auth, Postgres, storage, realtime.
  - Client configured in `lib/supabase.ts` (URL + anon key hardcoded; no env vars needed at runtime).
  - Schema lives in `lib/tandaxn_complete_schema.sql` (1,439 lines).
- **Stripe** (`@stripe/stripe-react-native 0.50.3`) for payments/Connect.

### State / data
- **@tanstack/react-query 5.96** for server state
- **20+ React Context providers** in `context/` (Auth, Wallet, Circles, Feed, Community, Notification, Preferences, Currency, Feature gates, Onboarding, etc.)
- **55+ custom hooks** in `hooks/`
- **66 service/engine classes** in `services/` — the business logic layer (scoring, payouts, KYC, etc.)

### Styling
- React Native stylesheets (StyleSheet.create)
- NativeWind 4.2 + Tailwind 3.4 (some components use it, most don't — inconsistent)
- Design tokens in `theme/tokens.ts` (colors, spacing, radius, typography)

### Native modules / capabilities
- expo-secure-store, expo-notifications, expo-local-authentication (biometrics)
- expo-image-picker, expo-camera, expo-barcode-scanner
- expo-av, expo-video (media)
- expo-linking (deep links — scheme: `tandaxn`, universal links on `tandaxn.com` and `v0-tanda-xn.vercel.app`)
- react-native-reanimated, react-native-gesture-handler

### Web support
- `react-native-web 0.21` + `react-dom 19.1`
- `expo export --platform web` outputs a single-file SPA to `dist/`
- `app.json`: `"web": { "bundler": "metro", "output": "single", "name": "TandaXn" }`

### Deployment
- **Mobile:** via Expo / EAS (config in `app.json` — iOS bundleId `com.tandaxn.app`, Android package `com.tandaxn.app`)
- **Web:** Expo Web bundle copied into `v0-tanda-xn/` repo, served as static files by Vercel. The Vercel project has NO build step — it just serves `index.html` + `expo-static/` + `assets/`.

---

## Repository layout (tanda-xn-mobile)

```
tanda-xn-mobile/
├── App.tsx                  # 909 lines. Root navigator, auth gate, 215 Stack.Screen entries.
├── app.json                 # Expo config (iOS/Android/Web)
├── index.ts                 # Expo entry (registers App.tsx)
├── package.json
├── babel.config.js
├── metro.config.js
├── screens/       (140 .tsx files)  # One file per screen. See SCREEN_INVENTORY.md.
├── components/    (~20 files + ui/)  # Reusable UI
├── context/       (~20 files)        # React Context providers
├── hooks/         (~55 files)        # Custom hooks (business logic for screens)
├── services/      (~66 files)        # "Engine" classes — core business logic
├── lib/
│   ├── supabase.ts                   # Supabase client init
│   ├── tandaxn_complete_schema.sql   # Full DB schema (source of truth for tables)
│   ├── database.sql / database_migration.sql / create_circle_tables.sql
│   ├── deepLinking.ts
│   ├── shareInvite.ts
│   ├── autoPost.ts
│   └── transferConfig.ts
├── constants/
├── theme/
│   └── tokens.ts                     # Design tokens (colors NAVY/TEAL/GOLD, spacing, typography)
├── assets/                           # Images, icons, fonts
├── docs/
│   ├── PROJECT_CONTEXT.md            # (this file)
│   ├── SCREEN_INVENTORY.md           # Full inventory of all 140 screens
│   ├── TANDAXN_ALGORITHMS_DETAILED.md
│   ├── TANDAXN_SYSTEMS_STATUS.md
│   ├── TANDAXN_SYSTEMS_STATUS_v2.md
│   └── tandaxn-partner-brief-lauritz.docx
├── BUILD_PLAN.md                     # Older planning doc (repo root)
├── SUPABASE_SETUP.md                 # Supabase bootstrap notes (repo root)
└── dist/                             # Output of `expo export --platform web` (gitignored usually)
```

---

## What's been worked on recently (last 10 commits)

```
c2c58be  Fix infinite spinners, broken trip list, and trip dashboard discoverability
590e227  Persist & display trip tagline/included/excluded; fix activity time saves
be4c43f  Fix Save Draft: convert snake_case form state to camelCase Trip shape
a09db23  Fix slug mismatch, public trip page data, and keyboard dismiss issues
3bbbb3f  Fix Dashboard crash: map TripDashboard camelCase fields to screen's snake_case
0220d2f  Rewrite Itinerary Builder: simpler inline editing, wired saves, updated categories
88b52d1  Fix refund_policy constraint: map display labels to DB enum values
b421c6e  Fix trip creation: remove non-existent DB columns, fix save/publish flow
49768a9  Fix DB column mismatches, date picker styles, keyboard avoidance, and realtime subscriptions
c20f9fc Fix UX issues: friendly date picker, keyboard dismiss, photo upload, error guards
```

**The Trip Organizer feature** (`screens/CreateTripWizard*`, `OrganizerTripList*`, `OrganizerTripDashboard*`, `ItineraryBuilder*`, `TripPublicPage*`) got the most attention. It's feature-complete but should be tested end-to-end before the presentation.

---

## Known rough edges (as of today)

- **No centralized navigation/deep-link test.** With 215 screen registrations and only a few paths actually reachable from the UI, some screens may be orphaned (registered but no button points at them).
- **Hybrid naming — snake_case DB vs camelCase TypeScript.** Mappers in `services/*Engine.ts` bridge them, but new screens sometimes mix the two and cause render bugs.
- **`react-native-web` mismatches.** A handful of components behave differently on web (time pickers, file uploads, gestures). The web deploy is for demos — full QA is native.
- **GitHub → Vercel auto-deploy on `v0-tanda-xn`** was broken until 2026-04-16 (commits authored under `salehtagu@gmail.com` / `vjekimagui@gmai.com` were blocked because those emails aren't linked to the Vercel account). Now working with `kimagui@hotmail.com` as author.
- **No automated tests.** No Jest, no Detox, no Playwright. All QA is manual.
- **`.env.local` is gitignored and contains Supabase keys** — but `lib/supabase.ts` also has them hardcoded, so the app runs without env files.

---

## How to run locally

```bash
cd tanda-xn-mobile
npm install        # or: pnpm install / yarn
npm start          # Expo dev server
# then:
#   press 'w' for web
#   press 'a' for android emulator
#   press 'i' for iOS simulator
#   scan QR with Expo Go on your phone
```

To rebuild the web bundle that feeds `v0-tanda-xn`:
```bash
cd tanda-xn-mobile
npx expo export --platform web   # outputs to ./dist/
# copy dist/* into ../v0-tanda-xn/, then:
#   rename _expo/ → expo-static/ (Vercel strips underscore-prefixed folders)
#   update index.html <script src> and vercel.json accordingly
#   git add / commit as author kimagui@hotmail.com / push
```

---

## Things only the product owner can answer (for the next engineer)

Copy-paste this checklist when handing the project off:

> **[NEEDS YOUR INPUT]**
> - [ ] Who are the 3-5 target user personas? (organizer? saver? migrant sender?)
> - [ ] Which of the 140 screens are **core to the v1 demo** vs. "stretch / later"?
> - [ ] Which tab is the "default landing tab" post-login supposed to be? (Currently: Home/Dashboard.)
> - [ ] Is there a Figma / design spec anywhere? (No link found in the repo.)
> - [ ] What's the current production Supabase project ID, and is anyone else on it besides you?
> - [ ] Are there iOS/Android store listings published, or is this still pre-launch?
> - [ ] What payment providers are live vs. mocked? (Stripe code is present; real keys status unknown.)
