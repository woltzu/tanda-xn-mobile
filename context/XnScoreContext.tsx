import { createAutoPost } from "../lib/autoPost";
import { supabase } from "../lib/supabase";
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet, Transaction } from "./WalletContext";

// Score event types for history tracking
export type ScoreEventType =
  | "contribution_made"
  | "contribution_on_time"
  | "contribution_early"
  | "contribution_late"
  | "payout_received"
  | "circle_joined"
  | "circle_completed"
  | "referral_bonus"
  | "streak_bonus"
  | "funds_added"
  | "withdrawal"
  | "send_money"
  | "account_verified"
  | "profile_completed"
  | "initial_score";

export type ScoreEvent = {
  id: string;
  type: ScoreEventType;
  description: string;
  points: number;
  date: string;
  timestamp: number;
  relatedTransactionId?: string;
};

export type ScoreLevel = {
  name: string;
  minScore: number;
  maxScore: number;
  color: string;
  icon: string;
  benefits: string[];
};

export type ScoreTip = {
  id: string;
  title: string;
  description: string;
  potentialPoints: number;
  action: string;
  completed: boolean;
};

type XnScoreContextType = {
  score: number;
  level: ScoreLevel;
  history: ScoreEvent[];
  tips: ScoreTip[];
  contributionStreak: number;
  isLoading: boolean;
  processTransaction: (transaction: Transaction, isContribution?: boolean, isOnTime?: boolean) => Promise<void>;
  processContribution: (circleId: string, isOnTime: boolean, isEarly: boolean) => Promise<void>;
  processCircleEvent: (eventType: "joined" | "completed") => Promise<void>;
  processAccountEvent: (eventType: "verified" | "profile_completed") => Promise<void>;
  getScoreBreakdown: () => { category: string; points: number; percentage: number }[];
  refreshScore: () => Promise<void>;
};

// XnScore™ V3.0 Score Levels (0-100 scale)
// Based on TandaXn Global Credit Scoring System
const SCORE_LEVELS: ScoreLevel[] = [
  {
    name: "Critical",
    minScore: 0,
    maxScore: 24,
    color: "#DC2626",
    icon: "alert-circle",
    benefits: ["Account under review", "Cannot join new circles"],
  },
  {
    name: "Poor",
    minScore: 25,
    maxScore: 44,
    color: "#F59E0B",
    icon: "warning",
    benefits: ["Last 3 payout slots only", "Building credit"],
  },
  {
    name: "Fair",
    minScore: 45,
    maxScore: 59,
    color: "#EAB308",
    icon: "star-half-outline",
    benefits: ["Slots 7+ access", "1% late bonus", "Up to $500 loans at 12% APR"],
  },
  {
    name: "Good",
    minScore: 60,
    maxScore: 74,
    color: "#22C55E",
    icon: "star",
    benefits: ["Slots 4+ access", "2% late bonus", "2% early fee", "Up to $1,500 loans at 10% APR"],
  },
  {
    name: "Excellent",
    minScore: 75,
    maxScore: 89,
    color: "#3B82F6",
    icon: "star",
    benefits: ["Any payout slot", "2.5% late bonus", "1% early fee", "Up to $3,000 loans at 8% APR"],
  },
  {
    name: "Elite",
    minScore: 90,
    maxScore: 100,
    color: "#8B5CF6",
    icon: "diamond",
    benefits: ["VIP status", "3% late bonus", "0.5% early fee", "Up to $5,000 loans at 6% APR", "Personal account manager"],
  },
];

// XnScore™ V3.0 Point Values (0-100 scale)
// Note: These are simplified for mobile app demo - real algorithm uses 6 weighted factors
const POINT_VALUES = {
  // Payment History Factor contributions (max 35 pts in real algorithm)
  contribution_made: 1.5,      // Base points for making payment
  contribution_on_time: 0.8,   // On-time bonus
  contribution_early: 1.2,     // Early payment bonus
  contribution_late: -2.0,     // Late payment penalty

  // Circle Activity (max 25 pts in real algorithm)
  payout_received: 0.5,
  circle_joined: 1.5,          // Joining a circle
  circle_completed: 5.0,       // First circle completion bonus (+5)

  // Bonuses
  referral_bonus: 2.5,
  streak_bonus: 2.0,           // Every 5 consecutive on-time contributions

  // Wallet Activity (minimal impact)
  funds_added: 0.3,
  withdrawal: -0.2,
  send_money: 0.2,

  // Account & Engagement (max 3 pts in real algorithm)
  account_verified: 1.0,       // KYC verified
  profile_completed: 1.0,      // Profile complete

  // Starting score for new users — builds up as they engage
  initial_score: 25,           // New users start at 25, grow through activity
};

// XnScore™ V3.0 Tips based on 6-factor algorithm
const DEFAULT_TIPS: ScoreTip[] = [
  {
    id: "tip_1",
    title: "Payment History (35%)",
    description: "Make all payments on-time. This is the largest factor in your XnScore™.",
    potentialPoints: 35,
    action: "Make a contribution",
    completed: false,
  },
  {
    id: "tip_2",
    title: "Complete Circles (25%)",
    description: "Stay in circles until they complete. Early exits hurt your score significantly.",
    potentialPoints: 25,
    action: "Stay committed",
    completed: false,
  },
  {
    id: "tip_3",
    title: "Build Account Age (20%)",
    description: "Time matters! Perfect score requires 24+ months of consistent activity.",
    potentialPoints: 20,
    action: "Stay active",
    completed: false,
  },
  {
    id: "tip_4",
    title: "Add Security Deposit (10%)",
    description: "Lock a deposit of 2-3x your monthly contribution for 90+ days.",
    potentialPoints: 10,
    action: "Add deposit",
    completed: false,
  },
  {
    id: "tip_5",
    title: "Diversify Circles (7%)",
    description: "Join 5+ different circles (90+ days old, 3+ payments each).",
    potentialPoints: 7,
    action: "Join circles",
    completed: false,
  },
  {
    id: "tip_6",
    title: "Complete Profile (3%)",
    description: "Add profile photo, verify KYC, and stay active for 12+ months.",
    potentialPoints: 3,
    action: "Complete profile",
    completed: false,
  },
];

const XnScoreContext = createContext<XnScoreContextType | undefined>(undefined);

export const useXnScore = () => {
  const context = useContext(XnScoreContext);
  if (!context) {
    throw new Error("useXnScore must be used within XnScoreProvider");
  }
  return context;
};

const STORAGE_KEY = "@tandaxn_xnscore";

export const XnScoreProvider = ({ children }: { children: ReactNode }) => {
  const { transactions } = useWallet();
  const [score, setScore] = useState<number>(POINT_VALUES.initial_score);
  const [history, setHistory] = useState<ScoreEvent[]>([]);
  const [tips, setTips] = useState<ScoreTip[]>(DEFAULT_TIPS);
  const [contributionStreak, setContributionStreak] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [processedTransactionIds, setProcessedTransactionIds] = useState<Set<string>>(new Set());

  // Calculate current level based on score
  const level = SCORE_LEVELS.find(
    (l) => score >= l.minScore && score <= l.maxScore
  ) || SCORE_LEVELS[0];

  // Load score data on mount
  useEffect(() => {
    loadScoreData();
  }, []);

  // Watch for new wallet transactions and process them
  useEffect(() => {
    if (!isLoading && transactions.length > 0) {
      processNewTransactions();
    }
  }, [transactions, isLoading]);

  const processNewTransactions = useCallback(async () => {
    for (const transaction of transactions) {
      if (!processedTransactionIds.has(transaction.id)) {
        await processTransaction(transaction);
      }
    }
  }, [transactions, processedTransactionIds]);

  const loadScoreData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.score !== undefined) setScore(Math.round(parsed.score * 10) / 10);
        if (parsed.history) setHistory(parsed.history);
        if (parsed.tips) setTips(parsed.tips);
        if (parsed.contributionStreak !== undefined) setContributionStreak(parsed.contributionStreak);
        if (parsed.processedTransactionIds) {
          setProcessedTransactionIds(new Set(parsed.processedTransactionIds));
        }
      } else {
        // First time - add initial score event
        const initialEvent: ScoreEvent = {
          id: `event_initial_${Date.now()}`,
          type: "initial_score",
          description: "Welcome to TandaXn! Starting score",
          points: POINT_VALUES.initial_score,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          timestamp: Date.now(),
        };
        await saveScoreData(POINT_VALUES.initial_score, [initialEvent], tips, 0, new Set());
      }
    } catch (error) {
      console.error("Error loading score data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveScoreData = async (
    newScore: number,
    newHistory: ScoreEvent[],
    newTips: ScoreTip[],
    newStreak: number,
    newProcessedIds: Set<string>
  ) => {
    try {
      // Clamp score between 0 and 100 (XnScore™ V3.0 scale) and round to 1 decimal
      const clampedScore = Math.round(Math.max(0, Math.min(100, newScore)) * 10) / 10;

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          score: clampedScore,
          history: newHistory,
          tips: newTips,
          contributionStreak: newStreak,
          processedTransactionIds: Array.from(newProcessedIds),
        })
      );
      setScore(clampedScore);
      setHistory(newHistory);
      setTips(newTips);
      setContributionStreak(newStreak);
      setProcessedTransactionIds(newProcessedIds);
    } catch (error) {
      console.error("Error saving score data:", error);
      throw error;
    }
  };

  const formatDate = () => {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const addScoreEvent = async (
    type: ScoreEventType,
    description: string,
    points: number,
    relatedTransactionId?: string
  ) => {
    const newEvent: ScoreEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      points,
      date: formatDate(),
      timestamp: Date.now(),
      relatedTransactionId,
    };

    const newHistory = [newEvent, ...history].slice(0, 100); // Keep last 100 events
    const newScore = Math.round((score + points) * 10) / 10; // Round to 1 decimal
    const newProcessedIds = new Set(processedTransactionIds);
    if (relatedTransactionId) {
      newProcessedIds.add(relatedTransactionId);
    }

    await saveScoreData(newScore, newHistory, tips, contributionStreak, newProcessedIds);

    // Auto-post: Check for XnScore level up (fire-and-forget)
    try {
      const clampedNew = Math.min(100, Math.max(0, newScore));
      const clampedOld = Math.min(100, Math.max(0, score));
      const oldLevel = SCORE_LEVELS.find(l => clampedOld >= l.minScore && clampedOld <= l.maxScore);
      const newLevel = SCORE_LEVELS.find(l => clampedNew >= l.minScore && clampedNew <= l.maxScore);
      if (newLevel && oldLevel && newLevel.name !== oldLevel.name && clampedNew > clampedOld) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          createAutoPost(session.user.id, "xn_level_up", "xn_score", "xn_score", {
            levelName: newLevel.name,
            score: Math.round(clampedNew),
            previousLevel: oldLevel.name,
          });
        }
      }
    } catch (autoPostErr) {
      console.warn("[AutoPost] Failed to auto-post XnScore level up:", autoPostErr);
    }

    return newEvent;
  };

  const processTransaction = async (transaction: Transaction, isContribution = false, isOnTime = true) => {
    // Skip if already processed
    if (processedTransactionIds.has(transaction.id)) {
      return;
    }

    let eventType: ScoreEventType;
    let points: number;
    let description: string;

    switch (transaction.type) {
      case "added":
        eventType = "funds_added";
        points = POINT_VALUES.funds_added;
        description = `Added funds: ${transaction.description}`;
        break;
      case "withdrawn":
        eventType = "withdrawal";
        points = POINT_VALUES.withdrawal;
        description = `Withdrawal: ${transaction.description}`;
        break;
      case "sent":
        eventType = "send_money";
        points = POINT_VALUES.send_money;
        description = `Money sent: ${transaction.description}`;
        break;
      case "received":
        // Check if it's a payout from a circle
        if (transaction.description.toLowerCase().includes("payout")) {
          eventType = "payout_received";
          points = POINT_VALUES.payout_received;
          description = "Received circle payout";
        } else {
          // Regular received money - small positive impact
          eventType = "send_money"; // Using same category
          points = 1;
          description = `Received: ${transaction.description}`;
        }
        break;
      default:
        return; // Don't process unknown types
    }

    await addScoreEvent(eventType, description, points, transaction.id);
  };

  const processContribution = async (circleId: string, isOnTime: boolean, isEarly: boolean) => {
    let newStreak = contributionStreak;

    // Base points for making a contribution
    await addScoreEvent(
      "contribution_made",
      "Circle contribution made",
      POINT_VALUES.contribution_made
    );

    // Timing bonus/penalty
    if (isEarly) {
      await addScoreEvent(
        "contribution_early",
        "Early payment bonus",
        POINT_VALUES.contribution_early
      );
      newStreak += 1;
    } else if (isOnTime) {
      await addScoreEvent(
        "contribution_on_time",
        "On-time payment bonus",
        POINT_VALUES.contribution_on_time
      );
      newStreak += 1;
    } else {
      await addScoreEvent(
        "contribution_late",
        "Late payment penalty",
        POINT_VALUES.contribution_late
      );
      newStreak = 0; // Reset streak
    }

    // Check for streak bonus (every 5 consecutive on-time contributions)
    if (newStreak > 0 && newStreak % 5 === 0) {
      await addScoreEvent(
        "streak_bonus",
        `${newStreak} contribution streak achieved!`,
        POINT_VALUES.streak_bonus
      );

      // Update streak tip
      const updatedTips = tips.map((tip) =>
        tip.id === "tip_5" ? { ...tip, completed: true } : tip
      );
      setTips(updatedTips);
    }

    // Update streak
    setContributionStreak(newStreak);
    await saveScoreData(score, history, tips, newStreak, processedTransactionIds);
  };

  const processCircleEvent = async (eventType: "joined" | "completed") => {
    if (eventType === "joined") {
      await addScoreEvent(
        "circle_joined",
        "Joined a new circle",
        POINT_VALUES.circle_joined
      );

      // Update join circle tip
      const updatedTips = tips.map((tip) =>
        tip.id === "tip_2" ? { ...tip, completed: true } : tip
      );
      setTips(updatedTips);
    } else if (eventType === "completed") {
      await addScoreEvent(
        "circle_completed",
        "Successfully completed a circle!",
        POINT_VALUES.circle_completed
      );

      // Update complete circle tip
      const updatedTips = tips.map((tip) =>
        tip.id === "tip_6" ? { ...tip, completed: true } : tip
      );
      setTips(updatedTips);
    }
  };

  const processAccountEvent = async (eventType: "verified" | "profile_completed") => {
    if (eventType === "verified") {
      await addScoreEvent(
        "account_verified",
        "Account verification completed",
        POINT_VALUES.account_verified
      );
    } else if (eventType === "profile_completed") {
      await addScoreEvent(
        "profile_completed",
        "Profile completed",
        POINT_VALUES.profile_completed
      );

      // Update profile tip
      const updatedTips = tips.map((tip) =>
        tip.id === "tip_3" ? { ...tip, completed: true } : tip
      );
      setTips(updatedTips);
    }
  };

  const getScoreBreakdown = () => {
    const breakdown: { [key: string]: number } = {
      "Contributions": 0,
      "Circle Activity": 0,
      "Wallet Activity": 0,
      "Account": 0,
      "Bonuses": 0,
    };

    history.forEach((event) => {
      switch (event.type) {
        case "contribution_made":
        case "contribution_on_time":
        case "contribution_early":
        case "contribution_late":
          breakdown["Contributions"] += event.points;
          break;
        case "circle_joined":
        case "circle_completed":
        case "payout_received":
          breakdown["Circle Activity"] += event.points;
          break;
        case "funds_added":
        case "withdrawal":
        case "send_money":
          breakdown["Wallet Activity"] += event.points;
          break;
        case "account_verified":
        case "profile_completed":
          breakdown["Account"] += event.points;
          break;
        case "referral_bonus":
        case "streak_bonus":
        case "initial_score":
          breakdown["Bonuses"] += event.points;
          break;
      }
    });

    const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return Object.entries(breakdown).map(([category, points]) => ({
      category,
      points,
      percentage: total > 0 ? Math.round((points / total) * 100) : 0,
    }));
  };

  const refreshScore = async () => {
    await loadScoreData();
  };

  return (
    <XnScoreContext.Provider
      value={{
        score,
        level,
        history,
        tips,
        contributionStreak,
        isLoading,
        processTransaction,
        processContribution,
        processCircleEvent,
        processAccountEvent,
        getScoreBreakdown,
        refreshScore,
      }}
    >
      {children}
    </XnScoreContext.Provider>
  );
};
