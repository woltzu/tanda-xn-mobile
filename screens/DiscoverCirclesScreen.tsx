// ═══════════════════════════════════════════════════════════════════════════
// DiscoverCirclesScreen — Phase C of feat(circle)
//
// Surfaces the CircleMatchingService recommendations that have been
// fully built but completely unreachable. Renders the user's top ranked
// circles using the existing CircleRecommendationCard component, logs
// every interaction (viewed/saved/dismissed/applied) into
// circle_match_history via the log-circle-match-interaction Edge
// Function for ML training data collection.
//
// What it depends on:
//   - useCircleMatching hook (already shipped, dormant)
//   - CircleRecommendationCard component (already shipped)
//   - log-circle-match-interaction EF (Phase C deliverable)
//
// What it logs:
//   On mount → "viewed" for the top match (the most prominent one shown).
//   On Save button tap → "saved"
//   On Dismiss button tap → "dismissed"
//   On Card tap → currently no-op (would navigate to a detail screen
//                 that doesn't exist yet); could log "applied".
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useCircleMatching } from "../hooks/useCircleMatching";
import type { CircleMatch } from "../services/CircleMatchingService";
import { CircleRecommendationCard } from "../components/CircleRecommendationCard";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BG = "#F5F7FA";
const MUTED = "#6B7280";

type LoggedAction =
  | "viewed"
  | "saved"
  | "dismissed"
  | "applied"
  | "joined"
  | "rejected"
  | "shared";

export default function DiscoverCirclesScreen() {
  const { t } = useTranslation();

  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const {
    recommendations,
    topMatch,
    isLoading,
    error,
    loadRecommendations,
    refreshRecommendations,
    hasRecommendations,
    eligibleCount,
  } = useCircleMatching();

  // Dedup view-logging: once per (circleId, lifetime-of-screen).
  // Prevents the same recommendation card from logging "viewed" 30 times
  // as the user scrolls or RN strict-mode double-mounts.
  const viewedRef = useRef<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  // Local dismissal so users can hide cards immediately without waiting
  // for a re-fetch. We still log the action; the next refresh would
  // pull the recommendation again if the engine still thinks it's a fit.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Load on mount
  useEffect(() => {
    if (!user?.id) return;
    loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Log impressions for the top match once it appears
  useEffect(() => {
    if (!topMatch || viewedRef.current.has(topMatch.circle.id)) return;
    viewedRef.current.add(topMatch.circle.id);
    logInteraction(topMatch, "viewed", 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topMatch?.circle.id]);

  /**
   * Call the log-circle-match-interaction Edge Function with the
   * interaction's full context. Includes a session snapshot so the
   * ML pipeline gets the data the CircleMatchHistoryEngine wants.
   * Fire-and-forget — never blocks the UI on a logging failure.
   */
  const logInteraction = useCallback(
    async (match: CircleMatch, action: LoggedAction, positionInFeed: number) => {
      if (!user?.id) return;
      try {
        const sessionContext = {
          screen: "DiscoverCircles",
          circlesViewedInSession: recommendations.length,
          positionInFeed,
          sessionDurationMs: 0, // not tracked yet
          deviceType: Platform.OS,
          appVersion: "1.0.0",
        };
        const { error: efErr } = await supabase.functions.invoke(
          "log-circle-match-interaction",
          {
            body: {
              userId: user.id,
              circleId: match.circle.id,
              action,
              matchScore: match.matchScore,
              affordabilityScore: Math.round(match.affordability?.score ?? 0),
              trustScore: match.connectionCount * 10, // proxy until real scoring exposed
              compatibilityScore: match.matchScore, // best proxy from current type
              actionReason: action === "dismissed" ? "user_dismissed_from_discover" : undefined,
              sessionContext,
              memberProfileSnapshot: {}, // future: enrich on the EF side
              circleProfileSnapshot: {
                amount: match.circle.amount,
                frequency: match.circle.frequency,
                memberCount: match.circle.memberCount,
                currentMembers: match.circle.currentMembers,
              },
              algorithmVersion: "rule-v1",
            },
          }
        );
        if (efErr) {
          console.log("[discover] log interaction failed:", efErr.message);
        }
      } catch (err: any) {
        console.log("[discover] log interaction threw:", err?.message);
      }
    },
    [user?.id, recommendations.length]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    viewedRef.current.clear();
    setDismissed(new Set());
    try {
      await refreshRecommendations();
    } finally {
      setRefreshing(false);
    }
  }, [refreshRecommendations]);

  const handleSave = useCallback(
    (match: CircleMatch, idx: number) => {
      logInteraction(match, "saved", idx);
    },
    [logInteraction]
  );

  const handleDismiss = useCallback(
    (match: CircleMatch, idx: number) => {
      logInteraction(match, "dismissed", idx);
      setDismissed((prev) => {
        const u = new Set(prev);
        u.add(match.circle.id);
        return u;
      });
    },
    [logInteraction]
  );

  const handleCardPress = useCallback(
    (match: CircleMatch, idx: number) => {
      // We don't have a unified circle-detail screen wired into HomeStack
      // for matched (non-owned) circles. For now, log the click as
      // "applied" intent so the ML pipeline records the funnel.
      logInteraction(match, "applied", idx);
    },
    [logInteraction]
  );

  const visibleRecommendations = recommendations.filter(
    (m) => !dismissed.has(m.circle.id)
  );

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading && !hasRecommendations) {
    return (
      <View style={styles.root}>
        <Header navigation={navigation} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.centerText}>Finding circles for you…</Text>
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (error && !hasRecommendations) {
    return (
      <View style={styles.root}>
        <Header navigation={navigation} />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={MUTED} />
          <Text style={styles.centerText}>{t("discover_circles.error_load")}</Text>
          <Text style={styles.centerSubtext}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>{t("discover_circles.btn_try_again")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────
  if (!isLoading && visibleRecommendations.length === 0) {
    return (
      <View style={styles.root}>
        <Header navigation={navigation} />
        <View style={styles.center}>
          <Ionicons name="compass-outline" size={48} color={MUTED} />
          <Text style={styles.centerText}>{t("discover_circles.empty_text")}</Text>
          <Text style={styles.centerSubtext}>
            New circles matching your profile will show up here. Check back later, or pull to refresh.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>{t("discover_circles.btn_refresh")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── List ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <Header navigation={navigation} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
        }
      >
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {eligibleCount} eligible · {visibleRecommendations.length} shown
          </Text>
        </View>

        {visibleRecommendations.map((match, idx) => (
          <View key={match.circle.id} style={styles.cardWrapper}>
            <CircleRecommendationCard
              match={match}
              onPress={() => handleCardPress(match, idx)}
              onJoin={() => handleCardPress(match, idx)}
              showAffordability
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => handleSave(match, idx)}
                accessibilityRole="button"
                accessibilityLabel={`Save ${match.circle.name}`}
              >
                <Ionicons name="bookmark-outline" size={14} color={NAVY} />
                <Text style={styles.actionBtnSecondaryText}>{t("final_polish.discovercircles_save")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => handleDismiss(match, idx)}
                accessibilityRole="button"
                accessibilityLabel={`Dismiss ${match.circle.name}`}
              >
                <Ionicons name="close-outline" size={14} color={MUTED} />
                <Text style={[styles.actionBtnSecondaryText, { color: MUTED }]}>
                  Dismiss
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Shared header ──────────────────────────────────────────────────────

function Header({ navigation }: { navigation: any }) {
  return (
    <LinearGradient colors={[NAVY, "#143654"]} style={styles.header}>
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={22} color="#FFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t("screen_headers.discover_circles")}</Text>
      <View style={styles.headerBtn} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },

  // Center states (loading / error / empty)
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  centerText: {
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
    textAlign: "center",
  },
  centerSubtext: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: TEAL,
  },
  retryBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },

  // List
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryBar: {
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  summaryText: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "500",
  },
  cardWrapper: {
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: NAVY,
  },
});
