import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

interface AuditTrailParams {
  circleName?: string;
  circleId?: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: "admin" | "elder" | "member" | "system";
  action: string;
  category: "payment" | "member" | "settings" | "dispute" | "circle" | "payout";
  target?: string;
  details: string;
  ipAddress?: string;
}

export default function AuditTrailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as AuditTrailParams) || {};
  const circleName = params.circleName || "Family Savings Circle";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Mock audit data
  const auditEntries: AuditEntry[] = [
    {
      id: "1",
      timestamp: "2025-01-21T14:30:00Z",
      actor: "Admin (You)",
      actorRole: "admin",
      action: "Settings Changed",
      category: "settings",
      details: "Updated late payment penalty from 3% to 5%",
      ipAddress: "192.168.1.100",
    },
    {
      id: "2",
      timestamp: "2025-01-21T12:15:00Z",
      actor: "System",
      actorRole: "system",
      action: "Payment Received",
      category: "payment",
      target: "Marie Kamga",
      details: "Payment of $100 received for Cycle 8. Transaction ID: TXN-ABC123",
    },
    {
      id: "3",
      timestamp: "2025-01-21T10:45:00Z",
      actor: "Elder Thomas",
      actorRole: "elder",
      action: "Dispute Resolved",
      category: "dispute",
      target: "Report #RPT-1705234567",
      details: "Marked dispute as resolved. Resolution: Payment timing verified with bank records.",
    },
    {
      id: "4",
      timestamp: "2025-01-20T16:20:00Z",
      actor: "Admin (You)",
      actorRole: "admin",
      action: "Member Paused",
      category: "member",
      target: "Paul Mbarga",
      details: "Membership paused due to 2 consecutive missed payments. Member notified via email.",
      ipAddress: "192.168.1.100",
    },
    {
      id: "5",
      timestamp: "2025-01-20T09:00:00Z",
      actor: "System",
      actorRole: "system",
      action: "Payout Processed",
      category: "payout",
      target: "David Nkodo",
      details: "Payout of $600 processed for Cycle 7. Bank transfer initiated.",
    },
    {
      id: "6",
      timestamp: "2025-01-19T18:30:00Z",
      actor: "Jean Pierre",
      actorRole: "member",
      action: "Dispute Reported",
      category: "dispute",
      details: "New dispute filed: Late payment not marked correctly. Report ID: RPT-1705234567",
    },
    {
      id: "7",
      timestamp: "2025-01-19T14:00:00Z",
      actor: "Admin (You)",
      actorRole: "admin",
      action: "Member Added",
      category: "member",
      target: "New Member Invitation",
      details: "Invitation sent to emma.t@example.com. Pending acceptance.",
      ipAddress: "192.168.1.100",
    },
    {
      id: "8",
      timestamp: "2025-01-18T11:30:00Z",
      actor: "System",
      actorRole: "system",
      action: "Cycle Started",
      category: "circle",
      details: "Cycle 8 started. Payment reminders sent to 6 members.",
    },
    {
      id: "9",
      timestamp: "2025-01-17T20:00:00Z",
      actor: "Admin (You)",
      actorRole: "admin",
      action: "Payout Order Changed",
      category: "settings",
      target: "Sarah Lobe",
      details: "Moved from position 6 to position 5 in payout order.",
      ipAddress: "192.168.1.100",
    },
    {
      id: "10",
      timestamp: "2025-01-16T15:45:00Z",
      actor: "System",
      actorRole: "system",
      action: "Late Payment Penalty",
      category: "payment",
      target: "Jean Pierre",
      details: "Late payment penalty of $3 applied. Payment was 2 days late.",
    },
  ];

  const categories = [
    { key: "all", label: "All", icon: "list" },
    { key: "payment", label: "Payments", icon: "card" },
    { key: "member", label: "Members", icon: "people" },
    { key: "settings", label: "Settings", icon: "settings" },
    { key: "dispute", label: "Disputes", icon: "alert-circle" },
    { key: "payout", label: "Payouts", icon: "cash" },
    { key: "circle", label: "Circle", icon: "sync" },
  ];

  const filteredEntries = auditEntries.filter((entry) => {
    const matchesCategory =
      selectedCategory === "all" || entry.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.target && entry.target.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryColor = (category: AuditEntry["category"]) => {
    switch (category) {
      case "payment":
        return "#10B981";
      case "member":
        return "#2563EB";
      case "settings":
        return "#6B7280";
      case "dispute":
        return "#F59E0B";
      case "payout":
        return "#8B5CF6";
      case "circle":
        return "#EC4899";
      default:
        return "#6B7280";
    }
  };

  const getCategoryIcon = (category: AuditEntry["category"]) => {
    switch (category) {
      case "payment":
        return "card-outline";
      case "member":
        return "person-outline";
      case "settings":
        return "settings-outline";
      case "dispute":
        return "alert-circle-outline";
      case "payout":
        return "cash-outline";
      case "circle":
        return "sync-outline";
      default:
        return "document-outline";
    }
  };

  const getRoleBadgeColor = (role: AuditEntry["actorRole"]) => {
    switch (role) {
      case "admin":
        return "#DC2626";
      case "elder":
        return "#7C3AED";
      case "member":
        return "#2563EB";
      case "system":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const formatFullTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const renderAuditEntry = (entry: AuditEntry) => {
    const isExpanded = expandedEntry === entry.id;
    const categoryColor = getCategoryColor(entry.category);

    return (
      <TouchableOpacity
        key={entry.id}
        style={[styles.auditCard, isExpanded && styles.auditCardExpanded]}
        onPress={() => setExpandedEntry(isExpanded ? null : entry.id)}
        activeOpacity={0.7}
      >
        <View style={styles.auditHeader}>
          <View
            style={[styles.categoryIcon, { backgroundColor: `${categoryColor}20` }]}
          >
            <Ionicons
              name={getCategoryIcon(entry.category) as any}
              size={18}
              color={categoryColor}
            />
          </View>
          <View style={styles.auditContent}>
            <View style={styles.auditTitleRow}>
              <Text style={styles.auditAction}>{entry.action}</Text>
              <Text style={styles.auditTime}>{formatTimestamp(entry.timestamp)}</Text>
            </View>
            <View style={styles.auditActorRow}>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: `${getRoleBadgeColor(entry.actorRole)}20` },
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    { color: getRoleBadgeColor(entry.actorRole) },
                  ]}
                >
                  {entry.actorRole.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.auditActor}>{entry.actor}</Text>
            </View>
            {entry.target && (
              <Text style={styles.auditTarget}>→ {entry.target}</Text>
            )}
          </View>
        </View>

        {isExpanded && (
          <View style={styles.auditDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                {formatFullTimestamp(entry.timestamp)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{entry.details}</Text>
            </View>
            {entry.ipAddress && (
              <View style={styles.detailRow}>
                <Ionicons name="globe-outline" size={16} color="#6B7280" />
                <Text style={styles.detailText}>IP: {entry.ipAddress}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="pricetag-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                Category: {entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.expandIndicator}>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#9CA3AF"
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Group entries by date
  const groupedEntries: { [key: string]: AuditEntry[] } = {};
  filteredEntries.forEach((entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!groupedEntries[date]) {
      groupedEntries[date] = [];
    }
    groupedEntries[date].push(entry);
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Audit Trail</Text>
          <Text style={styles.headerSubtitle}>{circleName}</Text>
        </View>
        <TouchableOpacity style={styles.exportButton}>
          <Ionicons name="download-outline" size={24} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search actions, actors, details..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryTab,
                selectedCategory === cat.key && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Ionicons
                name={cat.icon as any}
                size={16}
                color={selectedCategory === cat.key ? "#FFFFFF" : "#6B7280"}
              />
              <Text
                style={[
                  styles.categoryTabText,
                  selectedCategory === cat.key && styles.categoryTabTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>
          {filteredEntries.length} event{filteredEntries.length !== 1 ? "s" : ""} found
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {Object.entries(groupedEntries).length > 0 ? (
          Object.entries(groupedEntries).map(([date, entries]) => (
            <View key={date} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <View style={styles.dateLine} />
                <Text style={styles.dateText}>{date}</Text>
                <View style={styles.dateLine} />
              </View>
              {entries.map(renderAuditEntry)}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No Results</Text>
            <Text style={styles.emptyStateText}>
              No audit entries match your search criteria.
            </Text>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  exportButton: {
    padding: 8,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
    gap: 6,
  },
  categoryTabActive: {
    backgroundColor: "#2563EB",
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  categoryTabTextActive: {
    color: "#FFFFFF",
  },
  resultsBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  resultsText: {
    fontSize: 13,
    color: "#6B7280",
  },
  content: {
    flex: 1,
  },
  dateGroup: {
    marginTop: 16,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dateText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
  },
  auditCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  auditCardExpanded: {
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  auditHeader: {
    flexDirection: "row",
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  auditContent: {
    flex: 1,
  },
  auditTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  auditAction: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  auditTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  auditActorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  auditActor: {
    fontSize: 13,
    color: "#6B7280",
  },
  auditTarget: {
    fontSize: 13,
    color: "#2563EB",
    marginTop: 4,
  },
  auditDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  expandIndicator: {
    alignItems: "center",
    marginTop: 8,
  },
  emptyState: {
    alignItems: "center",
    padding: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  bottomPadding: {
    height: 40,
  },
});
