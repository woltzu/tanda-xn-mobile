import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Modal,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";
import { useFormDraft } from "../hooks/useFormDraft";
import { CircleDraft, CIRCLE_DRAFT_KEY } from "../lib/circleDraft";
import { supabase } from "../lib/supabase";
import { useCircleFormationCheck } from "../hooks/useConflictPrediction";

type CreateCircleSuccessNavigationProp = StackNavigationProp<RootStackParamList>;
type CreateCircleSuccessRouteProp = RouteProp<RootStackParamList, "CreateCircleSuccess">;

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
      return "🆘"; // Disaster Relief
    default:
      return "💰";
  }
};

export default function CreateCircleSuccessScreen() {
  const navigation = useNavigation<CreateCircleSuccessNavigationProp>();
  const route = useRoute<CreateCircleSuccessRouteProp>();
  const { createCircle } = useCircles();
  const { user } = useAuth();
  const circleSavedRef = useRef(false);
  const preflightStartedRef = useRef(false);
  const [createdCircleId, setCreatedCircleId] = useState<string | null>(null);

  // ── Conflict Prediction Engine: formation-time pairwise friction check ──
  // Phase D1 of feat(conflict): before we actually write the circle, run the
  // engine over (creator + resolvable invitee UUIDs) so member_pair_scores
  // and circle_formation_flags get rows. If any pair lands in Flag/Separate
  // tier, the admin sees a modal asking "Create anyway?" before save.
  //
  // Preflight states:
  //   'evaluating'      — resolving invitee UUIDs + running formation check
  //   'review-required' — flagged pairs exist; modal is showing
  //   'approved'        — admin chose to proceed (or check produced no flags)
  //   'saved'           — circle insert finished; show the success card
  type PreflightStatus = "evaluating" | "review-required" | "approved" | "saved";
  const [preflightStatus, setPreflightStatus] = useState<PreflightStatus>("evaluating");
  const { evaluation, evaluateFormation } = useCircleFormationCheck();

  const {
    circleType,
    name,
    amount,
    frequency,
    memberCount,
    startDate,
    rotationMethod,
    gracePeriodDays,
    invitedMembers,
    beneficiaryName,
    beneficiaryReason,
    beneficiaryPhone,
    beneficiaryCountry,
    isRecurring,
    totalCycles,
  } = route.params;

  // Cross-step draft: cleared below once the circle is created successfully.
  const { clearDraft } = useFormDraft<CircleDraft>(CIRCLE_DRAFT_KEY, { circleType });

  // Check if this is a family support or disaster relief circle
  const isFamilySupport = circleType === "family-support";
  const isDisasterRelief = circleType === "beneficiary";
  const monthlyPayout = amount * memberCount;
  const totalPayoutAllCycles = monthlyPayout * (totalCycles || 1);

  // Preflight runs once on mount: resolve invitee UUIDs → run formation
  // check. If review is required, the modal handles transition to save.
  // Otherwise we auto-advance to saving.
  useEffect(() => {
    if (preflightStartedRef.current) return;
    preflightStartedRef.current = true;
    runPreflight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the admin approves (or the check produced no flags), save the
  // circle exactly once. Mirrors the original one-shot guard.
  useEffect(() => {
    if (preflightStatus === "approved" && !circleSavedRef.current) {
      circleSavedRef.current = true;
      saveCircle().finally(() => setPreflightStatus("saved"));
    }
  }, [preflightStatus]);

  // Resolve as many invitee phone numbers as possible to TandaXn profile UUIDs.
  // Most device contacts won't match (they aren't TandaXn users yet); the
  // check still runs on the matching subset + the creator. If no one resolves
  // we end up with just [creator], which produces 0 pairs and the engine
  // no-ops cleanly — which is the correct behavior, not a bug.
  const resolveProposedMemberIds = async (): Promise<string[]> => {
    const creatorId = user?.id;
    if (!creatorId) return [];
    const phones = invitedMembers
      .map((m) => m.phone?.replace(/[^\d+]/g, ""))
      .filter((p): p is string => !!p && p.length >= 8);
    if (phones.length === 0) return [creatorId];
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, phone")
        .in("phone", phones);
      if (error) {
        console.warn("[preflight] phone→UUID lookup failed:", error.message);
        return [creatorId];
      }
      const matchedIds = (data ?? []).map((r: any) => r.id as string);
      // De-dupe with the creator's UUID (in case they invited themselves)
      return Array.from(new Set([creatorId, ...matchedIds]));
    } catch (err: any) {
      console.warn("[preflight] phone→UUID lookup threw:", err?.message);
      return [creatorId];
    }
  };

  const runPreflight = async () => {
    const ids = await resolveProposedMemberIds();
    // < 2 members → 0 pairs → no-op. Skip the engine entirely.
    if (ids.length < 2) {
      setPreflightStatus("approved");
      return;
    }
    try {
      const result = await evaluateFormation(ids);
      if (result?.requiresReview) {
        setPreflightStatus("review-required");
      } else {
        setPreflightStatus("approved");
      }
    } catch (err: any) {
      // Engine failure should NOT block circle creation — surfacing a
      // backend hiccup at "Create Circle" time would punish the user for
      // an internal monitoring system going down.
      console.warn("[preflight] formation check failed:", err?.message);
      setPreflightStatus("approved");
    }
  };

  // Admin chose to proceed despite flagged pairs
  const handleProceedDespiteFlags = () => {
    setPreflightStatus("approved");
  };

  // Admin chose to cancel — go back to the Invite step so they can adjust
  // the proposed member list. The wizard draft is intact so nothing is lost.
  const handleCancelFlags = () => {
    navigation.goBack();
  };

  const saveCircle = async () => {
    try {
      const newCircle = await createCircle({
        name,
        type: circleType as "traditional" | "goal-based" | "emergency" | "family-support" | "goal" | "beneficiary",
        amount,
        frequency: frequency as "daily" | "weekly" | "biweekly" | "monthly" | "one-time",
        memberCount,
        startDate,
        rotationMethod,
        gracePeriodDays,
        invitedMembers,
        createdBy: user?.id || "unknown",
        emoji: getCircleEmoji(circleType),
        description: beneficiaryName
          ? isRecurring && totalCycles && totalCycles > 1
            ? `Supporting ${beneficiaryName} — ${totalCycles} contributions`
            : `Supporting ${beneficiaryName}`
          : `${name} savings circle`,
        beneficiaryName,
        beneficiaryReason,
        isOneTime: frequency === "one-time",
        // Beneficiary circle specific fields
        beneficiaryPhone,
        beneficiaryCountry,
        isRecurring: isRecurring || false,
        totalCycles: totalCycles || 1,
        currentCycle: 1,
        payoutPerCycle: monthlyPayout,
        cyclesCompleted: 0,
        totalPayoutToDate: 0,
      });
      // Store the created circle ID for navigation
      setCreatedCircleId(newCircle.id);
      // Created successfully — clear the saved wizard draft so it won't
      // reappear next time. Inside the try, after success only: a failed
      // createCircle (catch below) leaves the draft intact for retry.
      clearDraft();
    } catch (error) {
      console.error("Error saving circle:", error);
    }
  };

  const circleEmoji = getCircleEmoji(circleType);

  // Generate a mock invite code
  const inviteCode = name.replace(/\s+/g, "").toUpperCase().slice(0, 6) + "2025";

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleViewCircle = () => {
    // Navigate to the circle detail screen with the created circle ID
    if (createdCircleId) {
      navigation.replace("CircleDetail", { circleId: createdCircleId });
    } else {
      // Fallback to circles tab if ID not available yet
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    }
  };

  const handleInviteMore = async () => {
    try {
      await Share.share({
        message: `You've been invited to join ${name} on TandaXn! Tap to join instantly: https://v0-tanda-xn.vercel.app/join/${inviteCode}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  // ── Conflict review modal ────────────────────────────────────────────
  // Renders when preflightStatus === "review-required". Lists flagged pairs
  // with friction tier + top contributing factor so the admin can make an
  // informed call. Two outcomes: proceed anyway or go back and edit members.
  const renderReviewModal = () => {
    const flagged = evaluation?.flag?.flaggedPairIds ?? [];
    const tier = evaluation?.circleTier ?? "clear";
    const highest = evaluation?.highestScore ?? 0;
    return (
      <Modal
        visible={preflightStatus === "review-required"}
        transparent
        animationType="fade"
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={28} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>Potential Friction Detected</Text>
            <Text style={styles.modalSubtitle}>
              Our compatibility check found {flagged.length} pair
              {flagged.length === 1 ? "" : "s"} that may have higher conflict
              risk. Circle tier: <Text style={styles.modalTierBold}>{tier.toUpperCase()}</Text>{" "}
              (highest pair score {Math.round(highest)}/100).
            </Text>

            <ScrollView style={styles.modalPairsList}>
              {flagged.slice(0, 5).map((p: any, idx: number) => (
                <View key={idx} style={styles.modalPairRow}>
                  <View style={[styles.modalTierDot, {
                    backgroundColor:
                      p.tier === "separate" ? "#DC2626" :
                      p.tier === "flag" ? "#EF4444" :
                      p.tier === "watch" ? "#F59E0B" : "#10B981",
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalPairScore}>
                      {Math.round(p.friction_score)}/100 — {p.tier}
                    </Text>
                    <Text style={styles.modalPairFactor}>
                      Top factor: {String(p.top_factor).replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>
              ))}
              {flagged.length > 5 && (
                <Text style={styles.modalMoreText}>
                  +{flagged.length - 5} more flagged pair
                  {flagged.length - 5 === 1 ? "" : "s"}
                </Text>
              )}
            </ScrollView>

            <Text style={styles.modalNote}>
              You can still create the circle. Flagged pairs will be monitored
              after formation; if scores escalate, you'll get an alert.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={handleCancelFlags}
              >
                <Text style={styles.modalCancelText}>Edit members</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalProceedBtn}
                onPress={handleProceedDespiteFlags}
              >
                <Text style={styles.modalProceedText}>Create anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Loading overlay covers the success card while preflight + save run.
  const isPreflighting = preflightStatus !== "saved";

  return (
    <View style={styles.container}>
      {renderReviewModal()}
      {isPreflighting && preflightStatus !== "review-required" && (
        <View style={styles.preflightOverlay}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.preflightText}>
            {preflightStatus === "evaluating"
              ? "Checking circle compatibility…"
              : "Creating your circle…"}
          </Text>
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          {/* Success Animation */}
          <View style={styles.successCircleOuter}>
            <View style={styles.successCircleInner}>
              <Ionicons name="checkmark" size={40} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.successTitle}>
            {isDisasterRelief
              ? "Fundraise Created! 🆘"
              : `${name.length > 20 ? name.slice(0, 20) + "…" : name} Created! ${circleEmoji}`}
          </Text>
          <Text style={styles.successSubtitle}>
            {beneficiaryName
              ? `Supporting ${beneficiaryName}${isRecurring && totalCycles ? ` — ${totalCycles} contributions` : ""}`
              : `${name} is ready to go`}
          </Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Circle Card */}
          <View style={styles.circleCard}>
            <View style={styles.circleIconContainer}>
              <Text style={styles.circleEmoji}>{circleEmoji}</Text>
            </View>
            <Text style={styles.circleName}>{name}</Text>
            <Text style={styles.circleDate}>Starting {formatDate(startDate)}</Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>${amount}</Text>
                <Text style={styles.statLabel}>
                  per {frequency === "biweekly" ? "2 wks" : frequency === "weekly" ? "week" : frequency === "daily" ? "day" : "cycle"}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{memberCount}+</Text>
                <Text style={styles.statLabel}>
                  {beneficiaryName ? "supporters" : "members"}
                </Text>
              </View>
              <View style={[styles.statItem, styles.statItemHighlight]}>
                <Text style={styles.statValueHighlight}>
                  ${monthlyPayout.toLocaleString()}+
                </Text>
                <Text style={styles.statLabel}>
                  {isRecurring ? `per ${frequency === "biweekly" ? "2 wks" : frequency === "weekly" ? "week" : "cycle"}` : isDisasterRelief ? "total raised" : "pot size"}
                </Text>
              </View>
            </View>

            {/* Recurring Support Info */}
            {isRecurring && totalCycles && totalCycles > 1 && (
              <View style={styles.recurringInfoContainer}>
                <View style={styles.recurringInfoRow}>
                  <Ionicons name="repeat" size={16} color="#00C6AE" />
                  <Text style={styles.recurringInfoText}>
                    {totalCycles} contributions
                  </Text>
                </View>
                <View style={styles.recurringTotalRow}>
                  <Text style={styles.recurringTotalLabel}>Total to {beneficiaryName}</Text>
                  <Text style={styles.recurringTotalValue}>
                    ${totalPayoutAllCycles.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {/* Invite Code */}
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCodeLabel}>Circle Invite Code</Text>
              <Text style={styles.inviteCode}>{inviteCode}</Text>
            </View>
          </View>

          {/* Invites Sent */}
          {invitedMembers.length > 0 && (
            <View style={styles.invitesSentCard}>
              <View style={styles.invitesSentIcon}>
                <Ionicons name="send" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.invitesSentText}>
                <Text style={styles.invitesSentTitle}>
                  {invitedMembers.length} invite
                  {invitedMembers.length > 1 ? "s" : ""} sent!
                </Text>
                <Text style={styles.invitesSentSubtitle}>
                  They'll receive a notification to join
                </Text>
              </View>
            </View>
          )}

          {/* Next Steps */}
          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>What's Next?</Text>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Wait for members to join</Text>
                <Text style={styles.stepDesc}>
                  Circle activates when members are ready
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, styles.stepNumberInactive]}>
                <Text style={styles.stepNumberTextInactive}>2</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Make your first contribution</Text>
                <Text style={styles.stepDesc}>Due on {formatDate(startDate)}</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, styles.stepNumberInactive]}>
                <Text style={styles.stepNumberTextInactive}>3</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Receive your payout</Text>
                <Text style={styles.stepDesc}>Based on rotation order</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.viewButton} onPress={handleViewCircle}>
          <Text style={styles.viewButtonText}>View Circle</Text>
        </TouchableOpacity>

        <View style={styles.secondaryButtons}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleInviteMore}>
            <Text style={styles.secondaryButtonText}>Invite More</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleDone}>
            <Text style={styles.secondaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 100,
    alignItems: "center",
  },
  successCircleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successCircleInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
  },
  content: {
    marginTop: -60,
    padding: 20,
    paddingBottom: 180,
  },
  circleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  circleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  circleEmoji: {
    fontSize: 28,
  },
  circleName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  circleDate: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    width: "100%",
  },
  statItem: {
    flex: 1,
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    alignItems: "center",
  },
  statItemHighlight: {
    backgroundColor: "#F0FDFB",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  statValueHighlight: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00C6AE",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  inviteCodeContainer: {
    backgroundColor: "#0A2342",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  invitesSentCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  invitesSentIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  invitesSentText: {
    flex: 1,
  },
  invitesSentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  invitesSentSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  nextStepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  nextStepsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberInactive: {
    backgroundColor: "#F5F7FA",
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#00C6AE",
  },
  stepNumberTextInactive: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  stepDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  viewButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButtons: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  // Recurring Beneficiary Styles
  recurringInfoContainer: {
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    marginBottom: 16,
  },
  recurringInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  recurringInfoText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00897B",
  },
  recurringTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,198,174,0.3)",
  },
  recurringTotalLabel: {
    fontSize: 13,
    color: "#065F46",
  },
  recurringTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  // ── Conflict Prediction preflight overlay + review modal ─────────────
  preflightOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(245,247,250,0.96)",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  preflightText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
  },
  modalIcon: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  modalTierBold: {
    fontWeight: "700",
    color: "#D97706",
  },
  modalPairsList: {
    maxHeight: 220,
    marginBottom: 12,
  },
  modalPairRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    marginBottom: 6,
  },
  modalTierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalPairScore: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  modalPairFactor: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  modalMoreText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 6,
  },
  modalNote: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  modalProceedBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#00C6AE",
    alignItems: "center",
  },
  modalProceedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
