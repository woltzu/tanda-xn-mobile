import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, typography, spacing } from "../theme/tokens";

const ORANGE = "#F97316";
const KENTE = ["#C4622D", "#E8A842", "#2A5240"];
const AMBER_TINT = "rgba(232,168,66,0.10)";

type UploadStatus = "uploaded" | "pending";

interface DocRow {
  emoji: string;
  title: string;
  subtitle: string;
  optional?: boolean;
  status: UploadStatus;
}

export default function ProviderVerificationScreen() {
  const navigation = useNavigation<any>();
  const [elderEndorsement, setElderEndorsement] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([
    {
      emoji: "\u{1FAAA}",
      title: "Government ID",
      subtitle: "National ID or passport",
      status: "uploaded",
    },
    {
      emoji: "\u{1F4C4}",
      title: "Business license",
      subtitle: "Strengthens your trust badge",
      optional: true,
      status: "pending",
    },
    {
      emoji: "\u{1F4C3}",
      title: "Past trip proof",
      subtitle: "Photos, receipts, or testimonials",
      status: "pending",
    },
  ]);

  const handleUploadPress = (index: number) => {
    // Toggle for demo purposes
    setDocs((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        status: next[index].status === "pending" ? "uploaded" : "pending",
      };
      return next;
    });
  };

  const timeline = [
    { badge: "24h", label: "TandaXn reviews your documents" },
    { badge: "\u2192", label: "You get a notification when approved" },
    { badge: "\u2192", label: "Create your first trip listing" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.primaryNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>2/3</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>Verify your business</Text>
        <Text style={styles.subtitle}>
          TandaXn reviews documents within 24 hours. Verified providers get a
          trust badge and higher search placement.
        </Text>

        {/* Document Upload Rows */}
        <View style={styles.card}>
          {docs.map((doc, i) => {
            const isUploaded = doc.status === "uploaded";
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.docRow,
                  isUploaded ? styles.docRowUploaded : styles.docRowPending,
                  i < docs.length - 1 && { marginBottom: spacing.md },
                ]}
                activeOpacity={0.7}
                onPress={() => handleUploadPress(i)}
              >
                <Text style={styles.docEmoji}>{doc.emoji}</Text>
                <View style={styles.docInfo}>
                  <View style={styles.docTitleRow}>
                    <Text style={styles.docTitle}>{doc.title}</Text>
                    {doc.optional && (
                      <Text style={styles.optionalBadge}>optional</Text>
                    )}
                  </View>
                  <Text style={styles.docSubtitle}>{doc.subtitle}</Text>
                </View>
                <Text
                  style={[
                    styles.docStatus,
                    { color: isUploaded ? colors.accentTeal : colors.textSecondary },
                  ]}
                >
                  {isUploaded ? "\u2713 Uploaded" : "Upload"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Kente Divider */}
        <View style={styles.kenteDivider}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.kenteBar,
                { backgroundColor: KENTE[i % KENTE.length] },
              ]}
            />
          ))}
        </View>

        {/* Elder Endorsement Card */}
        <View style={styles.elderCard}>
          <View style={styles.elderHeader}>
            <Text style={styles.elderIcon}>{"\u{1F451}"}</Text>
            <View style={styles.elderTextWrap}>
              <Text style={styles.elderTitle}>Request Elder Endorsement</Text>
            </View>
            <Switch
              value={elderEndorsement}
              onValueChange={setElderEndorsement}
              trackColor={{ false: colors.border, true: colors.accentTeal }}
              thumbColor={elderEndorsement ? "#FFFFFF" : "#F4F4F5"}
            />
          </View>
          <Text style={styles.elderDesc}>
            Ask a community elder to vouch for your business. Elder-endorsed
            providers earn a gold trust badge and rank higher in search results.
          </Text>
        </View>

        {/* What Happens Next */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What happens next</Text>
          {timeline.map((item, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={styles.timelineBadge}>
                <Text style={styles.timelineBadgeText}>{item.badge}</Text>
              </View>
              <Text style={styles.timelineLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => {
            // Submit logic would go here
            navigation.navigate("ProviderDiscovery");
          }}
        >
          <Text style={styles.ctaText}>Submit for Review</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  stepBadge: {
    backgroundColor: colors.navyTintBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  stepBadgeText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },

  /* Title */
  title: {
    fontSize: 17,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },

  /* Card */
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: spacing.md,
  },

  /* Doc Rows */
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.medium,
    padding: spacing.lg,
    borderWidth: 1.5,
  },
  docRowUploaded: {
    borderColor: colors.accentTeal,
    borderStyle: "solid",
  },
  docRowPending: {
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  docEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  docTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  docTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  optionalBadge: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  docSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  docStatus: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
  },

  /* Kente Divider */
  kenteDivider: {
    flexDirection: "row",
    marginBottom: spacing.lg,
    gap: 3,
  },
  kenteBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    opacity: 0.35,
  },

  /* Elder Endorsement */
  elderCard: {
    backgroundColor: AMBER_TINT,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  elderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  elderIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  elderTextWrap: {
    flex: 1,
  },
  elderTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  elderDesc: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  /* Timeline */
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  timelineBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navyTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  timelineBadgeText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  timelineLabel: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  /* CTA */
  ctaButton: {
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },
});
