import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { XnScoreEngine, Vouch, VouchLimits } from "../services/XnScoreEngine";
import { useXnScore } from "../hooks/useXnScore";

type VouchMemberNavigationProp = StackNavigationProp<RootStackParamList>;

type CandidateMember = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function VouchMemberScreen() {
  const navigation = useNavigation<VouchMemberNavigationProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { createVouch, loading: rpcLoading } = useXnScore();

  const [limits, setLimits] = useState<VouchLimits | null>(null);
  const [activeVouches, setActiveVouches] = useState<Vouch[]>([]);
  const [candidates, setCandidates] = useState<CandidateMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isVouching, setIsVouching] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Vouch limits + active vouches given by me (parallel).
      const [limitsResult, givenResult] = await Promise.all([
        XnScoreEngine.getVouchLimits(user.id).catch(() => null),
        XnScoreEngine.getVouchesGiven(user.id).catch(() => [] as Vouch[]),
      ]);
      setLimits(limitsResult);
      setActiveVouches(
        (givenResult || []).filter((v) => v.vouch_status === "active"),
      );

      // Circle-connected candidates. Two-step: my circle IDs, then peers.
      // Restricting to circle-shared members is idiomatic here — the app
      // deliberately avoids general profile enumeration (see mig 139).
      const { data: myMemberships } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", user.id);
      const circleIds = (myMemberships ?? [])
        .map((m: { circle_id: string | null }) => m.circle_id)
        .filter(Boolean) as string[];

      if (circleIds.length === 0) {
        setCandidates([]);
      } else {
        const { data: peers } = await supabase
          .from("circle_members")
          .select("user_id, profiles:user_id(id, full_name, avatar_url)")
          .in("circle_id", circleIds)
          .neq("user_id", user.id);
        // Dedupe by user_id — a peer in N shared circles returns N rows.
        const seen = new Set<string>();
        const unique: CandidateMember[] = [];
        for (const row of peers ?? []) {
          const p = (row as { profiles: CandidateMember | null }).profiles;
          if (!p?.id || seen.has(p.id)) continue;
          seen.add(p.id);
          unique.push({
            id: p.id,
            full_name: p.full_name ?? null,
            avatar_url: p.avatar_url ?? null,
          });
        }
        setCandidates(unique);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const alreadyVouchedIds = useMemo(
    () => new Set(activeVouches.map((v) => v.vouchee_user_id)),
    [activeVouches],
  );

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      (c.full_name || "").toLowerCase().includes(q),
    );
  }, [candidates, searchQuery]);

  const canVouch = limits?.can_vouch ?? false;
  const remainingVouches = limits?.remaining_vouches ?? 0;
  const activeCount = limits?.active_vouches ?? activeVouches.length;
  const maxVouches = limits?.max_vouches ?? 0;
  const myScore = limits?.vouch_power ?? 0;

  const handleVouch = (userId: string, userName: string) => {
    if (!canVouch) {
      Alert.alert(
        "Cannot vouch",
        limits?.reason || "You aren't eligible to vouch yet.",
      );
      return;
    }
    if (alreadyVouchedIds.has(userId)) {
      Alert.alert(
        "Already vouched",
        `You already have an active vouch for ${userName}.`,
      );
      return;
    }
    if (remainingVouches <= 0) {
      Alert.alert(
        "Vouch limit reached",
        `You can only have ${maxVouches} active vouches at a time. Wait for one to expire or for the vouchee to graduate.`,
      );
      return;
    }

    Alert.alert(
      "Vouch for member",
      `Are you sure you want to vouch for ${userName}?\n\nIf they default, your voucher reliability may drop and your XnScore may be affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Vouch",
          onPress: async () => {
            setIsVouching(true);
            const vouchId = await createVouch(userId);
            setIsVouching(false);
            if (vouchId) {
              await refresh();
              setSearchQuery("");
              Alert.alert(
                "Vouch created",
                `You're now vouching for ${userName}.`,
              );
            } else {
              Alert.alert(
                "Vouch failed",
                "The vouch could not be created. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const busy = loading || isVouching || rpcLoading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("vouch_member.header_title", { defaultValue: "Vouch for a member" })}
          </Text>
          <View style={styles.placeholder} />
        </View>

        {/* Vouch Power Card */}
        <View style={styles.elderCard}>
          <View style={styles.elderLeft}>
            <View style={styles.elderIcon}>
              <Ionicons name="people" size={24} color="#8B5CF6" />
            </View>
            <View>
              <Text style={styles.elderTitle}>Vouch power</Text>
              <Text style={styles.elderSubtitle}>
                {canVouch
                  ? `XnScore ${myScore} · you can vouch`
                  : limits?.reason || "Score 70+ required"}
              </Text>
            </View>
          </View>
          <View style={styles.vouchCount}>
            <Text style={styles.vouchCountNumber}>{remainingVouches}</Text>
            <Text style={styles.vouchCountLabel}>remaining</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{maxVouches}</Text>
            <Text style={styles.statLabel}>Max</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#00C6AE" }]}>
              {Math.round(myScore)}
            </Text>
            <Text style={styles.statLabel}>XnScore</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning Card */}
        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            <Text style={styles.bold}>Vouching responsibility: </Text>
            If a member you vouch for defaults on payments, your XnScore™ may be
            reduced by up to 4 points per incident. Only vouch for people you
            trust.
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members you share a circle with"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Active Vouches */}
        {activeVouches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Your active vouches ({activeVouches.length})
            </Text>
            {activeVouches.map((vouch) => {
              const name = vouch.vouchee_name || "Unknown member";
              const avatarUrl = vouch.vouchee_avatar;
              return (
                <View key={vouch.id} style={styles.activeVouchCard}>
                  <View style={styles.activeVouchLeft}>
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={styles.activeVouchAvatar}
                      />
                    ) : (
                      <View style={styles.activeVouchAvatar}>
                        <Text style={styles.activeVouchAvatarText}>
                          {name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.activeVouchName}>{name}</Text>
                      <Text style={styles.activeVouchDate}>
                        Vouched{" "}
                        {new Date(vouch.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.activeVouchStatus}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#00C6AE"
                    />
                    <Text style={styles.activeVouchStatusText}>Active</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Candidates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>People you can vouch for</Text>
          <Text style={styles.sectionSubtitle}>
            Members you share at least one savings circle with.
          </Text>

          {busy && candidates.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#8B5CF6" />
            </View>
          ) : filteredCandidates.length > 0 ? (
            filteredCandidates.map((c) => {
              const already = alreadyVouchedIds.has(c.id);
              const disabled =
                !canVouch || remainingVouches <= 0 || already || isVouching;
              const displayName = c.full_name || "Unknown member";
              return (
                <View key={c.id} style={styles.userCard}>
                  <View style={styles.userHeader}>
                    {c.avatar_url ? (
                      <Image
                        source={{ uri: c.avatar_url }}
                        style={styles.userAvatar}
                      />
                    ) : (
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <View style={styles.userNameRow}>
                        <Text style={styles.userName}>{displayName}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.userFooter}>
                    <View style={styles.userStats}>
                      {already ? (
                        <Text style={styles.userStatText}>
                          Already vouched
                        </Text>
                      ) : (
                        <Text style={styles.userStatText}>
                          Shared circle member
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.vouchButton,
                        disabled && styles.vouchButtonDisabled,
                      ]}
                      onPress={() => handleVouch(c.id, displayName)}
                      disabled={disabled}
                    >
                      <Ionicons
                        name={already ? "checkmark" : "hand-right"}
                        size={16}
                        color={disabled ? "#9CA3AF" : "#FFFFFF"}
                      />
                      <Text
                        style={[
                          styles.vouchButtonText,
                          disabled && styles.vouchButtonTextDisabled,
                        ]}
                      >
                        {already ? "Vouched" : "Vouch"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>
                {candidates.length === 0
                  ? "No shared circle members yet"
                  : "No matches"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {candidates.length === 0
                  ? "Join a circle to find people you can vouch for."
                  : "Try a different name."}
              </Text>
            </View>
          )}
        </View>

        {/* How Vouching Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("final_polish.vouchmember_how_vouching_works", {
              defaultValue: "How vouching works",
            })}
          </Text>
          <View style={styles.howItWorksCard}>
            <View style={styles.howItWorksItem}>
              <View
                style={[styles.howItWorksIcon, { backgroundColor: "#EEF2FF" }]}
              >
                <Text style={styles.howItWorksNumber}>1</Text>
              </View>
              <View style={styles.howItWorksContent}>
                <Text style={styles.howItWorksTitle}>Vouch</Text>
                <Text style={styles.howItWorksText}>
                  Endorse a member you trust
                </Text>
              </View>
            </View>

            <View style={styles.howItWorksItem}>
              <View
                style={[styles.howItWorksIcon, { backgroundColor: "#F0FDFB" }]}
              >
                <Text style={styles.howItWorksNumber}>2</Text>
              </View>
              <View style={styles.howItWorksContent}>
                <Text style={styles.howItWorksTitle}>They gain trust</Text>
                <Text style={styles.howItWorksText}>
                  Your endorsement adds diluted points to their XnScore
                </Text>
              </View>
            </View>

            <View style={styles.howItWorksItem}>
              <View
                style={[styles.howItWorksIcon, { backgroundColor: "#FEF3C7" }]}
              >
                <Text style={styles.howItWorksNumber}>3</Text>
              </View>
              <View style={styles.howItWorksContent}>
                <Text style={styles.howItWorksTitle}>Time-bound</Text>
                <Text style={styles.howItWorksText}>
                  Vouches expire after 1 year — renew if the relationship holds
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  elderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(139,92,246,0.15)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  elderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  elderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(139,92,246,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  elderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  elderSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  vouchCount: {
    alignItems: "center",
  },
  vouchCountNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  vouchCountLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 14,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  bold: {
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0A2342",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  activeVouchCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  activeVouchLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeVouchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  activeVouchAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  activeVouchName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  activeVouchDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  activeVouchStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeVouchStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00C6AE",
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#8B5CF620",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  userFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userStatText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  vouchButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  vouchButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  vouchButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  vouchButtonTextDisabled: {
    color: "#9CA3AF",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  howItWorksCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  howItWorksItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  howItWorksIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  howItWorksNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  howItWorksContent: {
    flex: 1,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  howItWorksText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});
