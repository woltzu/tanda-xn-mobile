import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type HowCirclesWorkNavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get("window");

// Circle type explanations
const circleTypeExplanations = [
  {
    id: "traditional",
    name: "Traditional Tanda",
    emoji: "🔄",
    color: "#00C6AE",
    howItWorks: [
      "A group of people agree to save together (e.g., 10 members, $100/month)",
      "Each month, everyone contributes their share to the pot ($1,000 total)",
      "One member receives the entire pot each cycle",
      "The cycle continues until everyone has received the pot once",
      "Order is determined by XnScore, random draw, or mutual agreement",
    ],
    example: {
      members: 10,
      contribution: 100,
      frequency: "monthly",
      pot: 1000,
      duration: "10 months",
    },
    benefits: [
      "Discipline: Forced savings on a schedule",
      "Lump sum: Receive a large amount when it's your turn",
      "Community: Built on trust and mutual support",
      "No interest: Unlike loans, you pay nothing extra",
    ],
  },
  {
    id: "family-support",
    name: "Family Support",
    emoji: "👨‍👩‍👧‍👦",
    color: "#6366F1",
    howItWorks: [
      "Choose a beneficiary (mom, cousin, friend in need)",
      "Invite family/friends to contribute",
      "Select one-time collection OR recurring schedule",
      "All funds go directly to the beneficiary",
      "Perfect for supporting loved ones back home",
    ],
    example: {
      members: 5,
      contribution: 200,
      frequency: "monthly",
      pot: 1000,
      duration: "Ongoing or one-time",
    },
    benefits: [
      "Direct support: Funds go to someone you care about",
      "Flexible: One-time for emergencies, recurring for ongoing support",
      "Transparent: Everyone sees where money goes",
      "Diaspora-friendly: Perfect for supporting family abroad",
    ],
  },
  {
    id: "goal",
    name: "Goal-Based Circle",
    emoji: "🎯",
    color: "#F59E0B",
    howItWorks: [
      "Set a shared goal (funeral fund, wedding, group purchase)",
      "Choose a target amount and deadline",
      "Members contribute until the goal is reached",
      "Can be one-time (funeral) or recurring (monthly savings)",
      "Funds released when target is achieved",
    ],
    example: {
      members: 8,
      contribution: 150,
      frequency: "one-time",
      pot: 1200,
      duration: "Until goal reached",
    },
    benefits: [
      "Shared motivation: Group accountability helps everyone save",
      "Specific purpose: Clear goal keeps everyone focused",
      "Flexible timing: Contribute when you can",
      "Achievable goals: Reach targets faster together",
    ],
  },
  {
    id: "emergency",
    name: "Emergency Fund Circle",
    emoji: "🛡️",
    color: "#EF4444",
    howItWorks: [
      "Members contribute regularly to build a shared fund",
      "When emergencies arise, members can request funds",
      "Requests are reviewed by the group or elder",
      "Approved requests receive funds from the pool",
      "Continuous protection for all members",
    ],
    example: {
      members: 12,
      contribution: 50,
      frequency: "monthly",
      pot: 600,
      duration: "Ongoing",
    },
    benefits: [
      "Safety net: Protection when unexpected costs arise",
      "Community support: Help each other through tough times",
      "Lower burden: Small regular contributions add up",
      "Peace of mind: Know you're covered for emergencies",
    ],
  },
];

// FAQ items
const faqItems = [
  {
    question: "What happens if someone doesn't pay?",
    answer:
      "TandaXn protects contributions against individual member defaults. If someone misses a payment, the circle continues and the defaulter's XnScore drops significantly. They may be removed from the circle and face restrictions on joining future circles.",
  },
  {
    question: "How is payout order decided?",
    answer:
      "Traditional tandas can use: 1) XnScore ranking (highest score goes first), 2) Random draw each cycle, or 3) Manual selection agreed by members. The method is set when creating the circle.",
  },
  {
    question: "What is XnScore?",
    answer:
      "XnScore is your trust rating on TandaXn. It increases when you pay on time, complete circles, and behave responsibly. Higher scores let you create circles, join premium circles, and get better payout positions.",
  },
  {
    question: "Can I leave a circle early?",
    answer:
      "You can request to leave, but if you've already received a payout, you'll need to continue contributing or return the funds. Leaving early affects your XnScore. Contact support for hardship situations.",
  },
  {
    question: "What fees does TandaXn charge?",
    answer:
      "TandaXn charges a small service fee (typically 2-3%) on payouts to maintain the platform and protection fund. Payment processing fees may apply for certain payment methods. All fees are shown before you confirm.",
  },
  {
    question: "How are international transfers handled?",
    answer:
      "For diaspora circles supporting family abroad, TandaXn partners with trusted money transfer services to ensure funds arrive quickly and securely. Exchange rates and transfer fees are shown upfront.",
  },
];

export default function HowCirclesWorkScreen() {
  const navigation = useNavigation<HowCirclesWorkNavigationProp>();
  const [selectedType, setSelectedType] = useState("traditional");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const currentType = circleTypeExplanations.find(
    (t) => t.id === selectedType
  )!;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>How Savings Circles Work</Text>
              <Text style={styles.headerSubtitle}>
                Learn about tandas and rotating savings
              </Text>
            </View>
          </View>

          {/* Hero illustration */}
          <View style={styles.heroSection}>
            <View style={styles.heroCircle}>
              <Text style={styles.heroEmoji}>🤝</Text>
            </View>
            <Text style={styles.heroText}>
              Savings circles (also known as tandas, susus, chit funds, or
              rotating savings) have been helping communities save for
              centuries.
            </Text>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* What is a Savings Circle */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>What is a Savings Circle?</Text>
            <Text style={styles.paragraph}>
              A savings circle is a group of trusted people who pool money
              together. Each member contributes a fixed amount regularly, and
              the collected "pot" is given to one member at a time until
              everyone has had a turn.
            </Text>
            <Text style={styles.paragraph}>
              Think of it as a way to save AND borrow from yourself, powered by
              your community.
            </Text>
          </View>

          {/* Circle Types Tabs */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Types of Circles</Text>
            <Text style={styles.sectionSubtitle}>
              Tap to learn about each type
            </Text>

            {/* Type Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeTabs}
              contentContainerStyle={styles.typeTabsContent}
            >
              {circleTypeExplanations.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeTab,
                    selectedType === type.id && {
                      backgroundColor: type.color,
                      borderColor: type.color,
                    },
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <Text style={styles.typeTabEmoji}>{type.emoji}</Text>
                  <Text
                    style={[
                      styles.typeTabText,
                      selectedType === type.id && styles.typeTabTextSelected,
                    ]}
                  >
                    {type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selected Type Details */}
            <View
              style={[
                styles.typeDetails,
                { borderLeftColor: currentType.color },
              ]}
            >
              <Text style={styles.typeDetailsTitle}>How it works:</Text>
              {currentType.howItWorks.map((step, index) => (
                <View key={index} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepNumber,
                      { backgroundColor: currentType.color },
                    ]}
                  >
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}

              {/* Example Box */}
              <View style={styles.exampleBox}>
                <Text style={styles.exampleTitle}>📊 Example</Text>
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>Members:</Text>
                  <Text style={styles.exampleValue}>
                    {currentType.example.members} people
                  </Text>
                </View>
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>Each contributes:</Text>
                  <Text style={styles.exampleValue}>
                    ${currentType.example.contribution}/
                    {currentType.example.frequency === "one-time"
                      ? "once"
                      : currentType.example.frequency}
                  </Text>
                </View>
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>Pot size:</Text>
                  <Text style={styles.exampleValueHighlight}>
                    ${currentType.example.pot.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>Duration:</Text>
                  <Text style={styles.exampleValue}>
                    {currentType.example.duration}
                  </Text>
                </View>
              </View>

              {/* Benefits */}
              <Text style={[styles.typeDetailsTitle, { marginTop: 16 }]}>
                Benefits:
              </Text>
              {currentType.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={currentType.color}
                  />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Visual Timeline */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>A Circle in Action</Text>
            <Text style={styles.sectionSubtitle}>
              How a 4-person monthly tanda works
            </Text>

            <View style={styles.timeline}>
              {[1, 2, 3, 4].map((month) => (
                <View key={month} style={styles.timelineItem}>
                  <View style={styles.timelineDot}>
                    <Text style={styles.timelineDotText}>{month}</Text>
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineMonth}>Month {month}</Text>
                    <Text style={styles.timelineDesc}>
                      Everyone pays $100 → Member {month} receives $400
                    </Text>
                  </View>
                  {month < 4 && <View style={styles.timelineLine} />}
                </View>
              ))}
            </View>

            <View style={styles.timelineNote}>
              <Ionicons name="bulb" size={18} color="#F59E0B" />
              <Text style={styles.timelineNoteText}>
                By the end, everyone has paid $400 and received $400. No
                interest, just community power!
              </Text>
            </View>
          </View>

          {/* Protection */}
          <View style={styles.card}>
            <View style={styles.protectionHeader}>
              <View style={styles.protectionIcon}>
                <Ionicons name="shield-checkmark" size={28} color="#00C6AE" />
              </View>
              <View style={styles.protectionHeaderText}>
                <Text style={styles.sectionTitle}>TandaXn Protection</Text>
                <Text style={styles.sectionSubtitle}>
                  Your contributions are secured
                </Text>
              </View>
            </View>

            <View style={styles.protectionFeatures}>
              <View style={styles.protectionFeature}>
                <Ionicons name="lock-closed" size={20} color="#0A2342" />
                <Text style={styles.protectionFeatureText}>
                  Contributions secured against individual defaults
                </Text>
              </View>
              <View style={styles.protectionFeature}>
                <Ionicons name="star" size={20} color="#0A2342" />
                <Text style={styles.protectionFeatureText}>
                  XnScore system ensures trustworthy members
                </Text>
              </View>
              <View style={styles.protectionFeature}>
                <Ionicons name="eye" size={20} color="#0A2342" />
                <Text style={styles.protectionFeatureText}>
                  Full transparency on all transactions
                </Text>
              </View>
              <View style={styles.protectionFeature}>
                <Ionicons name="people" size={20} color="#0A2342" />
                <Text style={styles.protectionFeatureText}>
                  Circle elders help resolve disputes
                </Text>
              </View>
            </View>

            <View style={styles.protectionWarning}>
              <Ionicons name="warning" size={16} color="#92400E" />
              <Text style={styles.protectionWarningText}>
                Note: Protection does not apply in cases of suspected collusion
                or coordinated fraud.
              </Text>
            </View>
          </View>

          {/* FAQ Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

            {faqItems.map((faq, index) => (
              <TouchableOpacity
                key={index}
                style={styles.faqItem}
                onPress={() =>
                  setExpandedFaq(
                    expandedFaq === faq.question ? null : faq.question
                  )
                }
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Ionicons
                    name={
                      expandedFaq === faq.question
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={20}
                    color="#6B7280"
                  />
                </View>
                {expandedFaq === faq.question && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate("CreateCircleStart")}
          >
            <LinearGradient
              colors={["#00C6AE", "#00897B"]}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>Start Your First Circle</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroEmoji: {
    fontSize: 40,
  },
  heroText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 22,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 12,
  },
  typeTabs: {
    marginBottom: 16,
  },
  typeTabsContent: {
    gap: 10,
  },
  typeTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F5F7FA",
    gap: 6,
  },
  typeTabEmoji: {
    fontSize: 16,
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  typeTabTextSelected: {
    color: "#FFFFFF",
  },
  typeDetails: {
    borderLeftWidth: 4,
    paddingLeft: 16,
  },
  typeDetailsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 20,
  },
  exampleBox: {
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  exampleTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 10,
  },
  exampleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  exampleLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  exampleValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
  },
  exampleValueHighlight: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00C6AE",
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 20,
  },
  timeline: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    position: "relative",
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineDotText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 14,
    paddingBottom: 24,
  },
  timelineMonth: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  timelineDesc: {
    fontSize: 13,
    color: "#6B7280",
  },
  timelineLine: {
    position: "absolute",
    left: 15,
    top: 32,
    width: 2,
    height: 40,
    backgroundColor: "#E5E7EB",
  },
  timelineNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  timelineNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  protectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  protectionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  protectionHeaderText: {
    flex: 1,
  },
  protectionFeatures: {
    gap: 14,
  },
  protectionFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  protectionFeatureText: {
    flex: 1,
    fontSize: 14,
    color: "#4B5563",
  },
  protectionWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
  },
  protectionWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 14,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    paddingRight: 12,
  },
  faqAnswer: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    marginTop: 10,
  },
  ctaButton: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
