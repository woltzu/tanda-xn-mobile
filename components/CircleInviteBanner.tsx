import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { colors, radius, typography, spacing } from "../theme/tokens";

type BannerNavigationProp = StackNavigationProp<RootStackParamList>;

interface CircleInviteBannerProps {
  circleId: string;
  circleName: string;
  inviterName: string;
  emoji?: string;
  contribution?: number;
  frequency?: string;
  members?: number;
}

export default function CircleInviteBanner({
  circleId,
  circleName,
  inviterName,
  emoji = "\uD83D\uDCB0",
  contribution,
  frequency,
  members,
}: CircleInviteBannerProps) {
  const navigation = useNavigation<BannerNavigationProp>();

  const handlePress = () => {
    navigation.navigate("CircleInvite", {
      circleId,
      name: circleName,
      emoji,
      inviterName,
      contribution,
      frequency,
      members,
    });
  };

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={styles.emojiBox}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>

      <View style={styles.textColumn}>
        <Text style={styles.headline} numberOfLines={1}>
          {inviterName} invited you to {circleName}
        </Text>
        <Text style={styles.cta}>
          Join now <Ionicons name="arrow-forward" size={12} color={colors.accentTeal} />
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.accentTeal} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTintBg,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.25)",
  },
  emojiBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  emoji: {
    fontSize: 22,
  },
  textColumn: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headline: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    marginBottom: 2,
  },
  cta: {
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    color: colors.accentTeal,
  },
});
