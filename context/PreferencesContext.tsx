import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Available languages
export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "tl", name: "Tagalog", nativeName: "Tagalog", flag: "🇵🇭" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "am", name: "Amharic", nativeName: "አማርኛ", flag: "🇪🇹" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá", flag: "🇳🇬" },
  { code: "ha", name: "Hausa", nativeName: "Hausa", flag: "🇳🇬" },
  { code: "ht", name: "Haitian Creole", nativeName: "Kreyòl Ayisyen", flag: "🇭🇹" },
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

type Language = (typeof LANGUAGES)[0];
type OriginCountry = {
  code: string;
  name: string;
  emoji: string;
  regionId: string;
  regionName: string;
};

type UserPreferences = {
  language: Language;
  originCountries: OriginCountry[]; // Multiple origin countries
  communities: Community[]; // Multiple communities from all categories
};

type PreferencesContextType = {
  preferences: UserPreferences;
  isLoading: boolean;
  setLanguage: (language: Language) => Promise<void>;
  addOriginCountry: (country: OriginCountry) => Promise<void>;
  removeOriginCountry: (countryCode: string) => Promise<void>;
  toggleCommunity: (community: Community) => Promise<void>;
  clearAllCommunities: () => Promise<void>;
  isCommunitySelected: (communityId: string) => boolean;
  isOriginSelected: (countryCode: string) => boolean;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  language: LANGUAGES[0], // English
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
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from storage on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({
          language: parsed.language || DEFAULT_PREFERENCES.language,
          originCountries: parsed.originCountries || [],
          communities: parsed.communities || [],
        });
      }
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

  const setLanguage = async (language: Language) => {
    const newPrefs = { ...preferences, language };
    await savePreferences(newPrefs);
  };

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
