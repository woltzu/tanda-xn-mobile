import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useLoan, LOAN_PRODUCTS, LoanProduct, LoanType, ELIGIBILITY_TIERS } from "../context/AdvanceContext";
import { useXnScore } from "../context/XnScoreContext";

type LoanMarketplaceNavigationProp = StackNavigationProp<RootStackParamList>;

const TYPE_LABELS: Record<LoanType, { label: string; color: string; icon: string }> = {
  small: { label: "Quick", color: "#10B981", icon: "flash" },
  medium: { label: "Growth", color: "#3B82F6", icon: "trending-up" },
  mortgage: { label: "Major", color: "#8B5CF6", icon: "home" },
};

export default function LoanMarketplaceScreen() {
  const navigation = useNavigation<LoanMarketplaceNavigationProp>();
  const { getEligibility, getAvailableProducts, activeLoans, getTotalOutstanding } = useLoan();
  const { score } = useXnScore();

  // Mock SMC (in production, calculate from circle contributions)
  const mockSMC = 500;

  const eligibility = useMemo(() => {
    return getEligibility(score, mockSMC);
  }, [score, mockSMC]);

  const availableProducts = useMemo(() => {
    return getAvailableProducts(score);
  }, [score]);

  const totalOutstanding = getTotalOutstanding();

  // Group products by type
  const productsByType = useMemo(() => {
    const grouped: Record<LoanType, LoanProduct[]> = {
      small: [],
      medium: [],
      mortgage: [],
    };
    LOAN_PRODUCTS.forEach(p => {
      grouped[p.type].push(p);
    });
    return grouped;
  }, []);

  const isProductAvailable = (product: LoanProduct) => {
    return availableProducts.some(p => p.id === product.id);
  };

  const getProductFeeRate = (product: LoanProduct) => {
    const tier = eligibility.tier;
    if (tier === "locked" || tier === "preview") return null;
    return product.feeRates[tier as keyof typeof product.feeRates];
  };

  const handleProductPress = (product: LoanProduct) => {
    if (isProductAvailable(product)) {
      navigation.navigate("LoanApplication", { productId: product.id });
    } else {
      // Show requirements
      navigation.navigate("LoanProductDetails", { productId: product.id });
    }
  };

  const renderProductCard = (product: LoanProduct) => {
    const available = isProductAvailable(product);
    const feeRate = getProductFeeRate(product);
    const typeInfo = TYPE_LABELS[product.type];

    return (
      <TouchableOpacity
        key={product.id}
        style={[styles.productCard, !available && styles.productCardLocked]}
        onPress={() => handleProductPress(product)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.productHeader}>
          <View style={[styles.productIconCircle, { backgroundColor: available ? `${typeInfo.color}20` : "#F3F4F6" }]}>
            <Ionicons
              name={product.icon as any}
              size={24}
              color={available ? typeInfo.color : "#9CA3AF"}
            />
          </View>
          <View style={styles.productHeaderRight}>
            {!available && (
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={10} color="#6B7280" />
                <Text style={styles.lockedBadgeText}>
                  {product.minXnScore}+ XnScore
                </Text>
              </View>
            )}
            {available && feeRate !== null && (
              <View style={[styles.rateBadge, { backgroundColor: `${typeInfo.color}20` }]}>
                <Text style={[styles.rateBadgeText, { color: typeInfo.color }]}>
                  {feeRate}% fee
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <Text style={[styles.productName, !available && styles.productNameLocked]}>
          {product.name}
        </Text>
        <Text style={styles.productDescription}>
          {product.description}
        </Text>

        {/* Amount Range */}
        <View style={styles.amountRange}>
          <Text style={styles.amountRangeLabel}>
            ${product.minAmount.toLocaleString()} - ${product.maxAmount.toLocaleString()}
          </Text>
          <Text style={styles.termRange}>
            {product.minTermMonths === product.maxTermMonths
              ? `${product.minTermMonths} mo`
              : `${product.minTermMonths}-${product.maxTermMonths} mo`}
          </Text>
        </View>

        {/* Features Preview */}
        <View style={styles.featuresPreview}>
          {product.features.slice(0, 2).map((feature, idx) => (
            <View key={idx} style={styles.featureItem}>
              <Ionicons name="checkmark" size={12} color={available ? "#10B981" : "#9CA3AF"} />
              <Text style={[styles.featureText, !available && styles.featureTextLocked]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.productFooter}>
          <Text style={styles.processingTime}>
            <Ionicons name="time-outline" size={12} color="#6B7280" /> {product.processingTime}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={available ? typeInfo.color : "#D1D5DB"}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Loan Marketplace</Text>
            <TouchableOpacity
              style={styles.calculatorButton}
              onPress={() => navigation.navigate("LoanCalculator")}
            >
              <Ionicons name="calculator-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Eligibility Summary */}
          <View style={styles.eligibilitySummary}>
            <View style={styles.eligibilityLeft}>
              <View style={[styles.tierBadge, { backgroundColor: eligibility.tierInfo.color }]}>
                <Ionicons
                  name={eligibility.tierInfo.status === "active" ? "shield-checkmark" : "lock-closed"}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.tierBadgeText}>{eligibility.tierInfo.label}</Text>
              </View>
              <Text style={styles.eligibilityLabel}>
                {eligibility.canApply
                  ? `${availableProducts.length} products available`
                  : eligibility.tierInfo.description}
              </Text>
            </View>
            <View style={styles.eligibilityRight}>
              <Text style={styles.xnScoreValue}>{score}</Text>
              <Text style={styles.xnScoreLabel}>XnScore</Text>
            </View>
          </View>

          {/* Active Loans Summary */}
          {activeLoans.length > 0 && (
            <TouchableOpacity
              style={styles.activeLoansBar}
              onPress={() => navigation.navigate("LoanDashboard")}
            >
              <View style={styles.activeLoansLeft}>
                <Ionicons name="wallet" size={18} color="#F59E0B" />
                <Text style={styles.activeLoansText}>
                  {activeLoans.length} active loan{activeLoans.length > 1 ? "s" : ""}
                </Text>
              </View>
              <View style={styles.activeLoansRight}>
                <Text style={styles.activeLoansAmount}>
                  ${totalOutstanding.toLocaleString()} remaining
                </Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
              </View>
            </TouchableOpacity>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {/* Quick Advance Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="flash" size={18} color="#10B981" />
              </View>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>Quick Advances</Text>
                <Text style={styles.sectionSubtitle}>Instant cash against your circle payouts</Text>
              </View>
            </View>
            {productsByType.small.map(renderProductCard)}
          </View>

          {/* Growth Loans Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="trending-up" size={18} color="#3B82F6" />
              </View>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>Growth Loans</Text>
                <Text style={styles.sectionSubtitle}>Finance your education, business & more</Text>
              </View>
            </View>
            {productsByType.medium.map(renderProductCard)}
          </View>

          {/* Major Purchases Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="home" size={18} color="#8B5CF6" />
              </View>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>Major Purchases</Text>
                <Text style={styles.sectionSubtitle}>Home loans & large financing</Text>
              </View>
            </View>
            {productsByType.mortgage.map(renderProductCard)}
          </View>

          {/* How It Works */}
          <TouchableOpacity
            style={styles.howItWorksCard}
            onPress={() => navigation.navigate("AdvanceExplanation")}
          >
            <View style={styles.howItWorksLeft}>
              <Ionicons name="help-circle" size={24} color="#00C6AE" />
              <View style={styles.howItWorksContent}>
                <Text style={styles.howItWorksTitle}>How TandaXn Loans Work</Text>
                <Text style={styles.howItWorksSubtitle}>
                  Learn about eligibility, fees & repayment
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#00C6AE" />
          </TouchableOpacity>

          {/* Unlock More Products */}
          {!eligibility.canApply && (
            <View style={styles.unlockCard}>
              <LinearGradient
                colors={["#0A2342", "#143654"]}
                style={styles.unlockGradient}
              >
                <View style={styles.unlockContent}>
                  <Ionicons name="lock-open-outline" size={32} color="#00C6AE" />
                  <Text style={styles.unlockTitle}>Unlock More Loan Options</Text>
                  <Text style={styles.unlockText}>
                    Build your XnScore to {eligibility.tier === "locked" ? 45 : 60}+ to access
                    {eligibility.tier === "locked" ? " Quick Advances" : " Growth Loans"}
                  </Text>
                  <View style={styles.unlockProgressContainer}>
                    <View style={styles.unlockProgressBar}>
                      <View
                        style={[
                          styles.unlockProgressFill,
                          {
                            width: `${Math.min(
                              (score / (eligibility.tier === "locked" ? 45 : 60)) * 100,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.unlockProgressText}>
                      {score} / {eligibility.tier === "locked" ? 45 : 60}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unlockButton}
                    onPress={() => navigation.navigate("XnScoreDashboard")}
                  >
                    <Text style={styles.unlockButtonText}>View XnScore Tips</Text>
                    <Ionicons name="arrow-forward" size={16} color="#0A2342" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}
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
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  calculatorButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  eligibilitySummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 14,
  },
  eligibilityLeft: {
    flex: 1,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  eligibilityLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  eligibilityRight: {
    alignItems: "flex-end",
  },
  xnScoreValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  xnScoreLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  activeLoansBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245,158,11,0.2)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  activeLoansLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeLoansText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F59E0B",
  },
  activeLoansRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeLoansAmount: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productCardLocked: {
    backgroundColor: "#FAFAFA",
    borderColor: "#E5E7EB",
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  productIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  productHeaderRight: {
    alignItems: "flex-end",
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  rateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  rateBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  productNameLocked: {
    color: "#6B7280",
  },
  productDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 12,
  },
  amountRange: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  amountRangeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  termRange: {
    fontSize: 12,
    color: "#6B7280",
  },
  featuresPreview: {
    marginBottom: 12,
    gap: 6,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: "#4B5563",
  },
  featureTextLocked: {
    color: "#9CA3AF",
  },
  productFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  processingTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  howItWorksCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.2)",
    marginBottom: 20,
  },
  howItWorksLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  howItWorksContent: {},
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  howItWorksSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  unlockCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  unlockGradient: {
    padding: 20,
  },
  unlockContent: {
    alignItems: "center",
  },
  unlockTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 12,
    marginBottom: 8,
  },
  unlockText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  unlockProgressContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  unlockProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  unlockProgressFill: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  unlockProgressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  unlockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  unlockButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
});
