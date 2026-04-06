import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  useMoodScore,
  useMoodIntervention,
  useMoodActions,
  type MoodTier,
  type MoodSignalBreakdown,
} from "../hooks/useContributionMoodDetection";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MoodTier,
  { color: string; bgColor: string; label: string; emoji: string }
> = {
  stable: { color: "#22C55E", bgColor: "#22C55E1A", label: "Feeling Good", emoji: "\u{1F60A}" },
  drifting: { color: "#EAB308", bgColor: "#EAB3081A", label: "Slight Change", emoji: "\u{1F610}" },
  disengaging: { color: "#F97316", bgColor: "#F973161A", label: "Pulling Back", emoji: "\u{1F614}" },
  at_risk: { color: "#EF4444", bgColor: "#EF44441A", label: "Needs Support", emoji: "\u{1F198}" },
};

// ─── Signal display mapping ──────────────────────────────────────────────────

type SignalKey = keyof MoodSignalBreakdown;

const SIGNAL_META: Record<SignalKey, { label: string; weightKey: string }> = {
  polarity: { label: "Message Sentiment", weightKey: "weight" },
  lexical: { label: "Message Complexity", weightKey: "weight" },
  keyword: { label: "Stress Keywords", weightKey: "weight" },
  latency: { label: "Response Time", weightKey: "weight" },
  length: { label: "Message Length", weightKey: "weight" },
};

function getBarColor(value: number): string {
  if (value > 50) return "#F97316";
  if (value > 30) return "#EAB308";
  return "#22C55E";
}

function getSentimentColor(score: number): string {
  if (score > 50) return "#F97316";
  if (score > 30) return "#EAB308";
  return "#22C55E";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MoodInsightsScreen() {
  const navigation = useNavigation<any>();
  const {
    currentSnapshot,
    history,
    baseline,
    tier,
    loading: scoreLoading,
    refresh: refreshScore,
  } = useMoodScore();
  const {
    activeIntervention,
    loading: interventionLoading,
    refresh: refreshIntervention,
  } = useMoodIntervention();
  const { setOptOut, acceptIntervention, declineIntervention, responding } = useMoodActions();

  const [optedOut, setOptedOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loading = scoreLoading || interventionLoading;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshScore(), refreshIntervention()]);
    setRefreshing(false);
  }, [refreshScore, refreshIntervention]);

  const handleOptToggle = useCallback(async (value: boolean) => {
    const newOptedOut = !value;
    setOptedOut(newOptedOut);
    try {
      await setOptOut(newOptedOut);
    } catch {
      setOptedOut(!newOptedOut);
    }
  }, [setOptOut]);

  const config = STATUS_CONFIG[tier];
  const score = currentSnapshot?.compositeMoodScore ?? 0;
  const signals = currentSnapshot?.signalBreakdown;
  const baselineScore = baseline?.isEstablished
    ? Math.round(
        ((baseline as any).baselinePolarity ?? 0 +
          (baseline as any).baselineLexical ?? 0) / 2
      )
    : null;

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading && !currentSnapshot) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={styles.loadingText}>Loading mood insights...</Text>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={[NAVY, "#0D2B50"]} style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mood Insights</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="shield-checkmark" size={24} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Privacy Banner */}
      <View style={styles.privacyBanner}>
        <Ionicons name="lock-closed" size={14} color={TEAL} />
        <Text style={styles.privacyText}>
          Your mood data is private. Only you can see this.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
        }
      >
        {/* Main Mood Card */}
        <View style={styles.card}>
          <View style={styles.moodCardInner}>
            <Text style={styles.moodEmoji}>{config.emoji}</Text>
            <Text style={styles.moodLabel}>Mood Drift Score</Text>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreValue, { color: config.color }]}>
                {Math.round(score)}
              </Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: config.bgColor }]}>
              <View style={[styles.statusDot, { backgroundColor: config.color }]} />
              <Text style={[styles.statusLabel, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
            {baselineScore !== null && (
              <Text style={styles.baselineText}>
                Your baseline: {baselineScore} (lower is calmer)
              </Text>
            )}
          </View>
        </View>

        {/* Signal Breakdown */}
        {signals && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What We're Noticing</Text>
            <Text style={styles.sectionSubtitle}>
              Based on your circle messages (anonymized analysis)
            </Text>

            {(Object.keys(SIGNAL_META) as SignalKey[]).map((key) => {
              const signal = signals[key];
              const meta = SIGNAL_META[key];
              const normalized = signal.normalized ?? 0;
              const weight = signal.weight ?? 0;

              return (
                <View key={key} style={styles.signalCard}>
                  <View style={styles.signalLeft}>
                    <Text style={styles.signalLabel}>{meta.label}</Text>
                    <Text style={styles.signalWeight}>
                      {Math.round(weight * 100)}% weight
                    </Text>
                  </View>
                  <View style={styles.signalBarTrack}>
                    <View
                      style={[
                        styles.signalBarFill,
                        {
                          width: `${Math.min(normalized, 100)}%`,
                          backgroundColor: getBarColor(normalized),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.signalValue}>{Math.round(normalized)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Sentiment Timeline */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Sentiment</Text>
            <View style={styles.card}>
              {history.slice(0, 6).map((snap, i) => {
                const isLast = i === Math.min(history.length, 6) - 1;
                return (
                  <View
                    key={snap.id}
                    style={[
                      styles.timelineRow,
                      !isLast && styles.timelineRowBorder,
                    ]}
                  >
                    <Text style={styles.timelineDate}>
                      {formatDate(snap.snapshotDate)}
                    </Text>
                    <View
                      style={[
                        styles.sentimentDot,
                        { backgroundColor: getSentimentColor(snap.compositeMoodScore) },
                      ]}
                    />
                    <Text style={styles.timelineMood}>
                      {STATUS_CONFIG[snap.tier]?.label ?? snap.tier}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Intervention Card */}
        {activeIntervention && !optedOut && (
          <View style={styles.section}>
            <View style={styles.interventionCard}>
              <Ionicons name="heart" size={28} color={TEAL} />
              <Text style={styles.interventionTitle}>
                {activeIntervention.messageTitle}
              </Text>
              <Text style={styles.interventionBody}>
                {activeIntervention.messageBody}
              </Text>
              <View style={styles.interventionActions}>
                <TouchableOpacity
                  style={styles.interventionBtnSecondary}
                  disabled={responding}
                  onPress={() => declineIntervention(activeIntervention.id)}
                >
                  <Text style={styles.interventionBtnSecondaryText}>
                    I'm fine, thanks
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.interventionBtnPrimary}
                  disabled={responding}
                  onPress={() => acceptIntervention(activeIntervention.id)}
                >
                  <Text style={styles.interventionBtnPrimaryText}>
                    Connect me with an elder
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Opt-Out Toggle */}
        <View style={[styles.card, styles.optOutCard]}>
          <View style={styles.optOutLeft}>
            <Text style={styles.optOutTitle}>Mood Analysis</Text>
            <Text style={styles.optOutSub}>
              {optedOut
                ? "Mood tracking is paused"
                : "Analyzing your circle messages for mood patterns"}
            </Text>
          </View>
          <Switch
            value={!optedOut}
            onValueChange={handleOptToggle}
            trackColor={{ false: "#D1D5DB", true: TEAL }}
            thumbColor="#FFF"
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BG = "#F5F7FA";
const MUTED = "#6B7280";

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: MUTED,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerBtn: {
    padding: 4,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },

  // Privacy Banner
  privacyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TEAL + "1A",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: "500",
    color: TEAL,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 24,
  },

  // Cards
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },

  // Main Mood Card
  moodCardInner: {
    alignItems: "center",
    padding: 24,
  },
  moodEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "800",
  },
  scoreMax: {
    fontSize: 18,
    color: MUTED,
    marginLeft: 4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  baselineText: {
    marginTop: 12,
    fontSize: 12,
    color: MUTED,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 4,
  },

  // Signal breakdown
  signalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  signalLeft: {
    width: 110,
  },
  signalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
  },
  signalWeight: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  signalBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  signalBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  signalValue: {
    width: 32,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
  },

  // Timeline
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  timelineRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  timelineDate: {
    width: 48,
    fontSize: 13,
    color: MUTED,
  },
  sentimentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineMood: {
    flex: 1,
    fontSize: 14,
    color: NAVY,
  },

  // Intervention
  interventionCard: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL + "33",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  interventionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  interventionBody: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
  },
  interventionActions: {
    marginTop: 16,
    width: "100%",
    gap: 8,
  },
  interventionBtnPrimary: {
    backgroundColor: TEAL,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  interventionBtnPrimaryText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 15,
  },
  interventionBtnSecondary: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  interventionBtnSecondaryText: {
    color: NAVY,
    fontWeight: "600",
    fontSize: 15,
  },

  // Opt-out
  optOutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    marginBottom: 8,
  },
  optOutLeft: {
    flex: 1,
  },
  optOutTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  optOutSub: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
});
