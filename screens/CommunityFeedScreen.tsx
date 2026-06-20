// ══════════════════════════════════════════════════════════════════════════════
// screens/CommunityFeedScreen.tsx — Full-page community post feed
// ══════════════════════════════════════════════════════════════════════════════
//
// Post to Community Bucket A (2026-06-20). Companion to the CommunityTab
// inline section: a dedicated list view of every `feed_posts` row with
// `type='community'`. The CommunityTab section shows the latest 3; this
// screen shows all of them in a virtualized FlatList.
//
// Data source: useFeed().posts, filtered client-side. fetchFeed already
// pulls every type unfiltered, so a separate query would just duplicate
// work — the filter is cheap (rarely more than a few hundred rows in the
// in-memory cache) and stays in lockstep with the rest of the app's feed
// state (likes, optimistic inserts, realtime subscriptions).
//
// Header (+) navigates to PostToCommunityScreen. Pull-to-refresh wires
// to FeedContext.refreshFeed so the entire cache (including community
// posts) gets a fresh fetch.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useFeed, FeedPost } from "../context/FeedContext";
import FeedPostCard from "../components/FeedPostCard";
import { Routes } from "../lib/routes";

const COLORS = {
  bg: "#F5F7FA",
  navy: "#0A2342",
  teal: "#00C6AE",
  subtitle: "#6B7280",
};

export default function CommunityFeedScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { posts, likedPostIds, toggleLike, refreshFeed } = useFeed();

  const [refreshing, setRefreshing] = useState(false);

  const communityPosts = useMemo(
    () => posts.filter((p) => p.type === "community"),
    [posts],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeed();
    setRefreshing(false);
  }, [refreshFeed]);

  const handlePostPress = useCallback(
    (postId: string) =>
      navigation.navigate(Routes.PostDetail as never, { postId } as never),
    [navigation],
  );

  const handleAuthorPress = useCallback(
    (userId: string) =>
      navigation.navigate(
        "UserDreamProfile" as never,
        { userId } as never,
      ),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <FeedPostCard
        post={item}
        isLiked={likedPostIds.has(item.id)}
        onLike={() => toggleLike(item.id)}
        onComment={() => handlePostPress(item.id)}
        onPress={() => handlePostPress(item.id)}
        onAuthorPress={handleAuthorPress}
        currentUserId={user?.id}
      />
    ),
    [likedPostIds, toggleLike, handlePostPress, handleAuthorPress, user?.id],
  );

  const renderEmpty = () => (
    <TouchableOpacity
      style={styles.emptyCard}
      onPress={() =>
        navigation.navigate(Routes.PostToCommunity as never)
      }
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <Ionicons name="chatbubble-ellipses-outline" size={36} color={COLORS.subtitle} />
      <Text style={styles.emptyTitle}>
        {t("community_feed.empty_title")}
      </Text>
      <Text style={styles.emptyBody}>
        {t("community_feed.empty_body")}
      </Text>
      <View style={styles.emptyCtaBtn}>
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={styles.emptyCtaText}>
          {t("community_feed.empty_cta")}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[COLORS.navy, "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("community_feed.header_title")}
          </Text>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() =>
              navigation.navigate(Routes.PostToCommunity as never)
            }
            accessibilityRole="button"
            accessibilityLabel={t("community_feed.compose_a11y")}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={communityPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          communityPosts.length === 0 ? styles.listEmpty : styles.list
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.teal}
            colors={[COLORS.teal]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  list: { padding: 16, paddingBottom: 32 },
  listEmpty: { flexGrow: 1, justifyContent: "center", padding: 24 },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.teal + "44",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
    marginTop: 4,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: COLORS.subtitle,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyCtaBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyCtaText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
