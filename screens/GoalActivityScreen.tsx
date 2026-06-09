// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalActivityScreen.tsx — Goal activity history (read-only)
// ══════════════════════════════════════════════════════════════════════════════
//
// Full activity history for a goal, reached from GoalDetailV2's "See All".
// Read-only: a FlatList of activity items (interest / deposit / circle
// payout) with pull-to-refresh that, for now, just re-loads the same mock
// data (no real data source yet).
//
// Route params (all optional — defaults applied for standalone preview):
//   goal?:           the goal object (used for the header subtitle, and as a
//                    fallback source of activity via goal.recentActivity)
//   recentActivity?: Activity[]  (preferred source; same shape as GoalDetailV2)
//
// NAVIGATION — onBack → goBack(). No forward actions (read-only screen).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

const NAVY = "#0A2342";
const GREEN = "#059669";
const RED = "#DC2626";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type Activity = {
  type: "interest" | "deposit" | "circle_payout";
  desc: string;
  amount: number;
  date: string;
  isCredit: boolean;
};

type ActivityGoal = {
  name?: string;
  emoji?: string;
  recentActivity?: Activity[];
};

type GoalActivityParams = {
  goal?: ActivityGoal;
  recentActivity?: Activity[];
};
type GoalActivityRouteProp = RouteProp<
  { GoalActivity: GoalActivityParams },
  "GoalActivity"
>;

// Same mock data as GoalDetailV2 (used when no activity is passed in).
const DEFAULT_ACTIVITY: Activity[] = [
  { type: "interest", desc: "Daily interest", amount: 0.47, date: "Today", isCredit: true },
  { type: "deposit", desc: "Auto-deposit", amount: 500, date: "Feb 1", isCredit: true },
  { type: "interest", desc: "Daily interest", amount: 0.46, date: "Jan 31", isCredit: true },
  {
    type: "circle_payout",
    desc: "From Home Buyers Circle",
    amount: 2000,
    date: "Jan 15",
    isCredit: true,
  },
  { type: "deposit", desc: "Manual deposit", amount: 1000, date: "Jan 10", isCredit: true },
];

const activityIcon = (type: Activity["type"]) =>
  type === "interest" ? "📈" : type === "circle_payout" ? "🔄" : "💰";
const activityIconBg = (type: Activity["type"]) =>
  type === "interest" ? "#F0FDFB" : type === "circle_payout" ? "#EFF6FF" : "#FEF3C7";

export default function GoalActivityScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<GoalActivityRouteProp>();

  const goal = route.params?.goal;
  const activity =
    route.params?.recentActivity ?? goal?.recentActivity ?? DEFAULT_ACTIVITY;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    // No real data source yet — simulate a reload of the same items.
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const renderItem = ({ item }: { item: Activity }) => (
    <View style={styles.activityRow}>
      <View style={styles.activityLeft}>
        <View
          style={[styles.activityIconBox, { backgroundColor: activityIconBg(item.type) }]}
        >
          <Text style={styles.activityIcon}>{activityIcon(item.type)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.activityDesc}>{item.desc}</Text>
          <Text style={styles.activityDate}>{item.date}</Text>
        </View>
      </View>
      <Text
        style={[styles.activityAmount, { color: item.isCredit ? GREEN : RED }]}
      >
        {item.isCredit ? "+" : "-"}$
        {item.amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <LinearGradient
        colors={[NAVY, "#143654"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t("screen_headers.goal_activity")}</Text>
            {goal?.name && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {goal.emoji ? `${goal.emoji} ` : ""}
                {goal.name}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={activity}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={NAVY}
            colors={[NAVY]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🗒️</Text>
            <Text style={styles.emptyText}>{t("final_polish.goalactivity_no_activity_yet")}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },

  listContent: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  separator: { height: 10 },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  activityLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityIcon: { fontSize: 16 },
  activityDesc: { fontSize: 13, fontWeight: "500", color: NAVY },
  activityDate: { fontSize: 11, color: MUTED, marginTop: 2 },
  activityAmount: { fontSize: 14, fontWeight: "600" },

  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: MUTED, marginTop: 12 },
});
