import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

// Onboarding step definitions
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action: string; // Navigation target or action
  completed: boolean;
  icon: string;
  order: number;
}

// Profile completion fields
export interface ProfileField {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  screen: string; // Screen to navigate for completion
}

// Invite data structure for deep linking
export interface InviteData {
  type: "circle" | "community";
  id: string;
  name: string;
  emoji?: string;
  invitedBy: string;
  inviterName: string;
  contribution?: number;
  frequency?: string;
  members?: number;
}

// Tooltip/bubble data
export interface TooltipData {
  id: string;
  targetRef: string; // ID of the element to point to
  title: string;
  message: string;
  position: "top" | "bottom" | "left" | "right";
  screen: string; // Which screen this tooltip appears on
  shown: boolean;
  order: number;
}

interface OnboardingContextType {
  // Onboarding state
  isOnboardingComplete: boolean;
  onboardingSteps: OnboardingStep[];
  currentStepIndex: number;
  completedStepsCount: number;

  // Profile completion
  profileCompletion: number; // 0-100
  profileFields: ProfileField[];
  incompleteFields: ProfileField[];

  // Tooltips
  activeTooltip: TooltipData | null;
  tooltips: TooltipData[];
  dismissTooltip: (tooltipId: string) => void;
  showNextTooltip: () => void;
  skipAllTooltips: (screen?: string) => void;

  // Invite handling
  pendingInvite: InviteData | null;
  setPendingInvite: (invite: InviteData | null) => void;
  clearPendingInvite: () => void;

  // Actions
  completeStep: (stepId: string) => void;
  completeProfileField: (fieldId: string) => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;

  // Community suggestions
  suggestedCommunities: SuggestedCommunity[];
  dismissSuggestion: (communityId: string) => void;
}

export interface SuggestedCommunity {
  id: string;
  name: string;
  icon: string;
  reason: string; // Why we're suggesting this
  members: number;
  category: string;
  matchScore: number; // 0-100
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_KEY = "@tandaxn_onboarding";
const TOOLTIPS_KEY = "@tandaxn_tooltips_shown";

// Default onboarding steps
const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "verify_email",
    title: "Verify Email",
    description: "Confirm your email address",
    action: "EmailVerification",
    completed: false,
    icon: "mail",
    order: 1,
  },
  {
    id: "add_funds",
    title: "Add Funds",
    description: "Add money to your wallet",
    action: "AddFunds",
    completed: false,
    icon: "wallet",
    order: 2,
  },
  {
    id: "complete_profile",
    title: "Complete Profile",
    description: "Add your details for better experience",
    action: "EditProfile",
    completed: false,
    icon: "person",
    order: 3,
  },
  {
    id: "join_community",
    title: "Join a Community",
    description: "Connect with others like you",
    action: "CommunityBrowser",
    completed: false,
    icon: "people",
    order: 4,
  },
  {
    id: "first_circle",
    title: "Join or Create Circle",
    description: "Start saving together",
    action: "CreateCircleStart",
    completed: false,
    icon: "sync",
    order: 5,
  },
  {
    id: "first_goal",
    title: "Set a Savings Goal",
    description: "Start earning interest",
    action: "CreateGoal",
    completed: false,
    icon: "flag",
    order: 6,
  },
];

// Default profile fields
const DEFAULT_PROFILE_FIELDS: ProfileField[] = [
  { id: "full_name", label: "Full Name", completed: false, required: true, screen: "EditProfile" },
  { id: "email", label: "Email", completed: false, required: true, screen: "EditProfile" },
  { id: "phone", label: "Phone Number", completed: false, required: true, screen: "EditProfile" },
  { id: "profile_photo", label: "Profile Photo", completed: false, required: false, screen: "EditProfile" },
  { id: "country_origin", label: "Country of Origin", completed: false, required: false, screen: "EditProfile" },
  { id: "country_residence", label: "Country of Residence", completed: false, required: false, screen: "EditProfile" },
  { id: "language", label: "Preferred Language", completed: false, required: false, screen: "EditProfile" },
  { id: "notification_prefs", label: "Notification Preferences", completed: false, required: false, screen: "NotificationSettings" },
];

// Default tooltips
const DEFAULT_TOOLTIPS: TooltipData[] = [
  {
    id: "welcome_balance",
    targetRef: "totalBalance",
    title: "Your Total Balance",
    message: "This shows all your money across wallet, circles, and goals combined.",
    position: "bottom",
    screen: "Dashboard",
    shown: false,
    order: 1,
  },
  {
    id: "add_money_tip",
    targetRef: "addMoneyBtn",
    title: "Add Money",
    message: "Tap here to fund your wallet via bank transfer, card, or mobile money.",
    position: "bottom",
    screen: "Dashboard",
    shown: false,
    order: 2,
  },
  {
    id: "circles_intro",
    targetRef: "circlesSection",
    title: "Savings Circles",
    message: "Join or create circles to save with friends and family. Take turns receiving the pot!",
    position: "top",
    screen: "Dashboard",
    shown: false,
    order: 3,
  },
  {
    id: "goals_intro",
    targetRef: "goalsSection",
    title: "Savings Goals",
    message: "Set personal goals and earn up to 7% APY on your savings!",
    position: "top",
    screen: "Dashboard",
    shown: false,
    order: 4,
  },
  {
    id: "xn_score_tip",
    targetRef: "xnScoreBadge",
    title: "Your Xn Score",
    message: "This is your trust score. Pay on time to improve it and unlock better rates!",
    position: "bottom",
    screen: "Dashboard",
    shown: false,
    order: 5,
  },
];

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[]>(DEFAULT_STEPS);
  const [profileFields, setProfileFields] = useState<ProfileField[]>(DEFAULT_PROFILE_FIELDS);
  const [tooltips, setTooltips] = useState<TooltipData[]>(DEFAULT_TOOLTIPS);
  const [pendingInvite, setPendingInvite] = useState<InviteData | null>(null);
  const [suggestedCommunities, setSuggestedCommunities] = useState<SuggestedCommunity[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved onboarding state
  useEffect(() => {
    loadOnboardingState();
  }, [user?.id]);

  // Update profile fields based on user data
  useEffect(() => {
    if (user) {
      updateProfileFieldsFromUser();
    }
  }, [user]);

  // Generate community suggestions based on user profile
  useEffect(() => {
    if (user && isLoaded) {
      generateCommunitySuggestions();
    }
  }, [user, isLoaded]);

  const loadOnboardingState = async () => {
    try {
      const savedData = await AsyncStorage.getItem(`${STORAGE_KEY}_${user?.id}`);
      const savedTooltips = await AsyncStorage.getItem(`${TOOLTIPS_KEY}_${user?.id}`);

      if (savedData) {
        const parsed = JSON.parse(savedData);
        setOnboardingSteps(parsed.steps || DEFAULT_STEPS);
        setProfileFields(parsed.profileFields || DEFAULT_PROFILE_FIELDS);
      }

      if (savedTooltips) {
        setTooltips(JSON.parse(savedTooltips));
      }

      setIsLoaded(true);
    } catch (error) {
      console.error("Error loading onboarding state:", error);
      setIsLoaded(true);
    }
  };

  const saveOnboardingState = async (steps: OnboardingStep[], fields: ProfileField[]) => {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEY}_${user?.id}`,
        JSON.stringify({ steps, profileFields: fields })
      );
    } catch (error) {
      console.error("Error saving onboarding state:", error);
    }
  };

  const saveTooltipsState = async (tooltipsData: TooltipData[]) => {
    try {
      await AsyncStorage.setItem(
        `${TOOLTIPS_KEY}_${user?.id}`,
        JSON.stringify(tooltipsData)
      );
    } catch (error) {
      console.error("Error saving tooltips state:", error);
    }
  };

  const updateProfileFieldsFromUser = () => {
    if (!user) return;

    const updatedFields = profileFields.map(field => {
      let completed = false;
      switch (field.id) {
        case "full_name":
          completed = !!user.name && user.name.trim().length > 0;
          break;
        case "email":
          completed = !!user.email && user.email.trim().length > 0;
          break;
        case "phone":
          completed = !!user.phone && user.phone.trim().length > 0;
          break;
        case "profile_photo":
          completed = !!(user as any).avatarUrl;
          break;
        case "country_origin":
          completed = !!(user as any).countryOfOrigin;
          break;
        case "country_residence":
          completed = !!(user as any).countryOfResidence;
          break;
        default:
          completed = field.completed;
      }
      return { ...field, completed };
    });

    setProfileFields(updatedFields);
  };

  const generateCommunitySuggestions = () => {
    // This would normally use user's profile data to suggest relevant communities
    // For now, we'll create mock suggestions based on common diaspora communities
    const mockSuggestions: SuggestedCommunity[] = [
      {
        id: "ghanaian_diaspora",
        name: "Ghanaian Diaspora USA",
        icon: "🇬🇭",
        reason: "Based on your country of origin",
        members: 2450,
        category: "Diaspora",
        matchScore: 95,
      },
      {
        id: "tech_professionals",
        name: "Tech Professionals",
        icon: "💻",
        reason: "Popular in your area",
        members: 1820,
        category: "Professional",
        matchScore: 85,
      },
      {
        id: "young_investors",
        name: "Young Investors Club",
        icon: "📈",
        reason: "Matches your goals",
        members: 3100,
        category: "Financial",
        matchScore: 80,
      },
      {
        id: "faith_community",
        name: "Faith & Finance",
        icon: "🙏",
        reason: "Popular community",
        members: 1560,
        category: "Faith-Based",
        matchScore: 75,
      },
    ];

    setSuggestedCommunities(mockSuggestions);
  };

  // Calculate derived values
  const completedStepsCount = onboardingSteps.filter(s => s.completed).length;
  const isOnboardingComplete = completedStepsCount === onboardingSteps.length;
  const currentStepIndex = onboardingSteps.findIndex(s => !s.completed);

  const completedFieldsCount = profileFields.filter(f => f.completed).length;
  const profileCompletion = Math.round((completedFieldsCount / profileFields.length) * 100);
  const incompleteFields = profileFields.filter(f => !f.completed);

  // Get next tooltip to show
  const activeTooltip = tooltips
    .filter(t => !t.shown)
    .sort((a, b) => a.order - b.order)[0] || null;

  // Actions
  const completeStep = (stepId: string) => {
    const updatedSteps = onboardingSteps.map(step =>
      step.id === stepId ? { ...step, completed: true } : step
    );
    setOnboardingSteps(updatedSteps);
    saveOnboardingState(updatedSteps, profileFields);
  };

  const completeProfileField = (fieldId: string) => {
    const updatedFields = profileFields.map(field =>
      field.id === fieldId ? { ...field, completed: true } : field
    );
    setProfileFields(updatedFields);
    saveOnboardingState(onboardingSteps, updatedFields);

    // Also complete the profile step if enough fields are done
    const newCompletedCount = updatedFields.filter(f => f.completed).length;
    const requiredFields = updatedFields.filter(f => f.required);
    const completedRequired = requiredFields.filter(f => f.completed).length;

    if (completedRequired === requiredFields.length) {
      completeStep("complete_profile");
    }
  };

  const dismissTooltip = (tooltipId: string) => {
    const updatedTooltips = tooltips.map(tip =>
      tip.id === tooltipId ? { ...tip, shown: true } : tip
    );
    setTooltips(updatedTooltips);
    saveTooltipsState(updatedTooltips);
  };

  const showNextTooltip = () => {
    // The current tooltip is already dismissed by the component's onDismiss handler.
    // The next unshown tooltip becomes activeTooltip automatically (derived value).
    // No additional dismiss needed here — doing so would skip the next tooltip.
  };

  const skipAllTooltips = (screen?: string) => {
    const updatedTooltips = tooltips.map(tip =>
      (!screen || tip.screen === screen) ? { ...tip, shown: true } : tip
    );
    setTooltips(updatedTooltips);
    saveTooltipsState(updatedTooltips);
  };

  const clearPendingInvite = () => {
    setPendingInvite(null);
  };

  const dismissSuggestion = (communityId: string) => {
    setSuggestedCommunities(prev => prev.filter(c => c.id !== communityId));
  };

  const skipOnboarding = async () => {
    const allCompleted = onboardingSteps.map(step => ({ ...step, completed: true }));
    const allTooltipsShown = tooltips.map(tip => ({ ...tip, shown: true }));

    setOnboardingSteps(allCompleted);
    setTooltips(allTooltipsShown);

    await saveOnboardingState(allCompleted, profileFields);
    await saveTooltipsState(allTooltipsShown);
  };

  const resetOnboarding = async () => {
    setOnboardingSteps(DEFAULT_STEPS);
    setTooltips(DEFAULT_TOOLTIPS);
    setProfileFields(DEFAULT_PROFILE_FIELDS);

    await AsyncStorage.removeItem(`${STORAGE_KEY}_${user?.id}`);
    await AsyncStorage.removeItem(`${TOOLTIPS_KEY}_${user?.id}`);
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        onboardingSteps,
        currentStepIndex,
        completedStepsCount,
        profileCompletion,
        profileFields,
        incompleteFields,
        activeTooltip,
        tooltips,
        dismissTooltip,
        showNextTooltip,
        skipAllTooltips,
        pendingInvite,
        setPendingInvite,
        clearPendingInvite,
        completeStep,
        completeProfileField,
        skipOnboarding,
        resetOnboarding,
        suggestedCommunities,
        dismissSuggestion,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
