import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

// ============ TYPES ============

// Honor Tiers (Social Progression)
export type HonorTier = "Newcomer" | "Guardian" | "Mentor" | "Elder" | "Sage";

// Honor Score Tiers (within Elder system)
export type HonorScoreTier = "Platinum" | "Gold" | "Silver" | "Bronze" | "Provisional";

// Elder Tiers (Elder-specific progression)
export type ElderTier = "Junior" | "Senior" | "Grand";

// Elder Application Status
export type ElderApplicationStatus = "not_applied" | "pending" | "approved" | "rejected";

// Vouch Status
export type VouchStatus = "pending" | "active" | "completed" | "expired" | "defaulted";

// Case Status
export type CaseStatus = "open" | "assigned" | "in_progress" | "resolved" | "escalated";

// Case Type
export type CaseType = "payment" | "trust" | "financial" | "communication";

// Case Severity
export type CaseSeverity = "high" | "medium" | "low";

// ============ INTERFACES ============

export interface ElderRequirement {
  id: string;
  label: string;
  current: number | string;
  required: number | string;
  met: boolean;
}

export interface ElderProfile {
  userId: string;
  tier: ElderTier;
  status: ElderApplicationStatus;
  honorScore: number;
  xnScore: number;
  specializations: string[];
  trainingCredits: number;
  joinedAsElderDate?: string;
  vouchStrength: number; // Points per vouch based on tier
  maxConcurrentCases: number;
  activeCases: number;
  totalCasesResolved: number;
  successRate: number;
}

export interface VouchRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar?: string;
  requesterXnScore: number;
  requesterHonorScore: number;
  requestedPoints: number;
  purpose: string;
  message: string;
  circleName?: string;
  status: VouchStatus;
  createdAt: string;
  expiresAt?: string;
  riskLevel: "low" | "medium" | "high";
}

export interface ActiveVouch {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  vouchPoints: number;
  purpose: string;
  circleName?: string;
  startDate: string;
  expirationDate: string;
  daysRemaining: number;
  memberPaymentStatus: "on_track" | "at_risk" | "defaulted";
  riskToHonorScore: number;
}

export interface VouchHistory {
  id: string;
  memberName: string;
  vouchPoints: number;
  status: "successful" | "defaulted" | "expired";
  startDate: string;
  endDate: string;
  honorScoreImpact: number;
}

export interface MediationCase {
  id: string;
  type: CaseType;
  severity: CaseSeverity;
  title: string;
  description: string;
  circleName: string;
  circleId: string;
  partiesInvolved: number;
  parties: { id: string; name: string; role: string }[];
  status: CaseStatus;
  assignedElderId?: string;
  openedDate: string;
  dueDate?: string;
  openedDays: number;
  estimatedTime: string;
  reward: {
    honorScore: number;
    fee: number;
  };
  matchesSpecialization: boolean;
  evidence?: { type: string; description: string }[];
  resolution?: {
    ruling: string;
    explanation: string;
    date: string;
  };
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  category: "required" | "elective";
  duration: string;
  credits: number;
  progress: number;
  completed: boolean;
  modules: {
    id: string;
    title: string;
    completed: boolean;
  }[];
}

export interface ElderBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedDate?: string;
  requirements: string;
  earned: boolean;
}

export interface HonorScoreActivity {
  id: string;
  type: "vouch" | "mediation" | "training" | "penalty";
  description: string;
  points: number;
  date: string;
}

export interface ElderStats {
  vouchesAvailable: number;
  maxVouches: number;
  vouchesUsedThisMonth: number;
  activeVouches: number;
  successfulVouches: number;
  defaultedVouches: number;
  totalCasesAssigned: number;
  casesResolvedThisMonth: number;
  avgResolutionTime: string;
  satisfactionRate: number;
}

// ============ CONTEXT TYPE ============

type ElderContextType = {
  // State
  isElder: boolean;
  elderProfile: ElderProfile | null;
  elderStats: ElderStats | null;
  vouchRequests: VouchRequest[];
  activeVouches: ActiveVouch[];
  vouchHistory: VouchHistory[];
  availableCases: MediationCase[];
  myCases: MediationCase[];
  trainingCourses: TrainingCourse[];
  badges: ElderBadge[];
  honorScoreHistory: HonorScoreActivity[];
  isLoading: boolean;

  // Elder Requirements
  getElderRequirements: () => ElderRequirement[];
  checkEligibility: () => boolean;

  // Elder Application
  applyToBecomeElder: () => Promise<{ success: boolean; message: string }>;

  // Honor Score
  getHonorScoreTier: (score: number) => { tier: HonorScoreTier; color: string; bg: string };
  getHonorTier: (score: number) => HonorTier;

  // Elder Tier
  getElderTierInfo: (tier: ElderTier) => { bg: string; color: string; icon: string; vouchStrength: number };

  // Vouch System
  respondToVouchRequest: (requestId: string, approved: boolean) => Promise<void>;
  getVouchRiskAssessment: (request: VouchRequest) => { level: string; factors: string[] };

  // Mediation
  acceptCase: (caseId: string) => Promise<void>;
  submitRuling: (caseId: string, ruling: string, explanation: string) => Promise<void>;
  escalateCase: (caseId: string, reason: string) => Promise<void>;

  // Training
  startCourse: (courseId: string) => Promise<void>;
  completeModule: (courseId: string, moduleId: string) => Promise<void>;

  // Refresh
  refreshElderData: () => Promise<void>;
};

const ElderContext = createContext<ElderContextType | undefined>(undefined);

export const useElder = () => {
  const context = useContext(ElderContext);
  if (!context) {
    throw new Error("useElder must be used within ElderProvider");
  }
  return context;
};

// ============ MOCK DATA ============

// Founder's ID — the platform creator is always Grand Elder
const FOUNDER_ID = "35545a5f-b71b-46a0-a2de-ad56228dd4cf";

const founderElderProfile: ElderProfile = {
  userId: FOUNDER_ID,
  tier: "Grand",
  status: "approved",
  honorScore: 95,
  xnScore: 95,
  specializations: ["payment", "trust", "financial", "communication"],
  trainingCredits: 300,
  joinedAsElderDate: "2024-01-01",
  vouchStrength: 50,
  maxConcurrentCases: 10,
  activeCases: 1,
  totalCasesResolved: 58,
  successRate: 97,
};

const defaultElderProfile: ElderProfile = {
  userId: "",
  tier: "Junior",
  status: "not_applied",
  honorScore: 0,
  xnScore: 50,
  specializations: [],
  trainingCredits: 0,
  vouchStrength: 10,
  maxConcurrentCases: 5,
  activeCases: 0,
  totalCasesResolved: 0,
  successRate: 0,
};

const founderElderStats: ElderStats = {
  vouchesAvailable: 8,
  maxVouches: 10,
  vouchesUsedThisMonth: 2,
  activeVouches: 12,
  successfulVouches: 85,
  defaultedVouches: 2,
  totalCasesAssigned: 62,
  casesResolvedThisMonth: 8,
  avgResolutionTime: "1.8 days",
  satisfactionRate: 97,
};

const defaultElderStats: ElderStats = {
  vouchesAvailable: 0,
  maxVouches: 5,
  vouchesUsedThisMonth: 0,
  activeVouches: 0,
  successfulVouches: 0,
  defaultedVouches: 0,
  totalCasesAssigned: 0,
  casesResolvedThisMonth: 0,
  avgResolutionTime: "N/A",
  satisfactionRate: 0,
};

const mockVouchRequests: VouchRequest[] = [
  {
    id: "vr-1",
    requesterId: "user-5",
    requesterName: "Amara Johnson",
    requesterXnScore: 62,
    requesterHonorScore: 58,
    requestedPoints: 10,
    purpose: "Join Premium Circle",
    message: "I've been saving consistently for 6 months and want to join a higher-tier circle. Your vouch would help me qualify.",
    circleName: "Atlanta Elite Savers",
    status: "pending",
    createdAt: "2024-01-10",
    riskLevel: "medium",
  },
  {
    id: "vr-2",
    requesterId: "user-8",
    requesterName: "Kofi Mensah",
    requesterXnScore: 71,
    requesterHonorScore: 65,
    requestedPoints: 8,
    purpose: "New Community Access",
    message: "Relocating to Atlanta and need a vouch to join local circles faster.",
    circleName: "Ghanaian Professionals ATL",
    status: "pending",
    createdAt: "2024-01-12",
    riskLevel: "low",
  },
];

const mockActiveVouches: ActiveVouch[] = [
  {
    id: "av-1",
    memberId: "user-10",
    memberName: "Sarah Williams",
    vouchPoints: 10,
    purpose: "Circle Membership",
    circleName: "Women in Business",
    startDate: "2023-11-15",
    expirationDate: "2024-02-13",
    daysRemaining: 34,
    memberPaymentStatus: "on_track",
    riskToHonorScore: 5,
  },
  {
    id: "av-2",
    memberId: "user-12",
    memberName: "David Okonkwo",
    vouchPoints: 8,
    purpose: "Premium Access",
    circleName: "Nigerian Entrepreneurs",
    startDate: "2023-12-01",
    expirationDate: "2024-02-28",
    daysRemaining: 49,
    memberPaymentStatus: "at_risk",
    riskToHonorScore: 12,
  },
];

const mockVouchHistory: VouchHistory[] = [
  {
    id: "vh-1",
    memberName: "Michael Chen",
    vouchPoints: 10,
    status: "successful",
    startDate: "2023-08-01",
    endDate: "2023-10-30",
    honorScoreImpact: 5,
  },
  {
    id: "vh-2",
    memberName: "Fatima Hassan",
    vouchPoints: 8,
    status: "successful",
    startDate: "2023-09-15",
    endDate: "2023-12-14",
    honorScoreImpact: 4,
  },
];

const mockAvailableCases: MediationCase[] = [
  {
    id: "case-001",
    type: "payment",
    severity: "medium",
    title: "Missed bi-weekly contribution",
    description: "Member missed two consecutive payments without communication. Circle members are concerned.",
    circleName: "Lagos Traders",
    circleId: "circle-5",
    partiesInvolved: 2,
    parties: [
      { id: "user-20", name: "James Adeyemi", role: "Defaulting Member" },
      { id: "user-21", name: "Circle Admin", role: "Complainant" },
    ],
    status: "open",
    openedDate: "2024-01-08",
    openedDays: 3,
    estimatedTime: "2h",
    reward: { honorScore: 25, fee: 5 },
    matchesSpecialization: true,
  },
  {
    id: "case-002",
    type: "trust",
    severity: "high",
    title: "Disputed payout order",
    description: "Two members claim the same payout slot. Documentation is unclear.",
    circleName: "Family Builders",
    circleId: "circle-8",
    partiesInvolved: 3,
    parties: [
      { id: "user-25", name: "Grace Obi", role: "Claimant 1" },
      { id: "user-26", name: "Peter Nwosu", role: "Claimant 2" },
      { id: "user-27", name: "Circle Admin", role: "Witness" },
    ],
    status: "open",
    openedDate: "2024-01-09",
    openedDays: 2,
    estimatedTime: "4h",
    reward: { honorScore: 40, fee: 10 },
    matchesSpecialization: true,
  },
  {
    id: "case-003",
    type: "communication",
    severity: "low",
    title: "Unresponsive circle admin",
    description: "Admin hasn't responded to member inquiries for 2 weeks.",
    circleName: "Neighborhood Savers",
    circleId: "circle-12",
    partiesInvolved: 2,
    parties: [
      { id: "user-30", name: "Maria Santos", role: "Complainant" },
      { id: "user-31", name: "John Doe", role: "Admin" },
    ],
    status: "open",
    openedDate: "2024-01-05",
    openedDays: 6,
    estimatedTime: "1h",
    reward: { honorScore: 15, fee: 3 },
    matchesSpecialization: false,
  },
];

const mockMyCases: MediationCase[] = [
  {
    id: "case-010",
    type: "financial",
    severity: "medium",
    title: "Early withdrawal request dispute",
    description: "Member requesting early withdrawal citing emergency. Circle policy unclear.",
    circleName: "Tech Professionals",
    circleId: "circle-15",
    partiesInvolved: 2,
    parties: [
      { id: "user-40", name: "Alex Kim", role: "Requestor" },
      { id: "user-41", name: "Circle Treasury", role: "Respondent" },
    ],
    status: "in_progress",
    assignedElderId: "user-1",
    openedDate: "2024-01-06",
    dueDate: "2024-01-13",
    openedDays: 5,
    estimatedTime: "3h",
    reward: { honorScore: 30, fee: 7 },
    matchesSpecialization: false,
  },
];

const mockTrainingCourses: TrainingCourse[] = [
  {
    id: "course-1",
    title: "Elder Fundamentals",
    description: "Core principles of being an effective Elder in the TandaXn community.",
    category: "required",
    duration: "2 hours",
    credits: 20,
    progress: 100,
    completed: true,
    modules: [
      { id: "m1", title: "Introduction to Elder Role", completed: true },
      { id: "m2", title: "Community Values", completed: true },
      { id: "m3", title: "Ethics & Responsibilities", completed: true },
    ],
  },
  {
    id: "course-2",
    title: "Mediation Basics",
    description: "Learn fundamental mediation techniques and conflict resolution.",
    category: "required",
    duration: "3 hours",
    credits: 25,
    progress: 60,
    completed: false,
    modules: [
      { id: "m4", title: "Understanding Conflict", completed: true },
      { id: "m5", title: "Active Listening", completed: true },
      { id: "m6", title: "Neutral Facilitation", completed: false },
      { id: "m7", title: "Finding Resolution", completed: false },
    ],
  },
  {
    id: "course-3",
    title: "Financial Dispute Resolution",
    description: "Specialized training for handling financial disagreements.",
    category: "elective",
    duration: "2.5 hours",
    credits: 30,
    progress: 0,
    completed: false,
    modules: [
      { id: "m8", title: "Payment Dispute Types", completed: false },
      { id: "m9", title: "Evidence Evaluation", completed: false },
      { id: "m10", title: "Fair Rulings", completed: false },
    ],
  },
  {
    id: "course-4",
    title: "Cultural Sensitivity",
    description: "Understanding diverse cultural backgrounds in savings communities.",
    category: "elective",
    duration: "1.5 hours",
    credits: 15,
    progress: 0,
    completed: false,
    modules: [
      { id: "m11", title: "Cultural Awareness", completed: false },
      { id: "m12", title: "Communication Styles", completed: false },
    ],
  },
];

const mockBadges: ElderBadge[] = [
  {
    id: "badge-1",
    name: "Mediator I",
    icon: "⚖️",
    description: "Resolved your first mediation case",
    earnedDate: "2024-07-20",
    requirements: "Resolve 1 case",
    earned: true,
  },
  {
    id: "badge-2",
    name: "Trust Builder",
    icon: "🤝",
    description: "Successfully vouched for 5 members",
    earnedDate: "2024-09-15",
    requirements: "5 successful vouches",
    earned: true,
  },
  {
    id: "badge-3",
    name: "Quick Resolver",
    icon: "⚡",
    description: "Resolved 10 cases within deadline",
    requirements: "10 on-time resolutions",
    earned: false,
  },
  {
    id: "badge-4",
    name: "Culture Expert",
    icon: "🌍",
    description: "Completed cultural sensitivity training",
    requirements: "Complete Cultural Sensitivity course",
    earned: false,
  },
  {
    id: "badge-5",
    name: "Financial Specialist",
    icon: "💰",
    description: "Expert in financial dispute resolution",
    requirements: "Complete Financial Dispute course + 10 financial cases",
    earned: false,
  },
];

const mockHonorScoreHistory: HonorScoreActivity[] = [
  {
    id: "h1",
    type: "mediation",
    description: "Resolved payment dispute case",
    points: 25,
    date: "2024-01-08",
  },
  {
    id: "h2",
    type: "vouch",
    description: "Successful vouch for Sarah Williams",
    points: 5,
    date: "2024-01-05",
  },
  {
    id: "h3",
    type: "training",
    description: "Completed Elder Fundamentals course",
    points: 10,
    date: "2024-01-02",
  },
  {
    id: "h4",
    type: "mediation",
    description: "Resolved trust dispute case",
    points: 30,
    date: "2023-12-28",
  },
  {
    id: "h5",
    type: "penalty",
    description: "Vouch default by member",
    points: -8,
    date: "2023-12-15",
  },
];

// ============ PROVIDER ============

export const ElderProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const isFounder = user?.id === FOUNDER_ID;

  const [isElder, setIsElder] = useState(false);
  const [elderProfile, setElderProfile] = useState<ElderProfile | null>(null);
  const [elderStats, setElderStats] = useState<ElderStats | null>(null);
  const [vouchRequests, setVouchRequests] = useState<VouchRequest[]>([]);
  const [activeVouches, setActiveVouches] = useState<ActiveVouch[]>([]);
  const [vouchHistory, setVouchHistory] = useState<VouchHistory[]>([]);
  const [availableCases, setAvailableCases] = useState<MediationCase[]>([]);
  const [myCases, setMyCases] = useState<MediationCase[]>([]);
  const [trainingCourses, setTrainingCourses] = useState<TrainingCourse[]>([]);
  const [badges, setBadges] = useState<ElderBadge[]>([]);
  const [honorScoreHistory, setHonorScoreHistory] = useState<HonorScoreActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ============ INITIALIZE ELDER DATA BASED ON USER ============
  useEffect(() => {
    if (!user) {
      // Logged out — reset everything
      setIsElder(false);
      setElderProfile(null);
      setElderStats(null);
      return;
    }

    if (isFounder) {
      // Founder is ALWAYS Grand Elder with full privileges
      setIsElder(true);
      setElderProfile({ ...founderElderProfile, userId: user.id });
      setElderStats(founderElderStats);
      setVouchRequests(mockVouchRequests);
      setActiveVouches(mockActiveVouches);
      setVouchHistory(mockVouchHistory);
      setAvailableCases(mockAvailableCases);
      setMyCases(mockMyCases);
      setTrainingCourses(mockTrainingCourses.map((c) => ({ ...c, progress: 100, completed: true })));
      setBadges(mockBadges.map((b) => ({ ...b, earned: true, earnedDate: b.earnedDate || "2024-01-15" })));
      setHonorScoreHistory(mockHonorScoreHistory);
    } else {
      // Regular users — start as non-elder (they can apply)
      setIsElder(false);
      setElderProfile({ ...defaultElderProfile, userId: user.id, xnScore: user.xnScore || 50 });
      setElderStats(defaultElderStats);
      setVouchRequests([]);
      setActiveVouches([]);
      setVouchHistory([]);
      setAvailableCases([]);
      setMyCases([]);
      setTrainingCourses(mockTrainingCourses.map((c) => ({ ...c, progress: 0, completed: false })));
      setBadges(mockBadges.map((b) => ({ ...b, earned: false, earnedDate: undefined })));
      setHonorScoreHistory([]);
    }
  }, [user?.id]);

  // Get Elder Requirements (uses real user data)
  const getElderRequirements = (): ElderRequirement[] => {
    const xnScore = user?.xnScore || 50;
    const honorScore = elderProfile?.honorScore || 0;

    if (isFounder) {
      // Founder automatically meets all requirements
      return [
        { id: "founder", label: "Platform Founder", current: "Yes", required: "Yes", met: true },
        { id: "xnscore", label: "XnScore 70+", current: xnScore, required: 70, met: true },
        { id: "honor", label: "Honor Score 65+", current: honorScore, required: 65, met: true },
        { id: "circles", label: "5+ circles completed", current: 12, required: 5, met: true },
        { id: "tenure", label: "6+ months member", current: "14 months", required: "6 months", met: true },
      ];
    }

    return [
      { id: "xnscore", label: "XnScore 70+", current: xnScore, required: 70, met: xnScore >= 70 },
      { id: "honor", label: "Honor Score 65+", current: honorScore, required: 65, met: honorScore >= 65 },
      { id: "circles", label: "5+ circles completed", current: 0, required: 5, met: false },
      { id: "tenure", label: "6+ months member", current: "1 month", required: "6 months", met: false },
      { id: "standing", label: "No active disputes", current: "0 disputes", required: "0", met: true },
    ];
  };

  // Check Eligibility
  const checkEligibility = (): boolean => {
    const requirements = getElderRequirements();
    return requirements.every((req) => req.met);
  };

  // Apply to Become Elder
  const applyToBecomeElder = async (): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (isFounder) {
        // Founder is auto-approved as Grand Elder
        setIsElder(true);
        setElderProfile({ ...founderElderProfile, userId: user?.id || FOUNDER_ID });
        setElderStats(founderElderStats);
        return {
          success: true,
          message: "As the platform founder, you are automatically a Grand Elder!",
        };
      }

      if (!checkEligibility()) {
        return {
          success: false,
          message: "You don't meet all the requirements to become an Elder.",
        };
      }

      setIsElder(true);
      setElderProfile({
        ...defaultElderProfile,
        userId: user?.id || "",
        status: "pending",
        tier: "Junior",
        xnScore: user?.xnScore || 50,
      });

      return {
        success: true,
        message: "Your application has been submitted! You'll be notified once reviewed.",
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Get Honor Score Tier (for Elder scoring)
  const getHonorScoreTier = (score: number): { tier: HonorScoreTier; color: string; bg: string } => {
    if (score >= 85) return { tier: "Platinum", color: "#00C6AE", bg: "#F0FDFB" };
    if (score >= 70) return { tier: "Gold", color: "#D97706", bg: "#FEF3C7" };
    if (score >= 55) return { tier: "Silver", color: "#6B7280", bg: "#F5F7FA" };
    if (score >= 40) return { tier: "Bronze", color: "#92400E", bg: "#FED7AA" };
    return { tier: "Provisional", color: "#DC2626", bg: "#FEE2E2" };
  };

  // Get Honor Tier (Social progression: Newcomer → Guardian → Mentor → Elder → Sage)
  const getHonorTier = (score: number): HonorTier => {
    if (score >= 90) return "Sage";
    if (score >= 75) return "Elder";
    if (score >= 60) return "Mentor";
    if (score >= 40) return "Guardian";
    return "Newcomer";
  };

  // Get Elder Tier Info
  const getElderTierInfo = (tier: ElderTier): { bg: string; color: string; icon: string; vouchStrength: number } => {
    switch (tier) {
      case "Grand":
        return { bg: "#7C3AED", color: "#FFFFFF", icon: "🌳", vouchStrength: 50 };
      case "Senior":
        return { bg: "#00C6AE", color: "#FFFFFF", icon: "🌿", vouchStrength: 25 };
      case "Junior":
      default:
        return { bg: "#6B7280", color: "#FFFFFF", icon: "🌱", vouchStrength: 10 };
    }
  };

  // Respond to Vouch Request
  const respondToVouchRequest = async (requestId: string, approved: boolean): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (approved) {
        const request = vouchRequests.find((r) => r.id === requestId);
        if (request) {
          const newActiveVouch: ActiveVouch = {
            id: `av-${Date.now()}`,
            memberId: request.requesterId,
            memberName: request.requesterName,
            vouchPoints: request.requestedPoints,
            purpose: request.purpose,
            circleName: request.circleName,
            startDate: new Date().toISOString(),
            expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            daysRemaining: 90,
            memberPaymentStatus: "on_track",
            riskToHonorScore: Math.round(request.requestedPoints * 0.5),
          };
          setActiveVouches((prev) => [...prev, newActiveVouch]);
        }
      }

      setVouchRequests((prev) => prev.filter((r) => r.id !== requestId));

      if (elderStats) {
        setElderStats({
          ...elderStats,
          vouchesAvailable: approved ? elderStats.vouchesAvailable - 1 : elderStats.vouchesAvailable,
          activeVouches: approved ? elderStats.activeVouches + 1 : elderStats.activeVouches,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get Vouch Risk Assessment
  const getVouchRiskAssessment = (request: VouchRequest): { level: string; factors: string[] } => {
    const factors: string[] = [];

    if (request.requesterXnScore < 65) {
      factors.push("XnScore below average");
    }
    if (request.requesterHonorScore < 60) {
      factors.push("Honor Score below average");
    }
    if (request.requestedPoints > 15) {
      factors.push("High vouch amount requested");
    }

    const level = factors.length === 0 ? "Low" : factors.length === 1 ? "Medium" : "High";

    return { level, factors: factors.length > 0 ? factors : ["Member has good standing"] };
  };

  // Accept Mediation Case
  const acceptCase = async (caseId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const caseToAccept = availableCases.find((c) => c.id === caseId);
      if (caseToAccept && elderProfile) {
        const acceptedCase: MediationCase = {
          ...caseToAccept,
          status: "assigned",
          assignedElderId: elderProfile.userId,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        };

        setMyCases((prev) => [...prev, acceptedCase]);
        setAvailableCases((prev) => prev.filter((c) => c.id !== caseId));

        setElderProfile({
          ...elderProfile,
          activeCases: elderProfile.activeCases + 1,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Ruling
  const submitRuling = async (caseId: string, ruling: string, explanation: string): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const resolvedCase = myCases.find((c) => c.id === caseId);
      if (resolvedCase && elderProfile) {
        setMyCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  status: "resolved" as CaseStatus,
                  resolution: {
                    ruling,
                    explanation,
                    date: new Date().toISOString(),
                  },
                }
              : c
          )
        );

        // Update elder profile
        setElderProfile({
          ...elderProfile,
          activeCases: elderProfile.activeCases - 1,
          totalCasesResolved: elderProfile.totalCasesResolved + 1,
          honorScore: elderProfile.honorScore + resolvedCase.reward.honorScore,
        });

        // Add to honor score history
        setHonorScoreHistory((prev) => [
          {
            id: `h-${Date.now()}`,
            type: "mediation",
            description: `Resolved: ${resolvedCase.title}`,
            points: resolvedCase.reward.honorScore,
            date: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Escalate Case
  const escalateCase = async (caseId: string, reason: string): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setMyCases((prev) =>
        prev.map((c) =>
          c.id === caseId ? { ...c, status: "escalated" as CaseStatus } : c
        )
      );

      if (elderProfile) {
        setElderProfile({
          ...elderProfile,
          activeCases: elderProfile.activeCases - 1,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Start Training Course
  const startCourse = async (courseId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      setTrainingCourses((prev) =>
        prev.map((c) =>
          c.id === courseId && c.progress === 0 ? { ...c, progress: 10 } : c
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Complete Module
  const completeModule = async (courseId: string, moduleId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setTrainingCourses((prev) =>
        prev.map((course) => {
          if (course.id !== courseId) return course;

          const updatedModules = course.modules.map((m) =>
            m.id === moduleId ? { ...m, completed: true } : m
          );

          const completedCount = updatedModules.filter((m) => m.completed).length;
          const progress = Math.round((completedCount / updatedModules.length) * 100);
          const completed = progress === 100;

          return {
            ...course,
            modules: updatedModules,
            progress,
            completed,
          };
        })
      );

      // Update training credits if course completed
      const course = trainingCourses.find((c) => c.id === courseId);
      if (course && elderProfile) {
        const updatedModules = course.modules.map((m) =>
          m.id === moduleId ? { ...m, completed: true } : m
        );
        const allCompleted = updatedModules.every((m) => m.completed);

        if (allCompleted) {
          setElderProfile({
            ...elderProfile,
            trainingCredits: elderProfile.trainingCredits + course.credits,
          });

          setHonorScoreHistory((prev) => [
            {
              id: `h-${Date.now()}`,
              type: "training",
              description: `Completed: ${course.title}`,
              points: 5,
              date: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh Elder Data
  const refreshElderData = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      // In real implementation, fetch from API
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ElderContext.Provider
      value={{
        isElder,
        elderProfile,
        elderStats,
        vouchRequests,
        activeVouches,
        vouchHistory,
        availableCases,
        myCases,
        trainingCourses,
        badges,
        honorScoreHistory,
        isLoading,
        getElderRequirements,
        checkEligibility,
        applyToBecomeElder,
        getHonorScoreTier,
        getHonorTier,
        getElderTierInfo,
        respondToVouchRequest,
        getVouchRiskAssessment,
        acceptCase,
        submitRuling,
        escalateCase,
        startCourse,
        completeModule,
        refreshElderData,
      }}
    >
      {children}
    </ElderContext.Provider>
  );
};
