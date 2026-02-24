import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useFeed, FeedVisibility } from "../context/FeedContext";
import { useAuth } from "../context/AuthContext";
import VisibilityPicker from "../components/VisibilityPicker";
import { colors, radius, typography, spacing } from "../theme/tokens";

export default function CreateDreamPostScreen() {
  const navigation = useNavigation();
  const { createDreamPost } = useFeed();
  const { user } = useAuth();

  const [content, setContent] = useState("");
  const [amount, setAmount] = useState("");
  const [visibility, setVisibility] = useState<FeedVisibility>("public");
  const [showAmount, setShowAmount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);
      const parsedAmount = showAmount && amount ? parseFloat(amount) : undefined;
      await createDreamPost(content.trim(), undefined, parsedAmount, visibility);
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", "Failed to create post. Please try again.");
      console.error("Error creating post:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Your Dream</Text>
          <TouchableOpacity
            style={[styles.postButton, !canSubmit && styles.postButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Author Info */}
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
            <View>
              <Text style={styles.authorName}>
                {user?.user_metadata?.full_name || "You"}
              </Text>
              <Text style={styles.visibilityLabel}>
                {visibility === "public" ? "Public" : visibility === "community" ? "Community" : "Anonymous"}
              </Text>
            </View>
          </View>

          {/* Content Input */}
          <TextInput
            style={styles.contentInput}
            placeholder="What are you dreaming about? Share your savings goals, milestones, or aspirations..."
            placeholderTextColor={colors.textSecondary}
            multiline
            autoFocus
            value={content}
            onChangeText={setContent}
            maxLength={500}
          />

          {/* Character count */}
          <Text style={styles.charCount}>{content.length}/500</Text>

          {/* Amount toggle & input */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => setShowAmount(!showAmount)}
          >
            <Ionicons
              name={showAmount ? "checkbox" : "square-outline"}
              size={22}
              color={showAmount ? colors.accentTeal : colors.textSecondary}
            />
            <Text style={styles.optionLabel}>Include an amount</Text>
          </TouchableOpacity>

          {showAmount && (
            <View style={styles.amountInputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          )}

          {/* Visibility Picker */}
          <View style={styles.section}>
            <VisibilityPicker selected={visibility} onChange={setVisibility} />
          </View>

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Tips for great dream posts</Text>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>1.</Text>
              <Text style={styles.tipText}>Share what you're saving for and why it matters</Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>2.</Text>
              <Text style={styles.tipText}>Celebrate your progress — every milestone counts</Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>3.</Text>
              <Text style={styles.tipText}>Inspire others by sharing your savings journey</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  postButton: {
    backgroundColor: colors.accentTeal,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minWidth: 70,
    alignItems: "center",
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  scrollContent: {
    flex: 1,
    padding: spacing.lg,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  authorName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  visibilityLabel: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contentInput: {
    fontSize: typography.bodyLarge,
    color: colors.textPrimary,
    minHeight: 120,
    textAlignVertical: "top",
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  charCount: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: "right",
    marginBottom: spacing.lg,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  optionLabel: {
    fontSize: typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  dollarSign: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.sectionHeader,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  section: {
    marginTop: spacing.md,
  },
  tipsCard: {
    backgroundColor: colors.softerNavyTintBg,
    borderRadius: radius.small,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  tipsTitle: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  tipBullet: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    width: 20,
  },
  tipText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
