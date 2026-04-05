import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  tokenService,
  TokenBalance,
  TokenTransaction,
  TokenRate,
  TokenAwardRule,
  RedeemOptions,
  TOKEN_CATEGORY_META,
} from "@/services/TokenService";

// ============ CONTEXT TYPE ============

type TokenContextType = {
  // State
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  transactions: TokenTransaction[];
  currentRate: TokenRate | null;
  awardRules: TokenAwardRule[];
  isLoading: boolean;
  error: string | null;

  // Computed
  balanceUsd: number;

  // Actions
  refreshBalance: () => Promise<void>;
  loadTransactions: (options?: {
    limit?: number;
    offset?: number;
    type?: string;
    category?: string;
  }) => Promise<void>;
  redeemTokens: (options: RedeemOptions) => Promise<{
    success: boolean;
    message: string;
    transactionId?: string;
  }>;
  calculateTokenDiscount: (
    feeAmount: number,
    tokensToUse: number
  ) => { discountAmount: number; remainingFee: number; tokensConsumed: number };

  // Helpers
  formatTokenAmount: (n: number) => string;
  getCategoryLabel: (cat: string) => string;
  getCategoryIcon: (cat: string) => string;
};

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export const useTokens = () => {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error("useTokens must be used within TokenProvider");
  }
  return context;
};

// ============ PROVIDER ============

export const TokenProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [lifetimeEarned, setLifetimeEarned] = useState<number>(0);
  const [lifetimeSpent, setLifetimeSpent] = useState<number>(0);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [currentRate, setCurrentRate] = useState<TokenRate | null>(null);
  const [awardRules, setAwardRules] = useState<TokenAwardRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ COMPUTED ============

  const balanceUsd = currentRate ? balance * currentRate.tokenValueUsd : 0;

  // ============ ACTIONS ============

  const refreshBalance = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const balanceData: TokenBalance = await tokenService.getBalance(user.id);
      setBalance(balanceData.balance);
      setLifetimeEarned(balanceData.lifetimeEarned);
      setLifetimeSpent(balanceData.lifetimeSpent);
    } catch (err: any) {
      console.error("[TokenContext] refreshBalance error:", err);
      setError(err.message || "Failed to refresh balance");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadTransactions = useCallback(
    async (options?: {
      limit?: number;
      offset?: number;
      type?: string;
      category?: string;
    }) => {
      if (!user?.id) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await tokenService.getTransactions(user.id, options);
        setTransactions(result.data);
      } catch (err: any) {
        console.error("[TokenContext] loadTransactions error:", err);
        setError(err.message || "Failed to load transactions");
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id]
  );

  const redeemTokens = useCallback(
    async (
      options: RedeemOptions
    ): Promise<{
      success: boolean;
      message: string;
      transactionId?: string;
    }> => {
      if (!user?.id) {
        return { success: false, message: "Not authenticated" };
      }
      if (options.amount > balance) {
        return { success: false, message: "Insufficient token balance" };
      }
      setIsLoading(true);
      setError(null);
      try {
        const transactionId = await tokenService.redeemTokens(user.id, options);
        // Refresh balance after redemption
        await refreshBalance();
        return {
          success: true,
          message: `Successfully redeemed ${tokenService.formatTokenAmount(options.amount)}`,
          transactionId,
        };
      } catch (err: any) {
        const message = err.message || "Failed to redeem tokens";
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, balance, refreshBalance]
  );

  const calculateTokenDiscount = useCallback(
    (
      feeAmount: number,
      tokensToUse: number
    ): {
      discountAmount: number;
      remainingFee: number;
      tokensConsumed: number;
    } => {
      if (!currentRate || tokensToUse <= 0 || feeAmount <= 0) {
        return {
          discountAmount: 0,
          remainingFee: feeAmount,
          tokensConsumed: 0,
        };
      }

      const maxTokens = Math.min(tokensToUse, balance);
      const maxDiscount = maxTokens * currentRate.tokenValueUsd;
      const discountAmount = Math.min(maxDiscount, feeAmount);
      const tokensConsumed = Math.ceil(
        discountAmount / currentRate.tokenValueUsd
      );
      const remainingFee = feeAmount - discountAmount;

      return { discountAmount, remainingFee, tokensConsumed };
    },
    [balance, currentRate]
  );

  // ============ HELPERS ============

  const formatTokenAmount = useCallback((n: number): string => {
    return tokenService.formatTokenAmount(n);
  }, []);

  const getCategoryLabel = useCallback((cat: string): string => {
    return tokenService.getCategoryLabel(cat);
  }, []);

  const getCategoryIcon = useCallback((cat: string): string => {
    return tokenService.getCategoryIcon(cat);
  }, []);

  // ============ INITIALIZE ON USER CHANGE ============

  useEffect(() => {
    if (!user?.id) {
      // User logged out — reset everything
      setBalance(0);
      setLifetimeEarned(0);
      setLifetimeSpent(0);
      setTransactions([]);
      setCurrentRate(null);
      setAwardRules([]);
      setError(null);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch balance, rate, and rules in parallel
        const [balanceData, rate, rules] = await Promise.all([
          tokenService.getBalance(user.id),
          tokenService.getCurrentRate(),
          tokenService.getAwardRules(),
        ]);

        setBalance(balanceData.balance);
        setLifetimeEarned(balanceData.lifetimeEarned);
        setLifetimeSpent(balanceData.lifetimeSpent);
        setCurrentRate(rate);
        setAwardRules(rules);

        // Subscribe to realtime balance updates
        unsubscribe = tokenService.subscribeToBalance(
          user.id,
          (updatedBalance: TokenBalance) => {
            setBalance(updatedBalance.balance);
            setLifetimeEarned(updatedBalance.lifetimeEarned);
            setLifetimeSpent(updatedBalance.lifetimeSpent);
          }
        );
      } catch (err: any) {
        console.error("[TokenContext] init error:", err);
        setError(err.message || "Failed to initialize token data");
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Cleanup subscription on unmount or user change
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // ============ RENDER ============

  return (
    <TokenContext.Provider
      value={{
        balance,
        lifetimeEarned,
        lifetimeSpent,
        transactions,
        currentRate,
        awardRules,
        isLoading,
        error,
        balanceUsd,
        refreshBalance,
        loadTransactions,
        redeemTokens,
        calculateTokenDiscount,
        formatTokenAmount,
        getCategoryLabel,
        getCategoryIcon,
      }}
    >
      {children}
    </TokenContext.Provider>
  );
};
