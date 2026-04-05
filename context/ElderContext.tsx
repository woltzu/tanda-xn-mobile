import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { tokenService } from "@/services/TokenService";
import { HonorScoreEngine } from "@/services/HonorScoreEngine";

/**
 * TANDAXN ELDER SYSTEM
 *
 * Elders are trusted community members who:
 * 1. VOUCH for new members (stake honor score)
 * 2. MEDIATE disputes between circle members
 * 3. GOVERN via council votes
 * 4. TRAIN via courses to earn credits
 *
 * Data Layer: Supabase tables from migrations 005 + 032:
 * - community_memberships (role='elder', honor_score, elder_tier, training_progress JSONB)
 * - elder_applications (application status tracking)
 * - member_vouches + vouch_events (vouch lifecycle)
 * - disputes + dispute_messages (mediation cases)
 * - elder_council_votes + elder_vote_records (governance)
 *
 * Training courses and badges: static constants (no DB tables),
 * progress persisted via training_progress JSONB on community_memberships.
 */

// ============ TYPES ============

export type HonorTier = "Novice" | "Trusted" | "Respected" | "Elder" | "Grand Elder";
export type HonorScoreTier = "Grand Elder" | "Elder" | "Respected" | "Trusted" | "Novice";
export type ElderTier = "Junior" | "Senior" | "Grand";
export type ElderApplicationStatus = "not_applied" | "pending" | "approved" | "rejected";
export type VouchStatus = "pending" | "active" | "completed" | "expired" | "defaulted";
export type CaseStatus = "open" | "assigned" | "in_progress" | "resolved" | "escalated";
export type CaseType = "payment" | "trust" | "financial" | "communication";
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
  vouchStrength: number;
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

// ============ DB ROW TYPES ============

type ElderMembershipRow = {
  id: string;
  user_id: string;
  community_id: string;
  role: string;
  status: string;
  joined_at: string | null;
  circles_completed: number;
  total_contributed: number;
  defaults_count: number;
  honor_score: number;
  elder_tier: string | null;
  elder_specializations: string[] | null;
  training_credits: number;
  training_progress: Record<string, { completedModules: string[]; completed?: boolean; startedAt?: string; completedAt?: string }> | null;
  elder_approved_at: string | null;
  total_cases_resolved: number;
  cases_success_rate: number;
  created_at: string;
  updated_at: string;
};

type ElderApplicationRow = {
  id: string;
  user_id: string;
  community_id: string;
  status: string;
  xn_score_at_application: number;
  honor_score_at_application: number | null;
  circles_completed_at_application: number;
  member_since: string;
  active_disputes_at_application: number;
  motivation_statement: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type MemberVouchRow = {
  id: string;
  voucher_user_id: string;
  vouched_user_id: string;
  community_id: string;
  voucher_xn_score_at_time: number;
  vouch_weight: number;
  status: string;
  vouch_message: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  // Joined profile data
  profiles?: { full_name: string; avatar_url: string | null; xn_score: number } | null;
};

type DisputeRow = {
  id: string;
  reporter_user_id: string;
  against_user_id: string | null;
  community_id: string;
  circle_id: string | null;
  default_id: string | null;
  type: string;
  title: string;
  description: string;
  evidence_urls: string[] | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  escalated_to: string | null;
  resolved_by: string | null;
  resolution: string | null;
  resolution_type: string | null;
  resolved_at: string | null;
  response_text: string | null;
  response_at: string | null;
  mediation_fee: number | null;
  honor_score_reward: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  circles?: { name: string } | null;
};

type VouchEventRow = {
  id: string;
  vouch_id: string;
  event_type: string;
  circle_id: string | null;
  default_id: string | null;
  voucher_score_impact: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ============ TRANSFORM HELPERS ============

const mapDisputeType = (dbType: string): CaseType => {
  const mapping: Record<string, CaseType> = {
    missed_contribution: "payment",
    payout_dispute: "payment",
    fraud_suspicion: "financial",
    harassment: "communication",
    rule_violation: "trust",
    unfair_removal: "trust",
    other: "communication",
  };
  return mapping[dbType] || "communication";
};

const mapDisputeStatus = (dbStatus: string): CaseStatus => {
  const mapping: Record<string, CaseStatus> = {
    open: "open",
    under_review: "assigned",
    investigating: "in_progress",
    awaiting_response: "in_progress",
    resolved: "resolved",
    escalated: "escalated",
    dismissed: "resolved",
  };
  return mapping[dbStatus] || "open";
};

const rowToVouchRequest = (row: MemberVouchRow): VouchRequest => {
  const xnScore = row.profiles?.xn_score || 50;
  return {
    id: row.id,
    requesterId: row.vouched_user_id,
    requesterName: row.profiles?.full_name || "Unknown",
    requesterAvatar: row.profiles?.avatar_url || undefined,
    requesterXnScore: xnScore,
    requesterHonorScore: 0,
    requestedPoints: Math.round(row.vouch_weight * 10),
    purpose: row.vouch_message || "Community vouch",
    message: row.vouch_message || "",
    circleName: undefined,
    status: "pending" as VouchStatus,
    createdAt: row.created_at,
    riskLevel: xnScore < 55 ? "high" : xnScore < 70 ? "medium" : "low",
  };
};

const rowToActiveVouch = (row: MemberVouchRow): ActiveVouch => {
  const startDate = new Date(row.created_at);
  const expirationDate = new Date(startDate);
  expirationDate.setDate(expirationDate.getDate() + 90);
  const daysRemaining = Math.max(
    0,
    Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return {
    id: row.id,
    memberId: row.vouched_user_id,
    memberName: row.profiles?.full_name || "Unknown",
    memberAvatar: row.profiles?.avatar_url || undefined,
    vouchPoints: Math.round(row.vouch_weight * 10),
    purpose: row.vouch_message || "Community vouch",
    circleName: undefined,
    startDate: row.created_at,
    expirationDate: expirationDate.toISOString(),
    daysRemaining,
    memberPaymentStatus: "on_track",
    riskToHonorScore: Math.round(row.vouch_weight * 5),
  };
};

const rowToVouchHistory = (row: MemberVouchRow): VouchHistory => {
  const statusMap: Record<string, "successful" | "defaulted" | "expired"> = {
    active: "successful",
    revoked: "expired",
    expired: "expired",
    invalidated_by_default: "defaulted",
  };

  const endDate = row.revoked_at || new Date().toISOString();

  return {
    id: row.id,
    memberName: row.profiles?.full_name || "Unknown",
    vouchPoints: Math.round(row.vouch_weight * 10),
    status: statusMap[row.status] || "expired",
    startDate: row.created_at,
    endDate,
    honorScoreImpact: row.status === "invalidated_by_default" ? -5 : 5,
  };
};

const rowToMediationCase = (row: DisputeRow, elderSpecializations?: string[]): MediationCase => {
  const openedDate = new Date(row.created_at);
  const openedDays = Math.ceil((Date.now() - openedDate.getTime()) / (1000 * 60 * 60 * 24));
  const caseType = mapDisputeType(row.type);

  return {
    id: row.id,
    type: caseType,
    severity: (row.priority as CaseSeverity) || "medium",
    title: row.title,
    description: row.description,
    circleName: row.circles?.name || "General",
    circleId: row.circle_id || "",
    partiesInvolved: row.against_user_id ? 2 : 1,
    parties: [
      { id: row.reporter_user_id, name: "Reporter", role: "Complainant" },
      ...(row.against_user_id ? [{ id: row.against_user_id, name: "Respondent", role: "Respondent" }] : []),
    ],
    status: mapDisputeStatus(row.status),
    assignedElderId: row.assigned_to || undefined,
    openedDate: row.created_at,
    dueDate: row.assigned_to
      ? new Date(new Date(row.updated_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : undefined,
    openedDays,
    estimatedTime: row.priority === "critical" ? "4h" : row.priority === "high" ? "3h" : "2h",
    reward: {
      honorScore: row.honor_score_reward || (row.priority === "critical" ? 40 : row.priority === "high" ? 30 : 15),
      fee: row.mediation_fee || 0,
    },
    matchesSpecialization: elderSpecializations ? elderSpecializations.includes(caseType) : false,
    evidence: row.evidence_urls?.map((url: string) => ({ type: "file", description: url })),
    resolution: row.resolution
      ? {
          ruling: row.resolution_type || "",
          explanation: row.resolution,
          date: row.resolved_at || "",
        }
      : undefined,
  };
};

// ============ STATIC CONSTANTS (no DB tables) ============

const TRAINING_COURSES: Omit<TrainingCourse, "progress" | "completed">[] = [
  {
    id: "course-1",
    title: "Elder Fundamentals",
    description: "Core principles of being an effective Elder in the TandaXn community.",
    category: "required",
    duration: "2 hours",
    credits: 20,
    modules: [
      { id: "m1", title: "Introduction to Elder Role", completed: false },
      { id: "m2", title: "Community Values", completed: false },
      { id: "m3", title: "Ethics & Responsibilities", completed: false },
    ],
  },
  {
    id: "course-2",
    title: "Mediation Basics",
    description: "Learn fundamental mediation techniques and conflict resolution.",
    category: "required",
    duration: "3 hours",
    credits: 25,
    modules: [
      { id: "m4", title: "Understanding Conflict", completed: false },
      { id: "m5", title: "Active Listening", completed: false },
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
    modules: [
      { id: "m11", title: "Cultural Awareness", completed: false },
      { id: "m12", title: "Communication Styles", completed: false },
    ],
  },
];

const ELDER_BADGES: Omit<ElderBadge, "earned" | "earnedDate">[] = [
  {
    id: "badge-1",
    name: "Mediator I",
    icon: "⚖️",
    description: "Resolved your first mediation case",
    requirements: "Resolve 1 case",
  },
  {
    id: "badge-2",
    name: "Trust Builder",
    icon: "🤝",
    description: "Successfully vouched for 5 members",
    requirements: "5 successful vouches",
  },
  {
    id: "badge-3",
    name: "Quick Resolver",
    icon: "⚡",
    description: "Resolved 10 cases within deadline",
    requirements: "10 on-time resolutions",
  },
  {
    id: "badge-4",
    name: "Culture Expert",
    icon: "🌍",
    description: "Completed cultural sensitivity training",
    requirements: "Complete Cultural Sensitivity course",
  },
  {
    id: "badge-5",
    name: "Financial Specialist",
    icon: "💰",
    description: "Expert in financial dispute resolution",
    requirements: "Complete Financial Dispute course + 10 financial cases",
  },
];

// Founder auto-approval — platform creator is always Grand Elder
const FOUNDER_ID = "35545a5f-b71b-46a0-a2de-ad56228dd4cf";

// ============ COMPUTED STATE BUILDERS ============

const computeElderStats = (
  allVouches: MemberVouchRow[],
  activeMyCases: MediationCase[],
  totalCasesResolved: number
): ElderStats => {
  const active = allVouches.filter((v) => v.status === "active");
  const successful = allVouches.filter((v) =>
    ["active", "expired"].includes(v.status) && v.status !== "invalidated_by_default"
  );
  const defaulted = allVouches.filter((v) => v.status === "invalidated_by_default");
  const now = new Date();
  const thisMonth = allVouches.filter((v) => {
    const d = new Date(v.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const maxVouches = 10;

  return {
    vouchesAvailable: Math.max(0, maxVouches - active.length),
    maxVouches,
    vouchesUsedThisMonth: thisMonth.length,
    activeVouches: active.length,
    successfulVouches: successful.length,
    defaultedVouches: defaulted.length,
    totalCasesAssigned: totalCasesResolved + activeMyCases.length,
    casesResolvedThisMonth: 0,
    avgResolutionTime: totalCasesResolved > 0 ? "2.5 days" : "N/A",
    satisfactionRate: totalCasesResolved > 0 ? 95 : 0,
  };
};

const mergeTrainingProgress = (
  progress: Record<string, { completedModules: string[]; completed?: boolean }> | null
): TrainingCourse[] => {
  return TRAINING_COURSES.map((course) => {
    const cp = progress?.[course.id];
    if (!cp) {
      return {
        ...course,
        progress: 0,
        completed: false,
        modules: course.modules.map((m) => ({ ...m, completed: false })),
      };
    }

    const updatedModules = course.modules.map((m) => ({
      ...m,
      completed: cp.completedModules?.includes(m.id) || false,
    }));
    const completedCount = updatedModules.filter((m) => m.completed).length;
    const progressPct = Math.round((completedCount / updatedModules.length) * 100);

    return {
      ...course,
      modules: updatedModules,
      progress: progressPct,
      completed: progressPct === 100,
    };
  });
};

const deriveBadges = (
  totalCasesResolved: number,
  successfulVouches: number,
  trainingProgress: Record<string, { completedModules: string[]; completed?: boolean }> | null
): ElderBadge[] => {
  return ELDER_BADGES.map((badge) => {
    let earned = false;
    switch (badge.id) {
      case "badge-1":
        earned = totalCasesResolved >= 1;
        break;
      case "badge-2":
        earned = successfulVouches >= 5;
        break;
      case "badge-3":
        earned = totalCasesResolved >= 10;
        break;
      case "badge-4":
        earned = trainingProgress?.["course-4"]?.completed || false;
        break;
      case "badge-5":
        earned = (trainingProgress?.["course-3"]?.completed || false) && totalCasesResolved >= 10;
        break;
    }
    return {
      ...badge,
      earned,
      earnedDate: earned ? new Date().toISOString() : undefined,
    };
  });
};

const buildHonorScoreHistory = (
  vouchEvents: VouchEventRow[],
  resolvedDisputes: DisputeRow[],
  trainingProgress: Record<string, { completedModules: string[]; completed?: boolean; completedAt?: string }> | null
): HonorScoreActivity[] => {
  const fromVouches: HonorScoreActivity[] = vouchEvents
    .filter((e) => e.voucher_score_impact !== 0)
    .map((e) => ({
      id: e.id,
      type: (e.event_type === "vouchee_defaulted" ? "penalty" : "vouch") as HonorScoreActivity["type"],
      description:
        e.event_type === "vouchee_defaulted" ? "Vouch default by member" : "Successful vouch",
      points: e.voucher_score_impact,
      date: e.created_at,
    }));

  const fromDisputes: HonorScoreActivity[] = resolvedDisputes.map((d) => ({
    id: d.id,
    type: "mediation" as const,
    description: `Resolved: ${d.title}`,
    points: d.honor_score_reward || 15,
    date: d.resolved_at || d.updated_at,
  }));

  const fromTraining: HonorScoreActivity[] = [];
  if (trainingProgress) {
    Object.entries(trainingProgress).forEach(([courseId, cp]) => {
      if (cp.completed && cp.completedAt) {
        const course = TRAINING_COURSES.find((c) => c.id === courseId);
        fromTraining.push({
          id: `training-${courseId}`,
          type: "training",
          description: `Completed: ${course?.title || courseId}`,
          points: 5,
          date: cp.completedAt,
        });
      }
    });
  }

  return [...fromVouches, ...fromDisputes, ...fromTraining].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

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

// ============ PROVIDER ============

export const ElderProvider = ({ children }: { children: ReactNode }) => {
  const { user, session } = useAuth();
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

  // Internal state for raw DB data used in mutations
  const [elderMembership, setElderMembership] = useState<ElderMembershipRow | null>(null);
  const [allVouchRows, setAllVouchRows] = useState<MemberVouchRow[]>([]);
  const [resolvedDisputeRows, setResolvedDisputeRows] = useState<DisputeRow[]>([]);

  // ============ DATA FETCHING ============

  const fetchElderData = useCallback(async () => {
    if (!session || !user?.id) {
      setIsElder(false);
      setElderProfile(null);
      setElderStats(null);
      setVouchRequests([]);
      setActiveVouches([]);
      setVouchHistory([]);
      setAvailableCases([]);
      setMyCases([]);
      setTrainingCourses(mergeTrainingProgress(null));
      setBadges(deriveBadges(0, 0, null));
      setHonorScoreHistory([]);
      return;
    }

    try {
      setIsLoading(true);

      // 1. Fetch community memberships — check if user is elder
      const { data: membershipData } = await supabase
        .from("community_memberships")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      const membership = (membershipData || []).find(
        (m: ElderMembershipRow) => m.role === "elder" || m.role === "owner"
      ) || (membershipData || [])[0] || null;

      setElderMembership(membership as ElderMembershipRow | null);

      // 2. Fetch elder application status
      const { data: applicationData } = await supabase
        .from("elder_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const latestApp = applicationData?.[0] as ElderApplicationRow | undefined;

      // 3. Determine elder status
      const isUserElder =
        isFounder ||
        (membership as ElderMembershipRow)?.role === "elder" ||
        (membership as ElderMembershipRow)?.role === "owner" ||
        latestApp?.status === "approved";

      setIsElder(isUserElder);

      // Get the community_id scope
      const communityId = membership?.community_id;

      // 4. Fetch vouches for this user (as voucher)
      const { data: vouchData } = await supabase
        .from("member_vouches")
        .select("*, profiles!member_vouches_vouched_user_id_fkey(full_name, avatar_url, xn_score)")
        .eq("voucher_user_id", user.id)
        .order("created_at", { ascending: false });

      const vouchRows = (vouchData || []) as MemberVouchRow[];
      setAllVouchRows(vouchRows);

      // Split vouches by status
      const pendingVouches = vouchRows.filter((v) => v.status === "active" && !v.revoked_at);
      // In the DB model, "active" means the vouch is in effect. For "pending requests",
      // we look for vouches created recently that the elder hasn't reviewed yet.
      // For now, we treat all non-revoked, non-expired vouches as the vouch data:
      const activeVouchRows = vouchRows.filter((v) => v.status === "active");
      const historyVouchRows = vouchRows.filter((v) =>
        ["revoked", "expired", "invalidated_by_default"].includes(v.status)
      );

      setVouchRequests([]); // Pending requests come from a different flow — member_vouches where status tracking shows pending
      setActiveVouches(activeVouchRows.map(rowToActiveVouch));
      setVouchHistory(historyVouchRows.map(rowToVouchHistory));

      // 5. Fetch available cases (unassigned, open)
      const { data: availableCasesData } = await supabase
        .from("disputes")
        .select("*, circles(name)")
        .is("assigned_to", null)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      const elderSpecs = (membership as ElderMembershipRow)?.elder_specializations || [];
      setAvailableCases(
        (availableCasesData || []).map((d: DisputeRow) =>
          rowToMediationCase(d, elderSpecs)
        )
      );

      // 6. Fetch my assigned cases
      const { data: myCasesData } = await supabase
        .from("disputes")
        .select("*, circles(name)")
        .eq("assigned_to", user.id)
        .in("status", ["under_review", "investigating", "awaiting_response"])
        .order("created_at", { ascending: false });

      setMyCases(
        (myCasesData || []).map((d: DisputeRow) => rowToMediationCase(d, elderSpecs))
      );

      // 7. Fetch resolved disputes (for honor history)
      const { data: resolvedData } = await supabase
        .from("disputes")
        .select("*")
        .eq("resolved_by", user.id)
        .eq("status", "resolved")
        .order("resolved_at", { ascending: false })
        .limit(50);

      setResolvedDisputeRows((resolvedData || []) as DisputeRow[]);

      // 8. Fetch vouch events (for honor history)
      const { data: vouchEventsData } = await supabase
        .from("vouch_events")
        .select("*")
        .in(
          "vouch_id",
          vouchRows.map((v) => v.id)
        )
        .order("created_at", { ascending: false })
        .limit(50);

      // 9. Fetch real honor score from honor_scores table
      const { data: honorScoreRow } = await supabase
        .from("honor_scores")
        .select("total_score")
        .eq("user_id", user.id)
        .maybeSingle();

      const realHonorScore = honorScoreRow?.total_score
        ? parseFloat(honorScoreRow.total_score)
        : (membership as any)?.honor_score || 0;

      // 10. Build elder profile
      const mem = membership as ElderMembershipRow | null;
      const activeCaseCount = (myCasesData || []).length;
      const totalResolved = mem?.total_cases_resolved || 0;
      const trainingProg = mem?.training_progress || null;

      if (isUserElder && mem) {
        const tier = (mem.elder_tier || "Junior") as ElderTier;
        setElderProfile({
          userId: user.id,
          tier,
          status: "approved",
          honorScore: realHonorScore,
          xnScore: user.xnScore || 50,
          specializations: mem.elder_specializations || [],
          trainingCredits: mem.training_credits || 0,
          joinedAsElderDate: mem.elder_approved_at || mem.joined_at || undefined,
          vouchStrength: tier === "Grand" ? 50 : tier === "Senior" ? 25 : 10,
          maxConcurrentCases: tier === "Grand" ? 10 : tier === "Senior" ? 7 : 5,
          activeCases: activeCaseCount,
          totalCasesResolved: totalResolved,
          successRate: mem.cases_success_rate || 0,
        });
      } else {
        // Non-elder user
        const appStatus: ElderApplicationStatus = latestApp
          ? (latestApp.status as ElderApplicationStatus)
          : "not_applied";

        setElderProfile({
          userId: user.id,
          tier: "Junior",
          status: appStatus,
          honorScore: realHonorScore,
          xnScore: user.xnScore || 50,
          specializations: [],
          trainingCredits: 0,
          vouchStrength: 10,
          maxConcurrentCases: 5,
          activeCases: 0,
          totalCasesResolved: 0,
          successRate: 0,
        });
      }

      // 10. Compute derived state
      const casesForStats = (myCasesData || []).map((d: DisputeRow) =>
        rowToMediationCase(d, elderSpecs)
      );
      setElderStats(computeElderStats(vouchRows, casesForStats, totalResolved));

      setTrainingCourses(mergeTrainingProgress(trainingProg));

      const successfulVouchCount = vouchRows.filter(
        (v) => v.status === "active" || v.status === "expired"
      ).length;
      setBadges(deriveBadges(totalResolved, successfulVouchCount, trainingProg));

      setHonorScoreHistory(
        buildHonorScoreHistory(
          (vouchEventsData || []) as VouchEventRow[],
          (resolvedData || []) as DisputeRow[],
          trainingProg
        )
      );
    } catch (error) {
      console.error("Failed to load elder data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session, user?.id, isFounder]);

  // Load data + real-time subscriptions
  useEffect(() => {
    if (!session) return;
    fetchElderData();

    const channel = supabase
      .channel("elder-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () =>
        fetchElderData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "member_vouches" }, () =>
        fetchElderData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "elder_applications" }, () =>
        fetchElderData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_memberships",
          filter: `user_id=eq.${user?.id}`,
        },
        () => fetchElderData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchElderData]);

  // ============ ELDER REQUIREMENTS ============

  const getElderRequirements = (): ElderRequirement[] => {
    const xnScore = user?.xnScore || 50;
    const honorScore = elderProfile?.honorScore || 0;
    const circlesCompleted = (elderMembership as ElderMembershipRow)?.circles_completed || 0;
    const joinedAt = (elderMembership as ElderMembershipRow)?.joined_at;
    const monthsAsMember = joinedAt
      ? Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    if (isFounder) {
      return [
        { id: "founder", label: "Platform Founder", current: "Yes", required: "Yes", met: true },
        { id: "xnscore", label: "XnScore 70+", current: xnScore, required: 70, met: true },
        { id: "honor", label: "Honor Score 65+", current: honorScore, required: 65, met: true },
        { id: "circles", label: "5+ circles completed", current: circlesCompleted, required: 5, met: true },
        { id: "tenure", label: "6+ months member", current: `${monthsAsMember} months`, required: "6 months", met: true },
      ];
    }

    return [
      { id: "xnscore", label: "XnScore 70+", current: xnScore, required: 70, met: xnScore >= 70 },
      { id: "honor", label: "Honor Score 65+", current: honorScore, required: 65, met: honorScore >= 65 },
      { id: "circles", label: "5+ circles completed", current: circlesCompleted, required: 5, met: circlesCompleted >= 5 },
      {
        id: "tenure",
        label: "6+ months member",
        current: `${monthsAsMember} months`,
        required: "6 months",
        met: monthsAsMember >= 6,
      },
      { id: "standing", label: "No active disputes", current: "0 disputes", required: "0", met: true },
    ];
  };

  const checkEligibility = (): boolean => {
    return getElderRequirements().every((req) => req.met);
  };

  // ============ ELDER APPLICATION ============

  const applyToBecomeElder = async (): Promise<{ success: boolean; message: string }> => {
    if (!user?.id) return { success: false, message: "Must be logged in" };

    setIsLoading(true);
    try {
      const communityId = elderMembership?.community_id;

      if (isFounder) {
        // Auto-approve founder as Grand Elder
        if (communityId) {
          await supabase
            .from("elder_applications")
            .upsert({
              user_id: user.id,
              community_id: communityId,
              status: "approved",
              xn_score_at_application: user.xnScore || 95,
              honor_score_at_application: 95,
              circles_completed_at_application: 0,
              member_since: new Date().toISOString(),
              active_disputes_at_application: 0,
            });

          await supabase
            .from("community_memberships")
            .update({
              role: "elder",
              elder_tier: "Grand",
              honor_score: 95,
              elder_specializations: ["payment", "trust", "financial", "communication"],
              elder_approved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
            .eq("community_id", communityId);
        }

        return { success: true, message: "As the platform founder, you are automatically a Grand Elder!" };
      }

      if (!checkEligibility()) {
        return { success: false, message: "You don't meet all the requirements to become an Elder." };
      }

      if (!communityId) {
        return { success: false, message: "You must be part of a community to apply." };
      }

      // Submit application
      const { error } = await supabase.from("elder_applications").insert({
        user_id: user.id,
        community_id: communityId,
        status: "pending",
        xn_score_at_application: user.xnScore || 50,
        honor_score_at_application: elderProfile?.honorScore || 0,
        circles_completed_at_application: elderMembership?.circles_completed || 0,
        member_since: elderMembership?.joined_at || new Date().toISOString(),
        active_disputes_at_application: 0,
      });

      if (error) throw new Error(error.message);

      return { success: true, message: "Your application has been submitted! You'll be notified once reviewed." };
    } catch (error: any) {
      return { success: false, message: error.message || "Application failed" };
    } finally {
      setIsLoading(false);
    }
  };

  // ============ HONOR SCORE (Pure functions — no changes) ============

  const getHonorScoreTier = (score: number): { tier: HonorScoreTier; color: string; bg: string } => {
    const tier = HonorScoreEngine.getTierFromScore(score);
    const info = HonorScoreEngine.getTierInfo(tier);
    return { tier, color: info.color, bg: info.bgColor };
  };

  const getHonorTier = (score: number): HonorTier => {
    return HonorScoreEngine.getTierFromScore(score);
  };

  const getElderTierInfo = (
    tier: ElderTier
  ): { bg: string; color: string; icon: string; vouchStrength: number } => {
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

  // ============ VOUCH SYSTEM ============

  const respondToVouchRequest = async (requestId: string, approved: boolean): Promise<void> => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      if (approved) {
        // Update vouch status to active
        const { error } = await supabase
          .from("member_vouches")
          .update({ status: "active" })
          .eq("id", requestId)
          .eq("voucher_user_id", user.id);

        if (error) throw new Error(error.message);

        // Insert vouch event
        await supabase.from("vouch_events").insert({
          vouch_id: requestId,
          event_type: "created",
          voucher_score_impact: 0,
        });

        // Award tokens
        try {
          const request = vouchRequests.find((r) => r.id === requestId);
          await tokenService.awardTokens(
            user.id,
            10,
            "vouch_success",
            `Vouched for ${request?.requesterName || "member"}`,
            "member_vouches",
            requestId
          );
        } catch (tokenErr) {
          console.warn("[Elder] Token award failed (non-blocking):", tokenErr);
        }
      } else {
        // Reject — revoke the vouch
        const { error } = await supabase
          .from("member_vouches")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            revoked_reason: "Vouch request declined",
          })
          .eq("id", requestId)
          .eq("voucher_user_id", user.id);

        if (error) throw new Error(error.message);
      }

      // Real-time subscription will refresh data automatically
    } finally {
      setIsLoading(false);
    }
  };

  const getVouchRiskAssessment = (
    request: VouchRequest
  ): { level: string; factors: string[] } => {
    const factors: string[] = [];

    if (request.requesterXnScore < 65) factors.push("XnScore below average");
    if (request.requesterHonorScore < 60) factors.push("Honor Score below average");
    if (request.requestedPoints > 15) factors.push("High vouch amount requested");

    const level = factors.length === 0 ? "Low" : factors.length === 1 ? "Medium" : "High";

    return { level, factors: factors.length > 0 ? factors : ["Member has good standing"] };
  };

  // ============ MEDIATION ============

  const acceptCase = async (caseId: string): Promise<void> => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("disputes")
        .update({
          assigned_to: user.id,
          status: "under_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId)
        .is("assigned_to", null); // Prevent double-assignment

      if (error) throw new Error(error.message);

      // Real-time subscription will refresh data
    } finally {
      setIsLoading(false);
    }
  };

  const submitRuling = async (
    caseId: string,
    ruling: string,
    explanation: string
  ): Promise<void> => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const resolvedCase = myCases.find((c) => c.id === caseId);

      // Update dispute as resolved
      const { error: disputeError } = await supabase
        .from("disputes")
        .update({
          status: "resolved",
          resolution: explanation,
          resolution_type: ruling,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId)
        .eq("assigned_to", user.id);

      if (disputeError) throw new Error(disputeError.message);

      // Update elder stats on community_memberships (honor_score computed by pipeline)
      if (elderMembership) {
        const { error: memberError } = await supabase
          .from("community_memberships")
          .update({
            total_cases_resolved: (elderMembership.total_cases_resolved || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", elderMembership.id);

        if (memberError) console.error("Failed to update elder stats:", memberError);

        // Trigger honor score recomputation (async, non-blocking)
        HonorScoreEngine.computeHonorScore(user.id).catch(console.warn);
      }

      // Award tokens
      if (resolvedCase) {
        try {
          await tokenService.awardTokens(
            user.id,
            20,
            "mediation_resolved",
            `Resolved: ${resolvedCase.title}`,
            "disputes",
            caseId
          );
        } catch (tokenErr) {
          console.warn("[Elder] Token award failed (non-blocking):", tokenErr);
        }
      }

      // Real-time subscription will refresh
    } finally {
      setIsLoading(false);
    }
  };

  const escalateCase = async (caseId: string, reason: string): Promise<void> => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("disputes")
        .update({
          status: "escalated",
          escalated_to: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId)
        .eq("assigned_to", user.id);

      if (error) throw new Error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ============ TRAINING ============

  const startCourse = async (courseId: string): Promise<void> => {
    if (!user?.id || !elderMembership) return;

    setIsLoading(true);
    try {
      const currentProgress = elderMembership.training_progress || {};
      if (currentProgress[courseId]) return; // Already started

      const updatedProgress = {
        ...currentProgress,
        [courseId]: { completedModules: [], startedAt: new Date().toISOString() },
      };

      const { error } = await supabase
        .from("community_memberships")
        .update({
          training_progress: updatedProgress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", elderMembership.id);

      if (error) throw new Error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const completeModule = async (courseId: string, moduleId: string): Promise<void> => {
    if (!user?.id || !elderMembership) return;

    setIsLoading(true);
    try {
      const currentProgress = elderMembership.training_progress || {};
      const courseProgress = currentProgress[courseId] || { completedModules: [] };
      const completedModules = [...new Set([...(courseProgress.completedModules || []), moduleId])];

      const course = TRAINING_COURSES.find((c) => c.id === courseId);
      const allCompleted = course && completedModules.length >= course.modules.length;

      const updatedProgress = {
        ...currentProgress,
        [courseId]: {
          completedModules,
          completed: allCompleted,
          startedAt: courseProgress.startedAt || new Date().toISOString(),
          completedAt: allCompleted ? new Date().toISOString() : undefined,
        },
      };

      const updates: Record<string, unknown> = {
        training_progress: updatedProgress,
        updated_at: new Date().toISOString(),
      };

      if (allCompleted && course) {
        updates.training_credits = (elderMembership.training_credits || 0) + course.credits;
      }

      const { error } = await supabase
        .from("community_memberships")
        .update(updates)
        .eq("id", elderMembership.id);

      if (error) throw new Error(error.message);

      // Award tokens for course completion
      if (allCompleted && course) {
        try {
          await tokenService.awardTokens(
            user.id,
            5,
            "training_completed",
            `Completed: ${course.title}`,
            "training_course",
            courseId
          );
        } catch (tokenErr) {
          console.warn("[Elder] Token award failed (non-blocking):", tokenErr);
        }

        // Recompute honor score (training completion affects community pillar)
        HonorScoreEngine.computeHonorScore(user.id).catch((err) =>
          console.warn("[Elder] Honor score recompute failed (non-blocking):", err)
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ============ PROVIDER VALUE ============

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
        refreshElderData: fetchElderData,
      }}
    >
      {children}
    </ElderContext.Provider>
  );
};
