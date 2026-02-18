import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Transaction = {
  id: string;
  type: "received" | "sent" | "converted" | "added" | "withdrawn" | "contribution" | "payout" | "remittance";
  description: string;
  amount: number;
  currency: string;
  date: string;
  flag?: string;
  recipientName?: string;
  method?: string;
  // Cross-border specific fields
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  convertedAmount?: number;
  convertedCurrency?: string;
  circleId?: string;
  circleName?: string;
};

export type WalletCurrency = {
  code: string;
  name: string;
  flag: string;
  symbol: string;
  balance: number;
  usdValue?: number;
  rate?: number;
  change?: number;
  isActive: boolean;
};

type WalletContextType = {
  balance: number;
  currencies: WalletCurrency[];
  transactions: Transaction[];
  isLoading: boolean;
  // Funds management
  addFunds: (amount: number, method: string, currency?: string) => Promise<string>;
  withdraw: (amount: number, method: string, currency?: string) => Promise<string>;
  sendMoney: (amount: number, recipientName: string, method: string, currency?: string) => Promise<string>;
  // Multi-currency operations
  addCurrencyWallet: (currencyCode: string) => Promise<void>;
  removeCurrencyWallet: (currencyCode: string) => Promise<void>;
  convertBetweenWallets: (amount: number, fromCurrency: string, toCurrency: string, rate: number) => Promise<string>;
  getCurrencyBalance: (currencyCode: string) => number;
  // Circle contributions
  makeContribution: (
    amount: number,
    currency: string,
    circleId: string,
    circleName: string,
    targetCurrency?: string,
    exchangeRate?: number
  ) => Promise<string>;
  receivePayout: (
    amount: number,
    currency: string,
    circleId: string,
    circleName: string
  ) => Promise<string>;
  // Remittance
  sendRemittance: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    recipientName: string,
    recipientCountry: string,
    exchangeRate: number,
    fee: number
  ) => Promise<string>;
  refreshWallet: () => Promise<void>;
};

const DEFAULT_CURRENCIES: WalletCurrency[] = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$", balance: 2450.0, change: 0, isActive: true },
  { code: "EUR", name: "Euro", flag: "🇪🇺", symbol: "€", balance: 850.0, usdValue: 923.5, rate: 1.0865, change: 0.23, isActive: true },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", symbol: "£", balance: 320.0, usdValue: 405.76, rate: 1.268, change: -0.15, isActive: true },
  { code: "XOF", name: "CFA Franc", flag: "🇸🇳", symbol: "CFA", balance: 485000, usdValue: 785.0, rate: 0.00162, change: 0.45, isActive: true },
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: "1", type: "received", description: "From Amadou Diallo", flag: "🇫🇷", amount: 500, currency: "EUR", date: "Dec 20" },
  { id: "2", type: "converted", description: "USD → XOF", amount: 122000, currency: "XOF", date: "Dec 19" },
  { id: "3", type: "sent", description: "To Mama Diallo", flag: "🇸🇳", amount: -150000, currency: "XOF", date: "Dec 18" },
];

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};

const STORAGE_KEY = "@tandaxn_wallet";

// Currency info for adding new wallets
const CURRENCY_INFO: Record<string, { name: string; flag: string; symbol: string }> = {
  USD: { name: "US Dollar", flag: "🇺🇸", symbol: "$" },
  EUR: { name: "Euro", flag: "🇪🇺", symbol: "€" },
  GBP: { name: "British Pound", flag: "🇬🇧", symbol: "£" },
  CAD: { name: "Canadian Dollar", flag: "🇨🇦", symbol: "C$" },
  XOF: { name: "West African CFA", flag: "🇸🇳", symbol: "CFA" },
  XAF: { name: "Central African CFA", flag: "🇨🇲", symbol: "FCFA" },
  NGN: { name: "Nigerian Naira", flag: "🇳🇬", symbol: "₦" },
  GHS: { name: "Ghanaian Cedi", flag: "🇬🇭", symbol: "GH₵" },
  KES: { name: "Kenyan Shilling", flag: "🇰🇪", symbol: "KSh" },
  TZS: { name: "Tanzanian Shilling", flag: "🇹🇿", symbol: "TSh" },
  UGX: { name: "Ugandan Shilling", flag: "🇺🇬", symbol: "USh" },
  ZAR: { name: "South African Rand", flag: "🇿🇦", symbol: "R" },
  JMD: { name: "Jamaican Dollar", flag: "🇯🇲", symbol: "J$" },
  TTD: { name: "Trinidad Dollar", flag: "🇹🇹", symbol: "TT$" },
  HTG: { name: "Haitian Gourde", flag: "🇭🇹", symbol: "G" },
  MXN: { name: "Mexican Peso", flag: "🇲🇽", symbol: "MX$" },
  CHF: { name: "Swiss Franc", flag: "🇨🇭", symbol: "CHF" },
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [currencies, setCurrencies] = useState<WalletCurrency[]>(DEFAULT_CURRENCIES);
  const [transactions, setTransactions] = useState<Transaction[]>(DEFAULT_TRANSACTIONS);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate total balance in USD
  const balance = currencies.reduce((total, curr) => {
    if (!curr.isActive) return total;
    if (curr.code === "USD") return total + curr.balance;
    return total + (curr.usdValue || 0);
  }, 0);

  // Load wallet data from storage on mount
  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.currencies) setCurrencies(parsed.currencies);
        if (parsed.transactions) setTransactions(parsed.transactions);
      }
    } catch (error) {
      console.error("Error loading wallet data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWalletData = async (newCurrencies: WalletCurrency[], newTransactions: Transaction[]) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currencies: newCurrencies, transactions: newTransactions })
      );
      setCurrencies(newCurrencies);
      setTransactions(newTransactions);
    } catch (error) {
      console.error("Error saving wallet data:", error);
      throw error;
    }
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const generateTransactionId = () => `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addFunds = async (amount: number, method: string, currency: string = "USD"): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    const newTransaction: Transaction = {
      id: transactionId,
      type: "added",
      description: `Added via ${method}`,
      amount: amount,
      currency: currency,
      date: formatDate(),
      method,
      flag: currencyInfo.flag,
    };

    // Update currency balance
    let newCurrencies = [...currencies];
    const currencyIndex = newCurrencies.findIndex(c => c.code === currency);

    if (currencyIndex >= 0) {
      newCurrencies[currencyIndex] = {
        ...newCurrencies[currencyIndex],
        balance: newCurrencies[currencyIndex].balance + amount,
      };
    } else {
      // Add new currency wallet if doesn't exist
      const info = CURRENCY_INFO[currency];
      if (info) {
        newCurrencies.push({
          code: currency,
          name: info.name,
          flag: info.flag,
          symbol: info.symbol,
          balance: amount,
          isActive: true,
        });
      }
    }

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const withdraw = async (amount: number, method: string, currency: string = "USD"): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    const newTransaction: Transaction = {
      id: transactionId,
      type: "withdrawn",
      description: `Withdrawn to ${method}`,
      amount: -amount,
      currency: currency,
      date: formatDate(),
      method,
      flag: currencyInfo.flag,
    };

    // Update currency balance
    const newCurrencies = currencies.map((c) =>
      c.code === currency ? { ...c, balance: c.balance - amount } : c
    );

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const sendMoney = async (amount: number, recipientName: string, method: string, currency: string = "USD"): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    const newTransaction: Transaction = {
      id: transactionId,
      type: "sent",
      description: `To ${recipientName}`,
      amount: -amount,
      currency: currency,
      date: formatDate(),
      recipientName,
      method,
      flag: currencyInfo.flag,
    };

    // Update currency balance
    const newCurrencies = currencies.map((c) =>
      c.code === currency ? { ...c, balance: c.balance - amount } : c
    );

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const addCurrencyWallet = async (currencyCode: string): Promise<void> => {
    // Check if already exists
    if (currencies.some(c => c.code === currencyCode)) {
      // Just activate it if it exists
      const newCurrencies = currencies.map(c =>
        c.code === currencyCode ? { ...c, isActive: true } : c
      );
      await saveWalletData(newCurrencies, transactions);
      return;
    }

    const info = CURRENCY_INFO[currencyCode];
    if (!info) {
      throw new Error(`Currency ${currencyCode} not supported`);
    }

    const newWallet: WalletCurrency = {
      code: currencyCode,
      name: info.name,
      flag: info.flag,
      symbol: info.symbol,
      balance: 0,
      isActive: true,
    };

    const newCurrencies = [...currencies, newWallet];
    await saveWalletData(newCurrencies, transactions);
  };

  const removeCurrencyWallet = async (currencyCode: string): Promise<void> => {
    // Don't allow removing USD
    if (currencyCode === "USD") {
      throw new Error("Cannot remove primary USD wallet");
    }

    // Just deactivate, don't delete (to preserve history)
    const newCurrencies = currencies.map(c =>
      c.code === currencyCode ? { ...c, isActive: false } : c
    );
    await saveWalletData(newCurrencies, transactions);
  };

  const convertBetweenWallets = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rate: number
  ): Promise<string> => {
    const transactionId = generateTransactionId();
    const convertedAmount = amount * rate;

    const newTransaction: Transaction = {
      id: transactionId,
      type: "converted",
      description: `${fromCurrency} → ${toCurrency}`,
      amount: convertedAmount,
      currency: toCurrency,
      date: formatDate(),
      originalAmount: amount,
      originalCurrency: fromCurrency,
      exchangeRate: rate,
      convertedAmount: convertedAmount,
      convertedCurrency: toCurrency,
    };

    // Update both currency balances
    const newCurrencies = currencies.map((c) => {
      if (c.code === fromCurrency) {
        return { ...c, balance: c.balance - amount };
      }
      if (c.code === toCurrency) {
        return { ...c, balance: c.balance + convertedAmount };
      }
      return c;
    });

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const getCurrencyBalance = (currencyCode: string): number => {
    const currency = currencies.find(c => c.code === currencyCode);
    return currency?.balance || 0;
  };

  const makeContribution = async (
    amount: number,
    currency: string,
    circleId: string,
    circleName: string,
    targetCurrency?: string,
    exchangeRate?: number
  ): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    // Handle cross-border contribution with conversion
    let convertedAmount = amount;
    let finalCurrency = currency;

    if (targetCurrency && targetCurrency !== currency && exchangeRate) {
      convertedAmount = amount * exchangeRate;
      finalCurrency = targetCurrency;
    }

    const newTransaction: Transaction = {
      id: transactionId,
      type: "contribution",
      description: `Circle: ${circleName}`,
      amount: -amount,
      currency: currency,
      date: formatDate(),
      flag: currencyInfo.flag,
      circleId,
      circleName,
      ...(targetCurrency && targetCurrency !== currency ? {
        originalAmount: amount,
        originalCurrency: currency,
        exchangeRate,
        convertedAmount,
        convertedCurrency: targetCurrency,
      } : {}),
    };

    // Deduct from source currency wallet
    const newCurrencies = currencies.map((c) =>
      c.code === currency ? { ...c, balance: c.balance - amount } : c
    );

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const receivePayout = async (
    amount: number,
    currency: string,
    circleId: string,
    circleName: string
  ): Promise<string> => {
    const transactionId = generateTransactionId();
    const currencyInfo = CURRENCY_INFO[currency] || { flag: "🏳️" };

    const newTransaction: Transaction = {
      id: transactionId,
      type: "payout",
      description: `Payout: ${circleName}`,
      amount: amount,
      currency: currency,
      date: formatDate(),
      flag: currencyInfo.flag,
      circleId,
      circleName,
    };

    // Add to currency wallet
    let newCurrencies = [...currencies];
    const currencyIndex = newCurrencies.findIndex(c => c.code === currency);

    if (currencyIndex >= 0) {
      newCurrencies[currencyIndex] = {
        ...newCurrencies[currencyIndex],
        balance: newCurrencies[currencyIndex].balance + amount,
      };
    } else {
      // Create new wallet for this currency
      const info = CURRENCY_INFO[currency];
      if (info) {
        newCurrencies.push({
          code: currency,
          name: info.name,
          flag: info.flag,
          symbol: info.symbol,
          balance: amount,
          isActive: true,
        });
      }
    }

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const sendRemittance = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    recipientName: string,
    recipientCountry: string,
    exchangeRate: number,
    fee: number
  ): Promise<string> => {
    const transactionId = generateTransactionId();
    const fromInfo = CURRENCY_INFO[fromCurrency] || { flag: "🏳️" };
    const toInfo = CURRENCY_INFO[toCurrency] || { flag: "🏳️" };

    const convertedAmount = amount * exchangeRate;
    const totalDeducted = amount + fee;

    const newTransaction: Transaction = {
      id: transactionId,
      type: "remittance",
      description: `Remittance to ${recipientName}`,
      amount: -totalDeducted,
      currency: fromCurrency,
      date: formatDate(),
      flag: toInfo.flag,
      recipientName,
      originalAmount: amount,
      originalCurrency: fromCurrency,
      exchangeRate,
      convertedAmount,
      convertedCurrency: toCurrency,
    };

    // Deduct from source currency wallet (amount + fee)
    const newCurrencies = currencies.map((c) =>
      c.code === fromCurrency ? { ...c, balance: c.balance - totalDeducted } : c
    );

    const newTransactions = [newTransaction, ...transactions];
    await saveWalletData(newCurrencies, newTransactions);
    return transactionId;
  };

  const refreshWallet = async () => {
    await loadWalletData();
  };

  return (
    <WalletContext.Provider
      value={{
        balance,
        currencies,
        transactions,
        isLoading,
        addFunds,
        withdraw,
        sendMoney,
        addCurrencyWallet,
        removeCurrencyWallet,
        convertBetweenWallets,
        getCurrencyBalance,
        makeContribution,
        receivePayout,
        sendRemittance,
        refreshWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
