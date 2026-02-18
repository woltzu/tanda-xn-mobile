import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Currency definitions by region
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  region: string;
  flag: string;
  decimals: number;
}

export const CURRENCIES: Record<string, Currency> = {
  // West Africa - CFA Franc Zone (BCEAO)
  XOF: { code: "XOF", name: "West African CFA Franc", symbol: "CFA", region: "West Africa", flag: "🇸🇳", decimals: 0 },
  // West Africa - CFA Franc Zone (BEAC)
  XAF: { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA", region: "Central Africa", flag: "🇨🇲", decimals: 0 },
  // West Africa - Others
  NGN: { code: "NGN", name: "Nigerian Naira", symbol: "₦", region: "West Africa", flag: "🇳🇬", decimals: 2 },
  GHS: { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", region: "West Africa", flag: "🇬🇭", decimals: 2 },
  GMD: { code: "GMD", name: "Gambian Dalasi", symbol: "D", region: "West Africa", flag: "🇬🇲", decimals: 2 },
  SLL: { code: "SLL", name: "Sierra Leonean Leone", symbol: "Le", region: "West Africa", flag: "🇸🇱", decimals: 2 },
  LRD: { code: "LRD", name: "Liberian Dollar", symbol: "L$", region: "West Africa", flag: "🇱🇷", decimals: 2 },
  GNF: { code: "GNF", name: "Guinean Franc", symbol: "FG", region: "West Africa", flag: "🇬🇳", decimals: 0 },

  // East Africa
  KES: { code: "KES", name: "Kenyan Shilling", symbol: "KSh", region: "East Africa", flag: "🇰🇪", decimals: 2 },
  TZS: { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", region: "East Africa", flag: "🇹🇿", decimals: 2 },
  UGX: { code: "UGX", name: "Ugandan Shilling", symbol: "USh", region: "East Africa", flag: "🇺🇬", decimals: 0 },
  RWF: { code: "RWF", name: "Rwandan Franc", symbol: "FRw", region: "East Africa", flag: "🇷🇼", decimals: 0 },
  BIF: { code: "BIF", name: "Burundian Franc", symbol: "FBu", region: "East Africa", flag: "🇧🇮", decimals: 0 },
  ETB: { code: "ETB", name: "Ethiopian Birr", symbol: "Br", region: "East Africa", flag: "🇪🇹", decimals: 2 },

  // Southern Africa
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", region: "Southern Africa", flag: "🇿🇦", decimals: 2 },
  ZMW: { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", region: "Southern Africa", flag: "🇿🇲", decimals: 2 },
  MWK: { code: "MWK", name: "Malawian Kwacha", symbol: "MK", region: "Southern Africa", flag: "🇲🇼", decimals: 2 },
  BWP: { code: "BWP", name: "Botswana Pula", symbol: "P", region: "Southern Africa", flag: "🇧🇼", decimals: 2 },

  // North America
  USD: { code: "USD", name: "US Dollar", symbol: "$", region: "North America", flag: "🇺🇸", decimals: 2 },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "C$", region: "North America", flag: "🇨🇦", decimals: 2 },
  MXN: { code: "MXN", name: "Mexican Peso", symbol: "MX$", region: "North America", flag: "🇲🇽", decimals: 2 },

  // Europe
  EUR: { code: "EUR", name: "Euro", symbol: "€", region: "Europe", flag: "🇪🇺", decimals: 2 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", region: "Europe", flag: "🇬🇧", decimals: 2 },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "CHF", region: "Europe", flag: "🇨🇭", decimals: 2 },

  // Caribbean
  JMD: { code: "JMD", name: "Jamaican Dollar", symbol: "J$", region: "Caribbean", flag: "🇯🇲", decimals: 2 },
  TTD: { code: "TTD", name: "Trinidad Dollar", symbol: "TT$", region: "Caribbean", flag: "🇹🇹", decimals: 2 },
  BBD: { code: "BBD", name: "Barbados Dollar", symbol: "Bds$", region: "Caribbean", flag: "🇧🇧", decimals: 2 },
  HTG: { code: "HTG", name: "Haitian Gourde", symbol: "G", region: "Caribbean", flag: "🇭🇹", decimals: 2 },
  DOP: { code: "DOP", name: "Dominican Peso", symbol: "RD$", region: "Caribbean", flag: "🇩🇴", decimals: 2 },
  XCD: { code: "XCD", name: "East Caribbean Dollar", symbol: "EC$", region: "Caribbean", flag: "🇦🇬", decimals: 2 },
};

// Mock exchange rates (base: USD)
// In production, these would come from a real-time API
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  // West Africa
  XOF: 605.50,
  XAF: 605.50,
  NGN: 1550.00,
  GHS: 14.85,
  GMD: 67.50,
  SLL: 22500.00,
  LRD: 192.00,
  GNF: 8600.00,
  // East Africa
  KES: 153.50,
  TZS: 2520.00,
  UGX: 3750.00,
  RWF: 1280.00,
  BIF: 2850.00,
  ETB: 56.50,
  // Southern Africa
  ZAR: 18.25,
  ZMW: 26.80,
  MWK: 1720.00,
  BWP: 13.60,
  // North America
  CAD: 1.36,
  MXN: 17.15,
  // Europe
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.88,
  // Caribbean
  JMD: 156.50,
  TTD: 6.78,
  BBD: 2.00,
  HTG: 132.50,
  DOP: 58.75,
  XCD: 2.70,
};

// Group currencies by region for UI display
export const CURRENCY_REGIONS = {
  "North America": ["USD", "CAD", "MXN"],
  "Europe": ["EUR", "GBP", "CHF"],
  "West Africa": ["XOF", "NGN", "GHS", "GMD", "SLL", "LRD", "GNF"],
  "Central Africa": ["XAF"],
  "East Africa": ["KES", "TZS", "UGX", "RWF", "BIF", "ETB"],
  "Southern Africa": ["ZAR", "ZMW", "MWK", "BWP"],
  "Caribbean": ["JMD", "TTD", "BBD", "HTG", "DOP", "XCD"],
};

interface ExchangeRateInfo {
  from: string;
  to: string;
  rate: number;
  inverseRate: number;
  timestamp: Date;
}

interface CurrencyContextType {
  // User preferences
  primaryCurrency: string;
  setPrimaryCurrency: (code: string) => void;
  secondaryCurrencies: string[];
  addSecondaryCurrency: (code: string) => void;
  removeSecondaryCurrency: (code: string) => void;

  // Exchange rates
  rates: Record<string, number>;
  lastUpdated: Date | null;
  refreshRates: () => Promise<void>;
  isLoadingRates: boolean;

  // Auto-refresh
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  autoRefreshInterval: number; // in seconds

  // Conversion functions
  convert: (amount: number, from: string, to: string) => number;
  getExchangeRate: (from: string, to: string) => ExchangeRateInfo;
  formatCurrency: (amount: number, currencyCode: string) => string;
  formatWithSymbol: (amount: number, currencyCode: string) => string;

  // Currency info
  getCurrency: (code: string) => Currency | undefined;
  getAllCurrencies: () => Currency[];
  getCurrenciesByRegion: (region: string) => Currency[];

  // Recent/favorite currencies
  recentCurrencies: string[];
  addToRecent: (code: string) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PRIMARY_CURRENCY: "tandaxn_primary_currency",
  SECONDARY_CURRENCIES: "tandaxn_secondary_currencies",
  RECENT_CURRENCIES: "tandaxn_recent_currencies",
  CACHED_RATES: "tandaxn_cached_rates",
  RATES_TIMESTAMP: "tandaxn_rates_timestamp",
};

// Auto-refresh interval in seconds (default: 60 seconds)
const AUTO_REFRESH_INTERVAL = 60;

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [primaryCurrency, setPrimaryCurrencyState] = useState<string>("USD");
  const [secondaryCurrencies, setSecondaryCurrencies] = useState<string[]>([]);
  const [rates, setRates] = useState<Record<string, number>>(EXCHANGE_RATES);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([]);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    loadSavedPreferences();
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (autoRefreshEnabled) {
      // Refresh immediately when enabled
      refreshRates();

      // Then refresh at the interval
      intervalId = setInterval(() => {
        refreshRates();
      }, AUTO_REFRESH_INTERVAL * 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefreshEnabled]);

  const loadSavedPreferences = async () => {
    try {
      const [primary, secondary, recent] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PRIMARY_CURRENCY),
        AsyncStorage.getItem(STORAGE_KEYS.SECONDARY_CURRENCIES),
        AsyncStorage.getItem(STORAGE_KEYS.RECENT_CURRENCIES),
      ]);

      if (primary) setPrimaryCurrencyState(primary);
      if (secondary) setSecondaryCurrencies(JSON.parse(secondary));
      if (recent) setRecentCurrencies(JSON.parse(recent));
    } catch (error) {
      console.error("Error loading currency preferences:", error);
    }
  };

  const setPrimaryCurrency = async (code: string) => {
    setPrimaryCurrencyState(code);
    addToRecent(code);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PRIMARY_CURRENCY, code);
    } catch (error) {
      console.error("Error saving primary currency:", error);
    }
  };

  const addSecondaryCurrency = async (code: string) => {
    if (secondaryCurrencies.includes(code) || code === primaryCurrency) return;

    const updated = [...secondaryCurrencies, code];
    setSecondaryCurrencies(updated);
    addToRecent(code);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SECONDARY_CURRENCIES, JSON.stringify(updated));
    } catch (error) {
      console.error("Error saving secondary currencies:", error);
    }
  };

  const removeSecondaryCurrency = async (code: string) => {
    const updated = secondaryCurrencies.filter(c => c !== code);
    setSecondaryCurrencies(updated);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SECONDARY_CURRENCIES, JSON.stringify(updated));
    } catch (error) {
      console.error("Error saving secondary currencies:", error);
    }
  };

  const addToRecent = async (code: string) => {
    const updated = [code, ...recentCurrencies.filter(c => c !== code)].slice(0, 5);
    setRecentCurrencies(updated);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_CURRENCIES, JSON.stringify(updated));
    } catch (error) {
      console.error("Error saving recent currencies:", error);
    }
  };

  const refreshRates = async () => {
    setIsLoadingRates(true);
    try {
      // In production, this would fetch from a real API like:
      // const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      // const data = await response.json();
      // setRates(data.rates);

      // For now, simulate a refresh with mock data + small variance
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedRates = { ...EXCHANGE_RATES };
      // Add small random variance to simulate real-time changes
      Object.keys(updatedRates).forEach(key => {
        if (key !== "USD") {
          const variance = 1 + (Math.random() - 0.5) * 0.02; // ±1% variance
          updatedRates[key] = Number((updatedRates[key] * variance).toFixed(4));
        }
      });

      setRates(updatedRates);
      setLastUpdated(new Date());

      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_RATES, JSON.stringify(updatedRates));
      await AsyncStorage.setItem(STORAGE_KEYS.RATES_TIMESTAMP, new Date().toISOString());
    } catch (error) {
      console.error("Error refreshing rates:", error);
    } finally {
      setIsLoadingRates(false);
    }
  };

  const convert = (amount: number, from: string, to: string): number => {
    if (from === to) return amount;

    const fromRate = rates[from] || 1;
    const toRate = rates[to] || 1;

    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate;
    const convertedAmount = usdAmount * toRate;

    // Round based on currency decimals
    const currency = CURRENCIES[to];
    const decimals = currency?.decimals ?? 2;

    return Number(convertedAmount.toFixed(decimals));
  };

  const getExchangeRate = (from: string, to: string): ExchangeRateInfo => {
    const fromRate = rates[from] || 1;
    const toRate = rates[to] || 1;

    const rate = toRate / fromRate;
    const inverseRate = fromRate / toRate;

    return {
      from,
      to,
      rate: Number(rate.toFixed(6)),
      inverseRate: Number(inverseRate.toFixed(6)),
      timestamp: lastUpdated || new Date(),
    };
  };

  const formatCurrency = (amount: number, currencyCode: string): string => {
    const currency = CURRENCIES[currencyCode];
    const decimals = currency?.decimals ?? 2;

    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  };

  const formatWithSymbol = (amount: number, currencyCode: string): string => {
    const currency = CURRENCIES[currencyCode];
    if (!currency) return `${amount}`;

    const formatted = formatCurrency(amount, currencyCode);
    return `${currency.symbol}${formatted}`;
  };

  const getCurrency = (code: string): Currency | undefined => {
    return CURRENCIES[code];
  };

  const getAllCurrencies = (): Currency[] => {
    return Object.values(CURRENCIES);
  };

  const getCurrenciesByRegion = (region: string): Currency[] => {
    return Object.values(CURRENCIES).filter(c => c.region === region);
  };

  return (
    <CurrencyContext.Provider
      value={{
        primaryCurrency,
        setPrimaryCurrency,
        secondaryCurrencies,
        addSecondaryCurrency,
        removeSecondaryCurrency,
        rates,
        lastUpdated,
        refreshRates,
        isLoadingRates,
        convert,
        getExchangeRate,
        formatCurrency,
        formatWithSymbol,
        getCurrency,
        getAllCurrencies,
        getCurrenciesByRegion,
        recentCurrencies,
        addToRecent,
        autoRefreshEnabled,
        setAutoRefreshEnabled,
        autoRefreshInterval: AUTO_REFRESH_INTERVAL,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
