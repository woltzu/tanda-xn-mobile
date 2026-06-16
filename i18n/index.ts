// =============================================================================
// i18n module -- Foundation for app-wide language switching (English / French).
//
// Initialization model:
//   1. Sync init with English as the default so the first render of any
//      useTranslation() consumer doesn't have to await a Promise.
//   2. Async post-init that reads AsyncStorage('app-language') (written by
//      PreferencesContext.setLanguage) and falls back to the system locale
//      from expo-localization. When the resolved language differs from the
//      sync default we call i18n.changeLanguage() which triggers re-renders
//      in every useTranslation() consumer.
//
// Why a separate `app-language` AsyncStorage key (vs reading the existing
// preferences blob): keeps i18n decoupled from PreferencesContext's shape.
// PreferencesContext.setLanguage mirrors the code into this key on every
// write so the two stay in sync without a circular import.
//
// Adding a new screen to i18n:
//   1. Add the screen's strings to `locales/en.json` AND `locales/fr.json`
//      under a new top-level key (e.g. "dashboard": { ... }).
//   2. In the screen: `const { t } = useTranslation();` then `t('dashboard.foo')`.
//   3. The translation registers automatically -- the resources blob below
//      reads the full JSON files at build time.
//
// Adding a new language:
//   1. Add the locale code to SUPPORTED_LANGUAGES below.
//   2. Drop a `locales/<code>.json` file with matching keys.
//   3. Import and register it in the `resources` map below.
// =============================================================================

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

export const APP_LANGUAGE_STORAGE_KEY = "app-language";
export const SUPPORTED_LANGUAGES = ["en", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// P1 (language-switcher review): sentinel for "follow device language".
// Stored verbatim under APP_LANGUAGE_STORAGE_KEY; resolved to a real
// SupportedLanguage code at read time via getEffectiveLanguage().
export const SYSTEM_LANGUAGE_SENTINEL = "system" as const;

// Resolves whichever language code i18next should currently be on.
// "system" sentinel + unknown values both fall back to the device
// locale and then to English.
export function resolveDeviceLanguage(): SupportedLanguage {
  try {
    const locales = Localization.getLocales();
    const detected = locales?.[0]?.languageCode ?? null;
    if (detected && SUPPORTED_LANGUAGES.includes(detected as SupportedLanguage)) {
      return detected as SupportedLanguage;
    }
  } catch {
    // Localization can throw on edge web bundles — fall through.
  }
  return "en";
}

// Returns the effective language code for a given stored value.
// Single-source-of-truth helper so PreferencesContext + i18n bootstrap
// agree on resolution rules.
export function resolveStoredLanguage(
  stored: string | null,
): SupportedLanguage {
  if (stored === SYSTEM_LANGUAGE_SENTINEL || !stored) {
    return resolveDeviceLanguage();
  }
  if (SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
    return stored as SupportedLanguage;
  }
  return resolveDeviceLanguage();
}

const resources = {
  en: { translation: en },
  fr: { translation: fr },
};

// Synchronous init -- English default. The async load below may upgrade
// this to the user's saved/system language; until then every t() call
// returns the English string. This avoids a "blank UI" first frame.
i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes
  // No Suspense -- we want sync returns for missing keys, not a throw.
  react: { useSuspense: false },
});

// Async post-init. Reads the stored choice if present, else falls back
// to the system locale, else English. Idempotent -- changeLanguage on
// the current language is a no-op.
(async () => {
  try {
    const stored = await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
    const lang = resolveStoredLanguage(stored);
    if (i18n.language !== lang) {
      await i18n.changeLanguage(lang);
    }
  } catch {
    // AsyncStorage failure or Localization API hiccup -- stay on English.
  }
})();

// Programmatic switcher used by LanguageRegionScreen and (indirectly via
// the PreferencesContext setLanguage) any other UI that flips language.
// Persists to AsyncStorage AND updates the live i18n instance so every
// useTranslation() consumer re-renders.
export const setAppLanguage = async (
  code: string,
): Promise<SupportedLanguage> => {
  // P0 (language-switcher review): if a caller hands us a code that
  // isn't in SUPPORTED_LANGUAGES we fall back to English — but warn
  // so we notice (the picker should never offer an unsupported code
  // after P0; if this fires, something else is calling this with bad
  // data). Kept the en fallback for safety until we ship migration
  // logic for users who already saved an unsupported code.
  //
  // P1 (language-switcher review): "system" sentinel is honored —
  // stored verbatim under APP_LANGUAGE_STORAGE_KEY so subsequent
  // reads can re-resolve against the *current* device locale.
  // Returns the effective code so callers can update local state.
  let storedValue: string;
  let effective: SupportedLanguage;
  if (code === SYSTEM_LANGUAGE_SENTINEL) {
    storedValue = SYSTEM_LANGUAGE_SENTINEL;
    effective = resolveDeviceLanguage();
  } else if (SUPPORTED_LANGUAGES.includes(code as SupportedLanguage)) {
    storedValue = code;
    effective = code as SupportedLanguage;
  } else {
    console.warn(
      `[i18n] setAppLanguage: unsupported code "${code}" — falling back to "en"`,
    );
    storedValue = "en";
    effective = "en";
  }
  await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, storedValue);
  if (i18n.language !== effective) {
    await i18n.changeLanguage(effective);
  }
  return effective;
};

export default i18n;
