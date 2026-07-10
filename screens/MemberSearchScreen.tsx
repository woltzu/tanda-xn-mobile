// ═══════════════════════════════════════════════════════════════════════════
// screens/MemberSearchScreen.tsx — Phase 2, migration 259
// ═══════════════════════════════════════════════════════════════════════════
//
// Bounded-belonging member search backed by search_members RPC. Two modes:
//
//   • Browse mode (no circleId param) — read-only directory of co-community
//     members. Useful as a vouch / nominee lookup surface.
//
//   • Invite mode (circleId param present) — each row gets an "Invite"
//     button that runs a can_invite pre-flight then INSERTs into
//     circle_invitations. The DB has two safety nets:
//       1. tr_block_critical_invitation (migration 257) — rejects writes
//          from critical-tier users at the trigger layer.
//       2. RLS WITH CHECK on circle_invitations — only the inviter can
//          INSERT their own row (auth.uid() = invited_by).
//     The can_invite RPC adds the cross-community + cross-circle bounded-
//     belonging policy on top. Pre-flighting via RPC is UX-only; the
//     INSERT itself will still be rejected if anything is off.
//
// No standalone create_invitation RPC was created (migration 257's spec
// review explicitly verified that the historic invite_member stub was
// never present in prod, and direct PostgREST INSERTs are the documented
// path — see migration 257 header).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
} from "react-native";
import { AppFlashList } from "../components/AppFlashList";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useResolutionStatus } from "../hooks/useResolutionStatus";
import {
  useMemberSearch,
  MemberSearchResult,
} from "../hooks/useMemberSearch";
import { showToast } from "../components/Toast";
import { RootStackParamList } from "../App";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

type MemberSearchRouteProp = RouteProp<RootStackParamList, "MemberSearch">;

const MemberSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<MemberSearchRouteProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  // Optional — when present, switches the screen into invite mode and
  // gates the per-row action with the circle's community.
  const circleId = (route.params as { circleId?: string } | undefined)
    ?.circleId;
  const communityId = (route.params as { communityId?: string } | undefined)
    ?.communityId;

  const [query, setQuery] = useState("");
  // The search hook debounces by 300ms internally — we just pass the
  // raw query and let it handle the timer.
  const { results, isLoading, error } = useMemberSearch(query, {
    communityId,
    limit: 25,
  });

  // Critical-tier users are blocked from inviting at the trigger layer
  // (migration 257). We surface a screen-level message instead of
  // showing disabled buttons so the user understands *why* they can't
  // act, not just that they can't.
  const { isCritical } = useResolutionStatus(user?.id);
  const inviteBlockedReason: string | null =
    circleId && isCritical
      ? t("search.invite_blocked")
      : null;

  // Per-row invite state — pending UUIDs keep their spinner up, sent
  // UUIDs render the success affordance instead of the button.
  const [pendingInviteIds, setPendingInviteIds] = useState<Set<string>>(
    new Set(),
  );
  const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(new Set());

  // On mount (invite mode only), prefill sentInviteIds from any pending
  // invitations this user has already sent for this circle. Without
  // this, a user who invited someone in a prior session sees the same
  // "Invite" button and can double-send (or perceive that "Sent" isn't
  // persisting after a re-open).
  useEffect(() => {
    if (!circleId || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("circle_invitations")
        .select("invited_user_id")
        .eq("circle_id", circleId)
        .eq("invited_by", user.id)
        .eq("status", "pending");
      if (cancelled || e || !data) return;
      const priorIds = new Set(
        data.map((r: { invited_user_id: string }) => r.invited_user_id),
      );
      if (priorIds.size === 0) return;
      setSentInviteIds((prev) => {
        const next = new Set(prev);
        priorIds.forEach((id) => next.add(id));
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [circleId, user?.id]);

  const handleInvite = useCallback(
    async (target: MemberSearchResult) => {
      if (!user?.id || !circleId) return;
      const targetId = target.user_id;
      setPendingInviteIds((prev) => {
        const next = new Set(prev);
        next.add(targetId);
        return next;
      });
      try {
        // Pre-flight via can_invite — gives a clear "blocked" message
        // instead of letting the RLS / trigger return a generic 42501.
        const { data: canInviteData, error: canInviteErr } =
          await supabase.rpc("can_invite", {
            p_inviter_id: user.id,
            p_target_id: targetId,
            p_circle_id: circleId,
          });
        if (canInviteErr) throw new Error(canInviteErr.message);
        if (canInviteData !== true) {
          showToast(t("search.invite_blocked"), "error");
          return;
        }

        // circle_invitations.name is NOT NULL (see schema). Use the
        // best available name from the search result.
        const displayName =
          target.full_name?.trim() ||
          target.display_name?.trim() ||
          t("role.unknown_member");

        const { error: insertErr } = await supabase
          .from("circle_invitations")
          .insert({
            circle_id: circleId,
            invited_by: user.id,
            invited_user_id: targetId,
            name: displayName,
            status: "pending",
          });
        // A 23505 (unique_violation) on circle_invitations means we
        // already invited this person in a prior tap / session. Treat
        // that as an already-sent success so the button flips to "Sent"
        // instead of leaving the user staring at the same "Invite"
        // pill after a second tap.
        const isDuplicate =
          (insertErr as any)?.code === "23505" ||
          /duplicate key|already exists/i.test(insertErr?.message ?? "");
        if (insertErr && !isDuplicate) {
          throw new Error(insertErr.message);
        }

        setSentInviteIds((prev) => {
          const next = new Set(prev);
          next.add(targetId);
          return next;
        });
        showToast(
          isDuplicate
            ? t("search.invite_already_sent")
            : t("search.invite_success"),
          "success",
        );
      } catch (err: any) {
        console.warn("[MemberSearchScreen] invite failed:", err);
        showToast(
          err?.message ?? t("search.invite_failed"),
          "error",
        );
      } finally {
        setPendingInviteIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      }
    },
    [user?.id, circleId, t],
  );

  // ── Render helpers ──────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.headerBtn}
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {circleId
          ? t("search.title_invite")
          : t("search.title_browse")}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );

  const renderRow = ({ item }: { item: MemberSearchResult }) => {
    const isPending = pendingInviteIds.has(item.user_id);
    const isSent = sentInviteIds.has(item.user_id);
    const name =
      item.full_name ?? item.display_name ?? t("role.unknown_member");
    const initial = (name || "?").charAt(0).toUpperCase();
    return (
      <View style={styles.row}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
          </Text>
          {item.tier_badge ? (
            <Text style={styles.rowTier} numberOfLines={1}>
              {item.tier_badge}
            </Text>
          ) : null}
        </View>
        {circleId ? (
          isSent ? (
            <View style={styles.sentChip}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              <Text style={styles.sentChipText}>
                {t("search.invite_sent")}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.inviteBtn,
                (isPending || !!inviteBlockedReason) &&
                  styles.inviteBtnDisabled,
              ]}
              onPress={() => handleInvite(item)}
              disabled={isPending || !!inviteBlockedReason}
              accessibilityRole="button"
              accessibilityLabel={t("search.invite_btn", { name })}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.inviteBtnText}>
                  {t("search.invite_btn_short")}
                </Text>
              )}
            </TouchableOpacity>
          )
        ) : null}
      </View>
    );
  };

  // ── Empty / loading / blocked states ────────────────────────────────
  const renderEmpty = () => {
    if (query.trim().length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={36} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            {t("search.empty_prompt")}
          </Text>
        </View>
      );
    }
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={TEAL} />
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={36} color="#CBD5E1" />
        <Text style={styles.emptyText}>{t("search.no_results")}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      {renderHeader()}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("search.placeholder")}
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <TouchableOpacity
            onPress={() => setQuery("")}
            accessibilityRole="button"
            accessibilityLabel={t("common.clear")}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={MUTED} />
          </TouchableOpacity>
        ) : null}
      </View>
      {inviteBlockedReason ? (
        <View style={styles.blockedBanner}>
          <Ionicons name="warning-outline" size={18} color="#991B1B" />
          <Text style={styles.blockedBannerText}>{inviteBlockedReason}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}
      <AppFlashList
        data={results}
        keyExtractor={(r) => r.user_id}
        estimatedItemSize={80}
        renderItem={renderRow}
        contentContainerStyle={
          results.length === 0
            ? styles.listEmptyContainer
            : styles.listContainer
        }
        ListEmptyComponent={renderEmpty}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
};

export default MemberSearchScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // Extra left padding accommodates the globally-mounted
    // LogoHomeButton (top-left "Xn" badge, ~40px wide including gap).
    // Without this the back arrow sits directly under the badge and
    // both are unreachable / illegible.
    paddingLeft: 48,
    paddingRight: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    color: NAVY,
    paddingVertical: 0,
  },
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: 10,
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 10,
  },
  blockedBannerText: {
    flex: 1,
    fontSize: typography.label,
    color: "#991B1B",
    fontWeight: typography.medium,
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
  },
  errorBannerText: {
    fontSize: typography.label,
    color: "#92400E",
  },
  listContainer: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 },
  listEmptyContainer: { flexGrow: 1 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body,
    color: MUTED,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    backgroundColor: "rgba(0,198,174,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
  },
  rowName: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
  },
  rowTier: {
    fontSize: typography.label,
    color: MUTED,
    marginTop: 2,
  },
  inviteBtn: {
    backgroundColor: TEAL,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteBtnText: {
    color: "#FFFFFF",
    fontWeight: typography.bold,
    fontSize: typography.label,
  },
  sentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#047857",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  sentChipText: {
    color: "#FFFFFF",
    fontWeight: typography.bold,
    fontSize: typography.label,
  },
});
