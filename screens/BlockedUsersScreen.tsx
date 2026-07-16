// ═══════════════════════════════════════════════════════════════════════════
// BlockedUsersScreen — Phase 5 block management
// ═══════════════════════════════════════════════════════════════════════════
//
// Shows every user the caller has blocked (mig 346 blocked_users where
// blocker_id = auth.uid()), with per-row Unblock action + confirmation.
// Reads via useBlockedUsers (enriched with profile join in Phase 5).
// Server-side RLS (blocked_users_select_own) already gates rows to the
// caller — no client-side filter needed. On unblock the row disappears
// from this list AND the target user's content becomes visible again
// via the feed_posts / feed_comments RLS from mig 346.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useBlockedUsers, BlockedUserRow } from "../hooks/useBlockedUsers";
import { showToast } from "../components/Toast";

export default function BlockedUsersScreen() {
  const navigation = useNavigation<any>();
  const {
    blocked,
    loading,
    fetchBlockedUsers,
    unblockUser,
  } = useBlockedUsers();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const handleUnblock = useCallback(
    (row: BlockedUserRow) => {
      if (busyId) return;
      const name = row.profile?.full_name?.trim() || "this user";
      Alert.alert(
        "Unblock user?",
        `${name} will be able to see your content again, and you'll see theirs.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            onPress: async () => {
              setBusyId(row.blocked_id);
              const r = await unblockUser(row.blocked_id);
              setBusyId(null);
              if (r.success) showToast("User unblocked", "success");
              else showToast(r.error ?? "Failed to unblock", "error");
            },
          },
        ],
      );
    },
    [busyId, unblockUser],
  );

  const renderItem = useCallback(
    ({ item }: { item: BlockedUserRow }) => {
      const displayName = item.profile?.full_name?.trim() || "(deleted user)";
      const isBusy = busyId === item.blocked_id;
      return (
        <View style={styles.row}>
          {item.profile?.avatar_url ? (
            <Image
              source={{ uri: item.profile.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {displayName[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>
              {displayName}
            </Text>
            {item.reason ? (
              <Text style={styles.rowReason} numberOfLines={1}>
                Note: {item.reason}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.unblockBtn, isBusy && styles.unblockBtnDisabled]}
            onPress={() => handleUnblock(item)}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={`Unblock ${displayName}`}
          >
            <Text style={styles.unblockBtnText}>Unblock</Text>
          </TouchableOpacity>
        </View>
      );
    },
    [busyId, handleUnblock],
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="ban-outline" size={40} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>You haven't blocked anyone yet</Text>
      <Text style={styles.emptySubtitle}>
        Block someone from their profile and they'll appear here for easy
        management.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={styles.headerRightSpacer} />
      </View>
      <Text style={styles.subtitle}>
        Users you've blocked won't see your content, and you won't see theirs.
      </Text>
      {loading && blocked.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#00C6AE" />
        </View>
      ) : (
        <FlashList
          data={blocked}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchBlockedUsers}
              tintColor="#00C6AE"
              colors={["#00C6AE"]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  headerRightSpacer: {
    width: 32,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    lineHeight: 18,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E5E7EB",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4B5563",
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  rowReason: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontStyle: "italic",
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  unblockBtnDisabled: {
    opacity: 0.5,
  },
  unblockBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
  },
});
