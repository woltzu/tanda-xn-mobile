# 31 — French Language Bug: i18n Diagnosis

**Status:** Diagnosed, not fixed. Decision pending on which fix path.
**Reporter:** A tester selected French as preferred language; the app stayed in English.
**Surfaced:** 2026-05-26.

---

## TL;DR — the chain breaks at translations

There is **no i18n library, no translation files, and no `t()` / `useTranslation()` in the codebase**. The "Language & Region" picker exists and *correctly persists* the user's choice to AsyncStorage, but that's the entire chain. Nothing reads the persisted language code to switch strings, and there are no foreign-language strings to switch to. Every UI string in every screen is a hardcoded English literal.

So when the tester picked French:
1. ✅ The picker UI updated (French flag + "Français" shown as selected).
2. ✅ The selection was saved to `AsyncStorage` under the preferences key.
3. ❌ No re-render with French strings happened, because there is no mechanism to do so.

The picker is currently **decorative UI**. Saving works, but the language preference is unused by any other code in the app.

---

## What I found, in order

### Picker UI — `screens/LanguageRegionScreen.tsx`

The picker lists 15 languages (English, French, Spanish, Portuguese, Hindi, Tagalog, Chinese, Vietnamese, Korean, Arabic, Amharic, Swahili, Yoruba, Hausa, Haitian Creole — clearly targeting your diaspora demographic). Tapping one calls `handleLanguageSelect` at line 41-44:

```ts
const handleLanguageSelect = async (language: (typeof LANGUAGES)[0]) => {
  await setLanguage(language);
  setShowLanguageModal(false);
};
```

`setLanguage` comes from `usePreferences()` — defined in `PreferencesContext`.

### Storage — `context/PreferencesContext.tsx`

The `LANGUAGES` constant at line 11-27 is a simple array of objects: `{ code, name, nativeName, flag }`. No translation strings attached, no locale data, just labels for the picker UI.

`setLanguage` at line 446-449:
```ts
const setLanguage = async (language: Language) => {
  const newPrefs = { ...preferences, language };
  await savePreferences(newPrefs);
};
```

`savePreferences` writes `preferences` to AsyncStorage. The default initial value (line 392) is `LANGUAGES[0]` — English. On app boot, `preferences.language` is loaded from AsyncStorage if present, otherwise English.

The persistence is correct. After picking French and restarting the app, `preferences.language.code === "fr"` and the picker shows French selected. Verified by reading the loader code at line 424.

### Translation files / i18n library — none exist

Searched for everything that would indicate an i18n setup:

- **`package.json` dependencies:** no `i18next`, `react-i18next`, `expo-localization`, `react-intl`, `lingui`, `format-message`, or any other translation library. Confirmed by `grep -E '"(i18n|i18next|react-i18next|expo-localization)"' package.json` returning zero matches.
- **Filesystem:** no `locales/`, `i18n/`, `translations/`, `lang/`, `src/i18n/`, `src/locales/` directories exist in the repo.
- **Translation files:** no `fr.json`, `en.json`, `*translation*.json` files anywhere in the source tree (excluding `node_modules`).
- **Hook / API usage:** `grep` for `useTranslation|i18next.init|i18n.t|i18n.changeLanguage` across `context/`, `screens/`, `lib/`, `hooks/`, `services/`, `components/` returned matches **only in services/hooks where "language" is a field name on a profile/model** (e.g., `services/SubstituteMemberEngine.ts`, `services/MarketplaceEngine.ts`). Zero matches for any actual i18n library call.
- **Hardcoded strings:** spot-checked screens — every `<Text>` element contains an inline English string literal. No `t("key")` wrappers anywhere.

### Where does `preferences.language` actually get *read* outside the picker?

Searching for any reader of `preferences.language` across the codebase:
- `screens/LanguageRegionScreen.tsx` reads `preferences.language` to render the currently-selected option in the picker UI. This is the only read site relevant to user-visible behavior.
- No other screen, context, hook, or service reads `preferences.language` to alter behavior.

The persisted value influences exactly one thing: which entry shows as "selected" in the picker UI itself. Pure cosmetic. No downstream consumer.

---

## Where the chain breaks (precisely)

```
User picks French
   ↓
LanguageRegionScreen.handleLanguageSelect  ✅  fires
   ↓
PreferencesContext.setLanguage              ✅  receives the Language object
   ↓
savePreferences → AsyncStorage              ✅  writes to disk
   ↓
preferences state updated                   ✅  context re-renders
   ↓
... [no consumer]                           ❌  CHAIN ENDS HERE
   ↓
[expected: every UI string re-evaluates]    ❌  doesn't happen
[expected: French translations load]        ❌  none exist to load
```

**Root cause:** the i18n system was never built. The Language & Region screen is a stub that saves a setting nothing reads, displaying a list of languages for which no translations exist.

This is not a regression, not a recently-broken feature, not a config issue. It's a feature that was scoped at the UI level but never implemented at the application level.

---

## Options to fix

### A. Full i18n implementation with `i18next` + `react-i18next` *(the "real" fix)*

- Install `i18next` (~30 KB), `react-i18next` (~20 KB), and `expo-localization` (already supported on Expo SDK 54).
- Create `locales/en.json`, `locales/fr.json`, etc. — one file per supported language. Each is a flat or nested JSON map of `key → translated string`.
- Initialize i18next at app boot in `App.tsx` or a new `lib/i18n.ts`, reading `preferences.language.code` to set initial locale, with a `useEffect` in PreferencesContext that calls `i18n.changeLanguage(code)` when the user picks a new one.
- Replace every hardcoded UI string in every screen with `t("key.path")`. This is the bulk of the work.
- Test that picking French re-renders the entire app in French in real time.

**Effort:** Big. The library setup is 1-2 days. Extracting strings from 155 screens is 2-4 weeks of careful work — every `<Text>` literal, every `Alert.alert(...)` argument, every error message, every placeholder, every label. Then translation itself (either professional or AI-assisted) is multi-week.

**Risk:** Low technical risk, high effort. The library is mature and battle-tested. The work is mechanical extraction.

**Best fit if:** French (and the other 13 languages) are a launch-blocking requirement for diaspora-community markets.

### B. Lightweight custom i18n *(minimal library)*

- Build a small `TranslationContext` that reads `preferences.language.code` and exposes a `t(key)` function backed by JSON dictionaries you maintain manually.
- Equivalent file structure to A (`locales/en.json`, `locales/fr.json`) but no third-party library.
- Same screen-extraction work as A.

**Effort:** Similar to A. The library you save (~50KB compressed) is not the bottleneck — the extraction work is.
**Risk:** You lose features (pluralization, interpolation, fallback chains, locale-aware date/number formatting) that `i18next` provides for free. If you ever need plurals ("1 message" vs "3 messages") or right-to-left support for Arabic, you'll end up rebuilding parts of i18next.

**Not recommended** unless there's a specific reason to avoid the dep.

### C. Show only English in the picker, with a "coming soon" message *(honest UX)*

- Trim `LANGUAGES` in `PreferencesContext.tsx` to just English.
- Or keep the list but render non-English entries with a "Coming Soon" badge and disable selection.
- The screen no longer claims to support 15 languages it doesn't.

**Effort:** Trivial (~15 minutes).
**Risk:** None.
**UX implication:** The current picker is misleading users into thinking the app supports French. Removing/dimming the option fixes the false promise even if you don't build the translations.

**Best fit if:** i18n is a Stage-N feature, not the current sprint, and you don't want the picker overpromising in the meantime.

### D. Use device locale only, no in-app picker *(deferred)*

- Read `expo-localization`'s `Localization.locale` once at boot.
- If translations exist for it, use them; otherwise English.
- Remove the picker entirely; the device's system language is the source of truth.

**Effort:** Tiny + same translation work as A.
**Risk:** Reduces user control. A user whose phone is in English but who wants the app in French can't override.
**Best fit if:** you ship translations later and want the picker out of the way until then.

### E. Hybrid — implement A but ship in phases

- Phase 1 (~1 week): set up i18next + locales/en.json + locales/fr.json with maybe 50 critical strings (Login screen, signup, dashboard tiles, errors). Confirm the wiring works end-to-end.
- Phase 2 (per sprint): extract strings from one feature area at a time (Wallet, Circles, Trips...) until done.
- During phase 1-N, untranslated strings fall back to English via i18next's `fallbackLng: 'en'`.

**Effort:** Same total work as A, but front-loaded value: French-speaking users see *some* translation immediately, more over time.
**Risk:** A user in French mode sees a mix of French and English for weeks/months, which is worse than pure English for some perception metrics.

**Best fit if:** you want to demonstrate i18n is live before all translations are ready.

---

## Recommendation

This is a product call, not a technical one. The technical paths are all viable; the question is timing vs. honesty vs. effort.

If I had to choose without business context: **C now, A in a subsequent sprint**. Option C unblocks user expectation in 15 minutes ("App is English right now, with more languages coming"). Option A then becomes a planned multi-sprint effort with a clean baseline (no users currently expecting French to work because option C set the expectation honestly).

If French specifically is required for launch (e.g., for the West African market the LANGUAGES list strongly hints at): **A or E**, scoped seriously, on its own milestone — not a side-task.

---

## Priority framing (recorded 2026-05-26)

**Francophone diaspora is the beachhead market for this product.** That makes bilingual support (English + French) close to a launch requirement, not optional polish. French is not a "someday" feature — it should be **a prioritized milestone** with its own scope, schedule, and acceptance criteria, planned alongside other launch-blocking work.

**Interim action (small, do soon):** apply Option C — make the picker honest. Either show only English in the LANGUAGES list, or render the other 14 entries with a "Coming Soon" badge and disable selection. This stops the app from shipping a language toggle that silently does nothing. ~15 minutes of work; should happen before any external testing that includes the Language & Region screen.

**Milestone action (planned, not started):** full i18n implementation per Option A or E. Scope is non-trivial — every UI string in 155 screens must be extracted to translation keys, English baseline written, then French translation produced. Treat as a multi-sprint milestone, not a side-task.

### Dependency: do NOT translate strings inside screens that are about to be consolidated

`docs/audit/28_consolidate_join_paths.md` calls for collapsing 9 user-facing join paths into a single RPC chokepoint, which will rewrite or remove several join-related screens (`JoinCircleConfirmScreen`, parts of `QuickJoinScreen`, parts of `JoinConfirmScreen`, plus the routes that navigate to them). Any string extraction work done in those screens *before* the consolidation will be discarded or duplicated when the screens are merged.

**Ordering rule for the i18n milestone:** the join-path consolidation in doc 28 must land before string extraction begins on those specific screens. Other parts of the app (Dashboard, Wallet, Goals, Trips, Community, etc.) can be extracted in parallel — only the screens listed in doc 28's "Current state — all 9 join paths" table are blocked behind the consolidation.

If any future consolidation work is identified for other features before i18n is done, apply the same ordering rule: consolidate first, translate second.

---

## Adjacent code-quality notes (not the bug, but worth seeing)

- **Profile field `language`** appears in some service / model files (`services/SubstituteMemberEngine.ts`, `services/MarketplaceEngine.ts`, etc.). These store a member's preferred language as part of their profile for **matching purposes** (e.g., suggesting circles whose members share a language). This is independent of UI translation — it's a data field, not an i18n flag. Don't confuse the two.
- **AsyncStorage key for preferences** can be found by reading `savePreferences` in `PreferencesContext.tsx`. If you ever build i18n and want to fix users who picked French in the broken picker, the key + value structure is ready to migrate from.
- **`LANGUAGES` includes 15 languages with `nativeName` populated correctly** (Français, Español, Português, हिन्दी, etc. all render in their own script). When translations are eventually built, this list is a good source-of-truth for which languages to support.

---

## Links

- `screens/LanguageRegionScreen.tsx:41-44` — picker tap handler
- `context/PreferencesContext.tsx:11-27` — LANGUAGES list (decorative until translations exist)
- `context/PreferencesContext.tsx:446-449` — `setLanguage()` (saves to AsyncStorage)
- `context/PreferencesContext.tsx:392` — default to English
- `context/PreferencesContext.tsx:424` — loader from AsyncStorage on mount
- `package.json` — confirm no i18n deps
- `docs/audit/30_navigation_map.md` — how the user reaches LanguageRegion (`Dashboard → ProfileMain (avatar) → LanguageRegion`)
