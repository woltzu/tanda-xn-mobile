import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useStressScore, useStressIntervention } from "../hooks/useFinancialStressPrediction";
import { useStressActions } from "../hooks/useFinancialStressPrediction";
import type { StressStatus, StressTrend, SignalBreakdown } from "../hooks/useFinancialStressPrediction";

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BG = "#F5F7FA";

const STATUS_CONFIG: Record<StressStatus, { color: string; bg: string; label: string }> = {
  green: { color: "#10B981", bg: "rgba(16,185,129,0.1)", label: "Healthy" },
  yellow: { color: "#EAB308", bg: "rgba(234,179,8,0.1)", label: "Mild Stress" },
  orange: { color: "#F97316", bg: "rgba(249,115,22,0.1)", label: "Elevated Stress" },
  red: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "High Stress" },
};

const TREND_CONFIG: Record<NonNullable<StressTrend>, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  message: string;
}> = {
  improving: { icon: "trending-down", color: "#10B981", message: "Getting better!" },
  stable: { icon: "remove-outline", color: "#9CA3AF", message: "Holding steady" },
  worsening: { icon: "trending-up", color: "#EF4444", message: "Needs attention" },
};

type SignalKey = keyof SignalBreakdown;

const SIGNAL_META: Record<SignalKey, { name: string; weight: string; icon: keyof typeof Ionicons.glyphMap }> = {
  contribution_delay: { name: "Payment Timing", weight: "30% weight", icon: "time-outline" },
  ticket_language: { name: "Support Messages", weight: "35% weight", icon: "chatbubble-outline" },
  login_drop: { name: "App Activity", weight: "20% weight", icon: "log-in-outline" },
  early_payout_request: { name: "Payout Requests", weight: "15% weight", icon: "cash-outline" },
};

const TIPS = [
  "Pay contributions before the deadline to lower your timing signal",
  "Stay active in the app \u2014 regular logins show engagement",
  "Reach out to support if you need help \u2014 we\u2019re here for you",
];

function getSignalStatus(value: number): StressStatus {
  if (value <= 30) return "green";
  if (value <= 60) return "yellow";
  if (value <= 80) return "orange";
  return "red";
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StressScoreDashboardScreen() {
  const navigation = useNavigation<any>();
  const {
    currentScore, history, stressLevel, isAtRisk, trend,
    loading: scoreLoading, refresh: refreshScore,
  } = useStressScore();
  const {
    activeIntervention, hasActiveIntervention,
    loading: interventionLoading, refresh: refreshIntervention,
  } = useStressIntervention();
  const { acceptIntervention, declineIntervention, responding } = useStressActions();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshScore(), refreshIntervention()]);
    setRefreshing(false);
  }, [refreshScore, refreshIntervention]);

  const loading = scoreLoading && interventionLoading;

  // Derived values
  const status = (currentScore?.status ?? "green") as StressStatus;
  const score = currentScore?.stressScore ?? 0;
  const scoreDelta = currentScore?.scoreDelta ?? 0;
  const trendKey = (currentScore?.trend ?? "stable") as NonNullable<StressTrend>;
  const breakdown = currentScore?.signalBreakdown;
  const cfg = STATUS_CONFIG[status];
  const trendCfg = TREND_CONFIG[trendKey];

  // Chart data from history
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null;
    const CHART_W = Dimensions.get("window").width - 64;
    const CHART_H = 120;
    const scores = history.slice().reverse(); // oldest first
    const points = scores.map((s, i) => ({
      x: scores.length === 1 ? CHART_W / 2 : (i / (scores.length - 1)) * CHART_W,
      y: CHART_H - (s.stressScore / 100) * CHART_H,
      score: s.stressScore,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return { points, pathD, width: CHART_W, height: CHART_H };
  }, [history]);

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={styles.loadingText}>Loading your wellness data...</Text>
      </View>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAccept = async () => {
    if (!activeIntervention) return;
    try {
      await acceptIntervention(activeIntervention.id);
      refreshIntervention();
    } catch (err) {
      console.error("Accept intervention error:", err);
    }
  };

  const handleDecline = async () => {
    if (!activeIntervention) return;
    try {
      await declineIntervention(activeIntervention.id);
      refreshIntervention();
    } catch (err) {
      console.error("Decline intervention error:", err);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Wellness</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="information-circle-outline" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
        }
      >
        {/* ── Main Score Card ── */}
        <View style={styles.card}>
          <Text style={styles.scoreLabel}>Your Stress Score</Text>

          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: cfg.color }]}>{score}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          {/* Trend */}
          <View style={styles.trendContainer}>
            <View style={styles.trendRow}>
              <Ionicons name={trendCfg.icon} size={16} color={trendCfg.color} />
              <Text style={[styles.trendDelta, { color: trendCfg.color }]}>
                {scoreDelta > 0 ? "+" : ""}
                {scoreDelta} pts from last check
              </Text>
            </View>
            <Text style={styles.trendMessage}>{trendCfg.message}</Text>
          </View>
        </View>

        {/* ── Signal Breakdown ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's Contributing</Text>
          <Text style={styles.sectionSubtitle}>
            4 signals weighted to calculate your score
          </Text>

          {breakdown &&
            (Object.keys(SIGNAL_META) as SignalKey[]).map((key) => {
              const meta = SIGNAL_META[key];
              const component = breakdown[key];
              if (!component) return null;
              const sigStatus = getSignalStatus(component.raw_value);
              const sigColor = STATUS_CONFIG[sigStatus].color;

              return (
                <View key={key} style={styles.card}>
                  <View style={styles.signalHeader}>
                    <View style={styles.signalIconWrap}>
                      <Ionicons name={meta.icon} size={20} color={sigColor} />
                    </View>
                    <View style={styles.signalInfo}>
                      <Text style={styles.signalName}>{meta.name}</Text>
                      <Text style={styles.signalWeight}>{meta.weight}</Text>
                    </View>
                    <Text style={[styles.signalValue, { color: sigColor }]}>
                      {Math.round(component.raw_value)}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(component.raw_value, 100)}%`, backgroundColor: sigColor },
                      ]}
                    />
                  </View>

                  <Text style={styles.signalDetail}>
                    {component.signals_used} signal{component.signals_used !== 1 ? "s" : ""} used
                    {" \u2022 "}weighted {component.weighted_value.toFixed(1)} pts
                  </Text>
                </View>
              );
            })}
        </View>

        {/* ── Intervention Offer ── */}
        {hasActiveIntervention && activeIntervention && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support Available</Text>

            <View style={[styles.card, styles.interventionCard]}>
              <View style={styles.interventionIconWrap}>
                <Ionicons name="heart" size={24} color={TEAL} />
              </View>
              <Text style={styles.interventionTitle}>{activeIntervention.messageTitle}</Text>
              <Text style={styles.interventionBody}>{activeIntervention.messageBody}</Text>

              {/* Installment preview */}
              {activeIntervention.installmentAmounts &&
                activeIntervention.installmentAmounts.length > 0 && (
                  <View style={styles.installmentBox}>
                    {activeIntervention.installmentAmounts.map((item: any, i: number) => (
                      <View key={i} style={styles.installmentRow}>
                        <Text style={styles.installmentLabel}>Payment {i + 1}</Text>
                        <Text style={styles.installmentAmount}>
                          {typeof item === "number"
                            ? formatCents(item)
                            : item.amount ?? `$${item}`}
                        </Text>
                        {item.dueDate && (
                          <Text style={styles.installmentDate}>Due {item.dueDate}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

              {/* Action buttons */}
              <View style={styles.interventionActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={handleAccept}
                  disabled={responding}
                >
                  {responding ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.acceptBtnText}>Accept Plan</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={handleDecline}
                  disabled={responding}
                >
                  <Text style={styles.declineBtnText}>Not Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── Score History ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score History</Text>
          <Text style={styles.sectionSubtitle}>Last 14 days</Text>

          <View style={styles.card}>
            {chartData ? (
              <View style={styles.chartContainer}>
                <View style={{ width: chartData.width, height: chartData.height }}>
                  {/* Simple dot-line chart rendered with Views */}
                  {chartData.points.map((p, i) => {
                    const statusColor = STATUS_CONFIG[getSignalStatus(p.score)].color;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.chartDot,
                          {
                            left: p.x - 4,
                            top: p.y - 4,
                            backgroundColor: statusColor,
                          },
                        ]}
                      />
                    );
                  })}
                  {/* Connecting lines */}
                  {chartData.points.map((p, i) => {
                    if (i === 0) return null;
                    const prev = chartData.points[i - 1];
                    const dx = p.x - prev.x;
                    const dy = p.y - prev.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    return (
                      <View
                        key={`line-${i}`}
                        style={[
                          styles.chartLine,
                          {
                            left: prev.x,
                            top: prev.y - 1,
                            width: len,
                            transform: [{ rotate: `${angle}deg` }],
                            transformOrigin: "0 0",
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text style={styles.emptyChart}>No history data yet</Text>
            )}
          </View>
        </View>

        {/* ── Tips ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips to Improve</Text>

          {TIPS.map((tip, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.tipRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={TEAL}
                  style={styles.tipIcon}
                />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },

  // Header
  header: {
    backgroundColor: NAVY,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Section
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 14,
  },

  // Main Score
  scoreLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginTop: 4,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: "800",
  },
  scoreMax: {
    fontSize: 20,
    color: "#9CA3AF",
    marginLeft: 2,
  },

  // Status badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Trend
  trendContainer: {
    alignItems: "center",
    marginTop: 14,
    gap: 2,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendDelta: {
    fontSize: 13,
    fontWeight: "600",
  },
  trendMessage: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  // Signals
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  signalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  signalInfo: {
    flex: 1,
  },
  signalName: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  signalWeight: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  signalValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  signalDetail: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
  },

  // Intervention
  interventionCard: {
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.3)",
    alignItems: "center",
  },
  interventionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,198,174,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  interventionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
    marginBottom: 6,
  },
  interventionBody: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  installmentBox: {
    width: "100%",
    backgroundColor: "rgba(243,244,246,0.5)",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  installmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  installmentLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    flex: 1,
  },
  installmentAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
    flex: 1,
    textAlign: "center",
  },
  installmentDate: {
    fontSize: 13,
    color: "#9CA3AF",
    flex: 1,
    textAlign: "right",
  },
  interventionActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  declineBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "600",
  },

  // Chart
  chartContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  chartDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLine: {
    position: "absolute",
    height: 2,
    backgroundColor: "#EAB308",
  },
  emptyChart: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 24,
  },

  // Tips
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
});
