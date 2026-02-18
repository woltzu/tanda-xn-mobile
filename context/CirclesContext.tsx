import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { RealtimeChannel } from "@supabase/supabase-js";

export type CircleType = "traditional" | "goal-based" | "emergency" | "family-support" | "goal" | "beneficiary";

export type Circle = {
  id: string;
  name: string;
  type: CircleType;
  amount: number;
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "one-time";
  memberCount: number;
  startDate: string;
  rotationMethod: string;
  gracePeriodDays: number;
  invitedMembers: Array<{ id: number; name: string; phone: string }>;
  createdAt: string;
  createdBy: string;
  status: "pending" | "active" | "completed";
  emoji: string;
  description?: string;
  location?: string;
  verified?: boolean;
  minScore?: number;
  currentMembers: number;
  myPosition?: number;
  progress: number;
  inviteCode?: string;
  // Beneficiary/Family support specific fields
  beneficiaryName?: string;
  beneficiaryReason?: string;
  beneficiaryPhone?: string;
  beneficiaryCountry?: string;
  isOneTime?: boolean;
  // Recurring beneficiary fields
  isRecurring?: boolean;
  totalCycles?: number;
  currentCycle?: number;
  payoutPerCycle?: number;
  cyclesCompleted?: number;
  totalPayoutToDate?: number;
};

export type CircleMember = {
  id: string;
  odictId: string;
  name: string;
  email?: string;
  phone?: string;
  position: number;
  role: "creator" | "admin" | "elder" | "member";
  status: "active" | "inactive" | "pending";
  xnScore: number;
  hasPaid: boolean;
  joinedAt: string;
  isCurrentUser: boolean;
};

export type CircleActivity = {
  id: string;
  type: "contribution" | "joined" | "created" | "payout" | "left";
  userId: string;
  userName: string;
  amount?: number;
  timestamp: string;
  isCurrentUser: boolean;
};

// Database row type (snake_case)
type CircleRow = {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  member_count: number;
  current_members: number;
  start_date: string | null;
  rotation_method: string;
  grace_period_days: number;
  status: string;
  emoji: string;
  description: string | null;
  location: string | null;
  verified: boolean;
  min_score: number;
  progress: number;
  invite_code: string;
  beneficiary_name: string | null;
  beneficiary_reason: string | null;
  beneficiary_phone: string | null;
  beneficiary_country: string | null;
  is_one_time: boolean;
  is_recurring: boolean;
  total_cycles: number | null;
  current_cycle: number;
  payout_per_cycle: number | null;
  cycles_completed: number;
  total_payout_to_date: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// Circle type configurations
export const CIRCLE_TYPES = {
  traditional: {
    id: "traditional",
    name: "Traditional Tanda",
    emoji: "🔄",
    description: "Classic rotating savings. Each member contributes, one member receives the pot each cycle.",
    features: ["Equal contributions", "Rotating payouts", "Fixed schedule"],
    popular: true,
  },
  "goal-based": {
    id: "goal-based",
    name: "Goal-Based Circle",
    emoji: "🎯",
    description: "Everyone saves toward a shared goal. Funds released when target is reached.",
    features: ["Shared target", "Flexible amounts", "Group motivation"],
    popular: false,
  },
  emergency: {
    id: "emergency",
    name: "Emergency Fund Circle",
    emoji: "🛡️",
    description: "Build emergency funds together. Members can request funds when needed.",
    features: ["Safety net", "Request-based", "Community support"],
    popular: false,
  },
  beneficiary: {
    id: "beneficiary",
    name: "Beneficiary Support",
    emoji: "💝",
    description: "Support someone in need. All contributions go to a designated beneficiary each cycle.",
    features: ["Single recipient", "Community giving", "Recurring support"],
    popular: false,
    isNew: true,
  },
};

type CirclesContextType = {
  circles: Circle[];
  myCircles: Circle[];
  browseCircles: Circle[];
  isLoading: boolean;
  error: string | null;
  createCircle: (circleData: Omit<Circle, "id" | "createdAt" | "status" | "currentMembers" | "progress">) => Promise<Circle>;
  joinCircle: (circleId: string) => Promise<void>;
  refreshCircles: () => Promise<void>;
  findCircleByInviteCode: (code: string) => Promise<Circle | null>;
  generateInviteCode: (circle: Circle) => string;
  leaveCircle: (circleId: string) => Promise<void>;
  getCircleMembers: (circleId: string) => Promise<CircleMember[]>;
  getCircleActivities: (circleId: string) => Promise<CircleActivity[]>;
  makeContribution: (circleId: string, amount: number) => Promise<void>;
};

const CirclesContext = createContext<CirclesContextType | undefined>(undefined);

export const useCircles = () => {
  const context = useContext(CirclesContext);
  if (!context) {
    throw new Error("useCircles must be used within CirclesProvider");
  }
  return context;
};

// Default browse circles for discovery (shown when DB is empty or loading)
const defaultBrowseCircles: Circle[] = [
  {
    id: "browse-1",
    name: "Diaspora Family Fund",
    type: "traditional",
    amount: 200,
    frequency: "monthly",
    memberCount: 12,
    startDate: "2025-02-01",
    rotationMethod: "xnscore",
    gracePeriodDays: 2,
    invitedMembers: [],
    createdAt: "2025-01-01",
    createdBy: "system",
    status: "active",
    emoji: "👨‍👩‍👧‍👦",
    description: "Supporting families back home together",
    location: "USA → Kenya",
    verified: true,
    minScore: 50,
    currentMembers: 8,
    progress: 65,
  },
  {
    id: "browse-2",
    name: "Tech Workers Savings",
    type: "traditional",
    amount: 500,
    frequency: "biweekly",
    memberCount: 8,
    startDate: "2025-01-15",
    rotationMethod: "xnscore",
    gracePeriodDays: 1,
    invitedMembers: [],
    createdAt: "2025-01-01",
    createdBy: "system",
    status: "active",
    emoji: "💻",
    description: "Bay Area tech professionals",
    location: "San Francisco",
    verified: true,
    minScore: 65,
    currentMembers: 6,
    progress: 75,
  },
  {
    id: "browse-3",
    name: "Brooklyn Community Circle",
    type: "traditional",
    amount: 100,
    frequency: "weekly",
    memberCount: 12,
    startDate: "2025-01-20",
    rotationMethod: "random",
    gracePeriodDays: 1,
    invitedMembers: [],
    createdAt: "2025-01-01",
    createdBy: "system",
    status: "active",
    emoji: "🏙️",
    description: "Local savings for local dreams",
    location: "Brooklyn, NY",
    verified: true,
    minScore: 40,
    currentMembers: 10,
    progress: 80,
  },
  {
    id: "browse-4",
    name: "New Parents Support",
    type: "goal-based",
    amount: 150,
    frequency: "monthly",
    memberCount: 8,
    startDate: "2025-02-15",
    rotationMethod: "manual",
    gracePeriodDays: 3,
    invitedMembers: [],
    createdAt: "2025-01-01",
    createdBy: "system",
    status: "active",
    emoji: "👶",
    description: "Saving for our children's future",
    location: "Nationwide",
    verified: false,
    minScore: 45,
    currentMembers: 5,
    progress: 60,
  },
  {
    id: "browse-5",
    name: "Nurses United Fund",
    type: "traditional",
    amount: 250,
    frequency: "monthly",
    memberCount: 12,
    startDate: "2025-01-10",
    rotationMethod: "xnscore",
    gracePeriodDays: 2,
    invitedMembers: [],
    createdAt: "2025-01-01",
    createdBy: "system",
    status: "active",
    emoji: "👩‍⚕️",
    description: "Healthcare workers saving together",
    location: "Houston, TX",
    verified: true,
    minScore: 55,
    currentMembers: 11,
    progress: 90,
  },
];

// Helper to get emoji based on circle type
const getCircleEmoji = (type: string): string => {
  switch (type) {
    case "traditional":
      return "🔄";
    case "goal-based":
    case "goal":
      return "🎯";
    case "emergency":
      return "🛡️";
    case "family-support":
      return "👨‍👩‍👧‍👦";
    case "beneficiary":
      return "💝";
    default:
      return "💰";
  }
};

// Helper to generate invite code from circle name
const generateCircleInviteCode = (name: string, createdAt: string): string => {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
  const year = new Date(createdAt).getFullYear();
  return `${cleanName}${year}`;
};

// Convert database row to Circle object (snake_case to camelCase)
const rowToCircle = (row: CircleRow): Circle => ({
  id: row.id,
  name: row.name,
  type: row.type as CircleType,
  amount: row.amount,
  frequency: row.frequency as Circle["frequency"],
  memberCount: row.member_count,
  currentMembers: row.current_members,
  startDate: row.start_date || "",
  rotationMethod: row.rotation_method,
  gracePeriodDays: row.grace_period_days,
  invitedMembers: [], // Will be populated separately if needed
  createdAt: row.created_at,
  createdBy: row.created_by,
  status: row.status as Circle["status"],
  emoji: row.emoji,
  description: row.description || undefined,
  location: row.location || undefined,
  verified: row.verified,
  minScore: row.min_score,
  progress: row.progress,
  inviteCode: row.invite_code,
  beneficiaryName: row.beneficiary_name || undefined,
  beneficiaryReason: row.beneficiary_reason || undefined,
  beneficiaryPhone: row.beneficiary_phone || undefined,
  beneficiaryCountry: row.beneficiary_country || undefined,
  isOneTime: row.is_one_time,
  isRecurring: row.is_recurring,
  totalCycles: row.total_cycles || undefined,
  currentCycle: row.current_cycle,
  payoutPerCycle: row.payout_per_cycle || undefined,
  cyclesCompleted: row.cycles_completed,
  totalPayoutToDate: row.total_payout_to_date,
});

// Convert Circle object to database row (camelCase to snake_case)
const circleToRow = (circle: Partial<Circle>): Partial<CircleRow> => {
  const row: Partial<CircleRow> = {};

  if (circle.name !== undefined) row.name = circle.name;
  if (circle.type !== undefined) row.type = circle.type;
  if (circle.amount !== undefined) row.amount = circle.amount;
  if (circle.frequency !== undefined) row.frequency = circle.frequency;
  if (circle.memberCount !== undefined) row.member_count = circle.memberCount;
  if (circle.startDate !== undefined) row.start_date = circle.startDate || null;
  if (circle.rotationMethod !== undefined) row.rotation_method = circle.rotationMethod;
  if (circle.gracePeriodDays !== undefined) row.grace_period_days = circle.gracePeriodDays;
  if (circle.status !== undefined) row.status = circle.status;
  if (circle.emoji !== undefined) row.emoji = circle.emoji;
  if (circle.description !== undefined) row.description = circle.description || null;
  if (circle.location !== undefined) row.location = circle.location || null;
  if (circle.verified !== undefined) row.verified = circle.verified;
  if (circle.minScore !== undefined) row.min_score = circle.minScore;
  if (circle.progress !== undefined) row.progress = circle.progress;
  if (circle.inviteCode !== undefined) row.invite_code = circle.inviteCode;
  if (circle.beneficiaryName !== undefined) row.beneficiary_name = circle.beneficiaryName || null;
  if (circle.beneficiaryReason !== undefined) row.beneficiary_reason = circle.beneficiaryReason || null;
  if (circle.beneficiaryPhone !== undefined) row.beneficiary_phone = circle.beneficiaryPhone || null;
  if (circle.beneficiaryCountry !== undefined) row.beneficiary_country = circle.beneficiaryCountry || null;
  if (circle.isOneTime !== undefined) row.is_one_time = circle.isOneTime;
  if (circle.isRecurring !== undefined) row.is_recurring = circle.isRecurring;
  if (circle.totalCycles !== undefined) row.total_cycles = circle.totalCycles || null;
  if (circle.currentCycle !== undefined) row.current_cycle = circle.currentCycle;
  if (circle.payoutPerCycle !== undefined) row.payout_per_cycle = circle.payoutPerCycle || null;
  if (circle.cyclesCompleted !== undefined) row.cycles_completed = circle.cyclesCompleted;
  if (circle.totalPayoutToDate !== undefined) row.total_payout_to_date = circle.totalPayoutToDate;
  if (circle.createdBy !== undefined) row.created_by = circle.createdBy;

  return row;
};

// Calculate beneficiary circle summary
export const calculateBeneficiaryStats = (circle: Circle) => {
  if (circle.type !== "beneficiary") return null;

  const totalCycles = circle.totalCycles || 1;
  const currentCycle = circle.currentCycle || 1;
  const payoutPerCycle = circle.amount * circle.memberCount;
  const totalExpectedPayout = payoutPerCycle * totalCycles;
  const totalPaidSoFar = circle.totalPayoutToDate || 0;
  const remainingPayout = totalExpectedPayout - totalPaidSoFar;
  const progressPercent = (currentCycle / totalCycles) * 100;

  return {
    totalCycles,
    currentCycle,
    payoutPerCycle,
    totalExpectedPayout,
    totalPaidSoFar,
    remainingPayout,
    progressPercent,
    cyclesRemaining: totalCycles - currentCycle + 1,
  };
};

export const CirclesProvider = ({ children }: { children: ReactNode }) => {
  const { user, session } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [myCircleIds, setMyCircleIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all circles from Supabase
  const fetchCircles = useCallback(async () => {
    if (!session) {
      setCircles([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all circles
      const { data: circlesData, error: circlesError } = await supabase
        .from("circles")
        .select("*")
        .order("created_at", { ascending: false });

      if (circlesError) {
        console.error("Error fetching circles:", circlesError);
        setError(circlesError.message);
        return;
      }

      // Fetch user's circle memberships
      const { data: membershipsData, error: membershipsError } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", user?.id);

      if (membershipsError) {
        console.error("Error fetching memberships:", membershipsError);
      }

      // Convert to Circle objects
      const fetchedCircles = (circlesData || []).map((row: CircleRow) => rowToCircle(row));
      setCircles(fetchedCircles);

      // Track which circles user is a member of
      const memberIds = new Set((membershipsData || []).map((m: { circle_id: string }) => m.circle_id));
      setMyCircleIds(memberIds);
    } catch (err) {
      console.error("Error in fetchCircles:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch circles");
    } finally {
      setIsLoading(false);
    }
  }, [session, user?.id]);

  // Setup real-time subscription
  useEffect(() => {
    if (!session) return;

    // Initial fetch
    fetchCircles();

    // Subscribe to real-time changes
    const channel: RealtimeChannel = supabase
      .channel("circles-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "circles",
        },
        (payload) => {
          console.log("Circle change received:", payload);

          if (payload.eventType === "INSERT") {
            const newCircle = rowToCircle(payload.new as CircleRow);
            setCircles((prev) => [newCircle, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedCircle = rowToCircle(payload.new as CircleRow);
            setCircles((prev) =>
              prev.map((c) => (c.id === updatedCircle.id ? updatedCircle : c))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setCircles((prev) => prev.filter((c) => c.id !== deletedId));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "circle_members",
        },
        (payload) => {
          console.log("Member change received:", payload);
          // Refresh circles when membership changes
          fetchCircles();
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchCircles]);

  // User's circles (created by them or member of)
  const myCircles = circles.filter(
    (circle) => circle.createdBy === user?.id || myCircleIds.has(circle.id)
  );

  // Circles available for browsing
  const browseCircles = [
    ...defaultBrowseCircles,
    ...circles.filter(
      (c) => c.createdBy !== user?.id && !myCircleIds.has(c.id) && c.status !== "completed"
    ),
  ];

  // Create a new circle
  const createCircle = async (
    circleData: Omit<Circle, "id" | "createdAt" | "status" | "currentMembers" | "progress">
  ): Promise<Circle> => {
    if (!user?.id) {
      throw new Error("Must be logged in to create a circle");
    }

    const createdAt = new Date().toISOString();
    const inviteCode = generateCircleInviteCode(circleData.name, createdAt);

    const newCircleData = {
      ...circleData,
      createdBy: user.id,
      createdAt,
      status: "pending" as const,
      currentMembers: 1,
      progress: 0,
      emoji: circleData.emoji || getCircleEmoji(circleData.type),
      inviteCode,
    };

    const rowData = circleToRow(newCircleData);

    // Insert into Supabase
    const { data, error: insertError } = await supabase
      .from("circles")
      .insert(rowData)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating circle:", insertError);
      throw new Error(insertError.message);
    }

    const newCircle = rowToCircle(data as CircleRow);

    // Add creator as first member
    const { error: memberError } = await supabase.from("circle_members").insert({
      circle_id: newCircle.id,
      user_id: user.id,
      position: 1,
      role: "creator",
      status: "active",
    });

    if (memberError) {
      console.error("Error adding creator as member:", memberError);
    } else {
      setMyCircleIds((prev) => new Set([...prev, newCircle.id]));
    }

    // Add invited members if any
    if (circleData.invitedMembers && circleData.invitedMembers.length > 0) {
      const invitations = circleData.invitedMembers.map((member) => ({
        circle_id: newCircle.id,
        invited_by: user.id,
        name: member.name,
        phone: member.phone,
        status: "pending",
      }));

      const { error: inviteError } = await supabase
        .from("invited_members")
        .insert(invitations);

      if (inviteError) {
        console.error("Error adding invited members:", inviteError);
      }
    }

    return newCircle;
  };

  // Join an existing circle
  const joinCircle = async (circleId: string) => {
    if (!user?.id) {
      throw new Error("Must be logged in to join a circle");
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      throw new Error("Already a member of this circle");
    }

    // Get current member count to determine position
    const { data: circle } = await supabase
      .from("circles")
      .select("current_members")
      .eq("id", circleId)
      .single();

    const position = (circle?.current_members || 0) + 1;

    // Add as member
    const { error: memberError } = await supabase.from("circle_members").insert({
      circle_id: circleId,
      user_id: user.id,
      position,
      role: "member",
      status: "active",
    });

    if (memberError) {
      console.error("Error joining circle:", memberError);
      throw new Error(memberError.message);
    }

    setMyCircleIds((prev) => new Set([...prev, circleId]));
  };

  // Leave a circle
  const leaveCircle = async (circleId: string) => {
    if (!user?.id) {
      throw new Error("Must be logged in to leave a circle");
    }

    const { error: leaveError } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", circleId)
      .eq("user_id", user.id);

    if (leaveError) {
      console.error("Error leaving circle:", leaveError);
      throw new Error(leaveError.message);
    }

    setMyCircleIds((prev) => {
      const next = new Set(prev);
      next.delete(circleId);
      return next;
    });
  };

  // Refresh circles from database
  const refreshCircles = async () => {
    await fetchCircles();
  };

  // Generate invite code for a circle
  const generateInviteCode = (circle: Circle): string => {
    if (circle.inviteCode) return circle.inviteCode;
    return generateCircleInviteCode(circle.name, circle.createdAt);
  };

  // Get members of a circle with their profile info
  const getCircleMembers = async (circleId: string): Promise<CircleMember[]> => {
    try {
      // Fetch circle members with joined profile data
      const { data: membersData, error: membersError } = await supabase
        .from("circle_members")
        .select(`
          id,
          user_id,
          position,
          role,
          status,
          joined_at
        `)
        .eq("circle_id", circleId)
        .order("position", { ascending: true });

      if (membersError) {
        console.error("Error fetching circle members:", membersError);
        return [];
      }

      if (!membersData || membersData.length === 0) {
        return [];
      }

      // Get user IDs to fetch profiles
      const userIds = membersData.map((m: any) => m.user_id);

      // Fetch profiles for all members (handle missing xn_score column gracefully)
      let profilesData: any[] | null = null;
      let profilesError: any = null;

      // Try with xn_score first, fallback to without if column doesn't exist
      const result = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, xn_score")
        .in("id", userIds);

      if (result.error?.code === "42703") {
        // Column doesn't exist, try without xn_score
        const fallbackResult = await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .in("id", userIds);
        profilesData = fallbackResult.data;
        profilesError = fallbackResult.error;
      } else {
        profilesData = result.data;
        profilesError = result.error;
      }

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      // Create a map of profiles by user ID
      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      // Combine member data with profile data
      const members: CircleMember[] = membersData.map((member: any) => {
        const profile = profilesMap.get(member.user_id);
        const isCurrentUser = member.user_id === user?.id;

        return {
          id: member.id,
          odictId: member.user_id,
          name: isCurrentUser ? "You" : (profile?.full_name || profile?.email || "Unknown Member"),
          email: profile?.email,
          phone: profile?.phone,
          position: member.position || 0,
          role: member.role || "member",
          status: member.status || "active",
          xnScore: profile?.xn_score || 50,
          hasPaid: false, // TODO: Check contributions table
          joinedAt: member.joined_at,
          isCurrentUser,
        };
      });

      return members;
    } catch (err) {
      console.error("Error in getCircleMembers:", err);
      return [];
    }
  };

  // Get circle activities (contributions, joins, payouts)
  const getCircleActivities = async (circleId: string): Promise<CircleActivity[]> => {
    try {
      const activities: CircleActivity[] = [];

      // Get contributions
      const { data: contributions, error: contribError } = await supabase
        .from("contributions")
        .select(`
          id,
          user_id,
          amount,
          created_at,
          profiles!contributions_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("circle_id", circleId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (contribError) {
        console.error("Error fetching contributions:", contribError);
      } else if (contributions) {
        contributions.forEach((contrib: any) => {
          const isCurrentUser = contrib.user_id === user?.id;
          const profile = contrib.profiles;
          activities.push({
            id: contrib.id,
            type: "contribution",
            userId: contrib.user_id,
            userName: isCurrentUser ? "You" : (profile?.full_name || profile?.email || "Member"),
            amount: contrib.amount,
            timestamp: contrib.created_at,
            isCurrentUser,
          });
        });
      }

      // Get member joins
      const { data: members, error: membersError } = await supabase
        .from("circle_members")
        .select(`
          id,
          user_id,
          role,
          joined_at,
          profiles!circle_members_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("circle_id", circleId)
        .order("joined_at", { ascending: false });

      if (membersError) {
        console.error("Error fetching member joins:", membersError);
      } else if (members) {
        members.forEach((member: any) => {
          const isCurrentUser = member.user_id === user?.id;
          const profile = member.profiles;
          const isCreator = member.role === "creator";
          activities.push({
            id: `join-${member.id}`,
            type: isCreator ? "created" : "joined",
            userId: member.user_id,
            userName: isCurrentUser ? "You" : (profile?.full_name || profile?.email || "Member"),
            timestamp: member.joined_at,
            isCurrentUser,
          });
        });
      }

      // Get payouts
      const { data: payouts, error: payoutsError } = await supabase
        .from("payouts")
        .select(`
          id,
          recipient_id,
          amount,
          created_at,
          status,
          profiles!payouts_recipient_id_fkey (
            full_name,
            email
          )
        `)
        .eq("circle_id", circleId)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (payoutsError) {
        console.error("Error fetching payouts:", payoutsError);
      } else if (payouts) {
        payouts.forEach((payout: any) => {
          const isCurrentUser = payout.recipient_id === user?.id;
          const profile = payout.profiles;
          activities.push({
            id: `payout-${payout.id}`,
            type: "payout",
            userId: payout.recipient_id,
            userName: isCurrentUser ? "You" : (profile?.full_name || profile?.email || "Member"),
            amount: payout.amount,
            timestamp: payout.created_at,
            isCurrentUser,
          });
        });
      }

      // Sort all activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities;
    } catch (err) {
      console.error("Error in getCircleActivities:", err);
      return [];
    }
  };

  // Make a contribution to a circle
  const makeContribution = async (circleId: string, amount: number): Promise<void> => {
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase.from("contributions").insert({
      circle_id: circleId,
      user_id: user.id,
      amount,
      cycle_number: 1, // TODO: Get current cycle from circle
      status: "completed",
      payment_method: "wallet",
    });

    if (error) {
      console.error("Error making contribution:", error);
      throw new Error("Failed to make contribution");
    }

    // Refresh circles to update data
    await refreshCircles();
  };

  // Find circle by invite code (searches database)
  const findCircleByInviteCode = async (code: string): Promise<Circle | null> => {
    const codeUpper = code.toUpperCase().trim();

    // Search in database
    const { data, error: searchError } = await supabase
      .from("circles")
      .select("*")
      .ilike("invite_code", codeUpper)
      .single();

    if (searchError && searchError.code !== "PGRST116") {
      console.error("Error searching for circle:", searchError);
    }

    if (data) {
      return rowToCircle(data as CircleRow);
    }

    // Fallback: search in default browse circles
    for (const circle of defaultBrowseCircles) {
      const circleInviteCode = generateCircleInviteCode(circle.name, circle.createdAt);
      if (circleInviteCode === codeUpper) {
        return circle;
      }
    }

    // Partial match in database
    const { data: partialData } = await supabase
      .from("circles")
      .select("*")
      .ilike("invite_code", `${codeUpper.slice(0, 6)}%`)
      .limit(1)
      .single();

    if (partialData) {
      return rowToCircle(partialData as CircleRow);
    }

    return null;
  };

  return (
    <CirclesContext.Provider
      value={{
        circles,
        myCircles,
        browseCircles,
        isLoading,
        error,
        createCircle,
        joinCircle,
        refreshCircles,
        findCircleByInviteCode,
        generateInviteCode,
        leaveCircle,
        getCircleMembers,
        getCircleActivities,
        makeContribution,
      }}
    >
      {children}
    </CirclesContext.Provider>
  );
};
