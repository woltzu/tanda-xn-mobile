import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type NavigationProp = StackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * ADVANCE EXPLANATION SCREEN
 *
 * Educational content explaining the "Advance on Future Payout" system
 * Key message: This is NOT a loan - it's YOUR future money advanced early
 */

const EXPLANATION_SLIDES = [
  {
    id: 1,
    icon: "cash-outline" as const,
    title: "What is Advance on Payout?",
    description:
      "When you're part of a savings circle, you have a guaranteed payout coming on a specific date. With Advance on Payout, you can access up to 90% of that future payout TODAY.",
    highlight: "It's YOUR money - just received earlier!",
    color: "#00C6AE",
  },
  {
    id: 2,
    icon: "sync-outline" as const,
    title: "How Repayment Works",
    description:
      "Repayment is automatic and simple. When your circle payout date arrives, the advance amount plus a small fee is automatically withheld from your payout. No extra payments needed!",
    highlight: "100% automatic - no monthly payments",
    color: "#3B82F6",
  },
  {
    id: 3,
    icon: "shield-checkmark-outline" as const,
    title: "Not a Traditional Loan",
    description:
      "Unlike loans, there's no credit check, no interest compounding, and no debt collection. You're simply accessing your own future money. If you're in a circle, you already qualify.",
    highlight: "No credit check, no debt",
    color: "#10B981",
  },
  {
    id: 4,
    icon: "trending-up-outline" as const,
    title: "Builds Your XnScore",
    description:
      "Successfully completing an advance boosts your XnScore by up to 5 points. Higher scores unlock better terms - up to 90% advance with only 1% processing fee at Elite tier!",
    highlight: "On-time = XnScore boost",
    color: "#8B5CF6",
  },
];

const FAQS = [
  {
    question: "What happens if I default?",
    answer:
      "If you can't repay, the amount is automatically deducted from your circle payout. If your payout is insufficient, your XnScore drops by 20 points and you may be restricted from future circles until resolved. No external collection agencies - everything stays within TandaXn.",
  },
  {
    question: "How is this different from a loan?",
    answer:
      "Loans are debt you owe to a lender. Advance on Payout is YOUR OWN MONEY from a future circle payout, given to you early. The fee is a one-time charge, not compounding interest. No credit check required.",
  },
  {
    question: "What are the processing fees?",
    answer:
      "Processing fees depend on your XnScore tier:\n- Basic (45-59): 3.5% fee\n- Standard (60-74): 2.5% fee\n- Premium (75-89): 1.5% fee\n- Elite (90+): 1% fee\n\nBetter score = lower fees!",
  },
  {
    question: "How much can I advance?",
    answer:
      "The maximum depends on your tier:\n- Basic: Up to 50% of payout\n- Standard: Up to 65% of payout\n- Premium: Up to 80% of payout\n- Elite: Up to 90% of payout",
  },
  {
    question: "Can I have multiple advances?",
    answer:
      "Yes! You can have up to 2 active advances at a time, from different circle payouts. Each payout can only have one advance against it.",
  },
  {
    question: "What if my circle collapses?",
    answer:
      "If your circle fails before your payout date, we work with you to create a repayment plan. Your advance is secured by your participation in the circle, so this scenario is rare.",
  },
];

export default function AdvanceExplanationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [activeSlide, setActiveSlide] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const slideWidth = SCREEN_WIDTH - 60 + 16; // slide width + marginRight
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActiveSlide(Math.min(slideIndex, EXPLANATION_SLIDES.length - 1));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How It Works</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <Ionicons name="flash" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Advance on Future Payout</Text>
          <Text style={styles.heroSubtitle}>
            Access your circle payout early - it's your money, just sooner
          </Text>
        </View>

        {/* Key Difference Banner */}
        <View style={styles.keyDifference}>
          <View style={styles.keyDifferenceIcon}>
            <Ionicons name="alert-circle" size={24} color="#10B981" />
          </View>
          <View style={styles.keyDifferenceText}>
            <Text style={styles.keyDifferenceTitle}>This is NOT a loan</Text>
            <Text style={styles.keyDifferenceDesc}>
              You're accessing YOUR OWN future circle payout early. No credit check, no debt.
            </Text>
          </View>
        </View>

        {/* Explanation Slides */}
        <View style={styles.slidesSection}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.slidesContainer}
            snapToInterval={SCREEN_WIDTH - 60 + 16}
            snapToAlignment="start"
            decelerationRate="fast"
          >
            {EXPLANATION_SLIDES.map((slide, index) => (
              <View key={slide.id} style={styles.slideCard}>
                <View style={[styles.slideIconBg, { backgroundColor: `${slide.color}20` }]}>
                  <Ionicons name={slide.icon} size={32} color={slide.color} />
                </View>
                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideDescription}>{slide.description}</Text>
                <View style={[styles.slideHighlight, { backgroundColor: `${slide.color}15` }]}>
                  <Ionicons name="checkmark-circle" size={16} color={slide.color} />
                  <Text style={[styles.slideHighlightText, { color: slide.color }]}>
                    {slide.highlight}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Slide Indicators */}
          <View style={styles.slideIndicators}>
            {EXPLANATION_SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.slideIndicator,
                  activeSlide === index && styles.slideIndicatorActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* How It Works Steps */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>Step by Step</Text>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Choose a Future Payout</Text>
              <Text style={styles.stepDesc}>
                Select from your upcoming circle payouts. You'll see the expected amount and date.
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Request Your Advance</Text>
              <Text style={styles.stepDesc}>
                Choose how much to advance (up to your tier limit). See the fee and total repayment upfront.
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Receive Funds</Text>
              <Text style={styles.stepDesc}>
                Funds are sent to your TandaXn wallet within minutes of approval.
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepItem}>
            <View style={[styles.stepNumber, { backgroundColor: "#10B981" }]}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Auto-Repayment</Text>
              <Text style={styles.stepDesc}>
                On your payout date, the advance + fee is automatically withheld. Done!
              </Text>
            </View>
          </View>
        </View>

        {/* Visual Flow Diagram */}
        <View style={styles.flowDiagram}>
          <View style={styles.flowItem}>
            <View style={styles.flowIcon}>
              <Ionicons name="calendar" size={24} color="#0A2342" />
            </View>
            <Text style={styles.flowLabel}>Your Payout</Text>
            <Text style={styles.flowValue}>$2,000</Text>
            <Text style={styles.flowDate}>Feb 15</Text>
          </View>

          <Ionicons name="arrow-forward" size={24} color="#00C6AE" />

          <View style={styles.flowItem}>
            <View style={[styles.flowIcon, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="flash" size={24} color="#10B981" />
            </View>
            <Text style={styles.flowLabel}>Advance</Text>
            <Text style={[styles.flowValue, { color: "#10B981" }]}>$1,000</Text>
            <Text style={styles.flowDate}>Today</Text>
          </View>

          <Ionicons name="arrow-forward" size={24} color="#00C6AE" />

          <View style={styles.flowItem}>
            <View style={[styles.flowIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="wallet" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.flowLabel}>You Receive</Text>
            <Text style={styles.flowValue}>$950</Text>
            <Text style={styles.flowDate}>On Feb 15</Text>
          </View>
        </View>

        {/* FAQs */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

          {FAQS.map((faq, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqItem}
              onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Ionicons
                  name={expandedFaq === index ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#6B7280"
                />
              </View>
              {expandedFaq === index && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Risk Warning */}
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={24} color="#DC2626" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Important to Know</Text>
            <Text style={styles.warningText}>
              If you miss a withholding (default), your XnScore drops by 20 points and you may be restricted from future circles. Always ensure your circle payout will cover your advance.
            </Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* CTA Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate("AdvanceHub")}
        >
          <Text style={styles.ctaButtonText}>View My Advance Options</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A2342",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: "#0A2342",
    marginTop: -1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 198, 174, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 22,
  },
  keyDifference: {
    flexDirection: "row",
    backgroundColor: "#D1FAE5",
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 14,
    padding: 16,
    alignItems: "flex-start",
  },
  keyDifferenceIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  keyDifferenceText: {
    flex: 1,
  },
  keyDifferenceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: 4,
  },
  keyDifferenceDesc: {
    fontSize: 13,
    color: "#047857",
    lineHeight: 19,
  },
  slidesSection: {
    paddingVertical: 24,
  },
  slidesContainer: {
    paddingLeft: 20,
    paddingRight: 40,
  },
  slideCard: {
    width: SCREEN_WIDTH - 60,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  slideIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  slideTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 12,
  },
  slideDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 21,
    marginBottom: 16,
  },
  slideHighlight: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  slideHighlightText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 8,
  },
  slideIndicators: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  slideIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
    marginHorizontal: 4,
  },
  slideIndicatorActive: {
    backgroundColor: "#00C6AE",
    width: 24,
  },
  stepsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00C6AE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
  },
  stepConnector: {
    width: 2,
    height: 24,
    backgroundColor: "#E5E7EB",
    marginLeft: 15,
    marginVertical: 4,
  },
  flowDiagram: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  flowItem: {
    alignItems: "center",
    flex: 1,
  },
  flowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  flowLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 2,
  },
  flowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  flowDate: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  faqSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  faqItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginRight: 10,
  },
  faqAnswer: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: "#FEE2E2",
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 16,
    alignItems: "flex-start",
    marginBottom: 24,
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: "#991B1B",
    lineHeight: 19,
  },
  bottomPadding: {
    height: 100,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginRight: 8,
  },
});
