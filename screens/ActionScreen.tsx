import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";
import { useElder } from "../context/ElderContext";

// ============ DESIGN TOKENS ============

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  gold: "#E8A842",
  bg: "#F5F7FA",
  white: "#FFFFFF",
  overlay: "rgba(10,35,66,0.95)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.65)",
  urgentBg: "rgba(232,168,66,0.15)",
  urgentBorder: "#E8A842",
  primaryBg: "rgba(0,198,174,0.15)",
  primaryBorder: "#00C6AE",
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============ ACTION DEFINITIONS ============

type ActionId =
  | "start_circle"
  | "contribute"
  | "send_money"
  | "vouch"
  | "share_moment"
  | "request_help"
  | "open_session";

interface ActionItem {
  id: ActionId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  route: string | null; // null means Alert-based action
  priority: number; // lower = higher in list
  visible: boolean;
  isUrgent: boolean;
  isPrimary: boolean;
}

// ============ COMPONENT ============

const ActionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, session } = useAuth();
  const { myCircles } = useCircles();
  const { isElder, elderProfile } = useElder();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardAnims = useRef<Animated.Value[]>(
    Array.from({ length: 7 }, () => new Animated.Value(0))
  ).current;

  // ---- Contextual Intelligence ----

  const userJoinedDaysAgo = useMemo(() => {
    if (!session?.user?.created_at) return 999;
    const created = new Date(session.user.created_at);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }, [session]);

  const hasCircles = myCircles.length > 0;

  const hasPendingContribution = useMemo(() => {
    return myCircles.some((circle) => {
      if (circle.status !== "active") return false;
      return true; // Active circles imply ongoing contributions
    });
  }, [myCircles]);

  const contributionDueSoon = useMemo(() => {
    // Check if any circle has a contribution due within 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    return myCircles.some((circle) => {
      if (circle.status !== "active") return false;
      // Use frequency to estimate next due date from start
      if (!circle.startDate) return false;
      const start = new Date(circle.startDate);
      const now = new Date();
      const freqDays =
        circle.frequency === "daily"
          ? 1
          : circle.frequency === "weekly"
          ? 7
          : circle.frequency === "biweekly"
          ? 14
          : 30;
      // Calculate next due date
      const daysSinceStart = Math.floor(
        (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const cyclesPassed = Math.floor(daysSinceStart / freqDays);
      const nextDueDate = new Date(start);
      nextDueDate.setDate(nextDueDate.getDate() + (cyclesPassed + 1) * freqDays);
      return nextDueDate <= threeDaysFromNow;
    });
  }, [myCircles]);

  const isNewMember = userJoinedDaysAgo < 30;

  const isTrustedTierPlus = useMemo(() => {
    const score = elderProfile?.honorScore ?? user?.xnScore ?? 0;
    // Trusted tier starts at score 50+
    return score >= 50;
  }, [elderProfile, user]);

  // ---- Build contextual action list ----

  const actions: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = [
      {
        id: "start_circle",
        title: "Start a Circle",
        subtitle: "Plant something new",
        icon: "people-circle",
        accentColor: COLORS.teal,
        route: "CreateCircleStart",
        priority: hasCircles ? 40 : 10,
        visible: true,
        isUrgent: false,
        isPrimary: !hasCircles,
      },
      {
        id: "contribute",
        title: "Contribute",
        subtitle: "Three taps to money moved",
        icon: "cash",
        accentColor: contributionDueSoon ? COLORS.gold : COLORS.teal,
        route: "SelectCircleContribution",
        priority: contributionDueSoon ? 5 : 30,
        visible: hasPendingContribution,
        isUrgent: contributionDueSoon,
        isPrimary: false,
      },
      {
        id: "send_money",
        title: "Send to Someone",
        subtitle: "Send to a face, not an account",
        icon: "send",
        accentColor: COLORS.teal,
        route: "SendMoney",
        priority: 50,
        visible: true,
        isUrgent: false,
        isPrimary: false,
      },
      {
        id: "vouch",
        title: "Vouch for Someone",
        subtitle: "Your Honor Score is on the line",
        icon: "shield-checkmark",
        accentColor: COLORS.gold,
        route: "VouchMember",
        priority: 60,
        visible: isTrustedTierPlus,
        isUrgent: false,
        isPrimary: false,
      },
      {
        id: "share_moment",
        title: "Share a Moment",
        subtitle: "Milestone, question, or welcome",
        icon: "camera",
        accentColor: COLORS.teal,
        route: "PostToCommunity",
        priority: 70,
        visible: true,
        isUrgent: false,
        isPrimary: false,
      },
      {
        id: "request_help",
        title: "Request Help",
        subtitle: "I need a vouch, guidance, or welcome",
        icon: "hand-left",
        accentColor: COLORS.teal,
        route: null,
        priority: isNewMember ? 8 : 80,
        visible: true,
        isUrgent: false,
        isPrimary: isNewMember,
      },
      {
        id: "open_session",
        title: "Open a Session",
        subtitle: "Post wisdom or announce Q&A",
        icon: "school",
        accentColor: COLORS.gold,
        route: "ElderDashboard",
        priority: 100, // Always at bottom
        visible: isElder,
        isUrgent: false,
        isPrimary: false,
      },
    ];

    return items
      .filter((item) => item.visible)
      .sort((a, b) => a.priority - b.priority);
  }, [
    hasCircles,
    hasPendingContribution,
    contributionDueSoon,
    isTrustedTierPlus,
    isNewMember,
    isElder,
  ]);

  // ---- Entrance Animation ----

  useEffect(() => {
    // Fade in the overlay and title
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Stagger card animations
    const staggerDelay = 60;
    actions.forEach((_, index) => {
      Animated.timing(cardAnims[index], {
        toValue: 1,
        duration: 280,
        delay: 150 + index * staggerDelay,
        useNativeDriver: true,
      }).start();
    });
  }, [actions.length]);

  // ---- Handlers ----

  const handleClose = () => {
    // Animate out then navigate back
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 40,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
    });
  };

  const handleAction = (action: ActionItem) => {
    if (action.route === null) {
      // Request Help - Alert for now
      Alert.alert(
        "Request Help",
        "What kind of help do you need?",
        [
          {
            text: "I need a vouch",
            onPress: () => {
              navigation.goBack();
              // Navigate after goBack settles
              setTimeout(() => navigation.navigate("CommunityBrowser"), 100);
            },
          },
          {
            text: "I need guidance",
            onPress: () => {
              navigation.goBack();
              setTimeout(() => navigation.navigate("CommunityBrowser"), 100);
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true }
      );
      return;
    }

    // Close the action sheet then navigate
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      navigation.goBack();
      setTimeout(() => {
        navigation.navigate(action.route as string);
      }, 50);
    });
  };

  // ---- Render Helpers ----

  const renderActionCard = (action: ActionItem, index: number) => {
    const animValue = cardAnims[index] || new Animated.Value(1);

    const cardStyle = [
      styles.actionCard,
      action.isUrgent && styles.actionCardUrgent,
      action.isPrimary && styles.actionCardPrimary,
      {
        borderLeftColor: action.isUrgent
          ? COLORS.urgentBorder
          : action.isPrimary
          ? COLORS.primaryBorder
          : action.accentColor,
      },
    ];

    const translateY = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [24, 0],
    });

    return (
      <Animated.View
        key={action.id}
        style={{
          opacity: animValue,
          transform: [{ translateY }],
        }}
      >
        <TouchableOpacity
          style={cardStyle}
          onPress={() => handleAction(action)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: action.isUrgent
                  ? COLORS.urgentBg
                  : action.isPrimary
                  ? COLORS.primaryBg
                  : COLORS.cardBg,
              },
            ]}
          >
            <Ionicons
              name={action.icon}
              size={26}
              color={
                action.isUrgent
                  ? COLORS.gold
                  : action.isPrimary
                  ? COLORS.teal
                  : COLORS.textPrimary
              }
            />
          </View>

          <View style={styles.actionTextContainer}>
            <View style={styles.actionTitleRow}>
              <Text
                style={[
                  styles.actionTitle,
                  action.isUrgent && styles.actionTitleUrgent,
                  action.isPrimary && styles.actionTitlePrimary,
                ]}
              >
                {action.title}
              </Text>
              {action.isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>Due Soon</Text>
                </View>
              )}
              {action.isPrimary && !action.isUrgent && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>Suggested</Text>
                </View>
              )}
            </View>
            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="rgba(255,255,255,0.3)"
            style={styles.chevron}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ---- Contextual Greeting ----

  const greeting = useMemo(() => {
    if (isNewMember) return "Welcome. What do you need today?";
    if (contributionDueSoon) return "You have a contribution coming up.";
    if (!hasCircles) return "Ready to start your first circle?";
    return "What do you want to make happen?";
  }, [isNewMember, contributionDueSoon, hasCircles]);

  // ---- Main Render ----

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerAccent} />
            <Text style={styles.headerTitle}>{greeting}</Text>
            {user?.name && (
              <Text style={styles.headerSubtitle}>
                Hey {user.name.split(" ")[0]}, let's make it happen.
              </Text>
            )}
          </View>

          {/* Action Cards */}
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {actions.map((action, index) => renderActionCard(action, index))}

            {/* Bottom spacer for close button */}
            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Close Button */}
          <View style={styles.closeContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.closeLabel}>Close</Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
};

// ============ STYLES ============

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Header
  header: {
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",
  },
  headerAccent: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.teal,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  // Scroll
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 20,
  },

  // Action Card
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.teal,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionCardUrgent: {
    backgroundColor: COLORS.urgentBg,
    borderColor: "rgba(232,168,66,0.3)",
  },
  actionCardPrimary: {
    backgroundColor: COLORS.primaryBg,
    borderColor: "rgba(0,198,174,0.25)",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    letterSpacing: -0.1,
  },
  actionTitleUrgent: {
    color: COLORS.gold,
  },
  actionTitlePrimary: {
    color: COLORS.teal,
  },
  actionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  chevron: {
    marginLeft: 8,
  },

  // Badges
  urgentBadge: {
    backgroundColor: "rgba(232,168,66,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  urgentBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.gold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  primaryBadge: {
    backgroundColor: "rgba(0,198,174,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.teal,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Bottom
  bottomSpacer: {
    height: 80,
  },
  closeContainer: {
    alignItems: "center",
    paddingBottom: 24,
    paddingTop: 8,
  },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    letterSpacing: 0.5,
  },
});

export default ActionScreen;
