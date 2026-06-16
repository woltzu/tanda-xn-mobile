import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { RealtimeChannel } from "@supabase/supabase-js";
import { createAutoPost } from "../lib/autoPost";

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
  // Trust premium score, 0–100. Either inherited from members' past
  // completed circles at creation time, or computed from this circle's
  // own contribution history when it completes (Step 2 of
  // feat(circle-reputation) #14).
  reputationScore?: number;
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

export type ContributionRecord = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  cycleNumber: number;
  status: "pending" | "completed" | "late" | "defaulted" | "failed";
  paymentMethod: string;
  createdAt: string;
  isCurrentUser: boolean;
  isLate: boolean;
  daysLate: number;
  lateFee: number;
};

export type PayoutScheduleEntry = {
  id: string;
  cycleNumber: number;
  recipientId: string;
  recipientName: string;
  scheduledDate: string;
  amount: number;
  status: string;
  isCurrentUser: boolean;
  positionInRotation: number;
};

export type MyContributionStatus = {
  hasPaid: boolean;
  totalContributed: number;
  position: number;
  role: "creator" | "admin" | "elder" | "member";
  payoutReceived: boolean;
  currentCyclePaid: boolean;
  nextDueDate: string | null;
};

export type InvitedMemberRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
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
  reputation_score?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// Circle type configurations
export const CIRCLE_TYPES = {
  traditional: {
    id: "traditional",
    name: "Rotating Pot",
    emoji: "🔄",
    description: "Classic ROSCA. Members contribute equally, one member receives the full pot each cycle.",
    features: ["Equal contributions", "Rotating payouts", "Fixed schedule"],
    popular: true,
  },
  "goal-based": {
    id: "goal-based",
    name: "Shared Goal",
    emoji: "🎯",
    description: "Everyone saves toward a common target. Funds are used together when the goal is reached.",
    features: ["Shared target", "Flexible amounts", "One-time or recurring"],
    popular: false,
  },
  emergency: {
    id: "emergency",
    name: "Emergency Pool",
    emoji: "🛡️",
    description: "Members contribute to a communal fund. Anyone can request withdrawals when needed.",
    features: ["Safety net", "Request-based", "Community support"],
    popular: false,
  },
  beneficiary: {
    id: "beneficiary",
    name: "Flexible Fundraise",
    emoji: "💝",
    description: "One-time campaign for a specific cause. Anyone can contribute any amount.",
    features: ["Community fundraising", "Any amount", "One-time campaign"],
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
  networkUserIds: Set<string>;
  createCircle: (circleData: Omit<Circle, "id" | "createdAt" | "status" | "currentMembers" | "progress">) => Promise<Circle>;
  joinCircle: (circleId: string, inviteCode?: string) => Promise<void>;
  refreshCircles: () => Promise<void>;
  findCircleByInviteCode: (code: string) => Promise<Circle | null>;
  generateInviteCode: (circle: Circle) => string;
  leaveCircle: (circleId: string) => Promise<void>;
  getCircleMembers: (circleId: string) => Promise<CircleMember[]>;
  getCircleActivities: (circleId: string) => Promise<CircleActivity[]>;
  makeContribution: (circleId: string, amount: number) => Promise<void>;
  // New methods for screen integration
  getCircleById: (circleId: string) => Circle | undefined;
  getContributions: (circleId: string, cycle?: number) => Promise<ContributionRecord[]>;
  getMyContributionStatus: (circleId: string) => Promise<MyContributionStatus>;
  getPayoutSchedule: (circleId: string) => Promise<PayoutScheduleEntry[]>;
  updateCircle: (circleId: string, data: Partial<Circle>) => Promise<void>;
  getPendingMembers: (circleId: string) => Promise<CircleMember[]>;
  approveMember: (memberId: string) => Promise<void>;
  rejectMember: (memberId: string) => Promise<void>;
  reportMember: (circleId: string, userId: string, reason: string, description: string) => Promise<void>;
  requestEmergencyWithdrawal: (circleId: string, reason: string, amount: number) => Promise<void>;
  getInvitedMembers: (circleId: string) => Promise<InvitedMemberRecord[]>;
  inviteMember: (circleId: string, name: string, phone: string, email?: string) => Promise<void>;
  getUserRole: (circleId: string) => Promise<"creator" | "admin" | "elder" | "member" | null>;
};

const CirclesContext = createContext<CirclesContextType | undefined>(undefined);

export const useCircles = () => {
  const context = useContext(CirclesContext);
  if (!context) {
    throw new Error("useCircles must be used within CirclesProvider");
  }
  return context;
};

// UUID validity check. Postgres throws 22P02 ("invalid input syntax for type
// uuid") when a non-UUID string reaches a uuid column. Guard query call sites
// that pass a circleId from UI/navigation — if a stale placeholder / browse
// shortcut / typo leaks in, we skip the query and warn instead of letting the
// error surface to the user.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (s: unknown): s is string =>
  typeof s === 'string' && UUID_RE.test(s);

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

// (Legacy `generateCircleInviteCode` removed — invite codes are now produced
// by the server-side `gen_invite_code` RPC inside migration 141, which yields
// a collision-resistant 8-char alphanumeric. Every newly-created circle has
// `invite_code` set at row-insert time, so client-side code generation is no
// longer needed.)

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
  // Supabase returns NUMERIC as string; coerce. Falls back to 0 for
  // older rows that haven't been migrated through Step 1 yet.
  reputationScore:
    row.reputation_score == null ? 0 : Number(row.reputation_score),
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
  const [networkUserIds, setNetworkUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs that mirror state, so the realtime callbacks (which capture state
  // via closure at subscribe time) can read the CURRENT set without going
  // stale after every membership change.
  const myCircleIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    myCircleIdsRef.current = myCircleIds;
  }, [myCircleIds]);

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

      // Fetch all user IDs from the user's circles (network = people in your circles)
      if (memberIds.size > 0) {
        const circleIdArray = Array.from(memberIds);
        const { data: networkData } = await supabase
          .from("circle_members")
          .select("user_id")
          .in("circle_id", circleIdArray)
          .neq("user_id", user?.id || "");

        if (networkData) {
          setNetworkUserIds(new Set(networkData.map((m: any) => m.user_id)));
        }
      } else {
        setNetworkUserIds(new Set());
      }
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
            // Upsert by id — never blindly prepend. `createCircle()` does
            // an optimistic local insert immediately after the RPC returns
            // (so the new row appears in My Circles before navigation
            // completes). The realtime channel then delivers the same row
            // moments later. Without this dedupe the same id ends up in
            // `circles` twice, which trips React's "duplicate key" warning
            // wherever the list is rendered (e.g. CirclesV2's My Circles).
            //
            // Prefer the realtime payload over the optimistic copy when
            // both exist — the realtime row reflects post-trigger state
            // (e.g. current_members already bumped by the
            // on_circle_member_change trigger), whereas the optimistic
            // copy is one step behind.
            setCircles((prev) => {
              const idx = prev.findIndex((c) => c.id === newCircle.id);
              if (idx === -1) return [newCircle, ...prev];
              const next = prev.slice();
              next[idx] = newCircle;
              return next;
            });
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
          // Targeted patch instead of full fetchCircles() — the prior
          // behaviour pulled the entire circles list on every single
          // member change, which got expensive in active circles and made
          // the UI feel laggy on join. We only need three things to
          // change locally:
          //   - myCircleIds when the change is about ME
          //   - networkUserIds when the change is about someone joining a
          //     circle I'm in
          //   - circles.current_members — already handled by the trigger
          //     -> circles table UPDATE event above
          if (payload.eventType === "INSERT") {
            const row = payload.new as { circle_id: string; user_id: string };
            if (row.user_id === user?.id) {
              setMyCircleIds((prev) => {
                if (prev.has(row.circle_id)) return prev;
                const next = new Set(prev);
                next.add(row.circle_id);
                return next;
              });
            } else if (myCircleIdsRef.current.has(row.circle_id)) {
              setNetworkUserIds((prev) => {
                if (prev.has(row.user_id)) return prev;
                const next = new Set(prev);
                next.add(row.user_id);
                return next;
              });
            }
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { circle_id: string; user_id: string };
            if (row.user_id === user?.id) {
              setMyCircleIds((prev) => {
                if (!prev.has(row.circle_id)) return prev;
                const next = new Set(prev);
                next.delete(row.circle_id);
                return next;
              });
            }
            // networkUserIds intentionally NOT pruned on a single delete —
            // the same uid could still share another circle with me.
            // Reconciled on next full fetchCircles() (e.g. cold start).
          }
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

  // Circles available for browsing (excludes user's own + already-joined + completed)
  const browseCircles = circles.filter(
    (c) => c.createdBy !== user?.id && !myCircleIds.has(c.id) && c.status !== "completed"
  );

  // Create a new circle — calls the atomic `create_circle` RPC (migration
  // 141). The RPC INSERTs `circles`, `circle_members` (creator at position 1),
  // and `invited_members` in a single transaction, generates a collision-
  // resistant invite code, and posts a system message to circle_messages.
  // The prior client-side 3-INSERT chain risked orphan circles if any
  // intermediate step failed.
  const createCircle = async (
    circleData: Omit<Circle, "id" | "createdAt" | "status" | "currentMembers" | "progress">
  ): Promise<Circle> => {
    if (!user?.id) {
      throw new Error("Must be logged in to create a circle");
    }

    // Build parallel arrays (phones, names) for the bulk invited_members
    // INSERT. The RPC will skip rows with empty phones.
    const invitees = circleData.invitedMembers ?? [];
    const phones = invitees.map((m) => m.phone ?? "");
    const names = invitees.map((m) => m.name ?? "");

    const { data, error: rpcError } = await supabase.rpc("create_circle", {
      p_type: circleData.type,
      p_name: circleData.name,
      p_amount: circleData.amount,
      p_frequency: circleData.frequency,
      p_member_count: circleData.memberCount,
      p_start_date: circleData.startDate || null,
      p_rotation_method: circleData.rotationMethod || "xnscore",
      p_grace_period_days: circleData.gracePeriodDays ?? 2,
      p_emoji: circleData.emoji || null,
      p_description: circleData.description || null,
      p_min_score: circleData.minScore ?? 0,
      p_invite_code: circleData.inviteCode || null,
      p_invited_phones: phones,
      p_invited_names: names,
    });

    if (rpcError) {
      console.error("[CirclesContext] create_circle RPC failed:", rpcError);
      throw new Error(rpcError.message || "create_failed");
    }

    const row = Array.isArray(data) ? data[0] : data;
    const newCircleId: string | undefined = row?.circle_id;
    if (!newCircleId) {
      throw new Error("create_failed");
    }

    // Fetch the full circle row so we can return a complete Circle object
    // to the caller (the success screen needs invite_code, defaults, etc.).
    // The realtime subscription will also patch local state shortly, but
    // we don't want to race the caller's navigation.
    const { data: full, error: fetchErr } = await supabase
      .from("circles")
      .select("*")
      .eq("id", newCircleId)
      .single();

    if (fetchErr || !full) {
      console.error("[CirclesContext] post-create fetch failed:", fetchErr);
      throw new Error(fetchErr?.message || "circle_fetch_failed");
    }

    const newCircle = rowToCircle(full as CircleRow);

    // Push the new row into local state immediately so the Circles tab
    // and HomeScreen pick it up on the next render. The realtime channel
    // would normally do this via the postgres_changes INSERT event, but
    // a few-hundred-ms lag can cause the user to navigate back and see
    // "no circles" — confusing. De-dup against the optimistic insert is
    // handled in the realtime handler (which prepends but never errors).
    setCircles((prev) =>
      prev.some((c) => c.id === newCircle.id) ? prev : [newCircle, ...prev],
    );
    setMyCircleIds((prev) => new Set([...prev, newCircleId]));
    return newCircle;
  };

  // Join an existing circle — calls the atomic `join_circle` RPC (migration
  // 141). The RPC locks the circles row FOR UPDATE, validates capacity +
  // min_score + invite code, atomically inserts circle_members + increments
  // current_members, and posts the "X joined the circle" system message
  // that the prior path silently dropped.
  const joinCircle = async (circleId: string, inviteCode?: string) => {
    if (!user?.id) {
      throw new Error("Must be logged in to join a circle");
    }

    const { data, error: rpcError } = await supabase.rpc("join_circle", {
      p_circle_id: circleId,
      p_invite_code: inviteCode || null,
    });

    if (rpcError) {
      console.error("[CirclesContext] join_circle RPC failed:", rpcError);
      // Map typed RPC exceptions to typed error messages the UI can switch on.
      const msg = (rpcError.message || "").toLowerCase();
      if (msg.includes("circle_full")) throw new Error("circle_full");
      if (msg.includes("min_score_not_met")) throw new Error("min_score_not_met");
      if (msg.includes("invalid_invite_code")) throw new Error("invalid_invite_code");
      if (msg.includes("circle_not_found")) throw new Error("circle_not_found");
      if (msg.includes("circle_not_joinable")) throw new Error("circle_not_joinable");
      throw new Error(rpcError.message || "join_failed");
    }

    setMyCircleIds((prev) => new Set([...prev, circleId]));

    // Auto-post: Joined a circle (fire-and-forget, never blocks join)
    try {
      if (user?.id) {
        const joinedCircle = circles.find((c) => c.id === circleId);
        createAutoPost(user.id, "circle_joined", circleId, "circle", {
          circleName: joinedCircle?.name || "a savings circle",
        });
      }
    } catch (autoPostErr) {
      console.warn("[AutoPost] Failed to auto-post circle join:", autoPostErr);
    }
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
  // Returns the server-generated invite code stored on the circle row.
  // Pre-migration-141 rows may have a synthesized code in this column;
  // newly-created circles get a `gen_invite_code()` result at insert time.
  const generateInviteCode = (circle: Circle): string => {
    return circle.inviteCode ?? "";
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

      // Fetch current cycle contributions to determine hasPaid status
      const circleData = circles.find(c => c.id === circleId);
      const currentCycle = circleData?.currentCycle || 1;
      const { data: cycleContributions } = await supabase
        .from("circle_contributions")
        .select("user_id")
        .eq("circle_id", circleId)
        .eq("cycle_number", currentCycle)
        .eq("status", "completed");

      const paidUserIds = new Set(
        (cycleContributions || []).map((c: any) => c.user_id)
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
          hasPaid: paidUserIds.has(member.user_id),
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
    if (!isValidUuid(circleId)) {
      console.warn(`[CirclesContext] getCircleActivities: invalid circleId ${JSON.stringify(circleId)} — skipping queries`);
      return [];
    }
    try {
      const activities: CircleActivity[] = [];

      // Get contributions
      const { data: contributions, error: contribError } = await supabase
        .from("circle_contributions")
        .select(`
          id,
          user_id,
          amount,
          created_at,
          profiles!circle_contributions_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("circle_id", circleId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (contribError) {
        console.error("[CirclesContext] circle_contributions query failed:", contribError);
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
        .from("circle_payouts")
        .select(`
          id,
          recipient_id,
          amount,
          created_at,
          status,
          profiles!circle_payouts_recipient_id_fkey (
            full_name,
            email
          )
        `)
        .eq("circle_id", circleId)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (payoutsError) {
        console.error("[CirclesContext] circle_payouts query failed:", payoutsError);
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

    // Get current cycle from circle data
    const circle = circles.find(c => c.id === circleId);
    const cycleNumber = circle?.currentCycle || 1;

    // Resolve due_date — circle_contributions.due_date is NOT NULL. Prefer the
    // circle's next upcoming/active scheduled date (contribution_schedules is
    // per-circle, not per-member, so we use the same "earliest active" pattern
    // as getMyContributionStatus). Falls back to today if no schedule row exists.
    let dueDate = new Date().toISOString().split('T')[0];
    const { data: nextSchedule } = await supabase
      .from("contribution_schedules")
      .select("due_date")
      .eq("circle_id", circleId)
      .in("status", ["upcoming", "active"])
      .order("due_date", { ascending: true })
      .limit(1);
    if (nextSchedule && nextSchedule[0]?.due_date) {
      dueDate = nextSchedule[0].due_date;
    }

    const { error } = await supabase.from("circle_contributions").insert({
      circle_id: circleId,
      user_id: user.id,
      amount,
      cycle_number: cycleNumber,
      due_date: dueDate,
      status: "paid",
      payment_method: "wallet",
    });

    if (error) {
      console.error("Error making contribution:", error);
      throw new Error("Failed to make contribution");
    }

    // Auto-post: Made a contribution (fire-and-forget)
    try {
      if (user?.id) {
        const circle = circles.find(c => c.id === circleId);
        createAutoPost(user.id, "contribution", circleId, "circle", {
          circleName: circle?.name || "a savings circle",
          amount,
        });
      }
    } catch (autoPostErr) {
      console.warn("[AutoPost] Failed to auto-post contribution:", autoPostErr);
    }

    // Refresh circles to update data
    await refreshCircles();
  };

  // Find circle by invite code — EXACT match only. The previous version
  // had a partial-prefix fallback (any code whose first 6 chars matched)
  // which created a real wrong-circle-by-typo risk for a money-pooling
  // tool: a typo in the last two characters could resolve to a completely
  // unrelated circle. With server-generated 8-char codes from migration
  // 141's `gen_invite_code` (32^8 keyspace), collisions are vanishingly
  // unlikely — exact-match is the right semantics. The UI surfaces a clean
  // "Invite code not found" message when nothing matches.
  const findCircleByInviteCode = async (code: string): Promise<Circle | null> => {
    const codeUpper = code.toUpperCase().trim();
    if (!codeUpper) return null;

    const { data, error: searchError } = await supabase
      .from("circles")
      .select("*")
      .eq("invite_code", codeUpper)
      .maybeSingle();

    if (searchError) {
      console.error("[CirclesContext] findCircleByInviteCode failed:", searchError);
      return null;
    }
    return data ? rowToCircle(data as CircleRow) : null;
  };

  // ================================================================
  // NEW METHODS — Screen Integration
  // ================================================================

  // Synchronous lookup from in-memory circles
  const getCircleById = (circleId: string): Circle | undefined => {
    return circles.find(c => c.id === circleId);
  };

  // Fetch contributions for a circle, optionally filtered by cycle
  const getContributions = async (circleId: string, cycle?: number): Promise<ContributionRecord[]> => {
    if (!isValidUuid(circleId)) {
      console.warn(`[CirclesContext] getContributions: invalid circleId ${JSON.stringify(circleId)} — skipping query`);
      return [];
    }
    try {
      let query = supabase
        .from("circle_contributions")
        .select(`
          id, user_id, amount, cycle_number, status, payment_method,
          created_at, is_late, days_late, late_fee
        `)
        .eq("circle_id", circleId)
        .order("created_at", { ascending: false });

      if (cycle !== undefined) {
        query = query.eq("cycle_number", cycle);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error("Error fetching contributions:", fetchError);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Get profiles for all user_ids
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return data.map((row: any) => {
        const profile = profileMap.get(row.user_id);
        const isCurrentUser = row.user_id === user?.id;
        return {
          id: row.id,
          userId: row.user_id,
          userName: isCurrentUser ? "You" : (profile?.full_name || profile?.email || "Member"),
          amount: row.amount,
          cycleNumber: row.cycle_number,
          status: row.status,
          paymentMethod: row.payment_method || "wallet",
          createdAt: row.created_at,
          isCurrentUser,
          isLate: row.is_late || false,
          daysLate: row.days_late || 0,
          lateFee: row.late_fee || 0,
        };
      });
    } catch (err) {
      console.error("Error in getContributions:", err);
      return [];
    }
  };

  // Get current user's contribution status for a specific circle
  const getMyContributionStatus = async (circleId: string): Promise<MyContributionStatus> => {
    const defaultStatus: MyContributionStatus = {
      hasPaid: false,
      totalContributed: 0,
      position: 0,
      role: "member",
      payoutReceived: false,
      currentCyclePaid: false,
      nextDueDate: null,
    };

    if (!user?.id) return defaultStatus;

    try {
      // Get member record
      const { data: memberData } = await supabase
        .from("circle_members")
        .select("position, role, payout_received, total_amount_paid")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .single();

      if (!memberData) return defaultStatus;

      // Get circle current cycle
      const circle = circles.find(c => c.id === circleId);
      const currentCycle = circle?.currentCycle || 1;

      // Check if paid this cycle
      const { data: cyclePaid } = await supabase
        .from("circle_contributions")
        .select("id")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .eq("cycle_number", currentCycle)
        .eq("status", "completed")
        .limit(1);

      // Get total contributed
      const { data: totalData } = await supabase
        .from("circle_contributions")
        .select("amount")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .eq("status", "completed");

      const totalContributed = (totalData || []).reduce((sum: number, c: any) => sum + c.amount, 0);

      // Get next due date from contribution_schedules
      const { data: nextSchedule } = await supabase
        .from("contribution_schedules")
        .select("due_date")
        .eq("circle_id", circleId)
        .in("status", ["upcoming", "active"])
        .order("due_date", { ascending: true })
        .limit(1);

      return {
        hasPaid: (cyclePaid && cyclePaid.length > 0) || false,
        totalContributed,
        position: memberData.position || 0,
        role: memberData.role || "member",
        payoutReceived: memberData.payout_received || false,
        currentCyclePaid: (cyclePaid && cyclePaid.length > 0) || false,
        nextDueDate: nextSchedule?.[0]?.due_date || null,
      };
    } catch (err) {
      console.error("Error in getMyContributionStatus:", err);
      return defaultStatus;
    }
  };

  // Fetch payout schedule for a circle
  const getPayoutSchedule = async (circleId: string): Promise<PayoutScheduleEntry[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from("payout_schedules")
        .select("id, cycle_number, recipient_id, scheduled_date, position_in_rotation, status")
        .eq("circle_id", circleId)
        .order("cycle_number", { ascending: true });

      if (fetchError) {
        console.error("Error fetching payout schedule:", fetchError);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Get profiles for recipients
      const recipientIds = [...new Set(data.map((p: any) => p.recipient_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", recipientIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const circle = circles.find(c => c.id === circleId);
      const payoutAmount = circle ? circle.amount * circle.currentMembers : 0;

      return data.map((row: any) => {
        const profile = profileMap.get(row.recipient_id);
        const isCurrentUser = row.recipient_id === user?.id;
        return {
          id: row.id,
          cycleNumber: row.cycle_number,
          recipientId: row.recipient_id,
          recipientName: isCurrentUser ? "You" : (profile?.full_name || profile?.email || "TBD"),
          scheduledDate: row.scheduled_date,
          amount: payoutAmount,
          status: row.status || "scheduled",
          isCurrentUser,
          positionInRotation: row.position_in_rotation || row.cycle_number,
        };
      });
    } catch (err) {
      console.error("Error in getPayoutSchedule:", err);
      return [];
    }
  };

  // Update circle settings (admin only)
  const updateCircle = async (circleId: string, data: Partial<Circle>): Promise<void> => {
    if (!user?.id) throw new Error("Must be logged in");

    const rowData = circleToRow(data);
    const { error: updateError } = await supabase
      .from("circles")
      .update(rowData)
      .eq("id", circleId);

    if (updateError) {
      console.error("Error updating circle:", updateError);
      throw new Error(updateError.message);
    }

    // Real-time subscription will update local state
  };

  // Get pending join requests for a circle
  const getPendingMembers = async (circleId: string): Promise<CircleMember[]> => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from("circle_members")
        .select("id, user_id, position, role, status, joined_at")
        .eq("circle_id", circleId)
        .eq("status", "pending")
        .order("joined_at", { ascending: true });

      if (membersError || !membersData) return [];

      const userIds = membersData.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, xn_score")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return membersData.map((member: any) => {
        const profile = profileMap.get(member.user_id);
        return {
          id: member.id,
          odictId: member.user_id,
          name: profile?.full_name || profile?.email || "Unknown",
          email: profile?.email,
          phone: profile?.phone,
          position: member.position || 0,
          role: member.role || "member",
          status: member.status,
          xnScore: profile?.xn_score || 50,
          hasPaid: false,
          joinedAt: member.joined_at,
          isCurrentUser: member.user_id === user?.id,
        };
      });
    } catch (err) {
      console.error("Error in getPendingMembers:", err);
      return [];
    }
  };

  // Approve a pending member
  const approveMember = async (memberId: string): Promise<void> => {
    const { error: approveError } = await supabase
      .from("circle_members")
      .update({ status: "active" })
      .eq("id", memberId);

    if (approveError) {
      console.error("Error approving member:", approveError);
      throw new Error(approveError.message);
    }
  };

  // Reject a pending member
  const rejectMember = async (memberId: string): Promise<void> => {
    const { error: rejectError } = await supabase
      .from("circle_members")
      .delete()
      .eq("id", memberId);

    if (rejectError) {
      console.error("Error rejecting member:", rejectError);
      throw new Error(rejectError.message);
    }
  };

  // Report a member (creates dispute)
  //
  // Conflict P0 (2026-06-12) — after the dispute row lands, we fan out a
  // best-effort `notifications.insert` to every elder of the circle so
  // someone is actually told there's a case to work on. The previous
  // path was silent: rows piled up in `disputes` and elders only saw
  // them by happening to open Elder Dashboard.
  //
  // The notifications surface is the existing `notifications` table
  // (cols: user_id, type, title, body, data jsonb, …). A push-delivery
  // layer can later read from this table without changing the call
  // sites here. We swallow notification errors so a delivery glitch
  // doesn't roll back the dispute itself.
  const reportMember = async (
    circleId: string,
    userId: string,
    reason: string,
    description: string
  ): Promise<void> => {
    if (!user?.id) throw new Error("Must be logged in");

    const { data: disputeRow, error: reportError } = await supabase
      .from("disputes")
      .insert({
        reporter_user_id: user.id,
        against_user_id: userId,
        circle_id: circleId,
        type: reason,
        title: `Report: ${reason}`,
        description,
        priority: "medium",
        status: "open",
      })
      .select("id")
      .single();

    if (reportError) {
      console.error("Error reporting member:", reportError);
      throw new Error(reportError.message);
    }

    // Best-effort elder notification — non-fatal on failure.
    try {
      const [{ data: elders }, { data: circleRow }] = await Promise.all([
        supabase
          .from("circle_members")
          .select("user_id")
          .eq("circle_id", circleId)
          .eq("role", "elder"),
        supabase
          .from("circles")
          .select("name")
          .eq("id", circleId)
          .maybeSingle(),
      ]);

      const elderIds = (elders ?? []).map((e: any) => e.user_id as string);
      const circleName = (circleRow as any)?.name ?? "your circle";

      if (elderIds.length > 0) {
        const rows = elderIds.map((elderId) => ({
          user_id: elderId,
          type: "dispute_filed",
          title: "New dispute reported",
          body: `A member reported a dispute in ${circleName}.`,
          data: {
            circle_id: circleId,
            circle_name: circleName,
            dispute_id: (disputeRow as any)?.id,
            reporter_user_id: user.id,
            against_user_id: userId,
            reason,
          },
          read: false,
        }));

        const { error: notifyError } = await supabase
          .from("notifications")
          .insert(rows);
        if (notifyError) {
          // Log and move on — the dispute itself is already filed and
          // discoverable via Elder Dashboard polling. A real push
          // delivery layer (FCM/APNs/Expo) can read from the
          // notifications table out-of-band.
          console.warn(
            "[reportMember] elder notifications insert failed:",
            notifyError.message,
          );
        }
      } else {
        // No elders in this circle — flag for product to fix the
        // governance setup. The dispute itself is still filed.
        console.warn(
          `[reportMember] circle ${circleId} has no elders to notify`,
        );
      }
    } catch (e: any) {
      console.warn(
        "[reportMember] elder notification fan-out failed:",
        e?.message ?? e,
      );
    }
  };

  // Request emergency withdrawal
  const requestEmergencyWithdrawal = async (
    circleId: string,
    reason: string,
    amount: number
  ): Promise<void> => {
    if (!user?.id) throw new Error("Must be logged in");

    const { error: withdrawError } = await supabase.from("payout_requests").insert({
      user_id: user.id,
      amount,
      currency: "USD",
      status: "pending",
      requires_approval: true,
      notes: `Emergency withdrawal: ${reason}`,
    });

    if (withdrawError) {
      console.error("Error requesting withdrawal:", withdrawError);
      throw new Error(withdrawError.message);
    }
  };

  // Get invited members for a circle
  const getInvitedMembers = async (circleId: string): Promise<InvitedMemberRecord[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from("invited_members")
        .select("id, name, phone, email, status, created_at")
        .eq("circle_id", circleId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching invited members:", fetchError);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error("Error in getInvitedMembers:", err);
      return [];
    }
  };

  // Invite a member to a circle
  const inviteMember = async (
    circleId: string,
    name: string,
    phone: string,
    email?: string
  ): Promise<void> => {
    if (!user?.id) throw new Error("Must be logged in");

    const { error: inviteError } = await supabase.from("invited_members").insert({
      circle_id: circleId,
      invited_by: user.id,
      name,
      phone,
      email: email || null,
      status: "pending",
    });

    if (inviteError) {
      console.error("Error inviting member:", inviteError);
      throw new Error(inviteError.message);
    }
  };

  // Get current user's role in a circle
  const getUserRole = async (
    circleId: string
  ): Promise<"creator" | "admin" | "elder" | "member" | null> => {
    if (!user?.id) return null;

    try {
      const { data } = await supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .single();

      return data?.role || null;
    } catch {
      return null;
    }
  };

  return (
    <CirclesContext.Provider
      value={{
        circles,
        myCircles,
        browseCircles,
        isLoading,
        error,
        networkUserIds,
        createCircle,
        joinCircle,
        refreshCircles,
        findCircleByInviteCode,
        generateInviteCode,
        leaveCircle,
        getCircleMembers,
        getCircleActivities,
        makeContribution,
        getCircleById,
        getContributions,
        getMyContributionStatus,
        getPayoutSchedule,
        updateCircle,
        getPendingMembers,
        approveMember,
        rejectMember,
        reportMember,
        requestEmergencyWithdrawal,
        getInvitedMembers,
        inviteMember,
        getUserRole,
      }}
    >
      {children}
    </CirclesContext.Provider>
  );
};
