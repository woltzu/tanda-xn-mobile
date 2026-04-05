import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCommunityMemory, CommunityMemoryItem } from "../hooks/useCommunityFeatures";

interface Props {
  communityId: string;
  communityName?: string;
}

const MEMORY_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  circle_completion: { icon: "checkmark-circle", color: "#10B981" },
  elder_elevation: { icon: "star", color: "#F59E0B" },
  milestone_story: { icon: "trophy", color: "#00C6AE" },
  gathering_recap: { icon: "camera", color: "#6366F1" },
  provider_milestone: { icon: "storefront", color: "#8B5CF6" },
  member_count: { icon: "people", color: "#3B82F6" },
  community_founding: { icon: "flag", color: "#0A2342" },
  payout_milestone: { icon: "cash", color: "#10B981" },
  custom: { icon: "bookmark", color: "#6B7280" },
};

export default function CommunityMemoryScreen({ communityId, communityName = "My Community" }: Props) {
  const navigation = useNavigation();
  const { memories, byYear, loading, refresh } = useCommunityMemory(communityId);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const renderMemoryItem = (memory: CommunityMemoryItem, isLast: boolean) => {
    const config = MEMORY_TYPE_CONFIG[memory.memoryType] ?? MEMORY_TYPE_CONFIG.custom;

    return (
      <View key={memory.id} style={styles.timelineItem}>
        {/* Timeline connector */}
        <View style={styles.timelineConnector}>
          <View style={[styles.timelineDot, { backgroundColor: config.color }]}>
            <Ionicons name={config.icon as any} size={14} color="#FFFFFF" />
          </View>
          {!isLast && <View style={styles.timelineLine} />}
        </View>

        {/* Content */}
        <View style={styles.memoryCard}>
          <Text style={styles.memoryDate}>{formatDate(memory.eventDate)}</Text>
          <Text style={styles.memoryTitle}>{memory.title}</Text>
          {memory.description && (
            <Text style={styles.memoryDesc} numberOfLines={3}>{memory.description}</Text>
          )}
          {memory.attributedName && (
            <View style={styles.memoryAttribution}>
              <Ionicons name="person-outline" size={12} color="#9CA3AF" />
              <Text style={styles.memoryAttributionText}>{memory.attributedName}</Text>
            </View>
          )}
          {memory.isSystemGenerated && (
            <View style={styles.systemBadge}>
              <Ionicons name="flash-outline" size={10} color="#6B7280" />
              <Text style={styles.systemBadgeText}>Auto-recorded</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community Memory</Text>
          <View style={styles.placeholder} />
        </View>
        <Text style={styles.headerSubtitle}>{communityName}</Text>
        <View style={styles.memoryCountBar}>
          <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.memoryCountText}>{memories.length} moments recorded</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {memories.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No memories yet</Text>
            <Text style={styles.emptySubtitle}>Community moments will be recorded here as they happen</Text>
          </View>
        )}

        {years.map((year) => (
          <View key={year} style={styles.yearSection}>
            <View style={styles.yearHeader}>
              <Text style={styles.yearText}>{year}</Text>
              <View style={styles.yearLine} />
            </View>
            {byYear[year].map((memory, index) =>
              renderMemoryItem(memory, index === byYear[year].length - 1)
            )}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  placeholder: { width: 40 },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 12 },
  memoryCountBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  memoryCountText: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  content: { flex: 1, padding: 20 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
  yearSection: { marginBottom: 24 },
  yearHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  yearText: { fontSize: 22, fontWeight: "700", color: "#0A2342" },
  yearLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  timelineItem: { flexDirection: "row", marginBottom: 0 },
  timelineConnector: { alignItems: "center", width: 36, marginRight: 12 },
  timelineDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#E5E7EB", marginTop: -2 },
  memoryCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  memoryDate: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  memoryTitle: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 4 },
  memoryDesc: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 8 },
  memoryAttribution: { flexDirection: "row", alignItems: "center", gap: 4 },
  memoryAttributionText: { fontSize: 12, color: "#9CA3AF" },
  systemBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  systemBadgeText: { fontSize: 11, color: "#9CA3AF" },
});
