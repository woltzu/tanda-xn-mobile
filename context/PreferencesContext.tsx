import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
// i18n integration -- setLanguage mirrors the selected code into the
// i18n module's separate AsyncStorage key + calls changeLanguage so
// every useTranslation() consumer re-renders without an app restart.
import {
  APP_LANGUAGE_STORAGE_KEY,
  SYSTEM_LANGUAGE_SENTINEL,
  resolveDeviceLanguage,
  setAppLanguage,
} from "../i18n";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

// P0 (language-switcher review): only locales that ship a translation
// bundle live here. Picking "Spanish" used to silently fall back to
// English because no es.json existed — surfacing only what works
// keeps the picker honest. Add a row here ONLY after the matching
// locales/<code>.json file ships AND the i18n module's
// SUPPORTED_LANGUAGES list is bumped to include the code.
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "fr", name: "French",  nativeName: "Français", flag: "🇫🇷" },
];

// Community categories
export type CommunityCategory = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  communities: Community[];
};

export type Community = {
  id: string;
  name: string;
  emoji: string;
  category: string;
};

// Origin communities (countries grouped by region)
export const ORIGIN_REGIONS = [
  {
    id: "west-africa",
    name: "West Africa",
    emoji: "🌍",
    countries: [
      { code: "ng", name: "Nigeria", emoji: "🇳🇬" },
      { code: "gh", name: "Ghana", emoji: "🇬🇭" },
      { code: "sn", name: "Senegal", emoji: "🇸🇳" },
      { code: "ci", name: "Ivory Coast", emoji: "🇨🇮" },
      { code: "ml", name: "Mali", emoji: "🇲🇱" },
      { code: "bf", name: "Burkina Faso", emoji: "🇧🇫" },
      { code: "ne", name: "Niger", emoji: "🇳🇪" },
      { code: "tg", name: "Togo", emoji: "🇹🇬" },
      { code: "bj", name: "Benin", emoji: "🇧🇯" },
      { code: "gn", name: "Guinea", emoji: "🇬🇳" },
      { code: "lr", name: "Liberia", emoji: "🇱🇷" },
      { code: "sl", name: "Sierra Leone", emoji: "🇸🇱" },
      { code: "gm", name: "Gambia", emoji: "🇬🇲" },
      { code: "cv", name: "Cape Verde", emoji: "🇨🇻" },
    ],
  },
  {
    id: "east-africa",
    name: "East Africa",
    emoji: "🌍",
    countries: [
      { code: "et", name: "Ethiopia", emoji: "🇪🇹" },
      { code: "ke", name: "Kenya", emoji: "🇰🇪" },
      { code: "tz", name: "Tanzania", emoji: "🇹🇿" },
      { code: "ug", name: "Uganda", emoji: "🇺🇬" },
      { code: "rw", name: "Rwanda", emoji: "🇷🇼" },
      { code: "so", name: "Somalia", emoji: "🇸🇴" },
      { code: "er", name: "Eritrea", emoji: "🇪🇷" },
      { code: "dj", name: "Djibouti", emoji: "🇩🇯" },
      { code: "ss", name: "South Sudan", emoji: "🇸🇸" },
    ],
  },
  {
    id: "central-africa",
    name: "Central Africa",
    emoji: "🌍",
    countries: [
      { code: "cd", name: "DR Congo", emoji: "🇨🇩" },
      { code: "cm", name: "Cameroon", emoji: "🇨🇲" },
      { code: "cg", name: "Congo", emoji: "🇨🇬" },
      { code: "ga", name: "Gabon", emoji: "🇬🇦" },
      { code: "td", name: "Chad", emoji: "🇹🇩" },
      { code: "cf", name: "Central African Republic", emoji: "🇨🇫" },
    ],
  },
  {
    id: "southern-africa",
    name: "Southern Africa",
    emoji: "🌍",
    countries: [
      { code: "za", name: "South Africa", emoji: "🇿🇦" },
      { code: "zw", name: "Zimbabwe", emoji: "🇿🇼" },
      { code: "mz", name: "Mozambique", emoji: "🇲🇿" },
      { code: "zm", name: "Zambia", emoji: "🇿🇲" },
      { code: "mw", name: "Malawi", emoji: "🇲🇼" },
      { code: "bw", name: "Botswana", emoji: "🇧🇼" },
      { code: "na", name: "Namibia", emoji: "🇳🇦" },
    ],
  },
  {
    id: "north-africa",
    name: "North Africa",
    emoji: "🌍",
    countries: [
      { code: "eg", name: "Egypt", emoji: "🇪🇬" },
      { code: "ma", name: "Morocco", emoji: "🇲🇦" },
      { code: "dz", name: "Algeria", emoji: "🇩🇿" },
      { code: "tn", name: "Tunisia", emoji: "🇹🇳" },
      { code: "ly", name: "Libya", emoji: "🇱🇾" },
      { code: "sd", name: "Sudan", emoji: "🇸🇩" },
    ],
  },
  {
    id: "caribbean",
    name: "Caribbean",
    emoji: "🏝️",
    countries: [
      { code: "ht", name: "Haiti", emoji: "🇭🇹" },
      { code: "jm", name: "Jamaica", emoji: "🇯🇲" },
      { code: "tt", name: "Trinidad & Tobago", emoji: "🇹🇹" },
      { code: "do", name: "Dominican Republic", emoji: "🇩🇴" },
      { code: "cu", name: "Cuba", emoji: "🇨🇺" },
      { code: "pr", name: "Puerto Rico", emoji: "🇵🇷" },
      { code: "bb", name: "Barbados", emoji: "🇧🇧" },
      { code: "gy", name: "Guyana", emoji: "🇬🇾" },
    ],
  },
  {
    id: "south-asia",
    name: "South Asia",
    emoji: "🌏",
    countries: [
      { code: "in", name: "India", emoji: "🇮🇳" },
      { code: "pk", name: "Pakistan", emoji: "🇵🇰" },
      { code: "bd", name: "Bangladesh", emoji: "🇧🇩" },
      { code: "np", name: "Nepal", emoji: "🇳🇵" },
      { code: "lk", name: "Sri Lanka", emoji: "🇱🇰" },
    ],
  },
  {
    id: "southeast-asia",
    name: "Southeast Asia",
    emoji: "🌏",
    countries: [
      { code: "ph", name: "Philippines", emoji: "🇵🇭" },
      { code: "vn", name: "Vietnam", emoji: "🇻🇳" },
      { code: "th", name: "Thailand", emoji: "🇹🇭" },
      { code: "my", name: "Malaysia", emoji: "🇲🇾" },
      { code: "id", name: "Indonesia", emoji: "🇮🇩" },
      { code: "mm", name: "Myanmar", emoji: "🇲🇲" },
      { code: "kh", name: "Cambodia", emoji: "🇰🇭" },
    ],
  },
  {
    id: "east-asia",
    name: "East Asia",
    emoji: "🌏",
    countries: [
      { code: "cn", name: "China", emoji: "🇨🇳" },
      { code: "kr", name: "South Korea", emoji: "🇰🇷" },
      { code: "jp", name: "Japan", emoji: "🇯🇵" },
      { code: "tw", name: "Taiwan", emoji: "🇹🇼" },
      { code: "hk", name: "Hong Kong", emoji: "🇭🇰" },
    ],
  },
  {
    id: "latin-america",
    name: "Latin America",
    emoji: "🌎",
    countries: [
      { code: "mx", name: "Mexico", emoji: "🇲🇽" },
      { code: "gt", name: "Guatemala", emoji: "🇬🇹" },
      { code: "sv", name: "El Salvador", emoji: "🇸🇻" },
      { code: "hn", name: "Honduras", emoji: "🇭🇳" },
      { code: "co", name: "Colombia", emoji: "🇨🇴" },
      { code: "pe", name: "Peru", emoji: "🇵🇪" },
      { code: "ec", name: "Ecuador", emoji: "🇪🇨" },
      { code: "br", name: "Brazil", emoji: "🇧🇷" },
      { code: "ve", name: "Venezuela", emoji: "🇻🇪" },
      { code: "ar", name: "Argentina", emoji: "🇦🇷" },
    ],
  },
  {
    id: "middle-east",
    name: "Middle East",
    emoji: "🌍",
    countries: [
      { code: "lb", name: "Lebanon", emoji: "🇱🇧" },
      { code: "sy", name: "Syria", emoji: "🇸🇾" },
      { code: "iq", name: "Iraq", emoji: "🇮🇶" },
      { code: "ir", name: "Iran", emoji: "🇮🇷" },
      { code: "jo", name: "Jordan", emoji: "🇯🇴" },
      { code: "ps", name: "Palestine", emoji: "🇵🇸" },
      { code: "ye", name: "Yemen", emoji: "🇾🇪" },
    ],
  },
  {
    id: "western-europe",
    name: "Western Europe",
    emoji: "🇪🇺",
    countries: [
      { code: "fr", name: "France", emoji: "🇫🇷" },
      { code: "de", name: "Germany", emoji: "🇩🇪" },
      { code: "gb", name: "United Kingdom", emoji: "🇬🇧" },
      { code: "es", name: "Spain", emoji: "🇪🇸" },
      { code: "it", name: "Italy", emoji: "🇮🇹" },
      { code: "pt", name: "Portugal", emoji: "🇵🇹" },
      { code: "nl", name: "Netherlands", emoji: "🇳🇱" },
      { code: "be", name: "Belgium", emoji: "🇧🇪" },
      { code: "ch", name: "Switzerland", emoji: "🇨🇭" },
      { code: "at", name: "Austria", emoji: "🇦🇹" },
      { code: "ie", name: "Ireland", emoji: "🇮🇪" },
      { code: "lu", name: "Luxembourg", emoji: "🇱🇺" },
    ],
  },
  {
    id: "northern-europe",
    name: "Northern Europe",
    emoji: "🇪🇺",
    countries: [
      { code: "se", name: "Sweden", emoji: "🇸🇪" },
      { code: "no", name: "Norway", emoji: "🇳🇴" },
      { code: "dk", name: "Denmark", emoji: "🇩🇰" },
      { code: "fi", name: "Finland", emoji: "🇫🇮" },
      { code: "is", name: "Iceland", emoji: "🇮🇸" },
      { code: "ee", name: "Estonia", emoji: "🇪🇪" },
      { code: "lv", name: "Latvia", emoji: "🇱🇻" },
      { code: "lt", name: "Lithuania", emoji: "🇱🇹" },
    ],
  },
  {
    id: "eastern-europe",
    name: "Eastern Europe",
    emoji: "🇪🇺",
    countries: [
      { code: "pl", name: "Poland", emoji: "🇵🇱" },
      { code: "ua", name: "Ukraine", emoji: "🇺🇦" },
      { code: "ru", name: "Russia", emoji: "🇷🇺" },
      { code: "cz", name: "Czech Republic", emoji: "🇨🇿" },
      { code: "ro", name: "Romania", emoji: "🇷🇴" },
      { code: "hu", name: "Hungary", emoji: "🇭🇺" },
      { code: "sk", name: "Slovakia", emoji: "🇸🇰" },
      { code: "bg", name: "Bulgaria", emoji: "🇧🇬" },
      { code: "by", name: "Belarus", emoji: "🇧🇾" },
      { code: "md", name: "Moldova", emoji: "🇲🇩" },
    ],
  },
  {
    id: "southern-europe",
    name: "Southern Europe",
    emoji: "🇪🇺",
    countries: [
      { code: "gr", name: "Greece", emoji: "🇬🇷" },
      { code: "hr", name: "Croatia", emoji: "🇭🇷" },
      { code: "rs", name: "Serbia", emoji: "🇷🇸" },
      { code: "si", name: "Slovenia", emoji: "🇸🇮" },
      { code: "ba", name: "Bosnia & Herzegovina", emoji: "🇧🇦" },
      { code: "al", name: "Albania", emoji: "🇦🇱" },
      { code: "mk", name: "North Macedonia", emoji: "🇲🇰" },
      { code: "me", name: "Montenegro", emoji: "🇲🇪" },
      { code: "xk", name: "Kosovo", emoji: "🇽🇰" },
      { code: "mt", name: "Malta", emoji: "🇲🇹" },
      { code: "cy", name: "Cyprus", emoji: "🇨🇾" },
    ],
  },
];

// Faith communities
export const FAITH_COMMUNITIES: Community[] = [
  { id: "christian", name: "Christian", emoji: "✝️", category: "faith" },
  { id: "catholic", name: "Catholic", emoji: "⛪", category: "faith" },
  { id: "protestant", name: "Protestant", emoji: "🙏", category: "faith" },
  { id: "muslim", name: "Muslim", emoji: "☪️", category: "faith" },
  { id: "hindu", name: "Hindu", emoji: "🕉️", category: "faith" },
  { id: "buddhist", name: "Buddhist", emoji: "☸️", category: "faith" },
  { id: "jewish", name: "Jewish", emoji: "✡️", category: "faith" },
  { id: "sikh", name: "Sikh", emoji: "🙏", category: "faith" },
  { id: "spiritual", name: "Spiritual", emoji: "🌟", category: "faith" },
];

// Professional communities
export const PROFESSIONAL_COMMUNITIES: Community[] = [
  { id: "entrepreneurs", name: "Entrepreneurs", emoji: "🚀", category: "professional" },
  { id: "small-business", name: "Small Business Owners", emoji: "🏪", category: "professional" },
  { id: "tech", name: "Tech Professionals", emoji: "💻", category: "professional" },
  { id: "healthcare", name: "Healthcare Workers", emoji: "🏥", category: "professional" },
  { id: "real-estate", name: "Real Estate", emoji: "🏠", category: "professional" },
  { id: "finance", name: "Finance & Banking", emoji: "💰", category: "professional" },
  { id: "education", name: "Educators", emoji: "📚", category: "professional" },
  { id: "creative", name: "Creatives & Artists", emoji: "🎨", category: "professional" },
  { id: "legal", name: "Legal Professionals", emoji: "⚖️", category: "professional" },
  { id: "trades", name: "Skilled Trades", emoji: "🔧", category: "professional" },
  { id: "rideshare", name: "Rideshare/Delivery", emoji: "🚗", category: "professional" },
];

// Life stage & interest communities
export const LIFE_COMMUNITIES: Community[] = [
  { id: "ivf", name: "IVF / Fertility Journey", emoji: "🍼", category: "life" },
  { id: "new-parents", name: "New Parents", emoji: "👶", category: "life" },
  { id: "homebuyers", name: "First-Time Homebuyers", emoji: "🏡", category: "life" },
  { id: "students", name: "Students", emoji: "🎓", category: "life" },
  { id: "newlyweds", name: "Newlyweds", emoji: "💒", category: "life" },
  { id: "single-parents", name: "Single Parents", emoji: "💪", category: "life" },
  { id: "caregivers", name: "Caregivers", emoji: "❤️", category: "life" },
  { id: "retirees", name: "Retirees", emoji: "🌴", category: "life" },
  { id: "immigrants", name: "New Immigrants", emoji: "🗽", category: "life" },
  { id: "sending-home", name: "Sending Money Home", emoji: "💸", category: "life" },
];

// Cultural affinity communities
export const CULTURAL_COMMUNITIES: Community[] = [
  { id: "hbcu", name: "HBCU Alumni", emoji: "🎓", category: "cultural" },
  { id: "greek", name: "Greek Life (D9 & Others)", emoji: "🏛️", category: "cultural" },
  { id: "veterans", name: "Veterans", emoji: "🎖️", category: "cultural" },
  { id: "women", name: "Women's Circle", emoji: "👩", category: "cultural" },
  { id: "mens", name: "Men's Circle", emoji: "👨", category: "cultural" },
  { id: "young-professionals", name: "Young Professionals", emoji: "💼", category: "cultural" },
  { id: "seniors", name: "Seniors (55+)", emoji: "🌟", category: "cultural" },
];

// All community categories for display
export const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  {
    id: "faith",
    name: "Faith & Religion",
    emoji: "🙏",
    description: "Connect with people who share your beliefs",
    communities: FAITH_COMMUNITIES,
  },
  {
    id: "professional",
    name: "Professional",
    emoji: "💼",
    description: "Network with people in your industry",
    communities: PROFESSIONAL_COMMUNITIES,
  },
  {
    id: "life",
    name: "Life Stage & Goals",
    emoji: "🎯",
    description: "Join others on similar life journeys",
    communities: LIFE_COMMUNITIES,
  },
  {
    id: "cultural",
    name: "Cultural & Affinity",
    emoji: "🤝",
    description: "Find your tribe and community",
    communities: CULTURAL_COMMUNITIES,
  },
];

// P0 (language-switcher review) fix-up — the typedef accidentally
// retained the legacy LANGUAGES identifier. Now sourced from the
// trimmed SUPPORTED_LANGUAGES export so it can't pick up unsupported
// codes.
type Language = (typeof SUPPORTED_LANGUAGES)[0];
type OriginCountry = {
  code: string;
  name: string;
  emoji: string;
  regionId: string;
  regionName: string;
};

// P2 (language-switcher review): language is no longer stored in the
// preferences blob. AsyncStorage('app-language') + i18n.language are
// the source of truth; the picker reads from useTranslation() (which
// gives i18n.language).
type UserPreferences = {
  originCountries: OriginCountry[]; // Multiple origin countries
  communities: Community[]; // Multiple communities from all categories
};

type PreferencesContextType = {
  preferences: UserPreferences;
  isLoading: boolean;
  setLanguage: (language: Language) => Promise<void>;
  // P1 (language-switcher review): "Follow device language" mode.
  // When true, AsyncStorage holds the "system" sentinel and the
  // effective language tracks Localization.getLocales()[0] on every
  // resume; when false, the user's explicit choice persists.
  isSystemLanguage: boolean;
  setFollowDeviceLanguage: (follow: boolean) => Promise<void>;
  addOriginCountry: (country: OriginCountry) => Promise<void>;
  removeOriginCountry: (countryCode: string) => Promise<void>;
  toggleCommunity: (community: Community) => Promise<void>;
  clearAllCommunities: () => Promise<void>;
  isCommunitySelected: (communityId: string) => boolean;
  isOriginSelected: (countryCode: string) => boolean;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  originCountries: [],
  communities: [],
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
};

const STORAGE_KEY = "@tandaxn_preferences";

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  // P2 — `useAuth` powers the profiles.language sync. Auth boots
  // before PreferencesProvider in the App.tsx provider tree, so
  // `user` is always defined by the time these effects fire.
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  // P1 — system-language tracking. Lives outside `preferences` because
  // it doesn't fit the blob-shape contract and shouldn't trigger a
  // savePreferences write.
  const [isSystemLanguage, setIsSystemLanguage] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from storage on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      // P0 (language-switcher review): the i18n module's
      // `app-language` key is the source-of-truth for the chosen
      // language code. The preferences blob can carry a stale value
      // (e.g., from before this refactor) — resolve from app-language
      // first, fall back to the blob, then to the default.
      const [stored, appLang] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY),
      ]);
      let parsed: {
        language?: Language;
        originCountries?: OriginCountry[];
        communities?: Community[];
      } | null = null;
      if (stored) {
        try {
          parsed = JSON.parse(stored);
        } catch {
          // malformed blob — fall through to defaults
        }
      }
      // P1: "system" sentinel resolves to whichever language the
      // device currently advertises.
      const followDevice = appLang === SYSTEM_LANGUAGE_SENTINEL;
      setIsSystemLanguage(followDevice);
      // P2 — `language` no longer lives on the preferences blob;
      // useTranslation()'s i18n.language is the active code now.
      // Any `parsed.language` field on a legacy blob is ignored.
      setPreferences({
        originCountries: parsed?.originCountries ?? [],
        communities: parsed?.communities ?? [],
      });
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async (newPrefs: UserPreferences) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
      setPreferences(newPrefs);
    } catch (error) {
      console.error("Error saving preferences:", error);
      throw error;
    }
  };

  // P2 — best-effort write-through to profiles.language. Idempotent
  // server-side; we don't await it from the caller path (UI shouldn't
  // wait on a network round-trip to flip text). Skipped when the
  // user isn't authenticated yet.
  const syncToProfile = async (code: string) => {
    if (!user?.id) return;
    try {
      await supabase
        .from("profiles")
        .update({ language: code })
        .eq("id", user.id);
    } catch (e) {
      console.warn(
        "[PreferencesContext] profiles.language sync failed:",
        (e as Error).message,
      );
    }
  };

  const setLanguage = async (language: Language) => {
    // P0 (language-switcher review): single-writer pattern. The
    // language no longer round-trips through the preferences blob —
    // setAppLanguage owns the persisted code (under
    // APP_LANGUAGE_STORAGE_KEY) and triggers i18next.changeLanguage so
    // every useTranslation() consumer re-renders.
    //
    // P1 — manually picking a language always clears system mode.
    // P2 — also mirror into profiles.language so the choice follows
    // the user to other devices.
    try {
      await setAppLanguage(language.code);
    } catch (e) {
      console.error("[PreferencesContext] setAppLanguage failed:", e);
      return;
    }
    setIsSystemLanguage(false);
    void syncToProfile(language.code);
  };

  // P1 — toggle "follow device language". When `follow` is true we
  // persist the sentinel and immediately resolve the effective code
  // from the device; when false we lock in whichever language is
  // currently effective.
  // P2 — the effective code is also mirrored into profiles.language
  // so the cross-device source-of-truth tracks the user's intent.
  const setFollowDeviceLanguage = async (follow: boolean) => {
    if (follow) {
      try {
        const effective = await setAppLanguage(SYSTEM_LANGUAGE_SENTINEL);
        setIsSystemLanguage(true);
        void syncToProfile(effective);
      } catch (e) {
        console.error("[PreferencesContext] setFollowDeviceLanguage(on) failed:", e);
      }
      return;
    }
    // follow=false — anchor whatever is currently effective. The
    // effective code is whatever i18next is on right now.
    try {
      const current = resolveDeviceLanguage();
      // Caller may already be on a non-device language at this point;
      // resolveDeviceLanguage() is the right fallback only when no
      // manual choice precedes this. Pull the live i18next language
      // if present.
      // NOTE: importing i18n here would be circular; the deferred
      // import in the i18n module already resolves the actual current
      // language. For now we lean on resolveDeviceLanguage as a safe
      // anchor; the next manual setLanguage from the UI overrides.
      await setAppLanguage(current);
      setIsSystemLanguage(false);
      void syncToProfile(current);
    } catch (e) {
      console.error("[PreferencesContext] setFollowDeviceLanguage(off) failed:", e);
    }
  };

  // P1 — AppState listener. When the user backgrounds the app, flips
  // their OS language, and returns, we re-resolve from the device
  // ONLY if they opted into system mode. Otherwise this is a no-op.
  useEffect(() => {
    const handler = async (state: AppStateStatus) => {
      if (state !== "active" || !isSystemLanguage) return;
      try {
        const effective = await setAppLanguage(SYSTEM_LANGUAGE_SENTINEL);
        void syncToProfile(effective);
      } catch {
        // non-fatal
      }
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSystemLanguage, user?.id]);

  // P2 — one-shot adopt: when the user logs in, if AsyncStorage holds
  // no app-language preference (e.g., fresh install on a new device),
  // pull from profiles.language as a cross-device fallback. Otherwise
  // mirror the local choice up so the server snapshot tracks.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
        const { data: prof } = await supabase
          .from("profiles")
          .select("language")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const profileCode = (prof?.language as string | undefined) ?? null;
        if (!stored && profileCode) {
          // Adopt the server's language locally.
          await setAppLanguage(profileCode);
        } else if (stored && stored !== SYSTEM_LANGUAGE_SENTINEL && stored !== profileCode) {
          // Mirror local → server.
          await syncToProfile(stored);
        }
      } catch (e) {
        console.warn(
          "[PreferencesContext] profile/local language reconcile skipped:",
          (e as Error).message,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const addOriginCountry = async (country: OriginCountry) => {
    if (preferences.originCountries.some((c) => c.code === country.code)) {
      return; // Already added
    }
    const newPrefs = {
      ...preferences,
      originCountries: [...preferences.originCountries, country],
    };
    await savePreferences(newPrefs);
  };

  const removeOriginCountry = async (countryCode: string) => {
    const newPrefs = {
      ...preferences,
      originCountries: preferences.originCountries.filter((c) => c.code !== countryCode),
    };
    await savePreferences(newPrefs);
  };

  const toggleCommunity = async (community: Community) => {
    const isSelected = preferences.communities.some((c) => c.id === community.id);
    let newCommunities: Community[];

    if (isSelected) {
      newCommunities = preferences.communities.filter((c) => c.id !== community.id);
    } else {
      newCommunities = [...preferences.communities, community];
    }

    const newPrefs = { ...preferences, communities: newCommunities };
    await savePreferences(newPrefs);
  };

  const clearAllCommunities = async () => {
    const newPrefs = {
      ...preferences,
      originCountries: [],
      communities: [],
    };
    await savePreferences(newPrefs);
  };

  const isCommunitySelected = (communityId: string) => {
    return preferences.communities.some((c) => c.id === communityId);
  };

  const isOriginSelected = (countryCode: string) => {
    return preferences.originCountries.some((c) => c.code === countryCode);
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        isLoading,
        setLanguage,
        isSystemLanguage,
        setFollowDeviceLanguage,
        addOriginCountry,
        removeOriginCountry,
        toggleCommunity,
        clearAllCommunities,
        isCommunitySelected,
        isOriginSelected,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};
