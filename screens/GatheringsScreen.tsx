import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useGatherings, CommunityGathering } from "../hooks/useCommunityFeatures";

interface Props {
  communityId: string;
  communityName?: string;
}

const EVENT_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  community: { icon: "people", color: "#00C6AE", label: "Community" },
  circle: { icon: "sync-circle", color: "#6366F1", label: "Circle" },
  elder_session: { icon: "school", color: "#F59E0B", label: "Elder Session" },
  service: { icon: "storefront", color: "#8B5CF6", label: "Service" },
};

export default function GatheringsScreen({ communityId, communityName = "My Community" }: Props) {
  const navigation = useNavigation();
  const { gatherings, upcoming, elderSessions, loading, rsvp, refresh } = useGatherings(communityId, "upcoming");
  const [filter, setFilter] = useState<"all" | "community" | "circle" | "elder_session" | "service">("all");

  const filtered = filter === "all" ? gatherings : gatherings.filter(g => g.eventType === filter);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const renderGatheringCard = (gathering: CommunityGathering) => {
    const config = EVENT_TYPE_CONFIG[gathering.eventType] ?? EVENT_TYPE_CONFIG.community;

    return (
      <TouchableOpacity key={gathering.id} style={styles.gatheringCard} activeOpacity={0.7}>
        {/* Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: config.color + "20" }]}>
          <Ionicons name={config.icon as any} size={14} color={config.color} />
          <Text style={[styles.typeLabel, { color: config.color }]}>{config.label}</Text>
        </View>

        <Text style={styles.gatheringTitle}>{gathering.title}</Text>

        {gathering.description && (
          <Text style={styles.gatheringDesc} numberOfLines={2}>{gathering.description}</Text>
        )}

        {/* Date & Location */}
        <View style={styles.gatheringMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>
              {formatDate(gathering.startsAt)} at {formatTime(gathering.startsAt)}
            </Text>
          </View>
          {gathering.locationName && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText} numberOfLines={1}>{gathering.locationName}</Text>
            </View>
          )}
          {gathering.isVirtual && (
            <View style={styles.metaRow}>
              <Ionicons name="videocam-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>Virtual Event</Text>
            </View>
          )}
        </View>

        {/* Organizer & RSVP */}
        <View style={styles.gatheringBottom}>
          <View style={styles.organizerRow}>
            <Text style={styles.organizerText}>
              By {gathering.organizerFirstName}
              {gathering.organizerOrigin ? ` . ${gathering.organizerOrigin}` : ""}
            </Text>
          </View>
          <View style={styles.rsvpRow}>
            <View style={styles.rsvpCount}>
              <Ionicons name="people-outline" size={14} color="#00C6AE" />
              <Text style={styles.rsvpCountText}>{gathering.rsvpCount}</Text>
            </View>
            <TouchableOpacity
              style={styles.goingButton}
              onPress={() => rsvp(gathering.id, "You")}
            >
              <Text style={styles.goingButtonText}>Going</Text>
            </TouchableOpacity>
          </View>
        </View>

        {gathering.isFamilyWelcome && (
          <View style={styles.familyBadge}>
            <Ionicons name="heart-outline" size={12} color="#8B5CF6" />
            <Text style={styles.familyText}>Families welcome</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gatherings</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate("CreateGathering" as any, { communityId })}
          >
            <Ionicons name="add" size={24} color="#00C6AE" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>{communityName}</Text>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: "all", label: "All" },
            { key: "community", label: "Community" },
            { key: "elder_session", label: "Elder Sessions" },
            { key: "circle", label: "Circle" },
            { key: "service", label: "Service" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterTab, filter === item.key && styles.filterTabActive]}
              onPress={() => setFilter(item.key as any)}
            >
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {/* Featured Elder Sessions */}
        {filter === "all" && elderSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Elder Sessions</Text>
            {elderSessions.slice(0, 2).map(renderGatheringCard)}
          </View>
        )}

        {/* All Events */}
        <View style={styles.section}>
          {filter === "all" && <Text style={styles.sectionTitle}>Upcoming Events</Text>}
          {filtered.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No gatherings yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to create one!</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate("CreateGathering" as any, { communityId })}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Create Gathering</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map(renderGatheringCard)
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  createButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,198,174,0.2)", alignItems: "center", justifyContent: "center" },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center" },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F5F7FA", marginRight: 8 },
  filterTabActive: { backgroundColor: "#0A2342" },
  filterText: { fontSize: 13, fontWeight: "500", color: "#6B7280" },
  filterTextActive: { color: "#FFFFFF" },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginBottom: 12 },
  gatheringCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, marginBottom: 10 },
  typeLabel: { fontSize: 12, fontWeight: "600" },
  gatheringTitle: { fontSize: 17, fontWeight: "700", color: "#0A2342", marginBottom: 6 },
  gatheringDesc: { fontSize: 14, color: "#6B7280", lineHeight: 20, marginBottom: 12 },
  gatheringMeta: { gap: 6, marginBottom: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13, color: "#6B7280" },
  gatheringBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  organizerRow: { flex: 1 },
  organizerText: { fontSize: 12, color: "#9CA3AF" },
  rsvpRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rsvpCount: { flexDirection: "row", alignItems: "center", gap: 4 },
  rsvpCountText: { fontSize: 13, fontWeight: "600", color: "#00C6AE" },
  goingButton: { backgroundColor: "#00C6AE", paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
  goingButtonText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  familyBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  familyText: { fontSize: 12, color: "#8B5CF6" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 20 },
  emptyButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#00C6AE", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  emptyButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
});
