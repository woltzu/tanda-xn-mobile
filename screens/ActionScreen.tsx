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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";
import { useElder } from "../context/ElderContext";

// ============ DESIGN TOKENS ============

const COLORS = {
  navy: "#0A2342",
  navyLight: "#0E2D54",
  teal: "#00C6AE",
  tealLight: "rgba(0,198,174,0.12)",
  gold: "#E8A842",
  goldLight: "rgba(232,168,66,0.12)",
  bg: "#F5F7FA",
  white: "#FFFFFF",
  purple: "#7C5CFC",
  purpleLight: "rgba(124,92,252,0.12)",
  navyIconBg: "rgba(10,35,66,0.10)",
  textDark: "#1A1A2E",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  cardShadow: "rgba(10,35,66,0.08)",
  urgentBorder: "#E8A842",
  primaryBorder: "#00C6AE",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  iconBgColor: string;
  iconColor: string;
  route: string | null;
  priority: number;
  visible: boolean;
  isUrgent: boolean;
  isPrimary: boolean;
}

// ============ COMPONENT ============

const ActionScreen: React.FC = () => {
  const { t } = useTranslation();

  const navigation = useNavigation<any>();
  const { user, session } = useAuth();
  const { myCircles } = useCircles();
  const { isElder, elderProfile } = useElder();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef<Animated.Value[]>(
    Array.from({ length: 7 }, () => new Animated.Value(0))
  ).current;

  // ---- Contextual Intelligence ----

  const userJoinedDaysAgo = useMemo(() => {
    if (!session?.user?.created_at) return 999;
    const created = new Date(session.user.created_at);
    const now = new Date();
    return Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );
  }, [session]);

  const hasCircles = myCircles.length > 0;

  const hasPendingContribution = useMemo(() => {
    return myCircles.some((circle) => {
      if (circle.status !== "active") return false;
      return true;
    });
  }, [myCircles]);

  const contributionDueSoon = useMemo(() => {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    return myCircles.some((circle) => {
      if (circle.status !== "active") return false;
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
      const daysSinceStart = Math.floor(
        (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const cyclesPassed = Math.floor(daysSinceStart / freqDays);
      const nextDueDate = new Date(start);
      nextDueDate.setDate(
        nextDueDate.getDate() + (cyclesPassed + 1) * freqDays
      );
      return nextDueDate <= threeDaysFromNow;
    });
  }, [myCircles]);

  const isNewMember = userJoinedDaysAgo < 30;

  const isTrustedTierPlus = useMemo(() => {
    const score = elderProfile?.honorScore ?? user?.xnScore ?? 0;
    return score >= 50;
  }, [elderProfile, user]);

  // ---- Build contextual action list ----

  const actions: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = [
      {
        id: "start_circle",
        title: t("action_screen.action_start_circle_title"),
        subtitle: t("action_screen.action_start_circle_sub"),
        icon: "people-circle",
        iconBgColor: COLORS.tealLight,
        iconColor: COLORS.teal,
        route: "CreateCircleStart",
        priority: hasCircles ? 40 : 10,
        visible: true,
        isUrgent: false,
        isPrimary: !hasCircles,
      },
      {
        id: "contribute",
        title: t("action_screen.action_contribute_title"),
        subtitle: t("action_screen.action_contribute_sub"),
        icon: "cash",
        iconBgColor: contributionDueSoon ? COLORS.goldLight : COLORS.tealLight,
        iconColor: contributionDueSoon ? COLORS.gold : COLORS.teal,
        route: "SelectCircleContribution",
        priority: contributionDueSoon ? 5 : 30,
        visible: hasPendingContribution,
        isUrgent: contributionDueSoon,
        isPrimary: false,
      },
      {
        id: "send_money",
        title: t("action_screen.action_send_title"),
        subtitle: t("action_screen.action_send_sub"),
        icon: "send",
        iconBgColor: COLORS.navyIconBg,
        iconColor: COLORS.navy,
        route: "SendMoney",
        priority: 50,
        visible: true,
        isUrgent: false,
        isPrimary: false,
      },
      {
        id: "vouch",
        title: t("action_screen.action_vouch_title"),
        subtitle: t("action_screen.action_vouch_sub"),
        icon: "shield-checkmark",
        iconBgColor: COLORS.goldLight,
        iconColor: COLORS.gold,
        route: "VouchMember",
        priority: 60,
        visible: isTrustedTierPlus,
        isUrgent: false,
        isPrimary: false,
      },
      {
        id: "share_moment",
        title: t("action_screen.action_share_title"),
        subtitle: t("action_screen.action_share_sub"),
        icon: "camera",
        iconBgColor: COLORS.tealLight,
        iconColor: COLORS.teal,
        route: "PostToCommunity",
        priority: 70,
        visible: true,
        isUrgent: false,
        isPrimary: false,
      },
      {
        id: "request_help",
        title: t("action_screen.action_request_help_title"),
        subtitle: t("action_screen.action_request_help_sub"),
        icon: "hand-left",
        iconBgColor: COLORS.purpleLight,
        iconColor: COLORS.purple,
        route: null,
        priority: isNewMember ? 8 : 80,
        visible: true,
        isUrgent: false,
        isPrimary: isNewMember,
      },
      {
        id: "open_session",
        title: t("action_screen.action_session_title"),
        subtitle: t("action_screen.action_session_sub"),
        icon: "school",
        iconBgColor: COLORS.goldLight,
        iconColor: COLORS.gold,
        route: "ElderDashboard",
        priority: 100,
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
    t,
  ]);

  // ---- Entrance Animation ----

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    const staggerDelay = 70;
    actions.forEach((_, index) => {
      Animated.timing(cardAnims[index], {
        toValue: 1,
        duration: 320,
        delay: 200 + index * staggerDelay,
        useNativeDriver: true,
      }).start();
    });
  }, [actions.length]);

  // ---- Handlers ----

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
    });
  };

  const handleAction = (action: ActionItem) => {
    if (action.route === null) {
      Alert.alert(
        t("action_screen.action_request_help_title"),
        t("action_screen.alert_help_body"),
        [
          {
            text: t("action_screen.alert_help_vouch"),
            onPress: () => {
              navigation.goBack();
              setTimeout(() => navigation.navigate("CommunityBrowser"), 100);
            },
          },
          {
            text: t("action_screen.alert_help_guidance"),
            onPress: () => {
              navigation.goBack();
              setTimeout(() => navigation.navigate("CommunityBrowser"), 100);
            },
          },
          { text: t("action_screen.alert_help_cancel"), style: "cancel" },
        ],
        { cancelable: true }
      );
      return;
    }

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

    const translateY = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 0],
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
          style={[
            styles.actionCard,
            action.isUrgent && styles.actionCardUrgent,
            action.isPrimary && styles.actionCardPrimary,
          ]}
          onPress={() => handleAction(action)}
          activeOpacity={0.7}
        >
          {/* Icon Area */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: action.iconBgColor },
            ]}
          >
            <Ionicons name={action.icon} size={26} color={action.iconColor} />
          </View>

          {/* Text Area */}
          <View style={styles.actionTextContainer}>
            <View style={styles.actionTitleRow}>
              <Text
                style={[
                  styles.actionTitle,
                  action.isUrgent && styles.actionTitleUrgent,
                  action.isPrimary && styles.actionTitlePrimary,
                ]}
                numberOfLines={1}
              >
                {action.title}
              </Text>
              {action.isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>{t("action_screen.badge_due_soon")}</Text>
                </View>
              )}
              {action.isPrimary && !action.isUrgent && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>{t("action_screen.badge_suggested")}</Text>
                </View>
              )}
            </View>
            <Text style={styles.actionSubtitle} numberOfLines={2}>
              {action.subtitle}
            </Text>
          </View>

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={COLORS.textMuted}
            style={styles.chevron}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ---- Contextual Greeting ----

  const greeting = useMemo(() => {
    if (isNewMember) return t("action_screen.greet_new_member");
    if (contributionDueSoon) return t("action_screen.greet_contrib_due");
    if (!hasCircles) return t("action_screen.greet_no_circles");
    return t("action_screen.greet_default");
  }, [isNewMember, contributionDueSoon, hasCircles, t]);

  const firstName = user?.name ? user.name.split(" ")[0] : null;

  // ---- Main Render ----

  return (
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Navy Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.headerInner}>
            <View style={styles.flameContainer}>
              <Ionicons name="flame" size={20} color={COLORS.gold} />
            </View>
            <Text style={styles.headerGreeting}>{greeting}</Text>
            {firstName && (
              <Text style={styles.headerName}>
                {isNewMember
                  ? t("action_screen.name_new_member", { name: firstName })
                  : t("action_screen.name_default", { name: firstName })}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Scrollable Action Cards */}
        <Animated.View
          style={[
            styles.body,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {actions.map((action, index) => renderActionCard(action, index))}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </Animated.View>

        {/* Close Button */}
        <View style={styles.closeContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={COLORS.navy} />
          </TouchableOpacity>
          <Text style={styles.closeLabel}>{t("action_screen.btn_close")}</Text>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

// ============ STYLES ============

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safeArea: {
    flex: 1,
  },

  // ---- Header ----
  header: {
    backgroundColor: COLORS.navy,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 28,
    paddingTop: Platform.OS === "android" ? 44 : 12,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.navy,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerInner: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  flameContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(232,168,66,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.white,
    textAlign: "center",
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  headerName: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  // ---- Body ----
  body: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  // ---- Action Card ----
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.cardShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionCardUrgent: {
    borderColor: COLORS.urgentBorder,
    borderWidth: 1.5,
    backgroundColor: "#FFFDF7",
  },
  actionCardPrimary: {
    borderColor: COLORS.primaryBorder,
    borderWidth: 1.5,
    backgroundColor: "#F7FFFE",
  },

  // ---- Icon ----
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  // ---- Text ----
  actionTextContainer: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  actionTitleUrgent: {
    color: "#B07818",
  },
  actionTitlePrimary: {
    color: "#009B89",
  },
  actionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  chevron: {
    marginLeft: 8,
  },

  // ---- Badges ----
  urgentBadge: {
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.gold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  primaryBadge: {
    backgroundColor: COLORS.tealLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.teal,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ---- Bottom ----
  bottomSpacer: {
    height: 16,
  },
  closeContainer: {
    alignItems: "center",
    paddingBottom: Platform.OS === "android" ? 24 : 16,
    paddingTop: 8,
    backgroundColor: COLORS.bg,
  },
  closeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0,0,0,0.1)",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  closeLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});

export default ActionScreen;
