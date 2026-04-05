import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, typography, spacing } from "../theme/tokens";

export default function FeedSettingsScreen() {
  const navigation = useNavigation();

  const [autoPostGoals, setAutoPostGoals] = useState(true);
  const [autoPostContributions, setAutoPostContributions] = useState(true);
  const [autoPostMilestones, setAutoPostMilestones] = useState(true);
  const [autoPostCircles, setAutoPostCircles] = useState(true);
  const [autoPostXnScore, setAutoPostXnScore] = useState(true);
  const [showAmounts, setShowAmounts] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feed Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Auto-Post Settings */}
        <Text style={styles.sectionTitle}>Auto-Post Settings</Text>
        <Text style={styles.sectionDescription}>
          Choose which activities automatically create posts in the Dream Feed.
        </Text>

        <View style={styles.card}>
          <SettingRow
            icon="flag-outline"
            title="New Savings Goals"
            description="When you create a new savings goal"
            value={autoPostGoals}
            onToggle={setAutoPostGoals}
          />
          <SettingRow
            icon="cash-outline"
            title="Circle Contributions"
            description="When you make a circle contribution"
            value={autoPostContributions}
            onToggle={setAutoPostContributions}
          />
          <SettingRow
            icon="trophy-outline"
            title="Milestones"
            description="When you hit 25%, 50%, 75% of a goal"
            value={autoPostMilestones}
            onToggle={setAutoPostMilestones}
          />
          <SettingRow
            icon="people-outline"
            title="Circle Activity"
            description="When you join a circle or receive a payout"
            value={autoPostCircles}
            onToggle={setAutoPostCircles}
          />
          <SettingRow
            icon="trending-up-outline"
            title="XnScore Level Ups"
            description="When your XnScore reaches a new level"
            value={autoPostXnScore}
            onToggle={setAutoPostXnScore}
            isLast
          />
        </View>

        {/* Privacy Settings */}
        <Text style={styles.sectionTitle}>Privacy</Text>

        <View style={styles.card}>
          <SettingRow
            icon="eye-outline"
            title="Show Amounts in Auto-Posts"
            description="Display dollar amounts in auto-generated posts"
            value={showAmounts}
            onToggle={setShowAmounts}
            isLast
          />
        </View>

        <Text style={styles.privacyNote}>
          You can always choose the visibility (Public, Community, or Anonymous) when creating manual dream posts. Anonymous posts hide your name and amounts from other users.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  title,
  description,
  value,
  onToggle,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowBorder]}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.accentTeal + "60" }}
        thumbColor={value ? colors.accentTeal : "#F4F4F5"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  headerTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  sectionDescription: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navyTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  settingTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  settingDescription: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  privacyNote: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.xs,
  },
});
