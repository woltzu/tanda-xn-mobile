import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type HelpCenterNavigationProp = StackNavigationProp<RootStackParamList>;

interface FAQCategory {
  id: string;
  icon: string;
  title: string;
  count: number;
}

interface Article {
  id: string;
  title: string;
  views: string;
}

export default function HelpCenterScreen() {
  const navigation = useNavigation<HelpCenterNavigationProp>();
  const [searchQuery, setSearchQuery] = useState("");

  const faqCategories: FAQCategory[] = [
    { id: "getting_started", icon: "rocket", title: "Getting Started", count: 8 },
    { id: "payments", icon: "card", title: "Payments & Deposits", count: 12 },
    { id: "circles", icon: "people", title: "Savings Circles", count: 15 },
    { id: "payouts", icon: "cash", title: "Payouts & Withdrawals", count: 10 },
    { id: "xnscore", icon: "trending-up", title: "XnScore & Credit", count: 6 },
    { id: "security", icon: "shield-checkmark", title: "Security & Privacy", count: 9 },
    { id: "cross_border", icon: "globe", title: "Sending Money Home", count: 11 },
  ];

  const popularArticles: Article[] = [
    { id: "a1", title: "How do savings circles work?", views: "2.4k" },
    { id: "a2", title: "When will I receive my payout?", views: "1.8k" },
    { id: "a3", title: "How is my XnScore calculated?", views: "1.5k" },
    { id: "a4", title: "What fees does TandaXn charge?", views: "1.2k" },
  ];

  const handleContactSupport = () => {
    // In a real app, this would open a chat or support ticket
    console.log("Open support chat");
  };

  const handleEmailSupport = () => {
    Linking.openURL("mailto:support@tandaxn.com");
  };

  const handleSelectArticle = (article: Article) => {
    console.log("Open article:", article.id);
  };

  const handleSelectCategory = (category: FAQCategory) => {
    console.log("Open category:", category.id);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={["#0A2342", "#143654"]}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Help Center</Text>
              <Text style={styles.headerSubtitle}>How can we help you?</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="rgba(255,255,255,0.7)"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for help..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionPrimary}
              onPress={handleContactSupport}
            >
              <View style={styles.quickActionIconPrimary}>
                <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionTitle}>Chat with Us</Text>
              <Text style={styles.quickActionSubtitle}>Get instant help</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionSecondary}
              onPress={handleEmailSupport}
            >
              <View style={styles.quickActionIconSecondary}>
                <Ionicons name="mail" size={20} color="#0A2342" />
              </View>
              <Text style={styles.quickActionTitle}>Email Us</Text>
              <Text style={styles.quickActionSubtitle}>
                support@tandaxn.com
              </Text>
            </TouchableOpacity>
          </View>

          {/* Popular Articles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular Articles</Text>
            <View style={styles.card}>
              {popularArticles.map((article, index) => (
                <TouchableOpacity
                  key={article.id}
                  style={[
                    styles.articleItem,
                    index < popularArticles.length - 1 && styles.borderBottom,
                  ]}
                  onPress={() => handleSelectArticle(article)}
                >
                  <Ionicons name="document-text" size={18} color="#00C6AE" />
                  <Text style={styles.articleTitle}>{article.title}</Text>
                  <Text style={styles.articleViews}>{article.views} views</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Browse by Topic */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Browse by Topic</Text>
            <View style={styles.categoriesGrid}>
              {faqCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryCard}
                  onPress={() => handleSelectCategory(category)}
                >
                  <View style={styles.categoryIcon}>
                    <Ionicons
                      name={category.icon as any}
                      size={24}
                      color="#0A2342"
                    />
                  </View>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                  <Text style={styles.categoryCount}>
                    {category.count} articles
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Contact Info */}
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactText}>
              Our support team is available 24/7 to help you with any questions.
            </Text>
            <View style={styles.contactMethods}>
              <View style={styles.contactMethod}>
                <Ionicons name="call" size={16} color="#00C6AE" />
                <Text style={styles.contactMethodText}>+1 (800) 555-0123</Text>
              </View>
              <View style={styles.contactMethod}>
                <Ionicons name="time" size={16} color="#00C6AE" />
                <Text style={styles.contactMethodText}>24/7 Support</Text>
              </View>
            </View>
          </View>
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
    paddingBottom: 30,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: "#FFFFFF",
  },
  content: {
    padding: 20,
    marginTop: -10,
    paddingBottom: 40,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  quickActionPrimary: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#00C6AE",
    alignItems: "center",
  },
  quickActionSecondary: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  quickActionIconPrimary: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  quickActionIconSecondary: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 11,
    color: "#6B7280",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  articleItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  articleTitle: {
    flex: 1,
    fontSize: 14,
    color: "#0A2342",
  },
  articleViews: {
    fontSize: 11,
    color: "#6B7280",
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 11,
    color: "#6B7280",
  },
  contactCard: {
    backgroundColor: "#0A2342",
    borderRadius: 14,
    padding: 20,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  contactText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 18,
    marginBottom: 16,
  },
  contactMethods: {
    flexDirection: "row",
    gap: 16,
  },
  contactMethod: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactMethodText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
